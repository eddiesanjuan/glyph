/**
 * Beta Invite System Routes
 *
 * POST /v1/beta/request - Submit early access request (public)
 * GET /v1/beta/requests - List pending requests (admin)
 * POST /v1/beta/approve/:requestId - Approve request and generate invite code (admin)
 * POST /v1/beta/reject/:requestId - Reject request (admin)
 * POST /v1/beta/activate - Activate invite code and get API key (public)
 * POST /v1/beta/reissue - Re-issue API key for already-activated invite (public)
 * GET /v1/beta/invites - List all invites (admin)
 * POST /v1/beta/revoke/:inviteId - Revoke invite access (admin)
 */

import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { getSupabase, supabase } from "../lib/supabase.js";
import { generateApiKey } from "../middleware/auth.js";

const beta = new Hono();

// Admin secret for protected routes (in production, use proper auth)
const ADMIN_SECRET = process.env.BETA_ADMIN_SECRET || "glyph_admin_secret_2024";

// Helper to verify admin access
function verifyAdmin(c: { req: { header: (name: string) => string | undefined } }) {
  const adminToken = c.req.header("X-Admin-Token");
  if (adminToken !== ADMIN_SECRET) {
    throw new HTTPException(403, { message: "Admin access required" });
  }
}

// Helper to generate invite code: GLYPH-XXXX-XXXX
function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No confusing chars (0/O, 1/I/L)
  let code = "GLYPH-";

  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  code += "-";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return code;
}

/**
 * POST /v1/beta/request
 * Public endpoint - Submit request for early access
 */
beta.post("/request", async (c) => {
  const body = await c.req.json();
  const { email, name, company, useCase } = body;

  if (!email || !email.includes("@")) {
    throw new HTTPException(400, { message: "Valid email is required" });
  }

  if (!supabase) {
    // Development mode - mock response
    return c.json({
      success: true,
      message: "You're on the list. We're letting in developers who will push Glyph to its limits.",
      position: Math.floor(Math.random() * 50) + 10,
    });
  }

  try {
    // Check if email already exists
    const { data: existing } = await getSupabase()
      .from("beta_requests")
      .select("id, status")
      .eq("email", email.toLowerCase())
      .single();

    if (existing) {
      if (existing.status === "approved") {
        return c.json({
          success: true,
          message: "You've already been approved! Check your email for your invite code.",
          status: "approved",
        });
      }
      return c.json({
        success: true,
        message: "You're already on the list. We'll reach out when it's your turn.",
        status: existing.status,
      });
    }

    // Insert new request
    const { error } = await getSupabase()
      .from("beta_requests")
      .insert({
        email: email.toLowerCase(),
        name: name || null,
        company: company || null,
        use_case: useCase || null,
        status: "pending",
      })
      .select("id")
      .single();

    if (error) {
      console.error("Beta request error:", error);
      throw new HTTPException(500, { message: "Failed to submit request" });
    }

    // Get position in queue
    const { count } = await getSupabase()
      .from("beta_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");

    return c.json({
      success: true,
      message: "You're on the list. We're letting in developers who will push Glyph to its limits.",
      position: count || 1,
    });
  } catch (err) {
    if (err instanceof HTTPException) throw err;
    console.error("Beta request error:", err);
    throw new HTTPException(500, { message: "Failed to submit request" });
  }
});

/**
 * GET /v1/beta/requests
 * Admin endpoint - List all pending requests
 */
beta.get("/requests", async (c) => {
  verifyAdmin(c);

  if (!supabase) {
    return c.json({
      requests: [
        {
          id: "mock-1",
          email: "developer@example.com",
          name: "Jane Developer",
          company: "TechCorp",
          useCase: "Invoice generation for SaaS",
          status: "pending",
          createdAt: new Date().toISOString(),
        },
      ],
      total: 1,
    });
  }

  try {
    const status = c.req.query("status") || "pending";

    const { data, error, count } = await getSupabase()
      .from("beta_requests")
      .select("*", { count: "exact" })
      .eq("status", status)
      .order("created_at", { ascending: false });

    if (error) {
      throw new HTTPException(500, { message: "Failed to fetch requests" });
    }

    return c.json({
      requests: data?.map(r => ({
        id: r.id,
        email: r.email,
        name: r.name,
        company: r.company,
        useCase: r.use_case,
        status: r.status,
        createdAt: r.created_at,
        reviewedAt: r.reviewed_at,
      })) || [],
      total: count || 0,
    });
  } catch (err) {
    if (err instanceof HTTPException) throw err;
    console.error("List requests error:", err);
    throw new HTTPException(500, { message: "Failed to fetch requests" });
  }
});

