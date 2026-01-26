/**
 * Mappings Routes
 * Template-source field mappings CRUD and preview
 *
 * POST   /v1/mappings           - Create template-source mapping
 * GET    /v1/mappings           - List mappings (optional filter by template/source)
 * GET    /v1/mappings/:id       - Get mapping details
 * PUT    /v1/mappings/:id       - Update mapping
 * DELETE /v1/mappings/:id       - Delete mapping (hard delete)
 * GET    /v1/mappings/:id/preview - Preview template with source data
 */

import { Hono } from "hono";
import { z } from "zod";
import Mustache from "mustache";
import { getSupabase, supabase } from "../lib/supabase.js";
import type { ApiError } from "../lib/types.js";
import type {
  DataSource,
  FieldMappings,
  Transformations,
  DiscoveredSchema,
} from "../types/data-sources.js";
import { createConnector } from "../services/connectors/index.js";
import { applyMappings, validateMappings } from "../services/fieldMapper.js";

const mappings = new Hono();

// =============================================================================
// Constants
// =============================================================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// =============================================================================
// Zod Validation Schemas
// =============================================================================

const transformationSchema = z.object({
  type: z.enum(["currency", "date", "text", "number", "boolean"]),
  locale: z.string().optional(),
  currency: z.string().optional(),
  format: z.string().optional(),
  transform: z.enum(["uppercase", "lowercase", "capitalize", "trim"]).optional(),
  decimals: z.number().int().min(0).max(10).optional(),
  true_value: z.string().optional(),
  false_value: z.string().optional(),
});

const createMappingSchema = z.object({
  template_id: z.string().uuid("Invalid template ID format"),
  source_id: z.string().uuid("Invalid source ID format"),
  field_mappings: z.record(z.string(), z.string()).refine(
    (val) => Object.keys(val).length > 0,
    { message: "At least one field mapping is required" }
  ),
  transformations: z.record(z.string(), transformationSchema).optional(),
  is_default: z.boolean().optional().default(false),
});

