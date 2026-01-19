/**
 * Dashboard API Routes
 * GET /v1/dashboard - Get usage metrics and key info
 * POST /v1/keys/regenerate - Regenerate API key
 */

import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { getSupabase, supabase } from "../lib/supabase.js";
import { generateApiKey } from "../middleware/auth.js";
import { createHash } from "crypto";

const dashboard = new Hono();

/**
 * GET /v1/dashboard
 * Returns usage metrics and key metadata for the authenticated API key
 */
dashboard.get("/", async (c) => {
  const apiKeyId = c.get("apiKeyId");
  const tier = c.get("tier");
  const monthlyLimit = c.get("monthlyLimit");
  const currentUsage = c.get("currentUsage");

  if (!supabase) {
    // Development mode - return mock data
    return c.json({
      key: {
        prefix: "gk_dev12345",
        name: "Development Key",
        tier: "pro",
        createdAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
      },
      usage: {
        today: 12,
        thisMonth: 47,
        pdfsGenerated: 23,
        monthlyLimit: 1000,
        resetDate: getNextResetDate(),
      },
      rateLimit: {
        current: 47,
        limit: 1000,
        percentage: 4.7,
      },
    });
  }

  try {
    // Get key metadata
    const { data: keyData, error: keyError } = await getSupabase()
      .from("api_keys")
      .select("key_prefix, name, tier, created_at, last_used_at")
      .eq("id", apiKeyId)
      .single();

    if (keyError || !keyData) {
      throw new HTTPException(404, { message: "API key not found" });
    }

    // Get today's usage
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { count: todayCount } = await getSupabase()
      .from("usage")
      .select("*", { count: "exact", head: true })
      .eq("api_key_id", apiKeyId)
      .gte("created_at", todayStart.toISOString());

    // Get PDFs generated this month
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const { count: pdfCount } = await getSupabase()
      .from("usage")
      .select("*", { count: "exact", head: true })
      .eq("api_key_id", apiKeyId)
      .eq("pdf_generated", true)
      .gte("created_at", monthStart.toISOString());

    const percentage = monthlyLimit > 0
      ? Math.round((currentUsage / monthlyLimit) * 1000) / 10
      : 0;

    return c.json({
      key: {
        prefix: keyData.key_prefix,
        name: keyData.name,
        tier: keyData.tier,
        createdAt: keyData.created_at,
        lastUsedAt: keyData.last_used_at,
      },
      usage: {
        today: todayCount || 0,
        thisMonth: currentUsage,
        pdfsGenerated: pdfCount || 0,
        monthlyLimit: monthlyLimit,
        resetDate: getNextResetDate(),
      },
      rateLimit: {
        current: currentUsage,
        limit: monthlyLimit,
        percentage,
      },
    });
  } catch (err) {
    if (err instanceof HTTPException) throw err;
    console.error("Dashboard error:", err);
    throw new HTTPException(500, { message: "Failed to fetch dashboard data" });
  }
});

// Helper to get next billing cycle reset date
function getNextResetDate(): string {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return nextMonth.toISOString();
}

export default dashboard;
