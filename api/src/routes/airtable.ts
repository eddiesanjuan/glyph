/**
 * Airtable Routes
 * API endpoints for Airtable integration
 *
 * POST /v1/airtable/connect - Validate API key and return bases
 * GET  /v1/airtable/bases/:baseId/tables - List tables in a base
 * GET  /v1/airtable/bases/:baseId/tables/:tableId/schema - Get field schema
 * GET  /v1/airtable/bases/:baseId/tables/:tableId/records - Get sample records
 */

import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import {
  AirtableService,
  isValidAirtableKeyFormat,
  type AirtableBase,
  type AirtableTable,
  type AirtableRecord,
} from "../services/airtable.js";
import type { ApiError } from "../lib/types.js";

const airtable = new Hono();

// =============================================================================
// Request Schemas
// =============================================================================

const connectSchema = z.object({
  apiKey: z.string().min(1, "API key is required"),
});

const listRecordsSchema = z.object({
  maxRecords: z.coerce.number().min(1).max(100).optional().default(5),
  view: z.string().optional(),
});

// =============================================================================
// Helper: Extract Airtable API Key from Request
// =============================================================================

function getAirtableKey(c: { req: { header: (name: string) => string | undefined } }): string | null {
  // Check for X-Airtable-Key header first
  const headerKey = c.req.header("X-Airtable-Key");
  if (headerKey) return headerKey;

  return null;
}

// =============================================================================
// Routes
// =============================================================================

/**
 * POST /connect
 * Validate Airtable API key and return list of accessible bases
 */
airtable.post(
  "/connect",
  zValidator("json", connectSchema, (result, c) => {
    if (!result.success) {
      const error: ApiError = {
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: result.error.issues,
      };
      return c.json(error, 400);
    }
    return;
  }),
  async (c) => {
    try {
      const { apiKey } = c.req.valid("json");

      // Validate key format
      if (!isValidAirtableKeyFormat(apiKey)) {
        const error: ApiError = {
          error: "Invalid Airtable API key format. Keys should start with 'pat' (personal access token) or 'key' (legacy).",
          code: "INVALID_KEY_FORMAT",
        };
        return c.json(error, 400);
      }

      // Create service and validate by listing bases
      const service = new AirtableService(apiKey);

      let bases: AirtableBase[];
      try {
        bases = await service.listBases();
      } catch (err) {
        const error: ApiError = {
          error: "Failed to connect to Airtable. Please check your API key.",
          code: "AIRTABLE_AUTH_ERROR",
          details: err instanceof Error ? err.message : undefined,
        };
        return c.json(error, 401);
      }

      return c.json({
        success: true,
        bases: bases.map((base) => ({
          id: base.id,
          name: base.name,
          permissionLevel: base.permissionLevel,
        })),
        message: `Connected successfully. Found ${bases.length} accessible base(s).`,
      });
    } catch (err) {
      console.error("Airtable connect error:", err);
      const error: ApiError = {
        error: err instanceof Error ? err.message : "Unknown error",
        code: "CONNECT_ERROR",
      };
      return c.json(error, 500);
    }
  }
);

/**
 * GET /bases/:baseId/tables
 * List all tables in a base with their field schemas
 */
airtable.get("/bases/:baseId/tables", async (c) => {
  try {
    const { baseId } = c.req.param();
    const apiKey = getAirtableKey(c);

    if (!apiKey) {
      const error: ApiError = {
        error: "Airtable API key required. Include X-Airtable-Key header.",
        code: "MISSING_AIRTABLE_KEY",
      };
      return c.json(error, 400);
    }

    const service = new AirtableService(apiKey);

    let tables: AirtableTable[];
    try {
      tables = await service.getBaseSchema(baseId);
    } catch (err) {
      const error: ApiError = {
        error: "Failed to fetch tables. Check your API key and base ID.",
        code: "AIRTABLE_ERROR",
        details: err instanceof Error ? err.message : undefined,
      };
      return c.json(error, 400);
    }

    return c.json({
      baseId,
      tables: tables.map((table) => ({
        id: table.id,
        name: table.name,
        description: table.description,
        primaryFieldId: table.primaryFieldId,
        fieldCount: table.fields.length,
        viewCount: table.views.length,
      })),
    });
  } catch (err) {
    console.error("List tables error:", err);
    const error: ApiError = {
      error: err instanceof Error ? err.message : "Unknown error",
      code: "TABLES_ERROR",
    };
    return c.json(error, 500);
  }
});

/**
 * GET /bases/:baseId/tables/:tableId/schema
 * Get detailed field schema for a table
 */