/**
 * POST /v1/beta/approve/:requestId
 * Admin endpoint - Approve request and generate invite code
 */
beta.post("/approve/:requestId", async (c) => {
  verifyAdmin(c);
  const requestId = c.req.param("requestId");

  if (!supabase) {
    const code = generateInviteCode();
    return c.json({
      success: true,
      inviteCode: code,
      message: "Invite code generated (development mode)",
    });
  }

  try {
    // Get the request
    const { data: request, error: fetchError } = await getSupabase()
      .from("beta_requests")
      .select("*")
      .eq("id", requestId)
      .single();

    if (fetchError || !request) {
      throw new HTTPException(404, { message: "Request not found" });
    }

    if (request.status !== "pending") {
      throw new HTTPException(400, { message: `Request already ${request.status}` });
    }

    // Generate unique invite code
    let inviteCode = generateInviteCode();
    let attempts = 0;

    // Ensure code is unique
    while (attempts < 10) {
      const { data: existing } = await getSupabase()
        .from("beta_invites")
        .select("id")
        .eq("code", inviteCode)
        .single();

      if (!existing) break;
      inviteCode = generateInviteCode();
      attempts++;
    }

    // Update request status
    const { error: updateError } = await getSupabase()
      .from("beta_requests")
      .update({
        status: "approved",
        reviewed_at: new Date().toISOString(),
        reviewed_by: "admin",
      })
      .eq("id", requestId);

    if (updateError) {
      throw new HTTPException(500, { message: "Failed to update request" });
    }

    // Create invite
    const { error: inviteError } = await getSupabase()
      .from("beta_invites")
      .insert({
        code: inviteCode,
        email: request.email,
        request_id: requestId,
      })
      .select()
      .single();

    if (inviteError) {
      console.error("Invite creation error:", inviteError);
      throw new HTTPException(500, { message: "Failed to create invite" });
    }

    return c.json({
      success: true,
      inviteCode: inviteCode,
      email: request.email,
      name: request.name,
      message: "Invite code generated successfully",
      // Email template data for sending
      emailData: {
        to: request.email,
        name: request.name || request.email.split("@")[0],
        code: inviteCode,
      },
    });
  } catch (err) {
    if (err instanceof HTTPException) throw err;
    console.error("Approve request error:", err);
    throw new HTTPException(500, { message: "Failed to approve request" });
  }
});

/**
 * POST /v1/beta/reject/:requestId
 * Admin endpoint - Reject request
 */
beta.post("/reject/:requestId", async (c) => {
  verifyAdmin(c);
  const requestId = c.req.param("requestId");

  if (!supabase) {
    return c.json({
      success: true,
      message: "Request rejected (development mode)",
    });
  }

  try {
    const { error } = await getSupabase()
      .from("beta_requests")
      .update({
        status: "rejected",
        reviewed_at: new Date().toISOString(),
        reviewed_by: "admin",
      })
      .eq("id", requestId);

    if (error) {
      throw new HTTPException(500, { message: "Failed to reject request" });
    }

    return c.json({
      success: true,
      message: "Request rejected",
    });
  } catch (err) {
    if (err instanceof HTTPException) throw err;
    console.error("Reject request error:", err);
    throw new HTTPException(500, { message: "Failed to reject request" });
  }
});

/**
 * POST /v1/beta/activate
 * Public endpoint - Activate invite code and receive API key
 */
