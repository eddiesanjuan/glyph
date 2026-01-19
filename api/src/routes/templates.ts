/**
 * Templates Routes
 * AI-powered template generation from Airtable schema
 *
 * POST /v1/templates/generate - Generate template from description + schema
 * POST /v1/templates/refine - Refine existing template with natural language
 * POST /v1/templates/preview - Render template with sample data
 */

import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import Mustache from "mustache";
import {
  AirtableService,
  isValidAirtableKeyFormat,
} from "../services/airtable.js";
import {
  generateTemplateFromSchema,
  refineTemplate,
  type AirtableAISchema,
} from "../services/ai.js";
import type { ApiError } from "../lib/types.js";

const templates = new Hono();

// =============================================================================
// Request Schemas
// =============================================================================

const generateSchema = z.object({
  // Airtable connection info
  airtable: z.object({
    apiKey: z.string().min(1, "Airtable API key is required"),
    baseId: z.string().min(1, "Base ID is required"),
    tableId: z.string().min(1, "Table ID is required"),
  }),
  // User's natural language description
  description: z.string().min(10, "Please provide a more detailed description"),
  // Optional style preset
  style: z
    .enum(["modern", "classic", "vibrant", "minimal", "invoice", "report"])
    .optional(),
  // Include sample data for preview
  includeSample: z.boolean().optional().default(true),
});

const refineSchema = z.object({
  // Current template HTML
  html: z.string().min(1, "Template HTML is required"),
  // Airtable connection for schema context
  airtable: z.object({
    apiKey: z.string().min(1, "Airtable API key is required"),
    baseId: z.string().min(1, "Base ID is required"),
    tableId: z.string().min(1, "Table ID is required"),
  }),
  // User's modification request
  instruction: z.string().min(1, "Please describe what you want to change"),
});

const previewSchema = z.object({
  // Template HTML with Mustache placeholders
  html: z.string().min(1, "Template HTML is required"),
  // Data to render (typically from Airtable)
  data: z.record(z.unknown()),
});

// =============================================================================
// Routes
// =============================================================================

/**
 * POST /generate
 * Generate a new template from Airtable schema + natural language description
 *
 * This is the KILLER FEATURE - user describes what they want, we create it.
 */
templates.post(
  "/generate",
  zValidator("json", generateSchema, (result, c) => {
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
      const { airtable, description, style, includeSample } =
        c.req.valid("json");

      // Validate Airtable key format
      if (!isValidAirtableKeyFormat(airtable.apiKey)) {
        const error: ApiError = {
          error:
            "Invalid Airtable API key format. Keys should start with 'pat' or 'key'.",
          code: "INVALID_KEY_FORMAT",
        };
        return c.json(error, 400);
      }

      // Create Airtable service
      const airtableService = new AirtableService(airtable.apiKey);

      // Get table schema
      const table = await airtableService.getTableSchema(
        airtable.baseId,
        airtable.tableId
      );

      if (!table) {
        const error: ApiError = {
          error: `Table '${airtable.tableId}' not found in base.`,
          code: "TABLE_NOT_FOUND",
        };
        return c.json(error, 404);
      }

      // Format schema for AI
      const aiSchema = airtableService.formatSchemaForAI(table);

      // Get sample data if requested
      let sampleData: Record<string, unknown> | undefined;
      let sampleRecord: unknown | undefined;

      if (includeSample) {
        try {
          const records = await airtableService.getSampleRecords(
            airtable.baseId,
            airtable.tableId
          );
          if (records.length > 0) {
            sampleRecord = airtableService.formatRecordForTemplate(
              records[0],
              table
            );
            sampleData = sampleRecord as Record<string, unknown>;
          }
        } catch (err) {
          console.warn("Could not fetch sample data:", err);
          // Continue without sample data
        }
      }

      // Generate template with AI
      const result = await generateTemplateFromSchema(aiSchema, description, {
        style,
        sampleData,
      });

      // Render preview if we have sample data
      let preview: string | undefined;
      if (sampleData) {
        try {
          preview = Mustache.render(result.fullHtml, sampleData);
        } catch (err) {
          console.warn("Could not render preview:", err);
        }
      }

      return c.json({
        success: true,
        template: {
          html: result.fullHtml,
          css: result.css,
          bodyHtml: result.html,
          fieldsUsed: result.fields,
        },
        preview: preview || null,
        sampleData: sampleData || null,
        schema: {
          tableName: aiSchema.tableName,
          fieldCount: aiSchema.fields.length,
          fields: aiSchema.fields.map((f) => ({
            name: f.name,
            type: f.type,
            mustachePath: f.mustachePath,
          })),
        },
        usage: {
          tokensUsed: result.tokensUsed,
        },
      });
    } catch (err) {
      console.error("Template generation error:", err);
      const error: ApiError = {
        error: err instanceof Error ? err.message : "Unknown error",
        code: "GENERATION_ERROR",
      };
      return c.json(error, 500);
    }
  }
);