airtable.get("/bases/:baseId/tables/:tableId/schema", async (c) => {
  try {
    const { baseId, tableId } = c.req.param();
    const apiKey = getAirtableKey(c);

    if (!apiKey) {
      const error: ApiError = {
        error: "Airtable API key required. Include X-Airtable-Key header.",
        code: "MISSING_AIRTABLE_KEY",
      };
      return c.json(error, 400);
    }

    const service = new AirtableService(apiKey);

    const table = await service.getTableSchema(baseId, tableId);

    if (!table) {
      const error: ApiError = {
        error: `Table '${tableId}' not found in base.`,
        code: "TABLE_NOT_FOUND",
      };
      return c.json(error, 404);
    }

    // Format schema for AI/template use
    const aiSchema = service.formatSchemaForAI(table);

    return c.json({
      baseId,
      table: {
        id: table.id,
        name: table.name,
        description: table.description,
        primaryFieldId: table.primaryFieldId,
      },
      fields: table.fields.map((field) => ({
        id: field.id,
        name: field.name,
        type: field.type,
        description: field.description,
        options: field.options,
      })),
      views: table.views.map((view) => ({
        id: view.id,
        name: view.name,
        type: view.type,
      })),
      // AI-optimized schema for template generation
      aiSchema,
    });
  } catch (err) {
    console.error("Get schema error:", err);
    const error: ApiError = {
      error: err instanceof Error ? err.message : "Unknown error",
      code: "SCHEMA_ERROR",
    };
    return c.json(error, 500);
  }
});

/**
 * GET /bases/:baseId/tables/:tableId/records
 * Get sample records for preview
 */
airtable.get(
  "/bases/:baseId/tables/:tableId/records",
  zValidator("query", listRecordsSchema),
  async (c) => {
    try {
      const { baseId, tableId } = c.req.param();
      const { maxRecords, view } = c.req.valid("query");
      const apiKey = getAirtableKey(c);

      if (!apiKey) {
        const error: ApiError = {
          error: "Airtable API key required. Include X-Airtable-Key header.",
          code: "MISSING_AIRTABLE_KEY",
        };
        return c.json(error, 400);
      }

      const service = new AirtableService(apiKey);

      // Get table schema for formatting
      const table = await service.getTableSchema(baseId, tableId);

      if (!table) {
        const error: ApiError = {
          error: `Table '${tableId}' not found in base.`,
          code: "TABLE_NOT_FOUND",
        };
        return c.json(error, 404);
      }

      // Get records
      let records: AirtableRecord[];
      try {
        records = await service.listRecords(baseId, tableId, {
          maxRecords,
          view,
        });
      } catch (err) {
        const error: ApiError = {
          error: "Failed to fetch records.",
          code: "RECORDS_ERROR",
          details: err instanceof Error ? err.message : undefined,
        };
        return c.json(error, 400);
      }

      // Format records for template use
      const formattedRecords = records.map((record) =>
        service.formatRecordForTemplate(record, table)
      );

      return c.json({
        baseId,
        tableId: table.id,
        tableName: table.name,
        recordCount: records.length,
        records: formattedRecords,
        // Include raw records too for debugging
        rawRecords: records,
      });
    } catch (err) {
      console.error("Get records error:", err);
      const error: ApiError = {
        error: err instanceof Error ? err.message : "Unknown error",
        code: "RECORDS_ERROR",
      };
      return c.json(error, 500);
    }
  }
);

/**
 * GET /bases/:baseId/tables/:tableId/records/:recordId
 * Get a single record by ID
 */
airtable.get("/bases/:baseId/tables/:tableId/records/:recordId", async (c) => {
  try {
    const { baseId, tableId, recordId } = c.req.param();
    const apiKey = getAirtableKey(c);

    if (!apiKey) {
      const error: ApiError = {
        error: "Airtable API key required. Include X-Airtable-Key header.",
        code: "MISSING_AIRTABLE_KEY",
      };
      return c.json(error, 400);
    }

    const service = new AirtableService(apiKey);

    // Get table schema for formatting
    const table = await service.getTableSchema(baseId, tableId);

    if (!table) {
      const error: ApiError = {
        error: `Table '${tableId}' not found in base.`,
        code: "TABLE_NOT_FOUND",
      };
      return c.json(error, 404);
    }

    // Get record
    let record: AirtableRecord;
    try {
      record = await service.getRecord(baseId, tableId, recordId);
    } catch (err) {
      const error: ApiError = {
        error: "Failed to fetch record.",
        code: "RECORD_ERROR",
        details: err instanceof Error ? err.message : undefined,
      };
      return c.json(error, 400);
    }

    // Format record for template use
    const formattedRecord = service.formatRecordForTemplate(record, table);

    return c.json({
      baseId,
      tableId: table.id,
      tableName: table.name,
      record: formattedRecord,
      rawRecord: record,
    });
  } catch (err) {
    console.error("Get record error:", err);
    const error: ApiError = {
      error: err instanceof Error ? err.message : "Unknown error",
      code: "RECORD_ERROR",
    };
    return c.json(error, 500);
  }
});

export default airtable;