beta.post("/activate", async (c) => {
  const body = await c.req.json();
  const { code } = body;

  if (!code) {
    throw new HTTPException(400, { message: "Invite code is required" });
  }

  // Normalize code format
  const normalizedCode = code.toUpperCase().trim();

  if (!supabase) {
    // Development mode - mock successful activation
    const { key, prefix } = generateApiKey();
    return c.json({
      success: true,
      apiKey: key,
      prefix: prefix,
      tier: "beta",
      message: "You're in. Let's build something incredible.",
    });
  }

  try {
    // Find the invite
    const { data: invite, error: fetchError } = await getSupabase()
      .from("beta_invites")
      .select("*")
      .eq("code", normalizedCode)
      .single();

    if (fetchError || !invite) {
      throw new HTTPException(404, {
        message: "Invalid invite code. Please check and try again."
      });
    }

    if (invite.activated_at) {
      throw new HTTPException(400, {
        message: "This invite code has already been used."
      });
    }

    if (invite.revoked) {
      throw new HTTPException(403, {
        message: "This invite code has been revoked."
      });
    }

    // Generate API key
    const { key, hash, prefix } = generateApiKey();

    // Create API key in database
    // Note: tier must be one of: 'free', 'pro', 'scale', 'enterprise'
    // Beta users get 'pro' tier with 500/month limit
    const { data: apiKeyRecord, error: keyError } = await getSupabase()
      .from("api_keys")
      .insert({
        key_hash: hash,
        key_prefix: prefix,
        name: `Beta Access - ${invite.email}`,
        owner_email: invite.email,
        tier: "pro", // Beta users get pro tier
        monthly_limit: 500, // Beta tier limit
        is_active: true,
      })
      .select("id")
      .single();

    if (keyError) {
      console.error("API key creation error:", keyError);
      throw new HTTPException(500, { message: "Failed to create API key" });
    }

    // Update invite as activated
    const { error: updateError } = await getSupabase()
      .from("beta_invites")
      .update({
        activated_at: new Date().toISOString(),
        api_key_id: apiKeyRecord.id,
      })
      .eq("id", invite.id);

    if (updateError) {
      console.error("Invite activation error:", updateError);
      // Don't fail - the key was created successfully
    }

    return c.json({
      success: true,
      apiKey: key,
      prefix: prefix,
      tier: "beta",
      monthlyLimit: 500,
      message: "You're in. Let's build something incredible.",
    });
  } catch (err) {
    if (err instanceof HTTPException) throw err;
    console.error("Activate invite error:", err);
    throw new HTTPException(500, { message: "Failed to activate invite" });
  }
});

/**
 * POST /v1/beta/reissue
 * Public endpoint - Re-issue API key for already-activated invite
 * Use when the original API key doesn't work
 */
beta.post("/reissue", async (c) => {
  const body = await c.req.json();
  const { code } = body;

  if (!code) {
    throw new HTTPException(400, { message: "Invite code is required" });
  }

  const normalizedCode = code.toUpperCase().trim();

  if (!supabase) {
    // Development mode
    const { key, prefix } = generateApiKey();
    return c.json({
      success: true,
      apiKey: key,
      prefix: prefix,
      tier: "beta",
      message: "New API key issued (development mode)",
    });
  }

  try {
    // Find the invite
    const { data: invite, error: fetchError } = await getSupabase()
      .from("beta_invites")
      .select("*")
      .eq("code", normalizedCode)
      .single();

    if (fetchError || !invite) {
      throw new HTTPException(404, {
        message: "Invalid invite code. Please check and try again."
      });
    }

    if (!invite.activated_at) {
      throw new HTTPException(400, {
        message: "This invite code hasn't been activated yet. Use /activate instead."
      });
    }

    if (invite.revoked) {
      throw new HTTPException(403, {
        message: "This invite code has been revoked."
      });
    }

    // Delete the old API key if it exists
    if (invite.api_key_id) {
      await getSupabase()
        .from("api_keys")
        .delete()
        .eq("id", invite.api_key_id);
    }

    // Generate new API key
    const { key, hash, prefix } = generateApiKey();

    // Create new API key in database
    console.log("Creating API key with hash:", hash, "prefix:", prefix);
    const { data: apiKeyRecord, error: keyError } = await getSupabase()
      .from("api_keys")
      .insert({
        key_hash: hash,
        key_prefix: prefix,
        name: `Beta Access - ${invite.email}`,
        owner_email: invite.email,
        tier: "pro",
        monthly_limit: 500,
        is_active: true,
      })
      .select("id")
      .single();

    if (keyError) {
      console.error("API key creation error:", keyError);
      throw new HTTPException(500, { message: "Failed to create API key: " + keyError.message });
    }

    if (!apiKeyRecord) {
      console.error("API key creation returned no record");
      throw new HTTPException(500, { message: "Failed to create API key: no record returned" });
    }

    // Verify the key was stored correctly
    const { data: verifyKey, error: verifyError } = await getSupabase()
      .from("api_keys")
      .select("id, key_hash, is_active")
      .eq("id", apiKeyRecord.id)
      .single();

    console.log("Verification:", verifyKey ? `Found key ${verifyKey.id} with hash ${verifyKey.key_hash?.slice(0, 16)}...` : "NOT FOUND", verifyError?.message || "");

    // Update invite with new API key ID
    await getSupabase()
      .from("beta_invites")
      .update({
        api_key_id: apiKeyRecord.id,
      })
      .eq("id", invite.id);

    return c.json({
      success: true,
      apiKey: key,
      prefix: prefix,
      tier: "beta",
      monthlyLimit: 500,
      message: "New API key issued. Your previous key has been deactivated.",
      // Debug info (remove after fixing)
      _debug: {
        storedHash: hash.slice(0, 16) + "...",
        keyId: apiKeyRecord.id,
        verifySuccess: !!verifyKey,
      },
    });
  } catch (err) {
    if (err instanceof HTTPException) throw err;
    console.error("Reissue API key error:", err);
    throw new HTTPException(500, { message: "Failed to reissue API key" });
  }
});

