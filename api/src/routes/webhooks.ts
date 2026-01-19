/**
 * Webhook Routes
 * Endpoints for creating and receiving webhooks for automated PDF generation
 *
 * POST /v1/webhooks - Create a new webhook configuration
 * GET  /v1/webhooks - List all webhooks
 * GET  /v1/webhooks/:id - Get webhook details
 * DELETE /v1/webhooks/:id - Delete a webhook
 * POST /v1/webhooks/airtable/:id - Receive Airtable webhook (public, no auth)
 * GET  /v1/webhooks/pdfs/:id - Download generated PDF
 */

import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import {
  createWebhook,
  getWebhook,
  listWebhooks,
  deleteWebhook,
  processWebhook,
  getPdf,
  generateSetupInstructions,
} from "../services/webhook.js";
import type { ApiError, AirtableWebhookPayload } from "../lib/types.js";

const webhooks = new Hono();

// =============================================================================
// Request Schemas
// =============================================================================

const createWebhookSchema = z.object({
  template: z.string().min(1, "Template HTML is required"),
  airtable: z.object({
    baseId: z.string().min(1, "Base ID is required"),
    tableId: z.string().min(1, "Table ID is required"),
    apiKey: z.string().optional(),
  }),
  filenameTemplate: z.string().optional().default("document-{{record.id}}.pdf"),
  actions: z
    .array(z.enum(["created", "updated"]))
    .optional()
    .default(["created", "updated"]),
  delivery: z
    .object({
      type: z.enum(["url", "email", "storage"]).default("storage"),
      destination: z.string().optional(),
      // Email delivery options
      emailTo: z.string().optional(),         // Static or "{{fields.Email}}"
      emailSubject: z.string().optional(),    // Subject with Mustache support
      emailBody: z.string().optional(),       // HTML body with Mustache support
      emailFrom: z.string().optional(),       // Custom from address
      emailReplyTo: z.string().optional(),    // Reply-to address
    })
    .optional(),
  pdfOptions: z
    .object({
      format: z.enum(["letter", "a4"]).optional(),
      landscape: z.boolean().optional(),
      scale: z.number().min(0.1).max(2).optional(),
    })
    .optional(),
});

