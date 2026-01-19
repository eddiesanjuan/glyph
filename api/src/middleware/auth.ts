/**
 * Authentication Middleware
 * Validates API keys from Authorization header
 */

import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";

// In production, validate against Supabase
const VALID_API_KEYS = new Set([
  process.env.GLYPH_API_KEY,
  process.env.GLYPH_TEST_API_KEY,
].filter(Boolean));

export async function authMiddleware(c: Context, next: Next) {
  // Skip auth for health check
  if (c.req.path === "/health") {
    return next();
  }

  const authHeader = c.req.header("Authorization");

  if (!authHeader) {
    throw new HTTPException(401, {
      message: "Missing Authorization header",
    });
  }

  const [type, token] = authHeader.split(" ");

  if (type !== "Bearer" || !token) {
    throw new HTTPException(401, {
      message: "Invalid Authorization format. Use: Bearer <api_key>",
    });
  }

  // In development, allow any key if no keys configured
  if (VALID_API_KEYS.size === 0) {
    console.warn("No API keys configured. Allowing all requests in development.");
    return next();
  }

  if (!VALID_API_KEYS.has(token)) {
    throw new HTTPException(403, {
      message: "Invalid API key",
    });
  }

  // TODO: Look up API key in Supabase to get user/org context
  // c.set('userId', keyRecord.userId);
  // c.set('orgId', keyRecord.orgId);

  return next();
}

export function extractApiKey(c: Context): string | null {
  const authHeader = c.req.header("Authorization");
  if (!authHeader) return null;

  const [type, token] = authHeader.split(" ");
  if (type !== "Bearer") return null;

  return token || null;
}