/**
 * GET /v1/beta/invites
 * Admin endpoint - List all invites
 */
beta.get("/invites", async (c) => {
  verifyAdmin(c);

  if (!supabase) {
    return c.json({
      invites: [
        {
          id: "mock-1",
          code: "GLYPH-TEST-CODE",
          email: "developer@example.com",
          createdAt: new Date().toISOString(),
          activatedAt: null,
          revoked: false,
        },
      ],
      total: 1,
    });
  }

  try {
    const { data, error, count } = await getSupabase()
      .from("beta_invites")
      .select(`
        *,
        beta_requests (name, company, use_case)
      `, { count: "exact" })
      .order("created_at", { ascending: false });

    if (error) {
      throw new HTTPException(500, { message: "Failed to fetch invites" });
    }

    return c.json({
      invites: data?.map(i => ({
        id: i.id,
        code: i.code,
        email: i.email,
        name: i.beta_requests?.name,
        company: i.beta_requests?.company,
        useCase: i.beta_requests?.use_case,
        createdAt: i.created_at,
        activatedAt: i.activated_at,
        revoked: i.revoked,
      })) || [],
      total: count || 0,
    });
  } catch (err) {
    if (err instanceof HTTPException) throw err;
    console.error("List invites error:", err);
    throw new HTTPException(500, { message: "Failed to fetch invites" });
  }
});

/**
 * POST /v1/beta/revoke/:inviteId
 * Admin endpoint - Revoke invite access
 */
beta.post("/revoke/:inviteId", async (c) => {
  verifyAdmin(c);
  const inviteId = c.req.param("inviteId");

  if (!supabase) {
    return c.json({
      success: true,
      message: "Invite revoked (development mode)",
    });
  }

  try {
    // Get the invite with its API key
    const { data: invite, error: fetchError } = await getSupabase()
      .from("beta_invites")
      .select("api_key_id")
      .eq("id", inviteId)
      .single();

    if (fetchError || !invite) {
      throw new HTTPException(404, { message: "Invite not found" });
    }

    // Revoke the invite
    const { error: updateError } = await getSupabase()
      .from("beta_invites")
      .update({ revoked: true })
      .eq("id", inviteId);

    if (updateError) {
      throw new HTTPException(500, { message: "Failed to revoke invite" });
    }

    // Deactivate the API key if it exists
    if (invite.api_key_id) {
      await getSupabase()
        .from("api_keys")
        .update({ is_active: false })
        .eq("id", invite.api_key_id);
    }

    return c.json({
      success: true,
      message: "Invite access revoked",
    });
  } catch (err) {
    if (err instanceof HTTPException) throw err;
    console.error("Revoke invite error:", err);
    throw new HTTPException(500, { message: "Failed to revoke invite" });
  }
});

/**
 * POST /v1/beta/debug-key
 * Debug endpoint - Test key lookup directly (TEMPORARY)
 */
