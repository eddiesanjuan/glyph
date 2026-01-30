/**
 * Sources Routes
 * CRUD operations for data sources (Airtable, REST APIs, webhooks)
 *
 * POST   /v1/sources           - Create data source
 * GET    /v1/sources           - List sources
 * GET    /v1/sources/:id       - Get source details
 * PUT    /v1/sources/:id       - Update source
 * DELETE /v1/sources/:id       - Delete source (soft delete)
 * POST   /v1/sources/:id/test  - Test connection
 * POST   /v1/sources/:id/sync  - Sync schema
 * GET    /v1/sources/:id/records - Fetch records
 */

import { Hono } from "hono";
import { z } from "zod";
import { getSupabase, supabase } from "../lib/supabase.js";
import type { ApiError } from "../lib/types.js";
import type {
  DataSource,
  DataSourceConfig,
  DataSourceType,
  AirtableConfig,
  RestApiConfig,
  WebhookConfig,
  DiscoveredSchema,
} from "../types/data-sources.js";
import { createConnector, isSourceTypeSupported } from "../services/connectors/index.js";
import { findMatchingTemplates, type MatchResult } from "../services/autoMatcher.js";

const sources = new Hono();

// =============================================================================
// Constants
// =============================================================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// =============================================================================
// Zod Validation Schemas
// =============================================================================

const airtableConfigSchema = z.object({
  personal_access_token: z.string().min(1, "Personal access token is required"),
  // Airtable IDs: prefix + alphanumeric characters (typically 14 chars, but allow flexibility)
  // Using loose pattern to accept all valid Airtable formats without being overly restrictive
  base_id: z.string().regex(/^app[a-zA-Z0-9]{5,25}$/, "Invalid Airtable base ID format. Expected format: appXXXXXXXXXXXXXX"),
  table_id: z.string().regex(/^tbl[a-zA-Z0-9]{5,25}$/, "Invalid Airtable table ID format. Expected format: tblXXXXXXXXXXXXXX"),
  view_id: z.string().regex(/^viw[a-zA-Z0-9]{5,25}$/, "Invalid Airtable view ID format. Expected format: viwXXXXXXXXXXXXXX").optional(),
  filter_formula: z.string().optional(),
});

const restApiConfigSchema = z.object({
  endpoint: z.string().url("Invalid endpoint URL"),
  method: z.enum(["GET", "POST", "PUT", "PATCH"]),
  headers: z.record(z.string()).optional(),
  query_params: z.record(z.string()).optional(),
  auth_type: z.enum(["bearer", "basic", "api_key", "none"]),
  auth_config: z.object({
    token: z.string().optional(),
    username: z.string().optional(),
    password: z.string().optional(),
    api_key: z.string().optional(),
    api_key_header: z.string().optional(),
  }).optional(),
  response_path: z.string().optional(),
});

const webhookConfigSchema = z.object({
  expected_schema: z.record(z.unknown()).optional(),
  secret: z.string().optional(),
  allowed_ips: z.array(z.string()).optional(),
});

// Discriminated union for create source request
const createSourceSchema = z.discriminatedUnion("source_type", [
  z.object({
    name: z.string().min(1, "Name is required").max(255),
    description: z.string().optional(),
    source_type: z.literal("airtable"),
    config: airtableConfigSchema,
  }),
  z.object({
    name: z.string().min(1, "Name is required").max(255),
    description: z.string().optional(),
    source_type: z.literal("rest_api"),
    config: restApiConfigSchema,
  }),
  z.object({
    name: z.string().min(1, "Name is required").max(255),
    description: z.string().optional(),
    source_type: z.literal("webhook"),
    config: webhookConfigSchema,
  }),
]);

// Update schema - allows partial updates
const updateSourceSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  config: z.record(z.unknown()).optional(),
  status: z.enum(["active", "pending", "failed", "disabled"]).optional(),
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
 * Mask sensitive fields in config based on source type
 */
function maskSensitiveConfig(
  config: DataSourceConfig,
  sourceType: DataSourceType
): Record<string, unknown> {
  const masked = { ...config } as Record<string, unknown>;

  if (sourceType === "airtable" && "personal_access_token" in config) {
    const airtableConfig = config as AirtableConfig;
    masked.personal_access_token = "***" + airtableConfig.personal_access_token.slice(-4);
  }

  if (sourceType === "rest_api" && "auth_config" in config) {
    const restConfig = config as RestApiConfig;
    if (restConfig.auth_config) {
      const maskedAuth: Record<string, unknown> = { ...restConfig.auth_config };
      if (restConfig.auth_config.token) {
        maskedAuth.token = "***" + restConfig.auth_config.token.slice(-4);
      }
      if (restConfig.auth_config.password) {
        maskedAuth.password = "***";
      }
      if (restConfig.auth_config.api_key) {
        maskedAuth.api_key = "***" + restConfig.auth_config.api_key.slice(-4);
      }
      masked.auth_config = maskedAuth;
    }
  }

  if (sourceType === "webhook" && "secret" in config) {
    const webhookConfig = config as WebhookConfig;
    if (webhookConfig.secret) {
      masked.secret = "***" + webhookConfig.secret.slice(-4);
    }
  }

  return masked;
}

