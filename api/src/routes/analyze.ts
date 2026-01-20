/**
 * Analyze Route
 * POST /v1/analyze - Analyze data and detect document type/schema
 * POST /v1/preview/auto - Auto-detect and create preview
 */

import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import {
  analyzeData,
  transformToSchema,
  type DataAnalysis,
} from "../services/schemaDetection.js";
import { templateEngine } from "../services/template.js";
import { supabase, getSupabase } from "../lib/supabase.js";
import { createDevSession, generateDevSessionId } from "../lib/devSessions.js";
import type { QuoteData, ApiError } from "../lib/types.js";

const analyze = new Hono();

// ============================================================================
// POST /v1/analyze - Analyze data structure
// ============================================================================

const analyzeRequestSchema = z.object({
  data: z.record(z.unknown()),
});

analyze.post(
  "/",
  zValidator("json", analyzeRequestSchema, (result, c) => {
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
      const { data } = c.req.valid("json");

      // Analyze the data structure
      const analysis = await analyzeData(data);

      // Build response
      const response = {
        documentType: analysis.documentType,
        confidence: analysis.confidence,
        suggestedTemplate: analysis.suggestedTemplate,
        fieldMappings: analysis.fields.map((f) => ({
          source: f.detected,
          target: f.mappedTo,
          example: f.example,
          confidence: f.confidence,
          required: f.required,
        })),
        missingFields: analysis.missingFields,
        warnings: analysis.warnings,
        // Also return a preview URL if they want to see it
        previewUrl: `/v1/preview/auto?template=${analysis.suggestedTemplate}`,
      };

      return c.json(response);
    } catch (err) {
      console.error("Analyze error:", err);

      const error: ApiError = {
        error: err instanceof Error ? err.message : "Unknown error",
        code: "ANALYZE_ERROR",
      };
      return c.json(error, 500);
    }
  }
);

// ============================================================================
// POST /v1/preview/auto - Auto-detect schema and create preview
// ============================================================================

const autoPreviewRequestSchema = z.object({
  data: z.record(z.unknown()),
  template: z.string().optional(), // Optional: override detected template
});

