/**
 * Glyph API
 * Document generation and AI-powered editing
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { HTTPException } from "hono/http-exception";
import { serve } from "@hono/node-server";

import { authMiddleware } from "./middleware/auth.js";
import { rateLimitMiddleware, generateRateLimit, modifyRateLimit } from "./middleware/rateLimit.js";

import preview from "./routes/preview.js";
import modify from "./routes/modify.js";
import generate from "./routes/generate.js";

const app = new Hono();

// Global middleware
app.use("*", logger());
app.use("*", prettyJSON());
app.use(
  "*",
  cors({
    origin: ["http://localhost:3000", "http://localhost:5173", "https://*.glyph.dev"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
  })
);

// Rate limiting
app.use("/v1/*", rateLimitMiddleware());

// Authentication (after rate limiting so we can rate limit by IP for auth errors)
app.use("/v1/*", authMiddleware);

// Health check (no auth required)
app.get("/health", (c) => {
  return c.json({
    status: "ok",
    version: "0.1.0",
    timestamp: new Date().toISOString(),
  });
});

// API info
app.get("/", (c) => {
  return c.json({
    name: "Glyph API",
    version: "0.1.0",
    documentation: "https://docs.glyph.dev",
    endpoints: {
      health: "GET /health",
      preview: "POST /v1/preview",
      modify: "POST /v1/modify",
      generate: "POST /v1/generate",
    },
  });
});

// Mount routes with specific rate limits
app.route("/v1/preview", preview);
app.use("/v1/modify", modifyRateLimit);
app.route("/v1/modify", modify);
app.use("/v1/generate", generateRateLimit);
app.route("/v1/generate", generate);

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      error: "Not found",
      code: "NOT_FOUND",
      path: c.req.path,
    },
    404
  );
});

// Error handler
app.onError((err, c) => {
  console.error("Unhandled error:", err);

  if (err instanceof HTTPException) {
    return c.json(
      {
        error: err.message,
        code: "HTTP_ERROR",
      },
      err.status
    );
  }

  return c.json(
    {
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    },
    500
  );
});

// Start server
const port = Number(process.env.PORT) || 3000;

// Start Node.js server
serve({
  fetch: app.fetch,
  port,
});

console.log(`
  ╔═══════════════════════════════════════╗
  ║         Glyph API v0.1.0              ║
  ║   Document Generation & AI Editing    ║
  ╚═══════════════════════════════════════╝

  🚀 Glyph API running on http://localhost:${port}

  Endpoints:
    GET  /health      - Health check
    POST /v1/preview  - Generate HTML preview
    POST /v1/modify   - AI-powered HTML editing
    POST /v1/generate - Generate PDF/PNG
`);

// Also export for Bun compatibility
export default {
  port,
  fetch: app.fetch,
};
