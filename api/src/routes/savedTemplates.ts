/**
 * Saved Templates Routes
 * CRUD operations for user-saved PDF templates
 *
 * GET    /v1/templates/saved         - List all templates for the authenticated user
 * POST   /v1/templates/saved         - Save a new template
 * GET    /v1/templates/saved/:id     - Get a specific template by ID
 * PUT    /v1/templates/saved/:id     - Update a template
 * DELETE /v1/templates/saved/:id     - Delete a template
 */

import { Hono } from "hono";
import { z } from "zod";
import { getSupabase, supabase } from "../lib/supabase.js";
import type { ApiError } from "../lib/types.js";

const savedTemplates = new Hono();

// =============================================================================
// Constants
// =============================================================================

const VALID_TYPES = [
  "invoice",
  "quote",
  "report",
  "certificate",
  "letter",
  "receipt",
  "contract",
  "custom",
] as const;

const VALID_STYLES = [
  "stripe-clean",
  "professional",
  "minimal",
  "bold",
  "classic",
  "corporate",
  "modern",
  "vibrant",
] as const;

// =============================================================================
// Request Schemas
// =============================================================================

const createTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required").max(255),
  type: z.enum(VALID_TYPES).optional(),
  description: z.string().max(1000).optional(),
  html: z.string().min(1, "Template HTML is required"),
  schema: z
    .object({
      fields: z
        .array(
          z.object({
            name: z.string(),
            type: z.string(),
            required: z.boolean().optional(),
          })
        )
        .optional(),
    })
    .optional(),
  style: z.enum(VALID_STYLES).optional(),
  isDefault: z.boolean().optional().default(false),
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  type: z.enum(VALID_TYPES).optional(),
  description: z.string().max(1000).optional(),
  html: z.string().min(1).optional(),
  schema: z
    .object({
      fields: z
        .array(
          z.object({
            name: z.string(),
            type: z.string(),
            required: z.boolean().optional(),
          })
        )
        .optional(),
    })
    .optional(),
  style: z.enum(VALID_STYLES).optional(),
  isDefault: z.boolean().optional(),
});

// =============================================================================
// Helper: Check if user has database access
// =============================================================================

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
// Helper: Format template for response
// =============================================================================