const airtablePayloadSchema = z.object({
  base: z
    .object({
      id: z.string(),
    })
    .optional(),
  table: z
    .object({
      id: z.string(),
    })
    .optional(),
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
// Authenticated Routes (require API key)
// =============================================================================

/**
 * POST /
 * Create a new webhook configuration
 */
webhooks.post(
  "/",
  zValidator("json", createWebhookSchema, (result, c) => {
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
      const body = c.req.valid("json");
      const baseUrl = getBaseUrl(c);

      // Create webhook
      const config = createWebhook({
        template: body.template,
        airtable: body.airtable,
        filenameTemplate: body.filenameTemplate,
        actions: body.actions,
        delivery: body.delivery,
        pdfOptions: body.pdfOptions,
      });

      // Generate webhook URL
      const webhookUrl = `${baseUrl}/v1/webhooks/airtable/${config.id}`;

      // Generate setup instructions
      const instructions = generateSetupInstructions(webhookUrl);

      return c.json({
        success: true,
        webhook: {
          id: config.id,
          webhookUrl,
          airtable: {
            baseId: config.airtable.baseId,
            tableId: config.airtable.tableId,
          },
          filenameTemplate: config.filenameTemplate,
          actions: config.actions,
          delivery: config.delivery,
          createdAt: config.createdAt.toISOString(),
        },
        instructions,
      });
    } catch (err) {
      console.error("Create webhook error:", err);
      const error: ApiError = {
        error: err instanceof Error ? err.message : "Unknown error",
        code: "WEBHOOK_CREATE_ERROR",
      };
      return c.json(error, 500);
    }
  }
);

/**
 * GET /
 * List all webhooks
 */
webhooks.get("/", async (c) => {
  try {
    const configs = listWebhooks();
    const baseUrl = getBaseUrl(c);

    return c.json({
      success: true,
      webhooks: configs.map((config) => ({
        id: config.id,
        webhookUrl: `${baseUrl}/v1/webhooks/airtable/${config.id}`,
        airtable: {
          baseId: config.airtable.baseId,
          tableId: config.airtable.tableId,
        },
        filenameTemplate: config.filenameTemplate,
        actions: config.actions,
        delivery: config.delivery,
        createdAt: config.createdAt.toISOString(),
        lastTriggeredAt: config.lastTriggeredAt?.toISOString() || null,
        triggerCount: config.triggerCount,
      })),
      count: configs.length,
    });
  } catch (err) {
    console.error("List webhooks error:", err);
    const error: ApiError = {
      error: err instanceof Error ? err.message : "Unknown error",
      code: "WEBHOOK_LIST_ERROR",
    };
    return c.json(error, 500);
  }
});

/**
 * GET /:id
 * Get webhook details
 */
webhooks.get("/:id", async (c) => {
  try {
    const { id } = c.req.param();
    const config = getWebhook(id);

    if (!config) {
      const error: ApiError = {
        error: "Webhook not found",
        code: "WEBHOOK_NOT_FOUND",
      };
      return c.json(error, 404);
    }

    const baseUrl = getBaseUrl(c);
    const webhookUrl = `${baseUrl}/v1/webhooks/airtable/${config.id}`;
    const instructions = generateSetupInstructions(webhookUrl);

    return c.json({
      success: true,
      webhook: {
        id: config.id,
        webhookUrl,
        airtable: {
          baseId: config.airtable.baseId,
          tableId: config.airtable.tableId,
        },
        filenameTemplate: config.filenameTemplate,
        actions: config.actions,
        delivery: config.delivery,
        pdfOptions: config.pdfOptions,
        createdAt: config.createdAt.toISOString(),
        lastTriggeredAt: config.lastTriggeredAt?.toISOString() || null,
        triggerCount: config.triggerCount,
      },
      instructions,
    });
  } catch (err) {
    console.error("Get webhook error:", err);
    const error: ApiError = {
      error: err instanceof Error ? err.message : "Unknown error",
      code: "WEBHOOK_GET_ERROR",
    };
    return c.json(error, 500);
  }
});

/**
 * DELETE /:id
 * Delete a webhook
 */
webhooks.delete("/:id", async (c) => {
  try {
    const { id } = c.req.param();

    const existed = deleteWebhook(id);

    if (!existed) {
      const error: ApiError = {
        error: "Webhook not found",
        code: "WEBHOOK_NOT_FOUND",
      };
      return c.json(error, 404);
    }

    return c.json({
      success: true,
      message: "Webhook deleted successfully",
    });
  } catch (err) {
    console.error("Delete webhook error:", err);
    const error: ApiError = {
      error: err instanceof Error ? err.message : "Unknown error",
      code: "WEBHOOK_DELETE_ERROR",
    };
    return c.json(error, 500);
  }
});

// =============================================================================
// Public Routes (no auth required - called by Airtable)
// =============================================================================

/**
 * POST /airtable/:id
 * Receive webhook from Airtable automation
 * This is the PUBLIC endpoint that Airtable calls
 */
webhooks.post(
  "/airtable/:id",
  zValidator("json", airtablePayloadSchema, (result, c) => {
    if (!result.success) {
      const error: ApiError = {
        error: "Invalid payload",
        code: "VALIDATION_ERROR",
        details: result.error.issues,
      };
      return c.json(error, 400);
    }
    return;
  }),
  async (c) => {
    const { id } = c.req.param();
    const payload = c.req.valid("json") as AirtableWebhookPayload;
    const baseUrl = getBaseUrl(c);

    console.log(`[Webhook] Received trigger for ${id}:`, {
      recordId: payload.record.id,
      action: payload.action,
      fieldCount: Object.keys(payload.record.fields).length,
    });

    // Process the webhook
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
 * Public endpoint - PDFs are accessed via unique IDs
 */
webhooks.get("/pdfs/:id", async (c) => {
  const { id } = c.req.param();

  const pdf = getPdf(id);

  if (!pdf) {
    const error: ApiError = {
      error: "PDF not found or expired",
      code: "PDF_NOT_FOUND",
    };
    return c.json(error, 404);
  }

  c.header("Content-Type", "application/pdf");
  c.header("Content-Disposition", `attachment; filename="${pdf.filename}"`);
  c.header("Content-Length", pdf.buffer.length.toString());

  return c.body(new Uint8Array(pdf.buffer));
});

/**
 * GET /test/:id
 * Test a webhook with sample data (for debugging)
 */
webhooks.get("/test/:id", async (c) => {
  const { id } = c.req.param();

  const config = getWebhook(id);

  if (!config) {
    const error: ApiError = {
      error: "Webhook not found",
      code: "WEBHOOK_NOT_FOUND",
    };
    return c.json(error, 404);
  }

  // Create sample payload for testing
  const samplePayload: AirtableWebhookPayload = {
    base: { id: config.airtable.baseId },
    table: { id: config.airtable.tableId },
    record: {
      id: "recTEST123456789",
      fields: {
        Name: "Test Record",
        Email: "test@example.com",
        Amount: 1234.56,
        Date: new Date().toISOString().split("T")[0],
        Status: "Active",
        Notes: "This is a test record generated by Glyph webhook tester.",
      },
    },
    action: "created",
    timestamp: new Date().toISOString(),
  };

  const baseUrl = getBaseUrl(c);
  const result = await processWebhook(id, samplePayload, baseUrl);

  return c.json({
    success: result.success,
    message: result.success
      ? "Test PDF generated successfully"
      : "Test failed",
    result,
    samplePayload,
  });
});

export default webhooks;
