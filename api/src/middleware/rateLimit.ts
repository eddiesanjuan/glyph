/**
 * Rate Limiting Middleware
 * Production-ready rate limiter with tier-based limits
 * Uses in-memory store (replace with Redis in production for multi-instance)
 */

import type { Context, Next } from "hono";

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

// Tier-based rate limits (requests per minute)
const TIER_LIMITS: Record<string, RateLimitConfig> = {
  demo: { windowMs: 60000, maxRequests: 20 }, // 20/min for playground demo
  free: { windowMs: 60000, maxRequests: 10 }, // 10/min
  pro: { windowMs: 60000, maxRequests: 60 }, // 60/min
  scale: { windowMs: 60000, maxRequests: 120 }, // 120/min
  enterprise: { windowMs: 60000, maxRequests: 300 }, // 300/min
};

// Monthly PDF generation limits by tier
const MONTHLY_LIMITS: Record<string, number> = {
  demo: Infinity, // Unlimited for playground demo (in-memory sessions only)
  free: 100,
  pro: 1000,
  scale: 10000,
  enterprise: Infinity,
};

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory rate tracking (would use Redis in production)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean up every minute

/**
 * Tier-based rate limiting middleware
 * Uses apiKeyId from auth middleware for tracking
 */
export async function rateLimitMiddleware(c: Context, next: Next) {
  const apiKeyId = c.get("apiKeyId");
  const tier = c.get("tier") || "free";

  // Skip rate limiting for health check
  if (c.req.path === "/health") {
    return next();
  }

  // If no apiKeyId, fall back to IP-based limiting with free tier limits
  const key = apiKeyId ? `rate:${apiKeyId}` : `rate:ip:${getClientIP(c)}`;
  const config = TIER_LIMITS[tier] || TIER_LIMITS.free;
  const now = Date.now();

  // Get or create rate limit entry
  let entry = rateLimitStore.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + config.windowMs };
    rateLimitStore.set(key, entry);
  }

  entry.count++;

  // Set rate limit headers
  c.header("X-RateLimit-Limit", config.maxRequests.toString());
  c.header(
    "X-RateLimit-Remaining",
    Math.max(0, config.maxRequests - entry.count).toString()
  );
  c.header("X-RateLimit-Reset", Math.ceil(entry.resetAt / 1000).toString());

  if (entry.count > config.maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    c.header("Retry-After", retryAfter.toString());
    return c.json(
      {
        error: "Rate limit exceeded",
        code: "RATE_LIMIT_EXCEEDED",
        retryAfter,
        tier,
        limit: config.maxRequests,
        windowMs: config.windowMs,
      },
      429
    );
  }

  await next();
}

/**
 * Monthly PDF generation limit middleware
 * Should only be applied to /v1/generate endpoint
 */
export async function monthlyLimitMiddleware(c: Context, next: Next) {
  const tier = c.get("tier") || "free";
  const currentUsage = c.get("currentUsage") || 0;
  const monthlyLimit = MONTHLY_LIMITS[tier];

  // Enterprise has unlimited
  if (monthlyLimit === Infinity) {
    return next();
  }

  // Set monthly usage headers
  c.header("X-Monthly-Limit", monthlyLimit.toString());
  c.header("X-Monthly-Used", currentUsage.toString());
  c.header(
    "X-Monthly-Remaining",
    Math.max(0, monthlyLimit - currentUsage).toString()
  );

  if (currentUsage >= monthlyLimit) {
    return c.json(
      {
        error: "Monthly PDF limit exceeded",
        code: "MONTHLY_LIMIT_EXCEEDED",
        limit: monthlyLimit,
        used: currentUsage,
        tier,
        upgrade: tier !== "enterprise" ? "https://glyph.you/pricing" : null,
      },
      429
    );
  }

  await next();
}

/**
 * Extract client IP from request
 */
function getClientIP(c: Context): string {
  return (
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
    c.req.header("x-real-ip") ||
    "unknown"
  );
}