beta.post("/debug-key", async (c) => {
  const body = await c.req.json();
  const { apiKey } = body;

  if (!apiKey) {
    return c.json({ error: "apiKey is required" });
  }

  if (!supabase) {
    return c.json({ error: "Supabase not configured" });
  }

  const { createHash } = await import("crypto");
  const keyHash = createHash("sha256").update(apiKey).digest("hex");

  console.log(`[Debug] Testing key lookup for hash: ${keyHash}`);

  // Try to find by hash - EXACT SAME QUERY AS AUTH MIDDLEWARE
  const { data: authStyleLookup, error: authStyleError } = await getSupabase()
    .from("api_keys")
    .select("id, tier, monthly_limit, is_active, expires_at")
    .eq("key_hash", keyHash)
    .single();

  // Try to find by hash - FULL FIELDS
  const { data: byHash, error: hashError } = await getSupabase()
    .from("api_keys")
    .select("id, key_hash, key_prefix, tier, is_active, owner_email, name, created_at")
    .eq("key_hash", keyHash)
    .single();

  // Also try to find by prefix
  const prefix = apiKey.slice(0, 11);
  const { data: byPrefix, error: prefixError } = await getSupabase()
    .from("api_keys")
    .select("id, key_hash, key_prefix, tier, is_active, owner_email, name, created_at")
    .eq("key_prefix", prefix)
    .single();

  // List all keys for debugging
  const { data: allKeys, error: listError } = await getSupabase()
    .from("api_keys")
    .select("id, key_hash, key_prefix, is_active, owner_email")
    .order("created_at", { ascending: false })
    .limit(10);

  // Test if we can use the same supabase instance that auth uses
  const supabaseInstance = getSupabase();
  const supabaseInfo = {
    instanceExists: !!supabaseInstance,
    // @ts-ignore - accessing internal for debug
    url: supabaseInstance?.supabaseUrl || "unknown",
  };

  return c.json({
    supabaseInfo,
    input: {
      apiKey: apiKey.slice(0, 8) + "...",
      computedHash: keyHash,
      prefix: prefix,
    },
    // This mimics exactly what auth middleware does
    authStyleLookup: {
      found: !!authStyleLookup,
      data: authStyleLookup,
      error: authStyleError?.message,
      errorDetails: authStyleError ? JSON.stringify(authStyleError) : null,
    },
    lookupByHash: {
      found: !!byHash,
      data: byHash ? {
        id: byHash.id,
        hashMatch: byHash.key_hash === keyHash,
        storedHash: byHash.key_hash?.slice(0, 16) + "...",
        prefix: byHash.key_prefix,
        tier: byHash.tier,
        isActive: byHash.is_active,
        email: byHash.owner_email,
      } : null,
      error: hashError?.message,
    },
    lookupByPrefix: {
      found: !!byPrefix,
      data: byPrefix ? {
        id: byPrefix.id,
        hashMatch: byPrefix.key_hash === keyHash,
        storedHash: byPrefix.key_hash?.slice(0, 16) + "...",
        prefix: byPrefix.key_prefix,
        tier: byPrefix.tier,
        isActive: byPrefix.is_active,
      } : null,
      error: prefixError?.message,
    },
    recentKeys: allKeys?.map(k => ({
      id: k.id,
      prefix: k.key_prefix,
      hashStart: k.key_hash?.slice(0, 12) + "...",
      isActive: k.is_active,
      email: k.owner_email,
    })),
    listError: listError?.message,
  });
});

/**
 * GET /v1/beta/stats
 * Admin endpoint - Get beta program stats
 */
beta.get("/stats", async (c) => {
  verifyAdmin(c);

  if (!supabase) {
    return c.json({
      pending: 12,
      approved: 8,
      rejected: 2,
      activated: 5,
      totalRequests: 22,
    });
  }

  try {
    // Get counts for each status
    const { count: pendingCount } = await getSupabase()
      .from("beta_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");

    const { count: approvedCount } = await getSupabase()
      .from("beta_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "approved");

    const { count: rejectedCount } = await getSupabase()
      .from("beta_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "rejected");

    const { count: activatedCount } = await getSupabase()
      .from("beta_invites")
      .select("*", { count: "exact", head: true })
      .not("activated_at", "is", null);

    return c.json({
      pending: pendingCount || 0,
      approved: approvedCount || 0,
      rejected: rejectedCount || 0,
      activated: activatedCount || 0,
      totalRequests: (pendingCount || 0) + (approvedCount || 0) + (rejectedCount || 0),
    });
  } catch (err) {
    console.error("Stats error:", err);
    throw new HTTPException(500, { message: "Failed to fetch stats" });
  }
});

export default beta;
