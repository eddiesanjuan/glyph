/**
 * Rate Limiting Middleware
 * Simple in-memory rate limiter (use Redis in production)
 */

import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store (replace with Redis in production)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Default limits
const DEFAULT_WINDOW_MS = 60 * 1000; // 1 minute
const DEFAULT_MAX_REQUESTS = 60; // 60 requests per minute

interface RateLimitConfig {
  windowMs?: number;
  maxRequests?: number;
  keyGenerator?: (c: Context) => string;
}

export function rateLimitMiddleware(config: RateLimitConfig = {}) {
  const {
    windowMs = DEFAULT_WINDOW_MS,
    maxRequests = DEFAULT_MAX_REQUESTS,
    keyGenerator = (c) => c.req.header("Authorization") || c.req.header("x-forwarded-for") || "anonymous",
  } = config;

  // Clean up expired entries periodically
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (entry.resetAt < now) {
        rateLimitStore.delete(key);
      }
    }
  }, windowMs);

  return async (c: Context, next: Next) => {
    // Skip rate limiting for health check
    if (c.req.path === "/health") {
      return next();
    }

    const key = keyGenerator(c);
    const now = Date.now();

    let entry = rateLimitStore.get(key);

    if (!entry || entry.resetAt < now) {
      entry = {
        count: 0,
        resetAt: now + windowMs,
      };
    }

    entry.count++;
    rateLimitStore.set(key, entry);

    // Set rate limit headers
    const remaining = Math.max(0, maxRequests - entry.count);
    c.header("X-RateLimit-Limit", String(maxRequests));
    c.header("X-RateLimit-Remaining", String(remaining));
    c.header("X-RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > maxRequests) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      c.header("Retry-After", String(retryAfter));

      throw new HTTPException(429, {
        message: `Rate limit exceeded. Retry after ${retryAfter} seconds.`,
      });
    }

    return next();
  };
}

// Specific rate limits for expensive operations
export const generateRateLimit = rateLimitMiddleware({
  windowMs: 60 * 1000,
  maxRequests: 10, // 10 PDF generations per minute
});

export const modifyRateLimit = rateLimitMiddleware({
  windowMs: 60 * 1000,
  maxRequests: 30, // 30 AI modifications per minute
});
