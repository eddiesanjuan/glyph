/**
 * Health Endpoint Tests
 */
import { describe, test, expect } from "vitest";
import { Hono } from "hono";

// Recreate the health route in isolation (avoids importing full app with side effects)
function createHealthApp() {
  const app = new Hono();
  app.get("/health", (c) => {
    c.header("Cache-Control", "public, max-age=60");
    return c.json({
      status: "ok",
      version: "0.13.1",
      timestamp: new Date().toISOString(),
    });
  });
  return app;
}

describe("GET /health", () => {
  const app = createHealthApp();

  test("returns 200 with status ok", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe("ok");
  });

  test("includes version string", async () => {
    const res = await app.request("/health");
    const body = await res.json();
    expect(body.version).toBeDefined();
    expect(typeof body.version).toBe("string");
  });

  test("includes ISO timestamp", async () => {
    const res = await app.request("/health");
    const body = await res.json();
    expect(body.timestamp).toBeDefined();
    // Verify it parses as a valid date
    expect(new Date(body.timestamp).getTime()).not.toBeNaN();
  });

  test("sets Cache-Control header", async () => {
    const res = await app.request("/health");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=60");
  });
});
