/**
 * Glyph API
 * Document generation and AI-powered editing
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { compress } from "hono/compress";
import { prettyJSON } from "hono/pretty-json";
import { HTTPException } from "hono/http-exception";
import { serve } from "@hono/node-server";
import { logger } from "./services/logger.js";

import { authMiddleware } from "./middleware/auth.js";
import {
  rateLimitMiddleware,
  monthlyLimitMiddleware,
} from "./middleware/rateLimit.js";

import preview from "./routes/preview.js";
import modify from "./routes/modify.js";
import generate from "./routes/generate.js";
import create from "./routes/create.js";
import dashboard from "./routes/dashboard.js";
import keys from "./routes/keys.js";
import airtable from "./routes/airtable.js";
import templates from "./routes/templates.js";
import savedTemplates from "./routes/savedTemplates.js";
import webhooks from "./routes/webhooks.js";
import analyze from "./routes/analyze.js";
import { templateEngine } from "./services/template.js";
import beta from "./routes/beta.js";
import sources from "./routes/sources.js";
import mappings from "./routes/mappings.js";
import generateSmart from "./routes/generate-smart.js";
import aiAssist from "./routes/ai-assist.js";
import subscriptions from "./routes/subscriptions.js";
import batch from "./routes/batch.js";
import notificationWebhooks from "./routes/notification-webhooks.js";

const app = new Hono();

// Global middleware
app.use("*", prettyJSON());
app.use("*", compress());
app.use(
  "*",
  cors({
    origin: (origin) => {
      // Allow requests with no origin (like curl, mobile apps)
      if (!origin) return origin;

      // Allow localhost for development
      if (origin.includes("localhost")) return origin;

      // Allow glyph domains
      if (origin.includes("glyph.so") || origin.includes("glyph.dev") || origin.includes("glyph.you"))
        return origin;

      // Allow Railway deployments
      if (origin.includes("railway.app")) return origin;

      // In production, could restrict further
      return origin; // Allow all for now during beta
    },
    allowMethods: ["GET", "HEAD", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
    credentials: true,
    maxAge: 86400,
  })
);

// Request ID tracking middleware (for tracing and debugging)
app.use('*', async (c, next) => {
  // Use incoming X-Request-ID if provided, otherwise generate new UUID
  const requestId = c.req.header('X-Request-ID') || crypto.randomUUID();

  // Store in context for use in error logging and downstream handlers
  c.set('requestId', requestId);

  await next();

  // Set response header for client-side tracing
  c.res.headers.set('X-Request-ID', requestId);
});

// Structured request logging middleware
app.use('*', async (c, next) => {
  const start = Date.now();
  const requestId = c.get('requestId') || 'unknown';
  const method = c.req.method;
  const path = new URL(c.req.url).pathname;

  await next();

  const duration = Date.now() - start;
  const status = c.res.status;

  logger.info('Request completed', {
    requestId,
    method,
    path,
    status,
    duration,
  });
});

// Performance timing middleware (logs slow requests, adds Server-Timing header)
app.use('*', async (c, next) => {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  const path = new URL(c.req.url).pathname;
  const requestId = c.get('requestId') || 'unknown';

  if (duration > 100) {
    logger.warn('Slow request detected', {
      requestId,
      method: c.req.method,
      path,
      duration,
      status: c.res.status,
    });
  }

  // Add Server-Timing header for browser DevTools
  const existing = c.res.headers.get('Server-Timing');
  const timing = existing ? `${existing}, total;dur=${duration}` : `total;dur=${duration}`;
  c.res.headers.set('Server-Timing', timing);
});

// Public webhook routes BEFORE auth middleware
// Import public webhook handlers from the webhooks route file
import webhooksPublic from "./routes/webhooks-public.js";

// Mount public webhook routes BEFORE auth middleware
app.route("/v1/webhooks", webhooksPublic);

// Beta invite system - public routes (request, activate) before auth
// These endpoints don't require API key authentication
app.route("/v1/beta", beta);


// Authentication first (to get tier info for rate limiting)
app.use("/v1/*", authMiddleware);

// Tier-based rate limiting (after auth so we have tier info)
app.use("/v1/*", rateLimitMiddleware);

// Health check (no auth required)
app.get("/health", (c) => {
  c.header("Cache-Control", "public, max-age=60");
  return c.json({
    status: "ok",
    version: "0.13.1",
    timestamp: new Date().toISOString(),
  });
});

// API info
app.get("/", (c) => {
  return c.json({
    name: "Glyph API",
    version: "0.13.0",
    documentation: "https://docs.glyph.you",
    endpoints: {
      health: "GET /health",
      preview: "POST /v1/preview",
      modify: "POST /v1/modify",
      generate: "POST /v1/generate",
      // One-shot PDF creation (the star!)
      create: "POST /v1/create",
      createAnalyze: "POST /v1/create/analyze",
      dashboard: "GET /v1/dashboard",
      regenerateKey: "POST /v1/keys/regenerate",
      // Schema detection (new!)
      analyze: "POST /v1/analyze",
      analyzePreviewAuto: "POST /v1/analyze/preview/auto",
      analyzeMappings: "GET /v1/analyze/mappings",
      // Airtable integration
      airtableConnect: "POST /v1/airtable/connect",
      airtableTables: "GET /v1/airtable/bases/:baseId/tables",
      airtableSchema: "GET /v1/airtable/bases/:baseId/tables/:tableId/schema",
      airtableRecords: "GET /v1/airtable/bases/:baseId/tables/:tableId/records",
      // Template generation
      openApiSpec: "GET /v1/openapi.json",
      templatesList: "GET /v1/templates",
      templateDetail: "GET /v1/templates/:id",
      templateSchema: "GET /v1/templates/:id/schema",
      templateValidate: "POST /v1/templates/:id/validate",
      templateGenerate: "POST /v1/templates/generate",
      templateRefine: "POST /v1/templates/refine",
      templatePreview: "POST /v1/templates/preview",
      templateStyles: "GET /v1/templates/styles",
      // Batch PDF generation
      batchSync: "POST /v1/templates/batch",
      batchStart: "POST /v1/templates/batch/start",
      batchStatus: "GET /v1/templates/batch/:jobId",
      batchDownload: "GET /v1/templates/batch/:jobId/download",
      views: "GET /v1/templates/views",
      recordCount: "GET /v1/templates/count",
      // Saved templates (CRUD)
      savedTemplatesList: "GET /v1/templates/saved",
      savedTemplatesCreate: "POST /v1/templates/saved",
      savedTemplatesGet: "GET /v1/templates/saved/:id",
      savedTemplatesUpdate: "PUT /v1/templates/saved/:id",
      savedTemplatesDelete: "DELETE /v1/templates/saved/:id",
      // Webhook automation
      webhookCreate: "POST /v1/webhooks",
      webhookList: "GET /v1/webhooks",
      webhookGet: "GET /v1/webhooks/:id",
      webhookDelete: "DELETE /v1/webhooks/:id",
      webhookReceive: "POST /v1/webhooks/airtable/:id",
      webhookPdf: "GET /v1/webhooks/pdfs/:id",
      webhookTest: "GET /v1/webhooks/test/:id",
      // Beta invite system
      betaRequest: "POST /v1/beta/request",
      betaActivate: "POST /v1/beta/activate",
      betaRequests: "GET /v1/beta/requests (admin)",
      betaApprove: "POST /v1/beta/approve/:id (admin)",
      betaInvites: "GET /v1/beta/invites (admin)",
      betaStats: "GET /v1/beta/stats (admin)",
      // Data sources
      sourcesList: "GET /v1/sources",
      sourcesCreate: "POST /v1/sources",
      sourcesGet: "GET /v1/sources/:id",
      sourcesUpdate: "PUT /v1/sources/:id",
      sourcesDelete: "DELETE /v1/sources/:id",
      sourcesTest: "POST /v1/sources/:id/test",
      sourcesSync: "POST /v1/sources/:id/sync",
      sourcesRecords: "GET /v1/sources/:id/records",
      // Template-source mappings
      mappingsList: "GET /v1/mappings",
      mappingsCreate: "POST /v1/mappings",
      mappingsGet: "GET /v1/mappings/:id",
      mappingsUpdate: "PUT /v1/mappings/:id",
      mappingsDelete: "DELETE /v1/mappings/:id",
      mappingsPreview: "GET /v1/mappings/:id/preview",
      // Batch generation
      batchGenerate: "POST /v1/batch/generate",
      // Smart generation
      generateSmart: "POST /v1/generate/smart",
      generateSmartBatch: "POST /v1/generate/smart/batch",
      generateSmartBatchStatus: "GET /v1/generate/smart/batch/:jobId",
      generateSmartBatchDownload: "GET /v1/generate/smart/batch/:jobId/download",
      // AI assistance
      aiSuggestMappings: "POST /v1/ai/suggest-mappings",
      aiInferSchema: "POST /v1/ai/infer-schema",
      aiMatchTemplate: "POST /v1/ai/match-template",
      // Event subscriptions (Zapier/Make)
      subscriptionCreate: "POST /v1/subscriptions",
      subscriptionList: "GET /v1/subscriptions",
      subscriptionGet: "GET /v1/subscriptions/:id",
      subscriptionDelete: "DELETE /v1/subscriptions/:id",
    },
  });
});

// OpenAPI specification (public, no auth)
app.get("/v1/openapi.json", (c) => {
  const spec = {
    openapi: "3.1.0",
    info: {
      title: "Glyph API",
      version: "0.13.1",
      description: "AI-powered PDF generation and document customization API. Generate professional PDFs from templates and data with natural language customization.",
      contact: { url: "https://docs.glyph.you" },
    },
    servers: [
      { url: "https://api.glyph.you", description: "Production" },
    ],
    paths: {
      "/health": {
        get: { summary: "Health check", operationId: "healthCheck", tags: ["System"], responses: { "200": { description: "API is healthy" } } },
      },
      "/v1/templates": {
        get: {
          summary: "List built-in templates",
          operationId: "listTemplates",
          tags: ["Templates"],
          parameters: [
            { name: "category", in: "query", schema: { type: "string" }, description: "Filter by category" },
            { name: "search", in: "query", schema: { type: "string" }, description: "Search templates" },
          ],
          responses: { "200": { description: "Template catalog", content: { "application/json": { schema: { type: "object", properties: { templates: { type: "array", items: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, description: { type: "string" }, category: { type: "string" }, sampleData: { type: "object" } }, required: ["id", "name", "description", "category"] } } }, required: ["templates"] }, example: { templates: [{ id: "quote-modern", name: "Modern Quote", description: "Clean, professional quote template with itemized pricing", category: "business", sampleData: { company: "Acme Corp", items: [{ name: "Widget", price: 29.99 }] } }] } } } } },
        },
      },
      "/v1/templates/{id}": {
        get: {
          summary: "Get template details with JSON Schema",
          operationId: "getTemplate",
          tags: ["Templates"],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Template with schema and sample data" }, "404": { description: "Template not found" } },
        },
      },
      "/v1/templates/{id}/schema": {
        get: {
          summary: "Get template JSON Schema only",
          operationId: "getTemplateSchema",
          tags: ["Templates"],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "JSON Schema for the template" }, "404": { description: "Template not found" } },
        },
      },
      "/v1/templates/{id}/validate": {
        post: {
          summary: "Validate data against template schema",
          operationId: "validateTemplateData",
          tags: ["Templates"],
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { data: { type: "object" } }, required: ["data"] } } } },
          responses: { "200": { description: "Validation result" } },
        },
      },
      "/v1/preview": {
        post: {
          summary: "Create HTML preview session",
          operationId: "createPreview",
          tags: ["Core"],
          security: [{ bearerAuth: [] }],
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { templateId: { type: "string" }, data: { type: "object" } }, required: ["templateId", "data"] } } } },
          responses: { "200": { description: "Preview session created", content: { "application/json": { schema: { type: "object", properties: { html: { type: "string", description: "Rendered HTML preview" }, sessionId: { type: "string", description: "Session ID for subsequent modify/generate calls" }, template: { type: "string", description: "Template ID used" } }, required: ["html", "sessionId", "template"] }, example: { html: "<div class=\"quote\">...</div>", sessionId: "sess_abc123def456", template: "quote-modern" } } } } },
        },
      },
      "/v1/modify": {
        post: {
          summary: "AI-powered document modification",
          operationId: "modifyDocument",
          tags: ["Core"],
          security: [{ bearerAuth: [] }],
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { sessionId: { type: "string" }, instruction: { type: "string" } }, required: ["sessionId", "instruction"] } } } },
          responses: { "200": { description: "Modified document", content: { "application/json": { schema: { type: "object", properties: { html: { type: "string", description: "Updated HTML after modification" }, changes: { type: "array", items: { type: "string" }, description: "List of changes applied" }, selfCheckPassed: { type: "boolean", description: "Whether the AI self-check validator approved the changes" }, usage: { type: "object", properties: { tokensUsed: { type: "integer" }, inputTokens: { type: "integer" }, outputTokens: { type: "integer" } }, required: ["tokensUsed", "inputTokens", "outputTokens"] } }, required: ["html", "changes", "selfCheckPassed", "usage"] }, example: { html: "<div class=\"quote\" style=\"font-family: 'Inter'\">...</div>", changes: ["Updated font family to Inter", "Applied Stripe-inspired color palette"], selfCheckPassed: true, usage: { tokensUsed: 1850, inputTokens: 1200, outputTokens: 650 } } } } } },
        },
      },
      "/v1/generate": {
        post: {
          summary: "Generate PDF from session",
          operationId: "generatePdf",
          tags: ["Core"],
          security: [{ bearerAuth: [] }],
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { sessionId: { type: "string" }, format: { type: "string", enum: ["pdf", "png"] } }, required: ["sessionId"] } } } },
          responses: { "200": { description: "Generated PDF/PNG", content: { "application/json": { schema: { type: "object", properties: { url: { type: "string", description: "URL to download the generated file" }, format: { type: "string", enum: ["pdf", "png"], description: "Output format" }, size: { type: "integer", description: "File size in bytes" } }, required: ["url", "format", "size"] }, example: { url: "https://api.glyph.you/v1/files/gen_abc123.pdf", format: "pdf", size: 45230 } } } } },
        },
      },
      "/v1/create": {
        post: {
          summary: "One-shot PDF creation (data in, PDF out)",
          operationId: "createPdf",
          tags: ["Core"],
          security: [{ bearerAuth: [] }],
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { templateId: { type: "string" }, data: { type: "object" }, intent: { type: "string" } } } } } },
          responses: { "200": { description: "Generated PDF" } },
        },
      },
      "/v1/airtable/connect": {
        post: {
          summary: "Connect Airtable base",
          operationId: "connectAirtable",
          tags: ["Airtable"],
          security: [{ bearerAuth: [] }],
          responses: { "200": { description: "Connection established" } },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", description: "Glyph API key (gk_...)" },
      },
    },
  };

  c.header("Cache-Control", "public, max-age=3600");
  c.header("Content-Type", "application/json; charset=UTF-8");
  return c.json(spec);
});

// Mount routes
app.route("/v1/preview", preview);
app.route("/v1/modify", modify);
// Apply monthly limit check before generate (actual PDF creation)
app.use("/v1/generate", monthlyLimitMiddleware);
app.route("/v1/generate", generate);
// One-shot PDF creation (includes PDF generation, so apply monthly limit)
app.use("/v1/create", monthlyLimitMiddleware);
app.route("/v1/create", create);
// Batch PDF generation (includes PDF generation, so apply monthly limit)
app.use("/v1/batch/*", monthlyLimitMiddleware);
app.route("/v1/batch", batch);
// Dashboard and key management
app.route("/v1/dashboard", dashboard);
app.route("/v1/keys", keys);
// Airtable integration
app.route("/v1/airtable", airtable);
// User-saved templates (CRUD) - mount before /v1/templates to ensure /saved routes work
app.route("/v1/templates/saved", savedTemplates);
// AI-powered template generation
app.route("/v1/templates", templates);
// Webhook automation
app.route("/v1/webhooks", webhooks);
// Schema detection and auto-preview
app.route("/v1/analyze", analyze);
// Data sources and intelligent templates
app.route("/v1/sources", sources);
app.route("/v1/mappings", mappings);
app.route("/v1/generate/smart", generateSmart);
app.route("/v1/ai", aiAssist);
// Event subscriptions (Zapier/Make integration)
app.route("/v1/subscriptions", subscriptions);
// Notification webhooks (user-registered callback URLs)
app.route("/v1/notification-webhooks", notificationWebhooks);

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
  const requestId = c.get('requestId') || 'unknown';

  if (err instanceof HTTPException) {
    logger.warn('HTTP exception', {
      requestId,
      status: err.status,
      message: err.message,
      path: c.req.path,
    });

    return c.json(
      {
        error: err.message,
        code: "HTTP_ERROR",
        requestId,
      },
      err.status
    );
  }

  logger.error('Unhandled error', {
    requestId,
    error: err.message,
    stack: err.stack,
    path: c.req.path,
  });

  return c.json(
    {
      error: "Internal server error",
      code: "INTERNAL_ERROR",
      requestId,
    },
    500
  );
});

// Warm template cache before accepting requests
templateEngine.warmCache();

// Start server
const port = Number(process.env.PORT) || 3000;

// Start Node.js server
serve({
  fetch: app.fetch,
  port,
});

logger.info('Glyph API started', {
  version: '0.13.0',
  port,
  environment: process.env.NODE_ENV || 'development',
});

console.log(`
  ╔═══════════════════════════════════════╗
  ║         Glyph API v0.13.0             ║
  ║   Document Generation & AI Editing    ║
  ║      + Self-Checking Validator        ║
  ╚═══════════════════════════════════════╝

  Glyph API running on http://localhost:${port}

  Core Endpoints:
    GET  /health              - Health check
    POST /v1/preview          - Generate HTML preview
    POST /v1/modify           - AI-powered HTML editing
    POST /v1/generate         - Generate PDF/PNG
    GET  /v1/dashboard        - API key usage metrics
    POST /v1/keys/regenerate  - Regenerate API key

  One-Shot PDF Creation (THE STAR!):
    POST /v1/create           - Data in, beautiful PDF out
    POST /v1/create/analyze   - Analysis-only (no PDF generation)

  Schema Detection:
    POST /v1/analyze              - Analyze data structure and detect document type
    POST /v1/analyze/preview/auto - Auto-detect schema and create preview
    GET  /v1/analyze/mappings     - Get field mapping reference

  Airtable Integration:
    POST /v1/airtable/connect                           - Connect with API key
    GET  /v1/airtable/bases/:baseId/tables              - List tables
    GET  /v1/airtable/bases/:baseId/tables/:tableId/schema   - Get field schema
    GET  /v1/airtable/bases/:baseId/tables/:tableId/records  - Get sample records

  Template Generation:
    GET  /v1/templates           - List available built-in templates
    POST /v1/templates/generate  - Generate from description + schema
    POST /v1/templates/refine    - Modify with natural language
    POST /v1/templates/preview   - Render with data
    GET  /v1/templates/styles    - List style presets

  Batch PDF Generation:
    POST /v1/templates/batch              - Generate PDFs (small batches, returns ZIP)
    POST /v1/templates/batch/start        - Start async batch job
    GET  /v1/templates/batch/:jobId       - Get job status
    GET  /v1/templates/batch/:jobId/download - Download completed ZIP
    GET  /v1/templates/views              - Get table views
    GET  /v1/templates/count              - Get record count

  Saved Templates (CRUD):
    GET    /v1/templates/saved            - List user's saved templates
    POST   /v1/templates/saved            - Save a new template
    GET    /v1/templates/saved/:id        - Get template by ID
    PUT    /v1/templates/saved/:id        - Update template
    DELETE /v1/templates/saved/:id        - Delete template

  Webhook Automation:
    POST /v1/webhooks                     - Create webhook configuration
    GET  /v1/webhooks                     - List all webhooks
    GET  /v1/webhooks/:id                 - Get webhook details
    DELETE /v1/webhooks/:id               - Delete webhook
    POST /v1/webhooks/airtable/:id        - Receive Airtable trigger (public)
    GET  /v1/webhooks/pdfs/:id            - Download generated PDF
    GET  /v1/webhooks/test/:id            - Test webhook with sample data

  Event Subscriptions (Zapier/Make):
    POST   /v1/subscriptions              - Subscribe to events
    GET    /v1/subscriptions              - List subscriptions
    GET    /v1/subscriptions/:id          - Get subscription details
    DELETE /v1/subscriptions/:id          - Delete subscription
    Events: pdf.generated, template.modified
`);

// Also export for Bun compatibility
export default {
  port,
  fetch: app.fetch,
};