analyze.post(
  "/preview/auto",
  zValidator("json", autoPreviewRequestSchema, (result, c) => {
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
      const { data, template: requestedTemplate } = c.req.valid("json");
      const apiKeyId = c.get("apiKeyId") as string | undefined;

      // Step 1: Analyze data structure
      const analysis = await analyzeData(data);

      // Step 2: Determine template
      const template = requestedTemplate || analysis.suggestedTemplate;

      // Step 3: Transform data to template schema
      const transformedData = transformToSchema(
        data as Record<string, unknown>,
        analysis.fields
      );

      // Step 4: Ensure required fields have defaults
      const finalData = ensureRequiredFields(transformedData, analysis);

      // Step 5: Create preview with detected/requested template
      const result = await templateEngine.render(
        template,
        finalData as unknown as QuoteData
      );

      // Build response
      const response: {
        sessionId?: string;
        html: string;
        analysis: {
          documentType: string;
          confidence: number;
          template: string;
          fieldMappings: {
            source: string;
            target: string;
            mapped: boolean;
          }[];
          missingFields: { field: string; reason: string }[];
          warnings: string[];
        };
      } = {
        html: result.html,
        analysis: {
          documentType: analysis.documentType,
          confidence: analysis.confidence,
          template,
          fieldMappings: analysis.fields.map((f) => ({
            source: f.detected,
            target: f.mappedTo,
            mapped: true,
          })),
          missingFields: analysis.missingFields,
          warnings: analysis.warnings,
        },
      };

      // Create session for modifications
      if (supabase && apiKeyId) {
        try {
          const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

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

          if (!sessionError && session) {
            response.sessionId = session.id;
          }

          // Track usage
          getSupabase()
            .from("usage")
            .insert({
              api_key_id: apiKeyId,
              endpoint: "preview_auto",
              template,
            })
            .then(({ error }) => {
              if (error) {
                console.error("Usage tracking error:", error);
              }
            });
        } catch (dbError) {
          console.error("Database error:", dbError);
        }
      } else if (!supabase) {
        // Development mode
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

      return c.json(response);
    } catch (err) {
      console.error("Auto preview error:", err);

      const error: ApiError = {
        error: err instanceof Error ? err.message : "Unknown error",
        code: "AUTO_PREVIEW_ERROR",
      };
      return c.json(error, 500);
    }
  }
);

// ============================================================================
// GET /v1/analyze/mappings - Get available field mappings reference
// ============================================================================

analyze.get("/mappings", (c) => {
  // Return the field mapping reference for SDK users
  const mappings = {
    description:
      "Common field name variations that Glyph recognizes and maps automatically",
    categories: {
      client: {
        description: "Customer/recipient information",
        fields: [
          "client.name - Customer name (accepts: customer_name, buyer_name, recipient_name)",
          "client.email - Customer email",
          "client.phone - Customer phone",
          "client.address - Billing/shipping address",
          "client.company - Company name",
        ],
      },
      lineItems: {
        description: "Line items/products/services",
        fields: [
          "lineItems - Array of items (accepts: items, products, services, entries)",
          "lineItems.description - Item description",
          "lineItems.quantity - Quantity (accepts: qty, amount, count)",
          "lineItems.price - Unit price (accepts: unit_price, rate, cost)",
          "lineItems.total - Line total",
        ],
      },
      totals: {
        description: "Pricing totals",
        fields: [
          "totals.subtotal - Subtotal before tax/discount",
          "totals.tax - Tax amount (accepts: vat, gst, sales_tax)",
          "totals.discount - Discount amount",
          "totals.total - Grand total (accepts: amount_due, balance)",
        ],
      },
      meta: {
        description: "Document metadata",
        fields: [
          "meta.number - Document number (accepts: invoice_number, quote_number)",
          "meta.date - Issue date",
          "meta.dueDate - Due/valid until date",
          "meta.terms - Payment terms",
          "meta.notes - Additional notes",
        ],
      },
      branding: {
        description: "Company branding",
        fields: [
          "branding.companyName - Your company name",
          "branding.logoUrl - Logo URL",
          "branding.companyAddress - Company address",
        ],
      },
    },
    documentTypes: [
      "invoice - Detected when: lineItems + totals + client info",
      "quote - Detected when: lineItems + totals + validity date",
      "receipt - Detected when: items + total + transaction date",
      "contract - Detected when: parties array + effective date",
      "resume - Detected when: experience + education + skills",
      "report - Detected when: sections array + summary",
      "letter - Detected when: recipient + sender + body",
    ],
  };

  return c.json(mappings);
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Ensure required fields have sensible defaults for template rendering
 */
function ensureRequiredFields(
  data: Record<string, unknown>,
  _analysis: DataAnalysis
): Record<string, unknown> {
  const result = { ...data };

  // Ensure client exists
  if (!result.client) {
    result.client = {};
  }
  const client = result.client as Record<string, unknown>;
  if (!client.name) {
    client.name = "Customer";
  }

  // Ensure lineItems exists and has valid structure
  if (!result.lineItems || !Array.isArray(result.lineItems)) {
    result.lineItems = [];
  }
  const lineItems = result.lineItems as Record<string, unknown>[];
  for (const item of lineItems) {
    // Ensure numeric fields
    if (typeof item.quantity !== "number") {
      item.quantity = Number(item.quantity) || 1;
    }
    if (typeof item.unitPrice !== "number") {
      item.unitPrice = Number(item.unitPrice) || Number(item.price) || 0;
    }
    if (typeof item.total !== "number") {
      item.total =
        Number(item.total) ||
        (item.quantity as number) * (item.unitPrice as number);
    }
    if (!item.description) {
      item.description = item.name || "Item";
    }
  }

  // Ensure totals exists with required fields
  if (!result.totals) {
    result.totals = {};
  }
  const totals = result.totals as Record<string, unknown>;

  // Calculate subtotal from lineItems if not provided
  if (typeof totals.subtotal !== "number") {
    const calculatedSubtotal = lineItems.reduce(
      (sum, item) => sum + (Number(item.total) || 0),
      0
    );
    totals.subtotal = calculatedSubtotal;
  }

  // Calculate total if not provided
  if (typeof totals.total !== "number") {
    const subtotal = totals.subtotal as number;
    const tax = (totals.tax as number) || 0;
    const discount = (totals.discount as number) || 0;
    totals.total = subtotal + tax - discount;
  }

  // Ensure meta exists
  if (!result.meta) {
    result.meta = {};
  }
  const meta = result.meta as Record<string, unknown>;
  if (!meta.quoteNumber && !meta.number) {
    meta.quoteNumber = meta.number || "001";
  } else if (meta.number && !meta.quoteNumber) {
    meta.quoteNumber = meta.number;
  }
  if (!meta.date) {
    meta.date = new Date().toLocaleDateString();
  }

  // Ensure branding exists
  if (!result.branding) {
    result.branding = {};
  }
  const branding = result.branding as Record<string, unknown>;
  if (!branding.companyName) {
    branding.companyName = "Your Company";
  }

  return result;
}

export default analyze;
