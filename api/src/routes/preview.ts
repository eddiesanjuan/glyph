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

const preview = new Hono();

// Request validation schema
const previewRequestSchema = z.object({
  template: z.string().min(1).default("quote-modern"),
  data: z.object({
    client: z.object({
      name: z.string().min(1),
      email: z.string().email().optional(),
      address: z.string().optional(),
      company: z.string().optional(),
    }),
    lineItems: z.array(
      z.object({
        description: z.string(),
        quantity: z.number().positive(),
        unitPrice: z.number().nonnegative(),
        total: z.number().nonnegative(),
      })
    ),
    totals: z.object({
      subtotal: z.number().nonnegative(),
      tax: z.number().nonnegative().optional(),
      discount: z.number().nonnegative().optional(),
      total: z.number().nonnegative(),
    }),
    meta: z
      .object({
        quoteNumber: z.string().optional(),
        date: z.string().optional(),
        validUntil: z.string().optional(),
        notes: z.string().optional(),
        terms: z.string().optional(),
      })
      .optional(),
    branding: z
      .object({
        logoUrl: z.string().url().optional(),
        companyName: z.string().optional(),
        companyAddress: z.string().optional(),
      })
      .optional(),
  }),
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
  }),
  async (c) => {
    try {
      const { template, data } = c.req.valid("json");
      const apiKeyId = c.get("apiKeyId") as string | undefined;

      // Render template using Mustache engine
      const result = await templateEngine.render(template, data as QuoteData);

      // Build response
      const response: PreviewResponse & { sessionId?: string } = {
        html: result.html,
      };

      // If Supabase is configured and we have an API key, create session and track usage
      if (supabase && apiKeyId) {
        try {
          // Create session in Supabase
          const { data: session, error: sessionError } = await getSupabase()
            .from("sessions")
            .insert({
              api_key_id: apiKeyId,
              template,
              current_html: result.html,
              original_html: result.html,
              data,
              modifications: [],
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
      }

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
