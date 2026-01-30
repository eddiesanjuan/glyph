/**
 * Preview Route
 * POST /v1/preview - Generate HTML preview from QuoteData
 */

import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import Mustache from "mustache";
import { templateEngine } from "../services/template.js";
import { supabase, getSupabase } from "../lib/supabase.js";
import type { QuoteData, PreviewResponse, ApiError } from "../lib/types.js";
import { createDevSession, generateDevSessionId } from "../lib/devSessions.js";
import { readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const preview = new Hono();

// Request validation schema
// Data is intentionally flexible: different template types (quote, invoice, receipt, report)
// have different data shapes. The template engine handles field mapping.
// Data is optional: when omitted, sample data from the template's schema.json is used.
// savedTemplateId: when provided, loads HTML from user's saved templates (UUID format)
const previewRequestSchema = z.object({
  template: z.string().min(1).default("quote-modern"),
  templateId: z.string().min(1).optional(),
  savedTemplateId: z.string().uuid().optional(), // UUID of a saved template from /v1/templates/saved
  data: z.record(z.unknown()).optional(),
});

/**
 * Load sample data from a template's schema.json examples[0].
 * Returns undefined if the schema or examples are not available.
 */
async function loadTemplateSampleData(templateId: string): Promise<Record<string, unknown> | undefined> {
  try {
    // Resolve templates directory relative to this file (api/src/routes/ -> project root/templates/)
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const schemaPath = join(currentDir, "..", "..", "..", "templates", templateId, "schema.json");
    const raw = await readFile(schemaPath, "utf-8");
    const schema = JSON.parse(raw);
    if (Array.isArray(schema.examples) && schema.examples.length > 0) {
      return schema.examples[0] as Record<string, unknown>;
    }
  } catch {
    // Schema not found or invalid - caller will handle the missing data
  }
  return undefined;
}

preview.post(
  "/",
  zValidator("json", previewRequestSchema, (result, c) => {
    if (!result.success) {
      const error: ApiError = {
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: result.error.issues,
      };
      return c.json(error, 400);
    }
    // Validation passed - continue to handler
    return;
  }),
  async (c) => {
    try {
      const tStart = Date.now();
      const { template: templateField, templateId, savedTemplateId, data: providedData } = c.req.valid("json");

      const apiKeyId = c.get("apiKeyId") as string | undefined;
      const tier = c.get("tier") as string | undefined;

      let templateHtml: string;
      let renderedHtml: string;
      let renderData: Record<string, unknown>;
      let template: string;

      // If savedTemplateId is provided, load from user's saved templates
      if (savedTemplateId) {
        // Require authentication for saved templates
        if (!apiKeyId || tier === "demo") {
          const error: ApiError = {
            error: "Authentication required to load saved templates",
            code: "AUTH_REQUIRED",
          };
          return c.json(error, 401);
        }

        // Check if Supabase is configured
        if (!supabase) {
          const error: ApiError = {
            error: "Database not configured",
            code: "DATABASE_NOT_CONFIGURED",
          };
          return c.json(error, 503);
        }

        // Fetch the saved template
        const { data: savedTemplate, error: fetchError } = await getSupabase()
          .from("templates")
          .select("id, name, html_template, schema, sample_data")
          .eq("id", savedTemplateId)
          .eq("api_key_id", apiKeyId)
          .single();

        if (fetchError || !savedTemplate) {
          const error: ApiError = {
            error: "Template not found",
            code: "TEMPLATE_NOT_FOUND",
          };
          return c.json(error, 404);
        }

        templateHtml = savedTemplate.html_template;
        template = `saved:${savedTemplateId}`;

        // Use provided data, or fall back to template's sample_data
        renderData = providedData || savedTemplate.sample_data || {};

        // Render using Mustache
        const tRender = Date.now();
        try {
          renderedHtml = Mustache.render(templateHtml, renderData);
        } catch (renderErr) {
          console.error("[Preview] Saved template render error:", renderErr);
          const error: ApiError = {
            error: "Failed to render template",
            code: "RENDER_ERROR",
            details: renderErr instanceof Error ? renderErr.message : "Unknown error",
          };
          return c.json(error, 400);
        }
        const renderDuration = Date.now() - tRender;
        console.log(`[perf:preview] saved_template render=${renderDuration}ms id=${savedTemplateId}`);

      } else {
        // Standard built-in template path
        // Support templateId as an alias for template; templateId takes precedence when explicitly provided
        template = templateId ?? templateField;

        // Validate that the requested template exists before rendering
        const availableTemplates = templateEngine.getAvailableTemplates();
        if (!availableTemplates.includes(template)) {
          const error: ApiError = {
            error: "Template not found",
            code: "TEMPLATE_NOT_FOUND",
            details: { templateId: template, availableTemplates },
          };
          return c.json(error, 400);
        }

        // If no data provided, load sample data from the template's schema.json
        renderData = providedData || {};
        if (!renderData || Object.keys(renderData).length === 0) {
          const sampleData = await loadTemplateSampleData(template);
          if (!sampleData) {
            const error: ApiError = {
              error: "No data provided and no sample data found for template",
              code: "MISSING_DATA",
              details: { template },
            };
            return c.json(error, 400);
          }
          renderData = sampleData;
        }

        // Render template using Mustache engine
        const tRender = Date.now();
        const result = await templateEngine.render(template, renderData as unknown as QuoteData);
        const renderDuration = Date.now() - tRender;
        console.log(`[perf:preview] builtin render=${renderDuration}ms template=${template}`);

        templateHtml = result.templateHtml;
        renderedHtml = result.html;
      }

      // Build response
      const response: PreviewResponse & { sessionId?: string } = {
        html: renderedHtml,
      };

      // If Supabase is configured and we have an API key (not demo), create session and track usage
      if (supabase && apiKeyId && tier !== "demo") {
        try {
          // Calculate session expiration (1 hour from now)
          const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

          // Create session in Supabase
          // Store both rendered HTML and template HTML for AI modifications
          const { data: session, error: sessionError } = await getSupabase()
            .from("sessions")
            .insert({
              api_key_id: apiKeyId,
              template,
              current_html: renderedHtml,
              original_html: renderedHtml,
              template_html: templateHtml,
              data: renderData,
              modifications: [],
              expires_at: expiresAt,
            })
            .select("id")
            .single();

          if (sessionError) {
            console.error("Session creation error:", sessionError);
            // Don't fail the request, just skip session tracking
          } else if (session) {
            response.sessionId = session.id;
          }

          // Track usage (fire and forget)
          getSupabase()
            .from("usage")
            .insert({
              api_key_id: apiKeyId,
              endpoint: "preview",
              template,
            })
            .then(({ error }) => {
              if (error) {
                console.error("Usage tracking error:", error);
              }
            });
        } catch (dbError) {
          console.error("Database error:", dbError);
          // Continue without session tracking
        }
      } else if (!supabase || tier === "demo") {
        // Development mode OR demo tier: Create a session in memory storage
        // This allows the SDK to work without database configuration
        // And allows demo playground to work without database entries
        const devSessionId = generateDevSessionId();
        createDevSession(
          devSessionId,
          template,
          renderedHtml,
          templateHtml,
          renderData
        );
        response.sessionId = devSessionId;
      }

      const totalDuration = Date.now() - tStart;
      console.log(`[perf:preview] total=${totalDuration}ms template=${template}`);
      c.header('Server-Timing', `total;dur=${totalDuration}`);
      c.header('Cache-Control', 'private, no-cache');

      return c.json(response);
    } catch (err) {
      console.error("Preview error:", err);

      // Return 404 for template-not-found errors
      if (err instanceof Error && err.message.startsWith("Template not found:")) {
        const templateId = err.message.replace("Template not found: ", "");
        const error: ApiError = {
          error: "Template not found",
          code: "TEMPLATE_NOT_FOUND",
          details: { templateId },
        };
        return c.json(error, 404);
      }

      const error: ApiError = {
        error: err instanceof Error ? err.message : "Unknown error",
        code: "PREVIEW_ERROR",
      };
      return c.json(error, 500);
    }
  }
);

// GET endpoint to list available templates
preview.get("/templates", async (c) => {
  try {
    const templates = templateEngine.getAvailableTemplates();
    return c.json({ templates });
  } catch (err) {
    const error: ApiError = {
      error: err instanceof Error ? err.message : "Unknown error",
      code: "TEMPLATES_ERROR",
    };
    return c.json(error, 500);
  }
});

export default preview;