interface DbTemplate {
  id: string;
  name: string;
  type: string | null;
  description: string | null;
  html_template: string;
  schema: Record<string, unknown> | null;
  style: string | null;
  is_default: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

function formatTemplateResponse(
  template: DbTemplate,
  includeHtml = false
): Record<string, unknown> {
  const response: Record<string, unknown> = {
    id: template.id,
    name: template.name,
    type: template.type,
    description: template.description,
    style: template.style,
    isDefault: template.is_default,
    version: template.version,
    createdAt: template.created_at,
    updatedAt: template.updated_at,
  };

  if (includeHtml) {
    response.html = template.html_template;
    response.schema = template.schema;
  }

  return response;
}

// =============================================================================
// Helper: Handle common errors
// =============================================================================

function handleError(c: { json: (data: unknown, status: number) => Response }, err: unknown): Response {
  if (err instanceof Error) {
    if (err.message === "DEMO_TIER") {
      const error: ApiError = {
        error:
          "Template persistence requires a registered API key. Please sign up to save templates.",
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

  console.error("Template operation error:", err);
  const error: ApiError = {
    error: err instanceof Error ? err.message : "Unknown error",
    code: "TEMPLATE_ERROR",
  };
  return c.json(error, 500);
}

// =============================================================================
// Routes
// =============================================================================

/**
 * GET /
 * List all templates for the authenticated API key
 */
savedTemplates.get("/", async (c) => {
  try {
    const apiKeyId = requireDatabaseAccess(c);

    // Parse query params manually
    const typeParam = c.req.query("type");
    const limitParam = c.req.query("limit");
    const offsetParam = c.req.query("offset");

    // Validate type if provided
    const type = typeParam && VALID_TYPES.includes(typeParam as typeof VALID_TYPES[number])
      ? typeParam
      : undefined;

    // Parse and validate limit/offset
    const limit = Math.min(Math.max(parseInt(limitParam || "50", 10) || 50, 1), 100);
    const offset = Math.max(parseInt(offsetParam || "0", 10) || 0, 0);

    // Build query
    let query = getSupabase()
      .from("templates")
      .select("*", { count: "exact" })
      .eq("api_key_id", apiKeyId)
      .order("updated_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply type filter if provided
    if (type) {
      query = query.eq("type", type);
    }

    const { data: templates, error, count } = await query;

    if (error) {
      console.error("List templates error:", error);
      const apiError: ApiError = {
        error: "Failed to list templates",
        code: "DATABASE_ERROR",
      };
      return c.json(apiError, 500);
    }

    return c.json({
      success: true,
      templates: (templates || []).map((t) =>
        formatTemplateResponse(t as DbTemplate, false)
      ),
      total: count || 0,
      limit,
      offset,
    });
  } catch (err) {
    return handleError(c, err);
  }
});

/**
 * POST /
 * Save a new template
 */
savedTemplates.post("/", async (c) => {
  try {
    const apiKeyId = requireDatabaseAccess(c);

    // Parse and validate body
    const rawBody = await c.req.json();
    const parseResult = createTemplateSchema.safeParse(rawBody);

    if (!parseResult.success) {
      const error: ApiError = {
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: parseResult.error.issues,
      };
      return c.json(error, 400);
    }

    const body = parseResult.data;

    // If setting as default, unset other defaults of same type
    if (body.isDefault && body.type) {
      await getSupabase()
        .from("templates")
        .update({ is_default: false })
        .eq("api_key_id", apiKeyId)
        .eq("type", body.type)
        .eq("is_default", true);
    }

    // Insert new template
    const { data: template, error } = await getSupabase()
      .from("templates")
      .insert({
        api_key_id: apiKeyId,
        name: body.name,
        type: body.type || null,
        description: body.description || null,
        html_template: body.html,
        schema: body.schema || {},
        style: body.style || null,
        is_default: body.isDefault || false,
      })
      .select()
      .single();

    if (error) {
      console.error("Create template error:", error);
      const apiError: ApiError = {
        error: "Failed to save template",
        code: "DATABASE_ERROR",
      };
      return c.json(apiError, 500);
    }

    return c.json(
      {
        success: true,
        template: formatTemplateResponse(template as DbTemplate, true),
      },
      201
    );
  } catch (err) {
    return handleError(c, err);
  }
});

/**
 * GET /:id
 * Get a specific template by ID
 */
savedTemplates.get("/:id", async (c) => {
  try {
    const apiKeyId = requireDatabaseAccess(c);
    const { id } = c.req.param();

    // Validate UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      const error: ApiError = {
        error: "Template not found",
        code: "TEMPLATE_NOT_FOUND",
      };
      return c.json(error, 404);
    }

    const { data: template, error } = await getSupabase()
      .from("templates")
      .select("*")
      .eq("id", id)
      .eq("api_key_id", apiKeyId)
      .single();

    if (error || !template) {
      // Return 404 (not 403) to avoid leaking existence
      const apiError: ApiError = {
        error: "Template not found",
        code: "TEMPLATE_NOT_FOUND",
      };
      return c.json(apiError, 404);
    }

    return c.json({
      success: true,
      template: formatTemplateResponse(template as DbTemplate, true),
    });
  } catch (err) {
    return handleError(c, err);
  }
});

/**
 * PUT /:id
 * Update a template
 */
savedTemplates.put("/:id", async (c) => {
  try {
    const apiKeyId = requireDatabaseAccess(c);
    const { id } = c.req.param();

    // Validate UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      const error: ApiError = {
        error: "Template not found",
        code: "TEMPLATE_NOT_FOUND",
      };
      return c.json(error, 404);
    }

    // Parse and validate body
    const rawBody = await c.req.json();
    const parseResult = updateTemplateSchema.safeParse(rawBody);

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

    // First verify the template exists and belongs to this user
    const { data: existing, error: fetchError } = await getSupabase()
      .from("templates")
      .select("id, type, version")
      .eq("id", id)
      .eq("api_key_id", apiKeyId)
      .single();

    if (fetchError || !existing) {
      const error: ApiError = {
        error: "Template not found",
        code: "TEMPLATE_NOT_FOUND",
      };
      return c.json(error, 404);
    }

    // If setting as default, unset other defaults of same type
    const targetType = body.type || existing.type;
    if (body.isDefault && targetType) {
      await getSupabase()
        .from("templates")
        .update({ is_default: false })
        .eq("api_key_id", apiKeyId)
        .eq("type", targetType)
        .eq("is_default", true)
        .neq("id", id);
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      version: existing.version + 1, // Increment version on update
    };

    if (body.name !== undefined) updateData.name = body.name;
    if (body.type !== undefined) updateData.type = body.type;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.html !== undefined) updateData.html_template = body.html;
    if (body.schema !== undefined) updateData.schema = body.schema;
    if (body.style !== undefined) updateData.style = body.style;
    if (body.isDefault !== undefined) updateData.is_default = body.isDefault;

    // Perform update
    const { data: template, error: updateError } = await getSupabase()
      .from("templates")
      .update(updateData)
      .eq("id", id)
      .eq("api_key_id", apiKeyId)
      .select()
      .single();

    if (updateError) {
      console.error("Update template error:", updateError);
      const error: ApiError = {
        error: "Failed to update template",
        code: "DATABASE_ERROR",
      };
      return c.json(error, 500);
    }

    return c.json({
      success: true,
      template: formatTemplateResponse(template as DbTemplate, true),
    });
  } catch (err) {
    return handleError(c, err);
  }
});

/**
 * DELETE /:id
 * Delete a template
 */
savedTemplates.delete("/:id", async (c) => {
  try {
    const apiKeyId = requireDatabaseAccess(c);
    const { id } = c.req.param();

    // Validate UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      const error: ApiError = {
        error: "Template not found",
        code: "TEMPLATE_NOT_FOUND",
      };
      return c.json(error, 404);
    }

    // Delete template (only if it belongs to this user)
    const { data, error } = await getSupabase()
      .from("templates")
      .delete()
      .eq("id", id)
      .eq("api_key_id", apiKeyId)
      .select("id")
      .single();

    if (error || !data) {
      // Return 404 (not 403) to avoid leaking existence
      const apiError: ApiError = {
        error: "Template not found",
        code: "TEMPLATE_NOT_FOUND",
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

export default savedTemplates;
