/**
 * Public Webhook Routes (no authentication required)
 * These endpoints are called by Airtable automations and must be publicly accessible
 *
 * POST /v1/webhooks/airtable/:id - Receive Airtable webhook trigger
 * GET  /v1/webhooks/pdfs/:id - Download generated PDF
 */

import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import {
  processWebhook,
  getPdf,
} from "../services/webhook.js";
import type { AirtableWebhookPayload } from "../lib/types.js";

const webhooksPublic = new Hono();

// =============================================================================
// Request Schemas
// =============================================================================

const airtablePayloadSchema = z.object({
  base: z.object({ id: z.string() }).optional(),
  table: z.object({ id: z.string() }).optional(),
  record: z.object({
    id: z.string().min(1, "Record ID is required"),
    fields: z.record(z.unknown()),
  }),
  action: z.enum(["created", "updated"]).optional(),
  timestamp: z.string().optional(),
});

// =============================================================================
// Helper: Get Base URL
// =============================================================================

function getBaseUrl(c: { req: { url: string } }): string {
  const url = new URL(c.req.url);
  // Use Railway URL if in production, otherwise use localhost
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }
  return `${url.protocol}//${url.host}`;
}

// =============================================================================
// Public Routes
// =============================================================================

/**
 * POST /airtable/:id
 * Receive webhook from Airtable automation
 * This is the PUBLIC endpoint that Airtable calls - NO AUTH REQUIRED
 */
webhooksPublic.post(
  "/airtable/:id",
  zValidator("json", airtablePayloadSchema, (result, c) => {
    if (!result.success) {
      return c.json({
        success: false,
        error: "Invalid payload",
        code: "VALIDATION_ERROR",
        details: result.error.issues,
      }, 400);
    }
    return;
  }),
  async (c) => {
    const { id } = c.req.param();
    const payload = c.req.valid("json") as AirtableWebhookPayload;
    const baseUrl = getBaseUrl(c);

    console.log(`[Webhook] Received trigger for ${id}:`, {
      recordId: payload.record.id,
      action: payload.action || "updated",
      fieldCount: Object.keys(payload.record.fields).length,
    });

    // Process the webhook (generate PDF)
    const result = await processWebhook(id, payload, baseUrl);

    if (result.success) {
      console.log(`[Webhook] Success for ${id}: ${result.filename} (${result.processingTimeMs}ms)`);
    } else {
      console.error(`[Webhook] Failed for ${id}: ${result.error}`);
    }

    // Always return 200 to Airtable (even on failure)
    // This prevents Airtable from retrying on our application errors
    return c.json(result);
  }
);

/**
 * GET /pdfs/:id
 * Download a generated PDF
 * Public endpoint - PDFs are accessed via unique IDs (security through obscurity)
 */
webhooksPublic.get("/pdfs/:id", async (c) => {
  const { id } = c.req.param();

  const pdf = getPdf(id);

  if (!pdf) {
    return c.json({
      success: false,
      error: "PDF not found or expired (PDFs expire after 24 hours)",
      code: "PDF_NOT_FOUND",
    }, 404);
  }

  c.header("Content-Type", "application/pdf");
  c.header("Content-Disposition", `attachment; filename="${pdf.filename}"`);
  c.header("Content-Length", pdf.buffer.length.toString());
  c.header("Cache-Control", "private, max-age=3600"); // Cache for 1 hour

  return c.body(new Uint8Array(pdf.buffer));
});

export default webhooksPublic;
