/**
 * AI Assist Routes
 * AI-powered assistance for mappings, schema inference, and template matching
 *
 * POST /v1/ai/suggest-mappings - AI suggests field mappings
 * POST /v1/ai/infer-schema     - Infer schema from sample data
 * POST /v1/ai/match-template   - Find best template for data
 */

import { Hono } from "hono";
import { z } from "zod";
import { supabase } from "../lib/supabase.js";
import {
  suggestMappings,
  inferSchema,
  matchTemplates,
  extractTemplateFields,
} from "../services/aiAssistant.js";
import type { DiscoveredSchema, DataSource } from "../types/data-sources.js";
import { createConnector } from "../services/connectors/index.js";

const aiAssist = new Hono();

// =============================================================================
// Constants
// =============================================================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// =============================================================================
// Request Schemas
// =============================================================================

const suggestMappingsSchema = z.object({
  templateId: z.string().regex(UUID_REGEX, "Invalid template ID format"),
  sourceId: z.string().regex(UUID_REGEX, "Invalid source ID format"),
});

const inferSchemaSchema = z.object({
  sampleData: z.record(z.unknown()).refine(
    (data) => Object.keys(data).length > 0,
    "Sample data cannot be empty"
  ),
  documentType: z.string().optional(),
});

const matchTemplateSchema = z.object({
  sourceId: z.string().regex(UUID_REGEX, "Invalid source ID format"),
  recordId: z.string().optional(),
});

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if user has database access
 */
function requireDatabaseAccess(c: { get: (key: string) => unknown }): string {
  const apiKeyId = c.get("apiKeyId") as string | undefined;

  if (!apiKeyId) {
    throw new Error("DEMO_TIER");
  }

  if (!supabase) {
    throw new Error("DATABASE_NOT_CONFIGURED");
  }

  return apiKeyId;
}

// =============================================================================
// Routes
// =============================================================================

/**
 * POST /suggest-mappings - AI suggests field mappings
 *
 * Uses AI to analyze a template's required fields and a data source's schema
 * to suggest intelligent field mappings with confidence scores.
 */
aiAssist.post("/suggest-mappings", async (c) => {
  try {
    const apiKeyId = requireDatabaseAccess(c);

    // Parse and validate request
    const body = await c.req.json();
    const validation = suggestMappingsSchema.safeParse(body);

    if (!validation.success) {
      return c.json(
        {
          success: false,
          error: "Validation error",
          details: validation.error.errors,
        },
        400
      );
    }

    const { templateId, sourceId } = validation.data;

    // Fetch template
    const { data: template, error: templateError } = await supabase!
      .from("templates")
      .select("id, name, html_template, required_fields")
      .eq("id", templateId)
      .eq("api_key_id", apiKeyId)
      .is("deleted_at", null)
      .single();

    if (templateError || !template) {
      return c.json(
        {
          success: false,
          error: "Template not found",
          code: "TEMPLATE_NOT_FOUND",
        },
        404
      );
    }

    // Fetch data source
    const { data: source, error: sourceError } = await supabase!
      .from("data_sources")
      .select("id, name, source_type, config, discovered_schema")
      .eq("id", sourceId)
      .eq("api_key_id", apiKeyId)
      .is("deleted_at", null)
      .single();

    if (sourceError || !source) {
      return c.json(
        {
          success: false,
          error: "Data source not found",
          code: "SOURCE_NOT_FOUND",
        },
        404
      );
    }

    // Get template fields - prefer required_fields if available, otherwise extract from HTML
    let templateFields: string[] = [];
    if (template.required_fields && Array.isArray(template.required_fields)) {
      templateFields = template.required_fields;
    } else if (template.html_template) {
      templateFields = extractTemplateFields(template.html_template);
    }

    // Get source schema
    const sourceSchema = source.discovered_schema as DiscoveredSchema | null;
    if (!sourceSchema || !sourceSchema.fields || sourceSchema.fields.length === 0) {
      return c.json(
        {
          success: false,
          error: "Data source has no discovered schema. Please sync the source first.",
          code: "NO_SCHEMA",
        },
        400
      );
    }

    // Use AI to suggest mappings
    console.log(`[AI Assist] Suggesting mappings for ${templateFields.length} template fields and ${sourceSchema.fields.length} source fields`);
    const result = await suggestMappings(templateFields, sourceSchema);

    return c.json({
      success: true,
      suggestions: result.suggestions,
      unmapped: result.unmapped,
      coverage: result.coverage,
      template: {
        id: template.id,
        name: template.name,
        fieldCount: templateFields.length,
      },
      source: {
        id: source.id,
        name: source.name,
        fieldCount: sourceSchema.fields.length,
      },
    });
  } catch (error) {
    console.error("[AI Assist] Error in suggest-mappings:", error);

    if (error instanceof Error) {
      if (error.message === "DEMO_TIER") {
        return c.json(
          {
            success: false,
            error: "AI assistance requires a production API key",
            code: "DEMO_TIER_NOT_SUPPORTED",
          },
          403
        );
      }
      if (error.message === "DATABASE_NOT_CONFIGURED") {
        return c.json(
          {
            success: false,
            error: "Database not configured",
            code: "DATABASE_NOT_CONFIGURED",
          },
          503
        );
      }
    }

    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to suggest mappings",
        code: "AI_ERROR",
      },
      500
    );
  }
});

/**
 * POST /infer-schema - Infer schema from sample data
 *
 * Uses AI to analyze sample data and infer:
 * - Field names, paths, and types
 * - Document type (invoice, quote, etc.)
 * - Required vs optional fields
 */
