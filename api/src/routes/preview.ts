/**
 * Preview Route
 * POST /v1/preview - Generate HTML preview from QuoteData
 */

import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { templateEngine } from "../services/template.js";
import { supabase, getSupabase } from "../lib/supabase.js";
import type { QuoteData, PreviewResponse, ApiError } from "../lib/types.js";
import { createDevSession, generateDevSessionId } from "../lib/devSessions.js";

const preview = new Hono();

// Request validation schema
// Data is intentionally flexible: different template types (quote, invoice, receipt, report)
// have different data shapes. The template engine handles field mapping.
const previewRequestSchema = z.object({
  template: z.string().min(1).default("quote-modern"),
  data: z.record(z.unknown()),
});

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
      const { template, data } = c.req.valid("json");
      const apiKeyId = c.get("apiKeyId") as string | undefined;

      // Render template using Mustache engine
      const tRender = Date.now();
      const result = await templateEngine.render(template, data as unknown as QuoteData);
      const renderDuration = Date.now() - tRender;

      // Build response
      const response: PreviewResponse & { sessionId?: string } = {
        html: result.html,
      };

      // Get tier to determine session handling
      const tier = c.get("tier") as string | undefined;

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
              current_html: result.html,
              original_html: result.html,
              template_html: result.templateHtml,
              data: result.renderData,
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
          result.html,
          result.templateHtml,
          result.renderData
        );
        response.sessionId = devSessionId;
      }

      const totalDuration = Date.now() - tStart;
      console.log(`[perf:preview] render=${renderDuration}ms total=${totalDuration}ms template=${template}`);
      c.header('Server-Timing', `render;dur=${renderDuration}, total;dur=${totalDuration}`);
      c.header('Cache-Control', 'private, no-cache');

      return c.json(response);
    } catch (err) {
      console.error("Preview error:", err);

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
