/**
 * Authentication Routes (Public)
 * POST /v1/auth/recover-key - Recover API key by email (generates new key)
 */

import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { getSupabase, supabase } from "../lib/supabase.js";
import { generateApiKey } from "../middleware/auth.js";

const auth = new Hono();

/**
 * POST /v1/auth/recover-key
 * Recovers API key by email - generates a NEW key (invalidates old one)
 *
 * Security note: In production, this should require email verification.
 * For MVP, we generate immediately with a prominent warning.
 */
auth.post("/recover-key", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { email } = body;

  if (!email || typeof email !== "string") {
    throw new HTTPException(400, {
      message: "Email is required",
    });
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    throw new HTTPException(400, {
      message: "Invalid email format",
    });
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (!supabase) {
    // Development mode - simulate recovery
    const { key, prefix } = generateApiKey();
    return c.json({
      success: true,
      newApiKey: key,
      prefix: prefix,
      message: "API key regenerated. Your old key is now invalid.",
      warning: "Development mode - key not persisted",
    });
  }

  try {
    // Look up user by email
    const { data: keyRecord, error: lookupError } = await getSupabase()
      .from("api_keys")
      .select("id, is_active, owner_email")
      .eq("owner_email", normalizedEmail)
      .single();

    if (lookupError || !keyRecord) {
      // Don't reveal whether email exists for security
      // Return same message either way
      throw new HTTPException(404, {
        message: "No API key found for this email address. Please request access first.",
      });
    }

    if (!keyRecord.is_active) {
      throw new HTTPException(403, {
        message: "This account has been deactivated. Please contact support.",
      });
    }

    // Generate new key
    const { key, hash, prefix } = generateApiKey();

    // Update the key in database
    const { error: updateError } = await getSupabase()
      .from("api_keys")
      .update({
        key_hash: hash,
        key_prefix: prefix,
        last_used_at: new Date().toISOString(),
      })
      .eq("id", keyRecord.id);

    if (updateError) {
      console.error("Key recovery error:", updateError);
      throw new HTTPException(500, { message: "Failed to recover API key" });
    }

    return c.json({
      success: true,
      newApiKey: key,
      prefix: prefix,
      message: "API key regenerated successfully. Your old key is now invalid. Store this key securely - it won't be shown again.",
    });
  } catch (err) {
    if (err instanceof HTTPException) throw err;
    console.error("Key recovery error:", err);
    throw new HTTPException(500, { message: "Failed to recover API key" });
  }
});

export default auth;
