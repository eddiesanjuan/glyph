/**
 * Sessions Routes
 * Advanced session creation from data sources and mappings
 *
 * POST /v1/sessions/from-mapping - Create session from a template-source mapping
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
import { applyMappings } from "../services/fieldMapper.js";
import { createDevSession, generateDevSessionId } from "../lib/devSessions.js";

const sessions = new Hono();

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
        error: "Creating sessions from mappings requires a registered API key. Please sign up.",
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

  console.error("Session operation error:", err);
  const error: ApiError = {
    error: err instanceof Error ? err.message : "Unknown error",
    code: "SESSION_ERROR",
  };
  return c.json(error, 500);
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
  last_sync_record_count: number | null;
}

// =============================================================================
// Request Schemas
// =============================================================================

const fromMappingSchema = z.object({
  mapping_id: z.string().uuid("Invalid mapping ID format"),
  record_id: z.string().optional(), // Specific record (default: first record)
});

// =============================================================================
// Routes
// =============================================================================

/**
 * POST /from-mapping
 * Create a session from a template-source mapping.
 *
 * This endpoint:
 * 1. Fetches the mapping with template and source
 * 2. Fetches a record from the source (specific or first)
 * 3. Applies field mappings and transformations
 * 4. Renders the Mustache template with mapped data
 * 5. Creates a session with both current_html and template_html
 *    (template_html is CRITICAL for AI modifications to preserve placeholders)
 */
sessions.post("/from-mapping", async (c) => {
  try {
    const apiKeyId = requireDatabaseAccess(c);

    // Parse and validate body
    const rawBody = await c.req.json();
    const parseResult = fromMappingSchema.safeParse(rawBody);

    if (!parseResult.success) {
      const error: ApiError = {
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: parseResult.error.issues,
      };
      return c.json(error, 400);
    }

    const { mapping_id, record_id } = parseResult.data;

    // Fetch mapping with template and source info
    const { data: mappingData, error: mappingError } = await getSupabase()
      .from("template_source_mappings")
      .select(`
        *,
        templates!inner(id, api_key_id, name, html_template, required_fields, sample_data, type),
        data_sources!inner(id, api_key_id, name, source_type, status, config, discovered_schema, last_sync_record_count)
      `)
      .eq("id", mapping_id)
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
      data_sources: DbSource;
    };

    // Verify ownership through template
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
        error: `Data source is ${mapping.data_sources.status}. Cannot create session.`,
        code: "SOURCE_NOT_ACTIVE",
      };
      return c.json(error, 400);
    }

    // Fetch record from source
    let sourceRecord;
    const warnings: string[] = [];

    try {
      const connector = createConnector(mapping.data_sources as unknown as DataSource);

      if (record_id) {
        // Fetch specific record
        sourceRecord = await connector.fetchRecord(record_id);
        if (!sourceRecord) {
          const error: ApiError = {
            error: `Record '${record_id}' not found in data source`,
            code: "RECORD_NOT_FOUND",
          };
          return c.json(error, 404);
        }
      } else {
        // Fetch first record for session
        const records = await connector.fetchRecords({ limit: 1 });
        if (records.length === 0) {
          const error: ApiError = {
            error: "No records found in data source",
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

    // Add warnings from mapping
    warnings.push(...mappingResult.warnings);

    // Render template with mapped data
    const templateHtml = mapping.templates.html_template;
    let renderedHtml: string;

    try {
      renderedHtml = Mustache.render(templateHtml, mappingResult.data);
    } catch (renderErr) {
      console.error("Template render error:", renderErr);
      const error: ApiError = {
        error: renderErr instanceof Error ? renderErr.message : "Failed to render template",
        code: "RENDER_ERROR",
      };
      return c.json(error, 500);
    }

    // Create session
    // CRITICAL: Store both current_html (rendered) and template_html (with Mustache placeholders)
    // This allows AI modifications to work on the template and re-render with data
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
    let sessionId: string;

    // Create session in Supabase
    const { data: session, error: sessionError } = await getSupabase()
      .from("sessions")
      .insert({
        api_key_id: apiKeyId,
        template: `mapping:${mapping_id}`,
        current_html: renderedHtml,
        original_html: renderedHtml,
        template_html: templateHtml, // CRITICAL: Store Mustache template!
        data: mappingResult.data, // Store mapped data for re-rendering
        modifications: [],
        expires_at: expiresAt,
      })
      .select("id")
      .single();

    if (sessionError) {
      console.error("Session creation error:", sessionError);
      // Fall back to dev session if database fails
      sessionId = generateDevSessionId();
      createDevSession(
        sessionId,
        `mapping:${mapping_id}`,
        renderedHtml,
        templateHtml,
        mappingResult.data
      );
    } else {
      sessionId = session.id;
    }

    return c.json({
      success: true,
      sessionId,
      preview: {
        html: renderedHtml,
        record_id: sourceRecord.id,
        mapped_data: mappingResult.data,
        unmapped_fields: mappingResult.unmappedFields,
        warnings,
      },
      template: {
        id: mapping.templates.id,
        name: mapping.templates.name,
        template_html: templateHtml,
      },
      source: {
        id: mapping.data_sources.id,
        name: mapping.data_sources.name,
        record_count: mapping.data_sources.last_sync_record_count,
      },
    });
  } catch (err) {
    return handleError(c, err);
  }
});

export default sessions;
