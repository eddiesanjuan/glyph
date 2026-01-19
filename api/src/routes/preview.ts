/**
 * Preview Route
 * POST /v1/preview - Generate HTML preview from QuoteData
 */

import { Hono } from "hono";
import { z } from "zod";
import { renderTemplate } from "../services/template.js";
import type { QuoteData, PreviewResponse, ApiError } from "../lib/types.js";

const preview = new Hono();

// Request validation schema
const previewSchema = z.object({
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
  templateId: z.string().optional(),
});

preview.post("/", async (c) => {
  try {
    const body = await c.req.json();

    // Validate request
    const parsed = previewSchema.safeParse(body);
    if (!parsed.success) {
      const error: ApiError = {
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: parsed.error.issues,
      };
      return c.json(error, 400);
    }

    const { data, templateId } = parsed.data;

    // Render template
    const html = renderTemplate(data as QuoteData, templateId);

    const response: PreviewResponse = {
      html,
      // previewUrl will be added when we implement hosted previews
    };

    return c.json(response);
  } catch (err) {
    const error: ApiError = {
      error: err instanceof Error ? err.message : "Unknown error",
      code: "PREVIEW_ERROR",
    };
    return c.json(error, 500);
  }
});

export default preview;
