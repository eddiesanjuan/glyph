/**
 * Notification Webhooks Service
 * In-memory store for webhook URLs that receive event notifications
 * when PDF generation completes or modifications are applied.
 *
 * Events:
 * - pdf.generated: Fired after successful PDF generation
 * - modify.completed: Fired after successful AI modification
 */

// =============================================================================
// Types
// =============================================================================

export const NOTIFICATION_EVENTS = ["pdf.generated", "modify.completed"] as const;
export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];

export interface NotificationWebhook {
  id: string;
  apiKeyId: string;
  url: string;
  events: NotificationEvent[];
  created_at: string;
}

export interface WebhookPayload {
  event: NotificationEvent;
  timestamp: string;
  [key: string]: unknown;
}

// =============================================================================
// In-Memory Storage (keyed by API key)
// =============================================================================

const webhookStore = new Map<string, NotificationWebhook[]>();

// =============================================================================
// Helpers
// =============================================================================

function generateId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "nwh_";
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// =============================================================================
// CRUD Operations
// =============================================================================

export function createNotificationWebhook(
  apiKeyId: string,
  url: string,
  events: NotificationEvent[]
): NotificationWebhook {
  const webhook: NotificationWebhook = {
    id: generateId(),
    apiKeyId,
    url,
    events,
    created_at: new Date().toISOString(),
  };

  const existing = webhookStore.get(apiKeyId) || [];
  existing.push(webhook);
  webhookStore.set(apiKeyId, existing);

  return webhook;
}

export function listNotificationWebhooks(apiKeyId: string): NotificationWebhook[] {
  return webhookStore.get(apiKeyId) || [];
}

export function deleteNotificationWebhook(apiKeyId: string, webhookId: string): boolean {
  const existing = webhookStore.get(apiKeyId);
  if (!existing) return false;

  const index = existing.findIndex((w) => w.id === webhookId);
  if (index === -1) return false;

  existing.splice(index, 1);
  webhookStore.set(apiKeyId, existing);
  return true;
}

// =============================================================================
// Fire-and-forget delivery
// =============================================================================

/**
 * Fire notification webhooks for all API keys that have subscriptions
 * matching the given event. Non-blocking.
 */
export function fireNotificationWebhooks(
  event: NotificationEvent,
  payload: Record<string, unknown>
): void {
  const allWebhooks = Array.from(webhookStore.values()).flat();
  const matching = allWebhooks.filter((w) => w.events.includes(event));

  if (matching.length === 0) return;

  console.log(
    `[NotificationWebhooks] Firing ${matching.length} webhook(s) for event: ${event}`
  );

  for (const webhook of matching) {
    fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Glyph-Event": event,
        "X-Glyph-Webhook-Id": webhook.id,
      },
      body: JSON.stringify({
        event,
        timestamp: new Date().toISOString(),
        ...payload,
      }),
    }).catch((err) => {
      console.error(
        `[NotificationWebhooks] Failed to deliver to ${webhook.url}:`,
        err instanceof Error ? err.message : err
      );
    });
  }
}