/**
 * POST /refine
 * Modify an existing template based on natural language instruction
 */
templates.post(
  "/refine",
  zValidator("json", refineSchema, (result, c) => {
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
      const { html, airtable, instruction } = c.req.valid("json");

      // Validate Airtable key format
      if (!isValidAirtableKeyFormat(airtable.apiKey)) {
        const error: ApiError = {
          error:
            "Invalid Airtable API key format. Keys should start with 'pat' or 'key'.",
          code: "INVALID_KEY_FORMAT",
        };
        return c.json(error, 400);
      }

      // Create Airtable service and get schema
      const airtableService = new AirtableService(airtable.apiKey);
      const table = await airtableService.getTableSchema(
        airtable.baseId,
        airtable.tableId
      );

      if (!table) {
        const error: ApiError = {
          error: `Table '${airtable.tableId}' not found in base.`,
          code: "TABLE_NOT_FOUND",
        };
        return c.json(error, 404);
      }

      // Format schema for AI
      const aiSchema: AirtableAISchema = airtableService.formatSchemaForAI(table);

      // Refine template with AI
      const result = await refineTemplate(html, aiSchema, instruction);

      // Get sample data for preview
      let preview: string | undefined;
      try {
        const records = await airtableService.getSampleRecords(
          airtable.baseId,
          airtable.tableId
        );
        if (records.length > 0) {
          const sampleData = airtableService.formatRecordForTemplate(
            records[0],
            table
          );
          preview = Mustache.render(result.fullHtml, sampleData);
        }
      } catch (err) {
        console.warn("Could not render preview:", err);
      }

      return c.json({
        success: true,
        template: {
          html: result.fullHtml,
          css: result.css,
          bodyHtml: result.html,
          fieldsUsed: result.fields,
        },
        preview: preview || null,
        usage: {
          tokensUsed: result.tokensUsed,
        },
      });
    } catch (err) {
      console.error("Template refinement error:", err);
      const error: ApiError = {
        error: err instanceof Error ? err.message : "Unknown error",
        code: "REFINEMENT_ERROR",
      };
      return c.json(error, 500);
    }
  }
);

/**
 * POST /preview
 * Render a template with provided data (no AI involved)
 */
templates.post(
  "/preview",
  zValidator("json", previewSchema, (result, c) => {
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
      const { html, data } = c.req.valid("json");

      // Render template with Mustache
      const rendered = Mustache.render(html, data);

      return c.json({
        success: true,
        html: rendered,
      });
    } catch (err) {
      console.error("Template preview error:", err);
      const error: ApiError = {
        error: err instanceof Error ? err.message : "Template rendering failed",
        code: "PREVIEW_ERROR",
      };
      return c.json(error, 500);
    }
  }
);

/**
 * GET /styles
 * List available style presets
 */
templates.get("/styles", (c) => {
  return c.json({
    styles: [
      {
        id: "modern",
        name: "Modern",
        description:
          "Clean, minimal design with lots of whitespace. Sans-serif fonts, subtle borders.",
      },
      {
        id: "classic",
        name: "Classic",
        description:
          "Traditional business style. Serif headings, formal and authoritative.",
      },
      {
        id: "vibrant",
        name: "Vibrant",
        description:
          "Bold, colorful design with gradient accents. Eye-catching but professional.",
      },
      {
        id: "minimal",
        name: "Minimal",
        description:
          "Ultra-minimal with maximum whitespace. Typography-focused.",
      },
      {
        id: "invoice",
        name: "Invoice",
        description:
          "Structured layout for invoices/quotes. Line items table, totals section.",
      },
      {
        id: "report",
        name: "Report",
        description:
          "Professional report layout. Good for data summaries and overviews.",
      },
    ],
  });
});

export default templates;