/**
 * Format source for API response
 */
function formatSourceResponse(
  source: DataSource,
  maskConfig = true
): Record<string, unknown> {
  return {
    id: source.id,
    name: source.name,
    description: source.description,
    source_type: source.source_type,
    config: maskConfig
      ? maskSensitiveConfig(source.config, source.source_type)
      : source.config,
    discovered_schema: source.discovered_schema,
    status: source.status,
    status_message: source.status_message,
    last_sync_at: source.last_sync_at,
    last_sync_status: source.last_sync_status,
    last_sync_record_count: source.last_sync_record_count,
    created_at: source.created_at,
    updated_at: source.updated_at,
  };
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
        error: "Data sources require a registered API key. Please sign up to use data sources.",
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

  console.error("Source operation error:", err);
  const error: ApiError = {
    error: err instanceof Error ? err.message : "Unknown error",
    code: "SOURCE_ERROR",
  };
  return c.json(error, 500);
}

// =============================================================================
// Routes
// =============================================================================

/**
 * POST /
 * Create a new data source
 */
sources.post("/", async (c) => {
  try {
    const apiKeyId = requireDatabaseAccess(c);

    // Parse and validate body
    const rawBody = await c.req.json();
    const parseResult = createSourceSchema.safeParse(rawBody);

    if (!parseResult.success) {
      const error: ApiError = {
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: parseResult.error.issues,
      };
      return c.json(error, 400);
    }

    const body = parseResult.data;

    // Build a temporary source object for testing
    const tempSource: DataSource = {
      id: "temp",
      api_key_id: apiKeyId,
      name: body.name,
      description: body.description,
      source_type: body.source_type,
      config: body.config as DataSourceConfig,
      status: "pending",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Test connection before saving
    let discoveredSchema: DiscoveredSchema | undefined;
    let status: "active" | "failed" = "active";
    let statusMessage: string | undefined;

    try {
      const connector = createConnector(tempSource);
      const testResult = await connector.testConnection();

      if (!testResult.success) {
        status = "failed";
        statusMessage = testResult.error || "Connection test failed";
      } else {
        // Discover schema if connection succeeded
        try {
          discoveredSchema = await connector.discoverSchema();
        } catch (schemaErr) {
          console.warn("Schema discovery failed:", schemaErr);
          statusMessage = "Connected, but schema discovery failed";
        }
      }
    } catch (connErr) {
      status = "failed";
      statusMessage = connErr instanceof Error ? connErr.message : "Connection failed";
    }

    // Insert into database
    const { data: source, error: dbError } = await getSupabase()
      .from("data_sources")
      .insert({
        api_key_id: apiKeyId,
        name: body.name,
        description: body.description || null,
        source_type: body.source_type,
        config: body.config,
        status,
        status_message: statusMessage || null,
        discovered_schema: discoveredSchema || null,
        last_sync_at: discoveredSchema ? new Date().toISOString() : null,
        last_sync_status: discoveredSchema ? "success" : null,
        last_sync_record_count: discoveredSchema?.record_count || null,
      })
      .select()
      .single();

    if (dbError) {
      console.error("Create source error:", dbError);
      const error: ApiError = {
        error: "Failed to create data source",
        code: "DATABASE_ERROR",
      };
      return c.json(error, 500);
    }

    // Auto-match templates if schema was discovered
    let matchSuggestions: MatchResult[] = [];
    if (discoveredSchema && apiKeyId) {
      try {
        matchSuggestions = await findMatchingTemplates(
          discoveredSchema,
          apiKeyId,
          { maxResults: 3 }
        );
      } catch (err) {
        console.warn('[AutoMatcher] Failed to find matches:', err);
        // Non-fatal, continue without suggestions
      }
    }

    return c.json(
      {
        success: true,
        source: formatSourceResponse(source as DataSource),
        matchSuggestions,
      },
      201
    );
  } catch (err) {
    return handleError(c, err);
  }
});

/**
 * GET /
 * List all sources for the authenticated API key
 */
sources.get("/", async (c) => {
  try {
    const apiKeyId = requireDatabaseAccess(c);

    // Parse query params
    const typeParam = c.req.query("type");
    const limitParam = c.req.query("limit");
    const offsetParam = c.req.query("offset");

    // Validate type if provided
    const type = typeParam && isSourceTypeSupported(typeParam) ? typeParam : undefined;

    // Parse and validate limit/offset
    const limit = Math.min(Math.max(parseInt(limitParam || "50", 10) || 50, 1), 100);
    const offset = Math.max(parseInt(offsetParam || "0", 10) || 0, 0);

    // Build query
    let query = getSupabase()
      .from("data_sources")
      .select("*", { count: "exact" })
      .eq("api_key_id", apiKeyId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply type filter if provided
    if (type) {
      query = query.eq("source_type", type);
    }

    const { data: dataSources, error, count } = await query;

    if (error) {
      console.error("List sources error:", error);
      const apiError: ApiError = {
        error: "Failed to list data sources",
        code: "DATABASE_ERROR",
      };
      return c.json(apiError, 500);
    }

    return c.json({
      success: true,
      sources: (dataSources || []).map((s) => formatSourceResponse(s as DataSource)),
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
 * Get a specific source by ID
 */
sources.get("/:id", async (c) => {
  try {
    const apiKeyId = requireDatabaseAccess(c);
    const { id } = c.req.param();

    // Validate UUID format
    if (!UUID_REGEX.test(id)) {
      const error: ApiError = {
        error: "Data source not found",
        code: "SOURCE_NOT_FOUND",
      };
      return c.json(error, 404);
    }

    const { data: source, error } = await getSupabase()
      .from("data_sources")
      .select("*")
      .eq("id", id)
      .eq("api_key_id", apiKeyId)
      .is("deleted_at", null)
      .single();

    if (error || !source) {
      const apiError: ApiError = {
        error: "Data source not found",
        code: "SOURCE_NOT_FOUND",
      };
      return c.json(apiError, 404);
    }

    return c.json({
      success: true,
      source: formatSourceResponse(source as DataSource),
    });
  } catch (err) {
    return handleError(c, err);
  }
});

/**
 * PUT /:id
 * Update a source
 */
sources.put("/:id", async (c) => {
  try {
    const apiKeyId = requireDatabaseAccess(c);
    const { id } = c.req.param();

    // Validate UUID format
    if (!UUID_REGEX.test(id)) {
      const error: ApiError = {
        error: "Data source not found",
        code: "SOURCE_NOT_FOUND",
      };
      return c.json(error, 404);
    }

    // Parse and validate body
    const rawBody = await c.req.json();
    const parseResult = updateSourceSchema.safeParse(rawBody);

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

    // Verify the source exists and belongs to this user
    const { data: existing, error: fetchError } = await getSupabase()
      .from("data_sources")
      .select("*")
      .eq("id", id)
      .eq("api_key_id", apiKeyId)
      .is("deleted_at", null)
      .single();

    if (fetchError || !existing) {
      const error: ApiError = {
        error: "Data source not found",
        code: "SOURCE_NOT_FOUND",
      };
      return c.json(error, 404);
    }

    // Build update object
    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.status !== undefined) updateData.status = body.status;

    // If config is being updated, merge with existing and re-test connection
    if (body.config !== undefined) {
      const mergedConfig = { ...existing.config, ...body.config };
      updateData.config = mergedConfig;

      // Re-test connection with new config
      const tempSource: DataSource = {
        ...existing,
        config: mergedConfig as DataSourceConfig,
      } as DataSource;

      try {
        const connector = createConnector(tempSource);
        const testResult = await connector.testConnection();

        if (!testResult.success) {
          updateData.status = "failed";
          updateData.status_message = testResult.error || "Connection test failed";
        } else {
          updateData.status = "active";
          updateData.status_message = null;

          // Re-sync schema
          try {
            const schema = await connector.discoverSchema();
            updateData.discovered_schema = schema;
            updateData.last_sync_at = new Date().toISOString();
            updateData.last_sync_status = "success";
            updateData.last_sync_record_count = schema.record_count || null;
          } catch (schemaErr) {
            console.warn("Schema re-discovery failed:", schemaErr);
          }
        }
      } catch (connErr) {
        updateData.status = "failed";
        updateData.status_message = connErr instanceof Error ? connErr.message : "Connection failed";
      }
    }

    // Perform update
    const { data: source, error: updateError } = await getSupabase()
      .from("data_sources")
      .update(updateData)
      .eq("id", id)
      .eq("api_key_id", apiKeyId)
      .select()
      .single();

    if (updateError) {
      console.error("Update source error:", updateError);
      const error: ApiError = {
        error: "Failed to update data source",
        code: "DATABASE_ERROR",
      };
      return c.json(error, 500);
    }

    return c.json({
      success: true,
      source: formatSourceResponse(source as DataSource),
    });
  } catch (err) {
    return handleError(c, err);
  }
});

/**
 * DELETE /:id
 * Soft delete a source
 */
sources.delete("/:id", async (c) => {
  try {
    const apiKeyId = requireDatabaseAccess(c);
    const { id } = c.req.param();

    // Validate UUID format
    if (!UUID_REGEX.test(id)) {
      const error: ApiError = {
        error: "Data source not found",
        code: "SOURCE_NOT_FOUND",
      };
      return c.json(error, 404);
    }

    // Soft delete by setting deleted_at
    const { data, error } = await getSupabase()
      .from("data_sources")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("api_key_id", apiKeyId)
      .is("deleted_at", null)
      .select("id")
      .single();

    if (error || !data) {
      const apiError: ApiError = {
        error: "Data source not found",
        code: "SOURCE_NOT_FOUND",
      };
      return c.json(apiError, 404);
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
 * POST /:id/test
 * Test connection to a source
 */
sources.post("/:id/test", async (c) => {
  try {
    const apiKeyId = requireDatabaseAccess(c);
    const { id } = c.req.param();

    // Validate UUID format
    if (!UUID_REGEX.test(id)) {
      const error: ApiError = {
        error: "Data source not found",
        code: "SOURCE_NOT_FOUND",
      };
      return c.json(error, 404);
    }

    // Get the source
    const { data: source, error: fetchError } = await getSupabase()
      .from("data_sources")
      .select("*")
      .eq("id", id)
      .eq("api_key_id", apiKeyId)
      .is("deleted_at", null)
      .single();

    if (fetchError || !source) {
      const error: ApiError = {
        error: "Data source not found",
        code: "SOURCE_NOT_FOUND",
      };
      return c.json(error, 404);
    }

    // Test connection
    let testResult;
    try {
      const connector = createConnector(source as DataSource);
      testResult = await connector.testConnection();
    } catch (connErr) {
      testResult = {
        success: false,
        error: connErr instanceof Error ? connErr.message : "Failed to create connector",
      };
    }

    // Update status in database
    const updateData: Record<string, unknown> = {
      status: testResult.success ? "active" : "failed",
      status_message: testResult.success ? null : testResult.error,
    };

    await getSupabase()
      .from("data_sources")
      .update(updateData)
      .eq("id", id)
      .eq("api_key_id", apiKeyId);

    return c.json({
      success: testResult.success,
      source_id: id,
      connection_status: testResult.success ? "connected" : "failed",
      error: testResult.error,
      details: testResult.details,
    });
  } catch (err) {
    return handleError(c, err);
  }
});

/**
 * POST /:id/sync
 * Sync schema from source
 */
sources.post("/:id/sync", async (c) => {
  try {
    const apiKeyId = requireDatabaseAccess(c);
    const { id } = c.req.param();

    // Validate UUID format
    if (!UUID_REGEX.test(id)) {
      const error: ApiError = {
        error: "Data source not found",
        code: "SOURCE_NOT_FOUND",
      };
      return c.json(error, 404);
    }

    // Get the source
    const { data: source, error: fetchError } = await getSupabase()
      .from("data_sources")
      .select("*")
      .eq("id", id)
      .eq("api_key_id", apiKeyId)
      .is("deleted_at", null)
      .single();

    if (fetchError || !source) {
      const error: ApiError = {
        error: "Data source not found",
        code: "SOURCE_NOT_FOUND",
      };
      return c.json(error, 404);
    }

    const typedSource = source as DataSource;
    const previousSchema = typedSource.discovered_schema;

    // Discover schema
    let discoveredSchema: DiscoveredSchema;
    let syncStatus: "success" | "failed" = "success";
    let syncMessage: string | undefined;

    try {
      const connector = createConnector(typedSource);
      discoveredSchema = await connector.discoverSchema();
    } catch (schemaErr) {
      syncStatus = "failed";
      syncMessage = schemaErr instanceof Error ? schemaErr.message : "Schema discovery failed";

      // Update with failure status
      await getSupabase()
        .from("data_sources")
        .update({
          last_sync_at: new Date().toISOString(),
          last_sync_status: "failed",
          status_message: syncMessage,
        })
        .eq("id", id)
        .eq("api_key_id", apiKeyId);

      return c.json({
        success: false,
        source_id: id,
        status: "failed",
        error: syncMessage,
      });
    }

    // Detect schema drift
    const schemaDrift = detectSchemaDrift(previousSchema, discoveredSchema);

    // Update database
    const { error: updateError } = await getSupabase()
      .from("data_sources")
      .update({
        discovered_schema: discoveredSchema,
        last_sync_at: new Date().toISOString(),
        last_sync_status: syncStatus,
        last_sync_record_count: discoveredSchema.record_count || null,
        status: "active",
        status_message: null,
      })
      .eq("id", id)
      .eq("api_key_id", apiKeyId);

    if (updateError) {
      console.error("Schema sync update error:", updateError);
    }

    return c.json({
      success: true,
      source_id: id,
      status: syncStatus,
      schema: discoveredSchema,
      schema_drift: schemaDrift,
      record_count: discoveredSchema.record_count,
    });
  } catch (err) {
    return handleError(c, err);
  }
});

/**
 * GET /:id/records
 * Fetch records from a source
 */
sources.get("/:id/records", async (c) => {
  try {
    const apiKeyId = requireDatabaseAccess(c);
    const { id } = c.req.param();

    // Validate UUID format
    if (!UUID_REGEX.test(id)) {
      const error: ApiError = {
        error: "Data source not found",
        code: "SOURCE_NOT_FOUND",
      };
      return c.json(error, 404);
    }

    // Parse query params
    const limitParam = c.req.query("limit");
    const offsetParam = c.req.query("offset");
    const filterParam = c.req.query("filter");

    const limit = Math.min(Math.max(parseInt(limitParam || "100", 10) || 100, 1), 1000);
    const offset = Math.max(parseInt(offsetParam || "0", 10) || 0, 0);

    // Get the source
    const { data: source, error: fetchError } = await getSupabase()
      .from("data_sources")
      .select("*")
      .eq("id", id)
      .eq("api_key_id", apiKeyId)
      .is("deleted_at", null)
      .single();

    if (fetchError || !source) {
      const error: ApiError = {
        error: "Data source not found",
        code: "SOURCE_NOT_FOUND",
      };
      return c.json(error, 404);
    }

    const typedSource = source as DataSource;

    // Check if source type supports fetching
    if (typedSource.source_type === "webhook") {
      const error: ApiError = {
        error: "Webhook sources do not support fetching records. Data is pushed to webhooks.",
        code: "OPERATION_NOT_SUPPORTED",
      };
      return c.json(error, 400);
    }

    // Fetch records
    try {
      const connector = createConnector(typedSource);
      const records = await connector.fetchRecords({
        limit,
        offset,
        filter: filterParam,
      });

      return c.json({
        success: true,
        source_id: id,
        records,
        count: records.length,
        limit,
        offset,
      });
    } catch (fetchErr) {
      const error: ApiError = {
        error: fetchErr instanceof Error ? fetchErr.message : "Failed to fetch records",
        code: "FETCH_ERROR",
      };
      return c.json(error, 500);
    }
  } catch (err) {
    return handleError(c, err);
  }
});

// =============================================================================
// Helper: Detect Schema Drift
// =============================================================================

interface SchemaDrift {
  has_changes: boolean;
  added_fields: string[];
  removed_fields: string[];
  type_changes: Array<{
    field: string;
    previous_type: string;
    current_type: string;
  }>;
}

function detectSchemaDrift(
  previous: DiscoveredSchema | undefined | null,
  current: DiscoveredSchema
): SchemaDrift {
  const drift: SchemaDrift = {
    has_changes: false,
    added_fields: [],
    removed_fields: [],
    type_changes: [],
  };

  if (!previous || !previous.fields) {
    // No previous schema, everything is "new"
    drift.has_changes = current.fields.length > 0;
    drift.added_fields = current.fields.map((f) => f.path);
    return drift;
  }

  const previousPaths = new Map(previous.fields.map((f) => [f.path, f]));
  const currentPaths = new Map(current.fields.map((f) => [f.path, f]));

  // Find added fields
  for (const field of current.fields) {
    if (!previousPaths.has(field.path)) {
      drift.added_fields.push(field.path);
    }
  }

  // Find removed fields
  for (const field of previous.fields) {
    if (!currentPaths.has(field.path)) {
      drift.removed_fields.push(field.path);
    }
  }

  // Find type changes
  for (const field of current.fields) {
    const prevField = previousPaths.get(field.path);
    if (prevField && prevField.type !== field.type) {
      drift.type_changes.push({
        field: field.path,
        previous_type: prevField.type,
        current_type: field.type,
      });
    }
  }

  drift.has_changes =
    drift.added_fields.length > 0 ||
    drift.removed_fields.length > 0 ||
    drift.type_changes.length > 0;

  return drift;
}

export default sources;
