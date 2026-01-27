/**
 * Event Subscription Routes (Zapier/Make Integration)
 * Subscribe to Glyph events and receive webhooks when they occur
 *
 * POST /v1/subscriptions - Create a new event subscription
 * GET  /v1/subscriptions - List all subscriptions
 * GET  /v1/subscriptions/:id - Get subscription details
 * DELETE /v1/subscriptions/:id - Delete a subscription
 *
 * Events:
 * - pdf.generated: Fired when a PDF is successfully generated
 * - template.modified: Fired when a template is modified via AI
 */

import { Hono } from "hono";
import { z } from "zod";
import type { ApiError } from "../lib/types.js";

const subscriptions = new Hono();

// =============================================================================
// Types
// =============================================================================

export interface EventSubscription {
  id: string;
  userId: string;
  url: string;
  events: string[];
  secret?: string;
  createdAt: Date;
  lastTriggeredAt?: Date;
  triggerCount: number;
}

// Valid event types that can be subscribed to
export const VALID_EVENTS = ["pdf.generated", "template.modified"] as const;
export type EventType = (typeof VALID_EVENTS)[number];

// =============================================================================
// In-Memory Storage (for demo tier)
// Production would use Supabase
// =============================================================================

const subscriptionStore = new Map<string, EventSubscription>();

// =============================================================================
// ID Generation
// =============================================================================

function generateSubscriptionId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "sub_";
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// =============================================================================
// Request Schemas
// =============================================================================

const createSubscriptionSchema = z.object({
  url: z.string().url("Must be a valid URL"),
  events: z
    .array(z.enum(VALID_EVENTS))
    .min(1, "At least one event is required"),
  secret: z.string().optional(),
});

// =============================================================================
// Routes
// =============================================================================

/**
 * POST /
 * Register a new event subscription
 */
subscriptions.post("/", async (c) => {
  try {
    const body = await c.req.json();

    // Validate request
    const parsed = createSubscriptionSchema.safeParse(body);
    if (!parsed.success) {
      const error: ApiError = {
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: parsed.error.issues,
      };
      return c.json(error, 400);
    }

    const { url, events, secret } = parsed.data;
    const userId = (c.get("apiKeyId") as string | undefined) || "demo";

    const id = generateSubscriptionId();

    const subscription: EventSubscription = {
      id,
      userId,
      url,
      events,
      secret,
      createdAt: new Date(),
      triggerCount: 0,
    };

    subscriptionStore.set(id, subscription);

    return c.json(
      {
        id,
        url,
        events,
        createdAt: subscription.createdAt.toISOString(),
      },
      201
    );
  } catch (err) {
    console.error("Create subscription error:", err);
    const error: ApiError = {
      error: err instanceof Error ? err.message : "Unknown error",
      code: "SUBSCRIPTION_CREATE_ERROR",
    };
    return c.json(error, 500);
  }
});

/**
 * GET /
 * List all subscriptions for the authenticated user
 */
subscriptions.get("/", async (c) => {
  try {
    const userId = (c.get("apiKeyId") as string | undefined) || "demo";

    const userSubscriptions = Array.from(subscriptionStore.values())
      .filter((sub) => sub.userId === userId)
      .map(({ id, url, events, createdAt, lastTriggeredAt, triggerCount }) => ({
        id,
        url,
        events,
        createdAt: createdAt.toISOString(),
        lastTriggeredAt: lastTriggeredAt?.toISOString() || null,
        triggerCount,
      }));

    return c.json({
      subscriptions: userSubscriptions,
      count: userSubscriptions.length,
    });
  } catch (err) {
    console.error("List subscriptions error:", err);
    const error: ApiError = {
      error: err instanceof Error ? err.message : "Unknown error",
      code: "SUBSCRIPTION_LIST_ERROR",
    };
    return c.json(error, 500);
  }
});

/**
 * GET /:id
 * Get subscription details
 */
subscriptions.get("/:id", async (c) => {
  try {
    const { id } = c.req.param();
    const userId = (c.get("apiKeyId") as string | undefined) || "demo";

    const subscription = subscriptionStore.get(id);

    if (!subscription || subscription.userId !== userId) {
      const error: ApiError = {
        error: "Subscription not found",
        code: "SUBSCRIPTION_NOT_FOUND",
      };
      return c.json(error, 404);
    }

    return c.json({
      id: subscription.id,
      url: subscription.url,
      events: subscription.events,
      createdAt: subscription.createdAt.toISOString(),
      lastTriggeredAt: subscription.lastTriggeredAt?.toISOString() || null,
      triggerCount: subscription.triggerCount,
    });
  } catch (err) {
    console.error("Get subscription error:", err);
    const error: ApiError = {
      error: err instanceof Error ? err.message : "Unknown error",
      code: "SUBSCRIPTION_GET_ERROR",
    };
    return c.json(error, 500);
  }
});

/**
 * DELETE /:id
 * Delete a subscription
 */
subscriptions.delete("/:id", async (c) => {
  try {
    const { id } = c.req.param();
    const userId = (c.get("apiKeyId") as string | undefined) || "demo";

    const subscription = subscriptionStore.get(id);

    if (!subscription || subscription.userId !== userId) {
      const error: ApiError = {
        error: "Subscription not found",
        code: "SUBSCRIPTION_NOT_FOUND",
      };
      return c.json(error, 404);
    }

    subscriptionStore.delete(id);

    return c.json({ success: true });
  } catch (err) {
    console.error("Delete subscription error:", err);
    const error: ApiError = {
      error: err instanceof Error ? err.message : "Unknown error",
      code: "SUBSCRIPTION_DELETE_ERROR",
    };
    return c.json(error, 500);
  }
});

// =============================================================================
// Event Triggering (exported for use by other routes)
// =============================================================================

/**
 * Trigger all subscriptions for a given event
 * Called from other routes when events occur (e.g., generate.ts, modify.ts)
 */
export async function triggerEventSubscriptions(
  event: EventType,
  payload: Record<string, unknown>
): Promise<void> {
  const matchingSubscriptions = Array.from(subscriptionStore.values()).filter(
    (sub) => sub.events.includes(event)
  );

  if (matchingSubscriptions.length === 0) {
    return;
  }

  console.log(
    `[Subscriptions] Triggering ${matchingSubscriptions.length} subscription(s) for event: ${event}`
  );

  // Fire webhooks in parallel (non-blocking)
  const promises = matchingSubscriptions.map(async (subscription) => {
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Glyph-Event": event,
        "X-Glyph-Timestamp": new Date().toISOString(),
      };

      if (subscription.secret) {
        headers["X-Webhook-Secret"] = subscription.secret;
      }

      const response = await fetch(subscription.url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          event,
          timestamp: new Date().toISOString(),
          data: payload,
        }),
      });

      // Update stats regardless of response
      subscription.lastTriggeredAt = new Date();
      subscription.triggerCount++;
      subscriptionStore.set(subscription.id, subscription);

      if (!response.ok) {
        console.warn(
          `[Subscriptions] Webhook ${subscription.id} returned ${response.status}`
        );
      } else {
        console.log(
          `[Subscriptions] Webhook ${subscription.id} triggered successfully`
        );
      }
    } catch (error) {
      console.error(
        `[Subscriptions] Failed to trigger webhook ${subscription.id}:`,
        error
      );
      // Still update stats on failure
      subscription.lastTriggeredAt = new Date();
      subscription.triggerCount++;
      subscriptionStore.set(subscription.id, subscription);
    }
  });

  // Don't await - fire and forget
  Promise.allSettled(promises);
}

export default subscriptions;
