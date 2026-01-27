/**
 * Notification Webhook Routes
 * Register webhook URLs to receive notifications when events occur.
 *
 * POST   /v1/notification-webhooks     - Register a webhook
 * GET    /v1/notification-webhooks     - List webhooks for this API key
 * DELETE /v1/notification-webhooks/:id - Remove a webhook
 *
 * Supported events: pdf.generated, modify.completed
 */

import { Hono } from "hono";
import { z } from "zod";
import type { ApiError } from "../lib/types.js";
import {
  NOTIFICATION_EVENTS,
  createNotificationWebhook,
  listNotificationWebhooks,
  deleteNotificationWebhook,
} from "../services/notificationWebhooks.js";

const notificationWebhooks = new Hono();

// =============================================================================
// Request Schema
// =============================================================================

const createSchema = z.object({
  url: z
    .string()
    .url("Must be a valid URL")
    .refine((u) => u.startsWith("https://"), {
      message: "Webhook URL must use HTTPS",
    }),
  events: z
    .array(z.enum(NOTIFICATION_EVENTS))
    .min(1, "At least one event is required"),
});

// =============================================================================
// Routes
// =============================================================================

/**
 * POST /
 * Register a new notification webhook
 */
notificationWebhooks.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = createSchema.safeParse(body);

    if (!parsed.success) {
      const error: ApiError = {
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: parsed.error.issues,
      };
      return c.json(error, 400);
    }

    const apiKeyId = (c.get("apiKeyId") as string | undefined) || "demo";
    const { url, events } = parsed.data;

    const webhook = createNotificationWebhook(apiKeyId, url, events);

    return c.json(
      {
        id: webhook.id,
        url: webhook.url,
        events: webhook.events,
        created_at: webhook.created_at,
      },
      201
    );
  } catch (err) {
    console.error("Create notification webhook error:", err);
    const error: ApiError = {
      error: err instanceof Error ? err.message : "Unknown error",
      code: "NOTIFICATION_WEBHOOK_CREATE_ERROR",
    };
    return c.json(error, 500);
  }
});

/**
 * GET /
 * List notification webhooks for the authenticated API key
 */
notificationWebhooks.get("/", async (c) => {
  try {
    const apiKeyId = (c.get("apiKeyId") as string | undefined) || "demo";
    const webhooks = listNotificationWebhooks(apiKeyId);

    return c.json({
      webhooks: webhooks.map(({ id, url, events, created_at }) => ({
        id,
        url,
        events,
        created_at,
      })),
      count: webhooks.length,
    });
  } catch (err) {
    console.error("List notification webhooks error:", err);
    const error: ApiError = {
      error: err instanceof Error ? err.message : "Unknown error",
      code: "NOTIFICATION_WEBHOOK_LIST_ERROR",
    };
    return c.json(error, 500);
  }
});

/**
 * DELETE /:id
 * Remove a notification webhook
 */
notificationWebhooks.delete("/:id", async (c) => {
  try {
    const { id } = c.req.param();
    const apiKeyId = (c.get("apiKeyId") as string | undefined) || "demo";

    const deleted = deleteNotificationWebhook(apiKeyId, id);

    if (!deleted) {
      const error: ApiError = {
        error: "Webhook not found",
        code: "NOTIFICATION_WEBHOOK_NOT_FOUND",
      };
      return c.json(error, 404);
    }

    return c.json({ success: true });
  } catch (err) {
    console.error("Delete notification webhook error:", err);
    const error: ApiError = {
      error: err instanceof Error ? err.message : "Unknown error",
      code: "NOTIFICATION_WEBHOOK_DELETE_ERROR",
    };
    return c.json(error, 500);
  }
});

export default notificationWebhooks;