aiAssist.post("/infer-schema", async (c) => {
  try {
    // This endpoint can work without database access for simple schema inference
    // API key validated by auth middleware, but not required for schema inference

    // Parse and validate request
    const body = await c.req.json();
    const validation = inferSchemaSchema.safeParse(body);

    if (!validation.success) {
      return c.json(
        {
          success: false,
          error: "Validation error",
          details: validation.error.errors,
        },
        400
      );
    }

    const { sampleData, documentType } = validation.data;

    console.log(`[AI Assist] Inferring schema from sample data with ${Object.keys(sampleData).length} top-level fields`);

    // Use AI to infer schema
    const result = await inferSchema(sampleData, documentType);

    return c.json({
      success: true,
      schema: result.schema,
      detectedType: result.detectedType,
      confidence: result.confidence,
    });
  } catch (error) {
    console.error("[AI Assist] Error in infer-schema:", error);

    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to infer schema",
        code: "AI_ERROR",
      },
      500
    );
  }
});

/**
 * POST /match-template - Find best template for data
 *
 * Uses AI to analyze source data and find the best matching templates
 * based on field coverage, document type, and data compatibility.
 */
aiAssist.post("/match-template", async (c) => {
  try {
    const apiKeyId = requireDatabaseAccess(c);

    // Parse and validate request
    const body = await c.req.json();
    const validation = matchTemplateSchema.safeParse(body);

    if (!validation.success) {
      return c.json(
        {
          success: false,
          error: "Validation error",
          details: validation.error.errors,
        },
        400
      );
    }

    const { sourceId, recordId: _recordId } = validation.data;
    // Note: recordId is reserved for future use to fetch a specific record

    // Fetch data source
    const { data: source, error: sourceError } = await supabase!
      .from("data_sources")
      .select("id, name, source_type, config, discovered_schema")
      .eq("id", sourceId)
      .eq("api_key_id", apiKeyId)
      .is("deleted_at", null)
      .single();

    if (sourceError || !source) {
      return c.json(
        {
          success: false,
          error: "Data source not found",
          code: "SOURCE_NOT_FOUND",
        },
        404
      );
    }

    // Get source schema
    const sourceSchema = source.discovered_schema as DiscoveredSchema | null;
    if (!sourceSchema || !sourceSchema.fields || sourceSchema.fields.length === 0) {
      return c.json(
        {
          success: false,
          error: "Data source has no discovered schema. Please sync the source first.",
          code: "NO_SCHEMA",
        },
        400
      );
    }

    // Get sample record - either from sample_records in schema or fetch from source
    let sampleRecord: Record<string, unknown> | null = null;

    if (sourceSchema.sample_records && sourceSchema.sample_records.length > 0) {
      // Use first sample record from schema
      sampleRecord = sourceSchema.sample_records[0];
    } else {
      // Try to fetch records from the source
      try {
        // Construct a minimal DataSource object for the connector
        const dataSource: DataSource = {
          id: source.id,
          api_key_id: apiKeyId,
          name: source.name,
          source_type: source.source_type,
          config: source.config,
          status: "active",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        const connector = createConnector(dataSource);
        const records = await connector.fetchRecords({ limit: 1 });
        if (records.length > 0) {
          // Convert SourceRecord to Record<string, unknown>
          // SourceRecord has { id, fields, createdTime? } structure
          const sourceRecord = records[0];
          sampleRecord = {
            id: sourceRecord.id,
            ...sourceRecord.fields,
            createdTime: sourceRecord.createdTime,
          };
        }
      } catch (fetchError) {
        console.warn("[AI Assist] Could not fetch sample record:", fetchError);
      }
    }

    if (!sampleRecord) {
      return c.json(
        {
          success: false,
          error: "No sample data available. Please sync the source first.",
          code: "NO_SAMPLE_DATA",
        },
        400
      );
    }

    // Fetch user's templates
    const { data: templates, error: templatesError } = await supabase!
      .from("templates")
      .select("id, name, type, description, required_fields")
      .eq("api_key_id", apiKeyId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(20);

    if (templatesError) {
      console.error("[AI Assist] Error fetching templates:", templatesError);
      return c.json(
        {
          success: false,
          error: "Failed to fetch templates",
          code: "DATABASE_ERROR",
        },
        500
      );
    }

    if (!templates || templates.length === 0) {
      return c.json({
        success: true,
        matches: [],
        message: "No templates found. Create some templates first.",
      });
    }

    // Format templates for AI matching
    const templateData = templates.map((t) => ({
      id: t.id,
      name: t.name,
      type: t.type || "custom",
      required_fields: t.required_fields || [],
      description: t.description,
    }));

    console.log(`[AI Assist] Matching ${templates.length} templates against source with ${sourceSchema.fields.length} fields`);

    // Use AI to find matches
    const matches = await matchTemplates(sourceSchema, sampleRecord, templateData);

    return c.json({
      success: true,
      matches,
      source: {
        id: source.id,
        name: source.name,
        fieldCount: sourceSchema.fields.length,
      },
      templatesAnalyzed: templates.length,
    });
  } catch (error) {
    console.error("[AI Assist] Error in match-template:", error);

    if (error instanceof Error) {
      if (error.message === "DEMO_TIER") {
        return c.json(
          {
            success: false,
            error: "AI assistance requires a production API key",
            code: "DEMO_TIER_NOT_SUPPORTED",
          },
          403
        );
      }
      if (error.message === "DATABASE_NOT_CONFIGURED") {
        return c.json(
          {
            success: false,
            error: "Database not configured",
            code: "DATABASE_NOT_CONFIGURED",
          },
          503
        );
      }
    }

    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to match templates",
        code: "AI_ERROR",
      },
      500
    );
  }
});

export default aiAssist;
