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
import auth from "./routes/auth.js";
import sources from "./routes/sources.js";
import mappings from "./routes/mappings.js";
import generateSmart from "./routes/generate-smart.js";
import aiAssist from "./routes/ai-assist.js";
import subscriptions from "./routes/subscriptions.js";
import batch from "./routes/batch.js";
import notificationWebhooks from "./routes/notification-webhooks.js";
import documents from "./routes/documents.js";
import brandTemplates from "./routes/brandTemplates.js";
import sessionsRoute from "./routes/sessions.js";
import autoGenerate from "./routes/auto-generate.js";

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

// Auth routes - public (key recovery by email)
app.route("/v1/auth", auth);

// Hosted document retrieval (public, uses unguessable IDs as security model)
app.route("/v1/documents", documents);

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
      // Authentication (public)
      authRecoverKey: "POST /v1/auth/recover-key",
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
      // Session creation from mappings
      sessionFromMapping: "POST /v1/sessions/from-mapping",
      // Template cloning
      templateClone: "POST /v1/templates/clone",
      // Save template from session
      templateSaveFromSession: "POST /v1/templates/saved/:id/save-from-session",
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
      // Hosted document retrieval (public)
      documentGet: "GET /v1/documents/:id",
      documentMetadata: "GET /v1/documents/:id/metadata",
      // Auto-generate (one-call magic)
      autoGenerate: "POST /v1/auto-generate",
      autoGenerateAccept: "POST /v1/auto-generate/accept",
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
            { name: "category", in: "query", schema: { type: "string", enum: ["quote", "invoice", "receipt", "report", "letter", "contract", "certificate", "proposal"] }, description: "Filter by document category (e.g. invoice, quote)" },
            { name: "search", in: "query", schema: { type: "string" }, description: "Full-text search across template names and descriptions" },
            { name: "style", in: "query", schema: { type: "string", enum: ["modern", "traditional", "minimal"] }, description: "Filter by visual style preset" },
            { name: "tag", in: "query", schema: { type: "string" }, description: "Filter by tag (e.g. modern, formal, clean, bold, minimal, compact)" },
          ],
          responses: { "200": { description: "Template catalog", content: { "application/json": { schema: { type: "object", properties: { templates: { type: "array", items: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, description: { type: "string" }, category: { type: "string" }, style: { type: "string", nullable: true, description: "Visual style preset (modern, traditional, minimal)" }, tags: { type: "array", items: { type: "string" }, description: "Searchable tags for filtering" }, sampleData: { type: "object" } }, required: ["id", "name", "description", "category", "style", "tags"] } }, count: { type: "integer", description: "Number of templates in the filtered result" } }, required: ["templates", "count"] } } } } },
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
          summary: "One-shot PDF creation from data, HTML, or URL",
          operationId: "createPdf",
          tags: ["Core"],
          security: [{ bearerAuth: [] }],
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", description: "Provide one of: data (auto-layout), html (direct render), or url (page capture)", properties: { data: { type: "object", description: "Document data for auto-analysis and layout generation" }, html: { type: "string", description: "Raw HTML to render directly as PDF/PNG" }, url: { type: "string", format: "uri", description: "URL to navigate to and capture as PDF/PNG" }, templateId: { type: "string", description: "Built-in template ID (used with data; auto-detected if omitted)" }, intent: { type: "string", description: "Natural language description of desired output (used with data path)" }, style: { type: "string", enum: ["stripe-clean", "bold", "minimal", "corporate"], description: "Visual style preset (used with data path)" }, format: { type: "string", enum: ["pdf", "png"], default: "pdf", description: "Output format" }, options: { type: "object", description: "Output generation options", properties: { pageSize: { type: "string", enum: ["A4", "letter", "legal"] }, orientation: { type: "string", enum: ["portrait", "landscape"] }, margin: { type: "object", properties: { top: { type: "string" }, bottom: { type: "string" }, left: { type: "string" }, right: { type: "string" } } }, scale: { type: "number", minimum: 0, maximum: 3 } } } } } } } },
          responses: { "200": { description: "Generated PDF/PNG with metadata", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" }, format: { type: "string", enum: ["pdf", "png"] }, url: { type: "string", description: "Base64 data URL of the generated file" }, size: { type: "integer", description: "File size in bytes" }, filename: { type: "string" }, expiresAt: { type: "string", format: "date-time" }, source: { type: "object", description: "Source information (type: data, html, url, or template)", properties: { type: { type: "string", enum: ["data", "html", "url", "template"] }, url: { type: "string" }, templateId: { type: "string" } } }, analysis: { type: "object", description: "Data analysis results (only present for data path)", properties: { detectedType: { type: "string" }, confidence: { type: "number" }, fieldsIdentified: { type: "array", items: { type: "string" } }, layoutDecisions: { type: "array", items: { type: "string" } } } }, sessionId: { type: "string", description: "Session ID for subsequent modify calls" }, _links: { type: "object", properties: { modify: { type: "string" }, generate: { type: "string" } } } }, required: ["success", "format", "url", "size", "sessionId"] } } } }, "400": { description: "Validation error (missing required input)", content: { "application/json": { schema: { type: "object", properties: { error: { type: "string" }, code: { type: "string" }, details: { type: "array" } } } } } }, "404": { description: "Template not found", content: { "application/json": { schema: { type: "object", properties: { error: { type: "string" }, code: { type: "string" }, details: { type: "object" } } } } } }, "502": { description: "URL fetch failed", content: { "application/json": { schema: { type: "object", properties: { error: { type: "string" }, code: { type: "string" }, details: { type: "string" } } } } } } },
        },
      },
      "/v1/documents/{id}": {
        get: {
          summary: "Download a hosted document by ID",
          operationId: "getDocument",
          tags: ["Documents"],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" }, description: "Document ID (e.g. doc_abc123)" }],
          responses: { "200": { description: "Document file (PDF or PNG)", content: { "application/pdf": { schema: { type: "string", format: "binary" } }, "image/png": { schema: { type: "string", format: "binary" } } } }, "404": { description: "Document not found" }, "410": { description: "Document has expired" } },
        },
      },
      "/v1/documents/{id}/metadata": {
        get: {
          summary: "Get document metadata",
          operationId: "getDocumentMetadata",
          tags: ["Documents"],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" }, description: "Document ID (e.g. doc_abc123)" }],
          responses: { "200": { description: "Document metadata", content: { "application/json": { schema: { type: "object", properties: { id: { type: "string" }, format: { type: "string", enum: ["pdf", "png"] }, size: { type: "integer" }, filename: { type: "string" }, createdAt: { type: "string", format: "date-time" }, expiresAt: { type: "string", format: "date-time" }, source: { type: "object" }, sessionId: { type: "string" } }, required: ["id", "format", "size", "createdAt", "expiresAt"] } } } }, "404": { description: "Document not found" }, "410": { description: "Document has expired" } },
        },
      },
      "/v1/airtable/connect": {
        post: {
          summary: "Connect Airtable base",
          operationId: "connectAirtable",
          tags: ["Airtable"],
          security: [{ bearerAuth: [] }],
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { apiKey: { type: "string", description: "Airtable personal access token (pat...) or legacy key (key...)" } }, required: ["apiKey"] } } } },
          responses: { "200": { description: "Connection established with list of accessible bases", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" }, bases: { type: "array", items: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, permissionLevel: { type: "string" } }, required: ["id", "name"] } }, message: { type: "string" } }, required: ["success", "bases", "message"] } } } }, "401": { description: "Invalid Airtable API key", content: { "application/json": { schema: { type: "object", properties: { error: { type: "string" }, code: { type: "string" } } } } } } },
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
// Brand-to-template generation (extracts brand from PDF/image/URL)
app.route("/v1/templates", brandTemplates);
// Webhook automation
app.route("/v1/webhooks", webhooks);
// Schema detection and auto-preview
app.route("/v1/analyze", analyze);
// Data sources and intelligent templates
app.route("/v1/sources", sources);
app.route("/v1/mappings", mappings);
app.route("/v1/sessions", sessionsRoute);
app.route("/v1/generate/smart", generateSmart);
app.route("/v1/ai", aiAssist);
// Event subscriptions (Zapier/Make integration)
app.route("/v1/subscriptions", subscriptions);
// Notification webhooks (user-registered callback URLs)
app.route("/v1/notification-webhooks", notificationWebhooks);
// Auto-generate (one-call magic endpoint)
app.route("/v1/auto-generate", autoGenerate);

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

  Auto-Generate (MAGIC ENDPOINT!):
    POST /v1/auto-generate         - Data in, auto-match template, preview out
    POST /v1/auto-generate/accept  - Persist template + mapping for reuse

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

  Hosted Documents (public, no auth):
    GET  /v1/documents/:id               - Download document by ID
    GET  /v1/documents/:id/metadata      - Get document metadata
`);

// Also export for Bun compatibility
export default {
  port,
  fetch: app.fetch,
};
