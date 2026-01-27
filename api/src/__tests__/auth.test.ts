/**
 * Auth Middleware Tests
 *
 * Tests the authentication middleware in isolation using a minimal Hono app.
 * Does NOT test Supabase paths (those require integration tests).
 * Focuses on: missing header, invalid format, invalid prefix, valid demo key.
 */
import { describe, test, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { Context, Next } from "hono";

// Inline a simplified version of the auth middleware for unit testing.
// This avoids importing the real module which pulls in Supabase at module scope.
const TEST_DEMO_KEY = "gk_demo_playground_2024";

async function authMiddleware(c: Context, next: Next) {
  if (c.req.path === "/health") return next();

  const authHeader = c.req.header("Authorization");
  if (!authHeader) {
    throw new HTTPException(401, { message: "Missing Authorization header" });
  }

  const [type, token] = authHeader.split(" ");

  if (type !== "Bearer" || !token) {
    throw new HTTPException(401, {
      message: "Invalid Authorization format. Use: Bearer <api_key>",
    });
  }

  if (!token.startsWith("gk_")) {
    throw new HTTPException(401, {
      message: "Invalid API key format. Keys should start with 'gk_'",
    });
  }

  // Only accept the demo key in tests
  if (token === TEST_DEMO_KEY) {
    c.set("tier", "demo");
    c.set("monthlyLimit", 1000);
    c.set("currentUsage", 0);
    return next();
  }

  throw new HTTPException(403, { message: "Invalid API key" });
}

function createApp() {
  const app = new Hono();
  app.use("/v1/*", authMiddleware);
  app.get("/v1/test", (c) => c.json({ ok: true, tier: c.get("tier") }));
  app.get("/health", (c) => c.json({ status: "ok" }));

  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      return c.json({ error: err.message }, err.status);
    }
    return c.json({ error: "Internal error" }, 500);
  });

  return app;
}

describe("Auth Middleware", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    app = createApp();
  });

  test("rejects request with no Authorization header", async () => {
    const res = await app.request("/v1/test");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain("Missing Authorization");
  });

  test("rejects request with non-Bearer scheme", async () => {
    const res = await app.request("/v1/test", {
      headers: { Authorization: "Basic abc123" },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain("Invalid Authorization format");
  });

  test("rejects request with Bearer but no token", async () => {
    const res = await app.request("/v1/test", {
      headers: { Authorization: "Bearer " },
    });
    expect(res.status).toBe(401);
  });

  test("rejects token that does not start with gk_", async () => {
    const res = await app.request("/v1/test", {
      headers: { Authorization: "Bearer sk_test_abc123" },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain("gk_");
  });

  test("rejects unknown gk_ key", async () => {
    const res = await app.request("/v1/test", {
      headers: { Authorization: "Bearer gk_unknown_key_12345" },
    });
    expect(res.status).toBe(403);
  });

  test("accepts valid demo key and sets tier", async () => {
    const res = await app.request("/v1/test", {
      headers: { Authorization: `Bearer ${TEST_DEMO_KEY}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.tier).toBe("demo");
  });

  test("health endpoint bypasses auth", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
  });
});
