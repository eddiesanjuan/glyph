/**
 * API Key Management Routes
 * POST /v1/keys/regenerate - Regenerate API key
 */

import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { getSupabase, supabase } from "../lib/supabase.js";
import { generateApiKey } from "../middleware/auth.js";
import "../types/hono.js"; // Import type extensions

const keys = new Hono();

/**
 * POST /v1/keys/regenerate
 * Regenerates the current API key and returns the new one
 * The new key is only shown ONCE - user must store it
 */
keys.post("/regenerate", async (c) => {
  const apiKeyId = c.get("apiKeyId");

  if (!supabase) {
    // Development mode - return mock regenerated key
    const { key, prefix } = generateApiKey();
    return c.json({
      success: true,
      key: key, // Only returned once!
      prefix: prefix,
      message: "API key regenerated. Store this key securely - it won't be shown again.",
      warning: "Development mode - key not persisted",
    });
  }

  try {
    // Generate new key
    const { key, hash, prefix } = generateApiKey();

    // Update the key in database
    const { error } = await getSupabase()
      .from("api_keys")
      .update({
        key_hash: hash,
        key_prefix: prefix,
      })
      .eq("id", apiKeyId);

    if (error) {
      console.error("Key regeneration error:", error);
      throw new HTTPException(500, { message: "Failed to regenerate API key" });
    }

    return c.json({
      success: true,
      key: key, // Only returned once!
      prefix: prefix,
      message: "API key regenerated successfully. Store this key securely - it won't be shown again.",
    });
  } catch (err) {
    if (err instanceof HTTPException) throw err;
    console.error("Key regeneration error:", err);
    throw new HTTPException(500, { message: "Failed to regenerate API key" });
  }
});

export default keys;
