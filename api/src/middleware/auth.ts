/**
 * Authentication Middleware
 * Validates API keys from Authorization header against Supabase
 */

import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { createHash } from "crypto";
import { supabase, getSupabase } from "../lib/supabase.js";

// For development mode when Supabase isn't configured
const DEV_API_KEYS = new Set(
  [process.env.GLYPH_API_KEY, process.env.GLYPH_TEST_API_KEY].filter(Boolean)
);

// In-memory cache for monthly usage counts
// Reduces Supabase queries from every request to once per 5 minutes per key
interface UsageCacheEntry {
  count: number;
  timestamp: number;
}

const usageCache = new Map<string, UsageCacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

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

  // Validate key format
  if (!token.startsWith("gk_")) {
    throw new HTTPException(401, {
      message: "Invalid API key format. Keys should start with 'gk_'",
    });
  }

  // Allow demo/test keys to bypass database validation
  // This ensures the playground demo always works
  if (DEV_API_KEYS.has(token)) {
    c.set("tier", "demo");
    c.set("monthlyLimit", 1000);
    c.set("currentUsage", 0);
    return next();
  }

  // If Supabase is configured, validate against database
  if (supabase) {
    try {
      // Hash the key to look up
      const keyHash = createHash("sha256").update(token).digest("hex");

      const { data: keyRecord, error } = await getSupabase()
        .from("api_keys")
        .select("id, tier, monthly_limit, is_active")
        .eq("key_hash", keyHash)
        .single();

      if (error || !keyRecord) {
        throw new HTTPException(401, {
          message: "Invalid API key",
        });
      }

      // Check if key is active
      if (!keyRecord.is_active) {
        throw new HTTPException(403, {
          message: "API key is deactivated. Please contact support to reactivate.",
        });
      }

      // Note: expires_at column doesn't exist in database yet
      // When it's added, uncomment this check:
      // if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
      //   throw new HTTPException(403, {
      //     message: "API key has expired. Please renew your subscription or generate a new key.",
      //   });
      // }

      // Check monthly usage limits with caching
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      // Check cache first
      const cacheKey = keyRecord.id;
      const cached = usageCache.get(cacheKey);
      const now = Date.now();

      let count: number | null;

      if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
        // Cache hit - use cached value
        count = cached.count;
      } else {
        // Cache miss or expired - query Supabase
        const result = await getSupabase()
          .from("usage")
          .select("*", { count: "exact", head: true })
          .eq("api_key_id", keyRecord.id)
          .gte("created_at", monthStart.toISOString());

        count = result.count;

        // Update cache
        if (count !== null) {
          usageCache.set(cacheKey, { count, timestamp: now });
        }
      }

      if (count !== null && count >= keyRecord.monthly_limit) {
        throw new HTTPException(429, {
          message: `Monthly API limit exceeded (${keyRecord.monthly_limit} requests)`,
        });
      }

      // Set context for downstream handlers
      c.set("apiKeyId", keyRecord.id);
      c.set("tier", keyRecord.tier);
      c.set("monthlyLimit", keyRecord.monthly_limit);
      c.set("currentUsage", count || 0);

      // Update last_used_at (fire and forget)
      getSupabase()
        .from("api_keys")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", keyRecord.id)
        .then(({ error }) => {
          if (error) {
            console.error("Error updating last_used_at:", error);
          }
        });

      return next();
    } catch (err) {
      if (err instanceof HTTPException) {
        throw err;
      }
      console.error("Auth middleware error:", err);
      throw new HTTPException(500, {
        message: "Authentication service error",
      });
    }
  }

  // Fallback: Development mode when Supabase isn't configured
  if (DEV_API_KEYS.size === 0) {
    console.warn(
      "No Supabase or API keys configured. Allowing all requests in development."
    );
    return next();
  }

  if (!DEV_API_KEYS.has(token)) {
    throw new HTTPException(403, {
      message: "Invalid API key",
    });
  }

  return next();
}

export function extractApiKey(c: Context): string | null {
  const authHeader = c.req.header("Authorization");
  if (!authHeader) return null;

  const [type, token] = authHeader.split(" ");
  if (type !== "Bearer") return null;

  return token || null;
}

/**
 * Helper function to generate a new API key
 * Returns both the raw key (to give to user) and the hash (to store in DB)
 */
export function generateApiKey(): { key: string; hash: string; prefix: string } {
  // Generate random bytes and convert to base64
  const randomBytes = crypto.getRandomValues(new Uint8Array(24));
  const randomString = Buffer.from(randomBytes)
    .toString("base64")
    .replace(/[+/=]/g, "")
    .slice(0, 24);

  const key = `gk_${randomString}`;
  const hash = createHash("sha256").update(key).digest("hex");
  const prefix = key.slice(0, 11); // "gk_" + first 8 chars

  return { key, hash, prefix };
}