const updateMappingSchema = z.object({
  field_mappings: z.record(z.string(), z.string()).optional(),
  transformations: z.record(z.string(), transformationSchema).optional(),
  is_default: z.boolean().optional(),
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

/**
 * Handle common errors
 */
function handleError(
  c: { json: (data: unknown, status: number) => Response },
  err: unknown
): Response {
  if (err instanceof Error) {
    if (err.message === "DEMO_TIER") {
      const error: ApiError = {
        error: "Mappings require a registered API key. Please sign up to use mappings.",
        code: "DEMO_TIER_LIMITATION",
      };
      return c.json(error, 403);
    }
    if (err.message === "DATABASE_NOT_CONFIGURED") {
      const error: ApiError = {
        error: "Database is not configured",
        code: "DATABASE_NOT_CONFIGURED",
      };
      return c.json(error, 503);
    }
  }

  console.error("Mapping operation error:", err);
  const error: ApiError = {
    error: err instanceof Error ? err.message : "Unknown error",
    code: "MAPPING_ERROR",
  };
  return c.json(error, 500);
}

/**
 * Format mapping for API response
 */
function formatMappingResponse(
  mapping: DbMapping,
  template?: DbTemplate | null,
  source?: DbSource | null
): Record<string, unknown> {
  const response: Record<string, unknown> = {
    id: mapping.id,
    template_id: mapping.template_id,
    source_id: mapping.source_id,
    field_mappings: mapping.field_mappings,
    transformations: mapping.transformations,
    is_default: mapping.is_default,
    validation_status: mapping.validation_status,
    validation_message: mapping.validation_message,
    last_validated_at: mapping.last_validated_at,
    created_at: mapping.created_at,
    updated_at: mapping.updated_at,
  };

  // Include template summary if available
  if (template) {
    response.template = {
      id: template.id,
      name: template.name,
      type: template.type,
    };
  }

  // Include source summary if available
  if (source) {
    response.source = {
      id: source.id,
      name: source.name,
      source_type: source.source_type,
      status: source.status,
    };
  }

  return response;
}

// =============================================================================
// Database Types
// =============================================================================

interface DbMapping {
  id: string;
  template_id: string;
  source_id: string;
  field_mappings: FieldMappings;
  transformations: Transformations | null;
  is_default: boolean;
  validation_status: string;
  validation_message: string | null;
  last_validated_at: string | null;
  created_at: string;
  updated_at: string;
}

interface DbTemplate {
  id: string;
  api_key_id: string;
  name: string;
  type: string | null;
  html_template: string;
  required_fields: string[] | null;
  sample_data: Record<string, unknown> | null;
}

interface DbSource {
  id: string;
  api_key_id: string;
  name: string;
  source_type: string;
  status: string;
  config: Record<string, unknown>;
  discovered_schema: DiscoveredSchema | null;
}

// =============================================================================
// Routes
// =============================================================================

/**
 * POST /
 * Create a new template-source mapping
 */
mappings.post("/", async (c) => {
  try {
    const apiKeyId = requireDatabaseAccess(c);

    // Parse and validate body
    const rawBody = await c.req.json();
    const parseResult = createMappingSchema.safeParse(rawBody);

    if (!parseResult.success) {
      const error: ApiError = {
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: parseResult.error.issues,
      };
      return c.json(error, 400);
    }

    const body = parseResult.data;

    // Validate template exists and user owns it
    const { data: template, error: templateError } = await getSupabase()
      .from("templates")
      .select("id, api_key_id, name, required_fields")
      .eq("id", body.template_id)
      .single();

    if (templateError || !template) {
      const error: ApiError = {
        error: "Template not found",
        code: "TEMPLATE_NOT_FOUND",
      };
      return c.json(error, 404);
    }

    if (template.api_key_id !== apiKeyId) {
      const error: ApiError = {
        error: "Template not found",
        code: "TEMPLATE_NOT_FOUND",
      };
      return c.json(error, 404);
    }

    // Validate source exists and user owns it
    const { data: source, error: sourceError } = await getSupabase()
      .from("data_sources")
      .select("id, api_key_id, name, source_type, config, discovered_schema, status")
      .eq("id", body.source_id)
      .is("deleted_at", null)
      .single();

    if (sourceError || !source) {
      const error: ApiError = {
        error: "Data source not found",
        code: "SOURCE_NOT_FOUND",
      };
      return c.json(error, 404);
    }

    if (source.api_key_id !== apiKeyId) {
      const error: ApiError = {
        error: "Data source not found",
        code: "SOURCE_NOT_FOUND",
      };
      return c.json(error, 404);
    }

    // Validate field mappings against source schema
    let validationStatus = "pending";
    let validationMessage: string | null = null;

    if (source.discovered_schema) {
      const validation = validateMappings(
        template.required_fields || [],
        body.field_mappings
      );

      if (validation.valid) {
        validationStatus = "valid";
      } else {
        validationStatus = "broken";
        const issues: string[] = [];
        if (validation.missingFields.length > 0) {
          issues.push(`Missing template fields: ${validation.missingFields.join(", ")}`);
        }
        validationMessage = issues.join("; ");
      }
    }

    // Check for existing mapping between this template and source
    const { data: existing } = await getSupabase()
      .from("template_source_mappings")
      .select("id")
      .eq("template_id", body.template_id)
      .eq("source_id", body.source_id)
      .single();

    if (existing) {
      const error: ApiError = {
        error: "A mapping already exists for this template-source pair",
        code: "MAPPING_EXISTS",
      };
      return c.json(error, 409);
    }

    // Insert mapping
    const { data: mapping, error: insertError } = await getSupabase()
      .from("template_source_mappings")
      .insert({
        template_id: body.template_id,
        source_id: body.source_id,
        field_mappings: body.field_mappings,
        transformations: body.transformations || {},
        is_default: body.is_default,
        validation_status: validationStatus,
        validation_message: validationMessage,
        last_validated_at: source.discovered_schema ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Create mapping error:", insertError);
      const error: ApiError = {
        error: "Failed to create mapping",
        code: "DATABASE_ERROR",
      };
      return c.json(error, 500);
    }

    return c.json(
      {
        success: true,
        mapping: formatMappingResponse(
          mapping as DbMapping,
          template as unknown as DbTemplate,
          source as unknown as DbSource
        ),
      },
      201
    );
  } catch (err) {
    return handleError(c, err);
  }
});

/**
 * GET /
 * List all mappings with optional filters
 */
mappings.get("/", async (c) => {
  try {
    const apiKeyId = requireDatabaseAccess(c);

    // Parse query params
    const templateId = c.req.query("template_id");
    const sourceId = c.req.query("source_id");
    const limitParam = c.req.query("limit");
    const offsetParam = c.req.query("offset");

    // Validate UUIDs if provided
    if (templateId && !UUID_REGEX.test(templateId)) {
      const error: ApiError = {
        error: "Invalid template_id format",
        code: "VALIDATION_ERROR",
      };
      return c.json(error, 400);
    }

    if (sourceId && !UUID_REGEX.test(sourceId)) {
      const error: ApiError = {
        error: "Invalid source_id format",
        code: "VALIDATION_ERROR",
      };
      return c.json(error, 400);
    }

    const limit = Math.min(Math.max(parseInt(limitParam || "50", 10) || 50, 1), 100);
    const offset = Math.max(parseInt(offsetParam || "0", 10) || 0, 0);

    // Build query with joins to get template and source info
    let query = getSupabase()
      .from("template_source_mappings")
      .select(`
        *,
        templates!inner(id, api_key_id, name, type),
        data_sources!inner(id, api_key_id, name, source_type, status)
      `, { count: "exact" })
      .order("updated_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by template_id
    if (templateId) {
      query = query.eq("template_id", templateId);
    }

    // Filter by source_id
    if (sourceId) {
      query = query.eq("source_id", sourceId);
    }

    // Filter by api_key_id through template ownership
    // Both template and source must belong to this user
    query = query.eq("templates.api_key_id", apiKeyId);
    query = query.eq("data_sources.api_key_id", apiKeyId);

    const { data: mappingsData, error, count } = await query;

    if (error) {
      console.error("List mappings error:", error);
      const apiError: ApiError = {
        error: "Failed to list mappings",
        code: "DATABASE_ERROR",
      };
      return c.json(apiError, 500);
    }

    // Format response with embedded template/source info
    const formattedMappings = (mappingsData || []).map((m) => {
      const mapping = m as unknown as DbMapping & {
        templates: DbTemplate;
        data_sources: DbSource;
      };
      return formatMappingResponse(
        mapping,
        mapping.templates,
        mapping.data_sources
      );
    });

    return c.json({
      success: true,
      mappings: formattedMappings,
      total: count || 0,
      limit,
      offset,
    });
  } catch (err) {
    return handleError(c, err);
  }
});

/**
 * GET /:id
 * Get mapping details
 */
mappings.get("/:id", async (c) => {
  try {
    const apiKeyId = requireDatabaseAccess(c);
    const { id } = c.req.param();

    // Validate UUID format
    if (!UUID_REGEX.test(id)) {
      const error: ApiError = {
        error: "Mapping not found",
        code: "MAPPING_NOT_FOUND",
      };
      return c.json(error, 404);
    }

    // Get mapping with template and source info
    const { data: mapping, error } = await getSupabase()
      .from("template_source_mappings")
      .select(`
        *,
        templates!inner(id, api_key_id, name, type),
        data_sources!inner(id, api_key_id, name, source_type, status, discovered_schema)
      `)
      .eq("id", id)
      .single();

    if (error || !mapping) {
      const apiError: ApiError = {
        error: "Mapping not found",
        code: "MAPPING_NOT_FOUND",
      };
      return c.json(apiError, 404);
    }

    // Verify ownership through template or source
    const typedMapping = mapping as unknown as DbMapping & {
      templates: DbTemplate;
      data_sources: DbSource;
    };

    if (typedMapping.templates.api_key_id !== apiKeyId) {
      const apiError: ApiError = {
        error: "Mapping not found",
        code: "MAPPING_NOT_FOUND",
      };
      return c.json(apiError, 404);
    }

    return c.json({
      success: true,
      mapping: formatMappingResponse(
        typedMapping,
        typedMapping.templates,
        typedMapping.data_sources
      ),
    });
  } catch (err) {
    return handleError(c, err);
  }
});

/**
 * PUT /:id
 * Update mapping
 */
mappings.put("/:id", async (c) => {
  try {
    const apiKeyId = requireDatabaseAccess(c);
    const { id } = c.req.param();

    // Validate UUID format
    if (!UUID_REGEX.test(id)) {
      const error: ApiError = {
        error: "Mapping not found",
        code: "MAPPING_NOT_FOUND",
      };
      return c.json(error, 404);
    }

    // Parse and validate body
    const rawBody = await c.req.json();
    const parseResult = updateMappingSchema.safeParse(rawBody);

    if (!parseResult.success) {
      const error: ApiError = {
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: parseResult.error.issues,
      };
      return c.json(error, 400);
    }

    const body = parseResult.data;

    // Check that at least one field is being updated
    if (Object.keys(body).length === 0) {
      const error: ApiError = {
        error: "No fields to update",
        code: "VALIDATION_ERROR",
      };
      return c.json(error, 400);
    }

    // Get existing mapping with template and source info
    const { data: existing, error: fetchError } = await getSupabase()
      .from("template_source_mappings")
      .select(`
        *,
        templates!inner(id, api_key_id, name, required_fields),
        data_sources!inner(id, api_key_id, name, source_type, discovered_schema)
      `)
      .eq("id", id)
      .single();

    if (fetchError || !existing) {
      const error: ApiError = {
        error: "Mapping not found",
        code: "MAPPING_NOT_FOUND",
      };
      return c.json(error, 404);
    }

    const typedExisting = existing as unknown as DbMapping & {
      templates: DbTemplate;
      data_sources: DbSource;
    };

    // Verify ownership
    if (typedExisting.templates.api_key_id !== apiKeyId) {
      const error: ApiError = {
        error: "Mapping not found",
        code: "MAPPING_NOT_FOUND",
      };
      return c.json(error, 404);
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (body.field_mappings !== undefined) {
      updateData.field_mappings = body.field_mappings;
    }

    if (body.transformations !== undefined) {
      updateData.transformations = body.transformations;
    }

    if (body.is_default !== undefined) {
      updateData.is_default = body.is_default;
    }

    // Re-validate mappings if field_mappings changed
    if (body.field_mappings && typedExisting.data_sources.discovered_schema) {
      const validation = validateMappings(
        typedExisting.templates.required_fields || [],
        body.field_mappings
      );

      if (validation.valid) {
        updateData.validation_status = "valid";
        updateData.validation_message = null;
      } else {
        updateData.validation_status = "broken";
        const issues: string[] = [];
        if (validation.missingFields.length > 0) {
          issues.push(`Missing template fields: ${validation.missingFields.join(", ")}`);
        }
        updateData.validation_message = issues.join("; ");
      }
      updateData.last_validated_at = new Date().toISOString();
    }

    // Perform update
    const { data: mapping, error: updateError } = await getSupabase()
      .from("template_source_mappings")
      .update(updateData)
      .eq("id", id)
      .select(`
        *,
        templates(id, name, type),
        data_sources(id, name, source_type, status)
      `)
      .single();

    if (updateError) {
      console.error("Update mapping error:", updateError);
      const error: ApiError = {
        error: "Failed to update mapping",
        code: "DATABASE_ERROR",
      };
      return c.json(error, 500);
    }

    const typedMapping = mapping as unknown as DbMapping & {
      templates: DbTemplate;
      data_sources: DbSource;
    };

    return c.json({
      success: true,
      mapping: formatMappingResponse(
        typedMapping,
        typedMapping.templates,
        typedMapping.data_sources
      ),
    });
  } catch (err) {
    return handleError(c, err);
  }
});

/**
 * DELETE /:id
 * Delete mapping (hard delete)
 */
mappings.delete("/:id", async (c) => {
  try {
    const apiKeyId = requireDatabaseAccess(c);
    const { id } = c.req.param();

    // Validate UUID format
    if (!UUID_REGEX.test(id)) {
      const error: ApiError = {
        error: "Mapping not found",
        code: "MAPPING_NOT_FOUND",
      };
      return c.json(error, 404);
    }

    // Verify ownership before delete by checking template ownership
    const { data: existing, error: fetchError } = await getSupabase()
      .from("template_source_mappings")
      .select(`
        id,
        templates!inner(api_key_id)
      `)
      .eq("id", id)
      .single();

    if (fetchError || !existing) {
      const error: ApiError = {
        error: "Mapping not found",
        code: "MAPPING_NOT_FOUND",
      };
      return c.json(error, 404);
    }

    const typedExisting = existing as unknown as { id: string; templates: { api_key_id: string } };

    if (typedExisting.templates.api_key_id !== apiKeyId) {
      const error: ApiError = {
        error: "Mapping not found",
        code: "MAPPING_NOT_FOUND",
      };
      return c.json(error, 404);
    }

    // Delete the mapping
    const { error: deleteError } = await getSupabase()
      .from("template_source_mappings")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Delete mapping error:", deleteError);
      const error: ApiError = {
        error: "Failed to delete mapping",
        code: "DATABASE_ERROR",
      };
      return c.json(error, 500);
    }

    return c.json({
      success: true,
      deleted: id,
    });
  } catch (err) {
    return handleError(c, err);
  }
});

/**
 * GET /:id/preview
 * Preview template with source data
 */
mappings.get("/:id/preview", async (c) => {
  try {
    const apiKeyId = requireDatabaseAccess(c);
    const { id } = c.req.param();

    // Optional record_id query param to preview specific record
    const recordId = c.req.query("record_id");

    // Validate UUID format
    if (!UUID_REGEX.test(id)) {
      const error: ApiError = {
        error: "Mapping not found",
        code: "MAPPING_NOT_FOUND",
      };
      return c.json(error, 404);
    }

    // Get mapping with full template and source info
    const { data: mappingData, error: mappingError } = await getSupabase()
      .from("template_source_mappings")
      .select(`
        *,
        templates!inner(id, api_key_id, name, html_template, sample_data),
        data_sources!inner(id, api_key_id, name, source_type, config, discovered_schema, status)
      `)
      .eq("id", id)
      .single();

    if (mappingError || !mappingData) {
      const error: ApiError = {
        error: "Mapping not found",
        code: "MAPPING_NOT_FOUND",
      };
      return c.json(error, 404);
    }

    const mapping = mappingData as unknown as DbMapping & {
      templates: DbTemplate;
      data_sources: DataSource;
    };

    // Verify ownership
    if (mapping.templates.api_key_id !== apiKeyId) {
      const error: ApiError = {
        error: "Mapping not found",
        code: "MAPPING_NOT_FOUND",
      };
      return c.json(error, 404);
    }

    // Check if source is active
    if (mapping.data_sources.status !== "active") {
      const error: ApiError = {
        error: `Data source is ${mapping.data_sources.status}. Cannot preview.`,
        code: "SOURCE_NOT_ACTIVE",
      };
      return c.json(error, 400);
    }

    // Fetch sample record from source
    let sourceRecord;
    try {
      const connector = createConnector(mapping.data_sources);

      if (recordId) {
        // Fetch specific record
        sourceRecord = await connector.fetchRecord(recordId);
      } else {
        // Fetch first record for preview
        const records = await connector.fetchRecords({ limit: 1 });
        if (records.length === 0) {
          const error: ApiError = {
            error: "No records found in data source for preview",
            code: "NO_RECORDS",
          };
          return c.json(error, 404);
        }
        sourceRecord = records[0];
      }
    } catch (fetchErr) {
      console.error("Error fetching source record:", fetchErr);
      const error: ApiError = {
        error: fetchErr instanceof Error ? fetchErr.message : "Failed to fetch source data",
        code: "SOURCE_FETCH_ERROR",
      };
      return c.json(error, 500);
    }

    // Apply field mappings and transformations
    const mappingResult = applyMappings(
      sourceRecord,
      mapping.field_mappings,
      mapping.transformations || undefined
    );

    // Render template with mapped data
    let renderedHtml: string;
    try {
      renderedHtml = Mustache.render(
        mapping.templates.html_template,
        mappingResult.data
      );
    } catch (renderErr) {
      console.error("Template render error:", renderErr);
      const error: ApiError = {
        error: renderErr instanceof Error ? renderErr.message : "Failed to render template",
        code: "RENDER_ERROR",
      };
      return c.json(error, 500);
    }

    return c.json({
      success: true,
      preview: {
        html: renderedHtml,
        record_id: sourceRecord.id,
        mapped_data: mappingResult.data,
        unmapped_fields: mappingResult.unmappedFields,
        warnings: mappingResult.warnings,
      },
      mapping: {
        id: mapping.id,
        template_name: mapping.templates.name,
        source_name: mapping.data_sources.name,
      },
    });
  } catch (err) {
    return handleError(c, err);
  }
});

export default mappings;
