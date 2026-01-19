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
import {
  rateLimitMiddleware,
  monthlyLimitMiddleware,
} from "./middleware/rateLimit.js";

import preview from "./routes/preview.js";
import modify from "./routes/modify.js";
import generate from "./routes/generate.js";
import dashboard from "./routes/dashboard.js";
import keys from "./routes/keys.js";

const app = new Hono();

// Global middleware
app.use("*", logger());
app.use("*", prettyJSON());
app.use(
  "*",
  cors({
    origin: (origin) => {
      // Allow requests with no origin (like curl, mobile apps)
      if (!origin) return origin;

      // Allow localhost for development
      if (origin.includes("localhost")) return origin;

      // Allow glyph domains
      if (origin.includes("glyph.so") || origin.includes("glyph.dev"))
        return origin;

      // In production, could restrict further
      return origin; // Allow all for now during beta
    },
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    maxAge: 86400,
  })
);

// Authentication first (to get tier info for rate limiting)
app.use("/v1/*", authMiddleware);

// Tier-based rate limiting (after auth so we have tier info)
app.use("/v1/*", rateLimitMiddleware);

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
      dashboard: "GET /v1/dashboard",
      regenerateKey: "POST /v1/keys/regenerate",
    },
  });
});

// Mount routes
app.route("/v1/preview", preview);
app.route("/v1/modify", modify);
// Apply monthly limit check before generate (actual PDF creation)
app.use("/v1/generate", monthlyLimitMiddleware);
app.route("/v1/generate", generate);
// Dashboard and key management
app.route("/v1/dashboard", dashboard);
app.route("/v1/keys", keys);

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
    GET  /health            - Health check
    POST /v1/preview        - Generate HTML preview
    POST /v1/modify         - AI-powered HTML editing
    POST /v1/generate       - Generate PDF/PNG
    GET  /v1/dashboard      - API key usage metrics
    POST /v1/keys/regenerate - Regenerate API key
`);

// Also export for Bun compatibility
export default {
  port,
  fetch: app.fetch,
};
