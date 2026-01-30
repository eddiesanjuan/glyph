/**
 * Create Route
 * POST /v1/create - One-shot PDF generation from data, HTML, or URL
 * POST /v1/create/analyze - Analysis-only endpoint (no PDF generation)
 *
 * The star of the show: One API call, beautiful PDF.
 *
 * Three input paths:
 *   1. data   - Auto-analyze structure, pick/use template, generate layout
 *   2. html   - Render raw HTML directly to PDF/PNG via Playwright
 *   3. url    - Navigate Playwright to a URL and capture as PDF/PNG
 *
 * When using the data path, an optional templateId can be provided to
 * skip auto-detection and use a specific built-in template.
 */

import { Hono } from "hono";
import { z } from "zod";
import { analyzeData, DataAnalysis } from "../services/dataAnalyzer.js";
import { generateLayout, generateFullDocument, LayoutOptions } from "../services/layoutGenerator.js";
import { generatePDF, generatePNG, generatePDFFromURL, generatePNGFromURL, PDFOptions, PNGOptions } from "../services/pdf.js";
import { templateEngine } from "../services/template.js";
import {
  createDevSession,
  generateDevSessionId,
} from "../lib/devSessions.js";
import { storeDocument } from "../lib/documentStore.js";
import type { ApiError } from "../lib/types.js";
import {
  getCustomTemplate,
  isCustomTemplateId,
} from "../lib/customTemplates.js";
import { supabase, getSupabase } from "../lib/supabase.js";
import Mustache from "mustache";

/**
 * Track usage for a create request (fire and forget)
 */
function trackCreateUsage(
  apiKeyId: string | undefined,
  tier: string | undefined,
  source: "data" | "html" | "url",
  templateId?: string,
  format?: string
): void {
  // Only track for non-demo tiers with valid API key ID and Supabase configured
  if (!apiKeyId || tier === "demo" || !supabase) {
    return;
  }

  getSupabase()
    .from("usage")
    .insert({
      api_key_id: apiKeyId,
      endpoint: "create",
      template: templateId || `${source}-${format || "pdf"}`,
      pdf_generated: true,
    })
    .then(({ error }) => {
      if (error) {
        console.error("[Create] Usage tracking error:", error);
      }
    });
}

const create = new Hono();

// ============================================================================
// Error Responses
// ============================================================================

const ERROR_RESPONSES = {
  EMPTY_DATA: {
    code: "EMPTY_DATA",
    message: "Data object is required",
    status: 400 as const,
  },
  INVALID_DATA: {
    code: "INVALID_DATA",
    message: "Data must be a valid JSON object",
    status: 400 as const,
  },
  GENERATION_FAILED: {
    code: "GENERATION_FAILED",
    message: "Failed to generate document",
    status: 500 as const,
  },
  ANALYSIS_FAILED: {
    code: "ANALYSIS_FAILED",
    message: "Could not analyze data structure",
    status: 500 as const,
  },
  TEMPLATE_NOT_FOUND: {
    code: "TEMPLATE_NOT_FOUND",
    message: "The specified template was not found",
    status: 404 as const,
  },
  URL_FETCH_FAILED: {
    code: "URL_FETCH_FAILED",
    message: "Failed to fetch content from the provided URL",
    status: 502 as const,
  },
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * Derive the public base URL for hosted document links.
 * Prefers the X-Forwarded-Host / Host headers so links work behind proxies.
 */
function getBaseUrl(c: { req: { header: (name: string) => string | undefined; url: string } }): string {
  const forwardedHost = c.req.header("X-Forwarded-Host");
  const host = forwardedHost || c.req.header("Host");
  const proto = c.req.header("X-Forwarded-Proto") || "https";

  if (host) {
    return `${proto}://${host}`;
  }

  // Fallback: derive from request URL
  try {
    const parsed = new URL(c.req.url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return "https://api.glyph.you";
  }
}

// ============================================================================
// Request Validation
// ============================================================================

const createRequestSchema = z
  .object({
    data: z
      .record(z.unknown())
      .refine((val) => Object.keys(val).length > 0, {
        message: "Data object cannot be empty",
      })
      .optional(),
    html: z.string().optional(),
    url: z.string().url().optional(),
    templateId: z.string().optional(),
    intent: z.string().optional(),
    style: z.enum(["stripe-clean", "bold", "minimal", "corporate"]).optional(),
    format: z.enum(["pdf", "png"]).optional().default("pdf"),
    ttl: z.number().int().min(300).max(604800).optional(),
    options: z
      .object({
        pageSize: z.enum(["A4", "letter", "legal"]).optional(),
        orientation: z.enum(["portrait", "landscape"]).optional(),
        margin: z
          .object({
            top: z.string().optional(),
            bottom: z.string().optional(),
            left: z.string().optional(),
            right: z.string().optional(),
          })
          .optional(),
        scale: z.number().positive().max(3).optional(),
      })
      .optional(),
  })
  .refine((val) => val.data || val.html || val.url, {
    message: "At least one of 'data', 'html', or 'url' must be provided",
    path: ["data"],
  });

const analyzeRequestSchema = z.object({
  data: z.record(z.unknown()).refine((val) => Object.keys(val).length > 0, {
    message: "Data object cannot be empty",
  }),
  intent: z.string().optional(),
});

// ============================================================================
// Routes
// ============================================================================

/**
 * POST /v1/create
 * One-shot PDF generation from data, HTML, or URL
 *
 * Input paths (checked in order):
 *   url  -> Navigate Playwright to URL, capture as PDF/PNG
 *   html -> Render raw HTML directly via Playwright
 *   data -> Analyze structure, generate layout, render PDF/PNG
 *          (optionally with templateId to skip auto-detection)
 *
 * All paths create a session for subsequent /v1/modify calls.
 */
create.post("/", async (c) => {
  try {
    const body = await c.req.json();

    // Validate request
    const parsed = createRequestSchema.safeParse(body);
    if (!parsed.success) {
      const error: ApiError = {
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: parsed.error.issues,
      };
      return c.json(error, 400);
    }

    const { data, html, url, templateId, intent, style, format, options, ttl } = parsed.data;

    // Extract auth context for usage tracking
    const apiKeyId = c.get("apiKeyId") as string | undefined;
    const tier = c.get("tier") as string | undefined;

    // Shared PDF/PNG options
    const pdfOptions: PDFOptions = {
      format: options?.pageSize === "A4" ? "a4" : "letter",
      landscape: options?.orientation === "landscape",
      margin: options?.margin,
      scale: options?.scale,
    };
    const pngOptions: PNGOptions = {
      scale: options?.scale,
    };

    // ========================================================================
    // Path 1: URL-based capture
    // Navigate Playwright to a URL and capture as PDF/PNG
    // ========================================================================
    if (url) {
      console.log(`[Create] URL path: capturing ${format} from ${url}`);

      let outputBuffer: Buffer;
      let contentType: string;
      let filename: string;

      try {
        if (format === "pdf") {
          outputBuffer = await generatePDFFromURL(url, pdfOptions);
          contentType = "application/pdf";
          filename = `glyph-url-capture-${Date.now()}.pdf`;
        } else {
          outputBuffer = await generatePNGFromURL(url, pngOptions);
          contentType = "image/png";
          filename = `glyph-url-capture-${Date.now()}.png`;
        }
        console.log(`[Create] URL capture ${format.toUpperCase()}: ${outputBuffer.length} bytes`);
      } catch (err) {
        console.error("[Create] URL capture failed:", err);
        const errorMessage = err instanceof Error ? err.message : "Unknown error";

        if (errorMessage.includes("Playwright")) {
          return c.json(
            {
              error: "PDF generation not available. Playwright is not installed.",
              code: "PLAYWRIGHT_NOT_INSTALLED",
              details: {
                install: "bun add playwright && npx playwright install chromium",
              },
            },
            503
          );
        }

        return c.json(
          {
            error: ERROR_RESPONSES.URL_FETCH_FAILED.message,
            code: ERROR_RESPONSES.URL_FETCH_FAILED.code,
            details: errorMessage,
          },
          ERROR_RESPONSES.URL_FETCH_FAILED.status
        );
      }

      // Create session for subsequent modifications
      const sessionId = generateDevSessionId();
      createDevSession(sessionId, "url-capture", "", "", {});
      console.log(`[Create] Session created: ${sessionId}`);

      // Store document for hosted access
      const storedDoc = storeDocument({
        buffer: outputBuffer,
        format: format as "pdf" | "png",
        filename,
        source: { type: "url", url },
        sessionId,
        ttlSeconds: ttl,
      });

      const baseUrl = getBaseUrl(c);
      const hostedUrl = `${baseUrl}/v1/documents/${storedDoc.id}`;

      // Track usage (fire and forget)
      trackCreateUsage(apiKeyId, tier, "url", undefined, format);

      const accept = c.req.header("Accept");
      if (accept?.includes("application/json") || !accept?.includes(contentType)) {
        return c.json({
          success: true,
          id: storedDoc.id,
          format,
          url: hostedUrl,
          dataUrl: `data:${contentType};base64,${outputBuffer.toString("base64")}`,
          size: outputBuffer.length,
          filename,
          expiresAt: storedDoc.expiresAt,
          source: { type: "url", url },
          sessionId,
          _links: {
            self: `/v1/documents/${storedDoc.id}`,
            metadata: `/v1/documents/${storedDoc.id}/metadata`,
            modify: `/v1/modify`,
            generate: `/v1/generate`,
          },
        });
      }

      c.header("Content-Type", contentType);
      c.header("Content-Disposition", `attachment; filename="${filename}"`);
      c.header("Content-Length", String(outputBuffer.length));
      c.header("X-Glyph-Session-Id", sessionId);
      c.header("X-Glyph-Document-Id", storedDoc.id);
      c.header("X-Glyph-Document-Url", hostedUrl);
      return c.body(new Uint8Array(outputBuffer));
    }

    // ========================================================================
    // Path 2: Raw HTML rendering
    // Render provided HTML directly to PDF/PNG
    // ========================================================================
    if (html) {
      console.log(`[Create] HTML path: rendering ${format} from raw HTML (${html.length} chars)`);

      let outputBuffer: Buffer;
      let contentType: string;
      let filename: string;

      try {
        if (format === "pdf") {
          outputBuffer = await generatePDF(html, pdfOptions);
          contentType = "application/pdf";
          filename = `glyph-html-render-${Date.now()}.pdf`;
        } else {
          outputBuffer = await generatePNG(html, pngOptions);
          contentType = "image/png";
          filename = `glyph-html-render-${Date.now()}.png`;
        }
        console.log(`[Create] HTML render ${format.toUpperCase()}: ${outputBuffer.length} bytes`);
      } catch (err) {
        console.error("[Create] HTML render failed:", err);
        const errorMessage = err instanceof Error ? err.message : "Unknown error";

        if (errorMessage.includes("Playwright")) {
          return c.json(
            {
              error: "PDF generation not available. Playwright is not installed.",
              code: "PLAYWRIGHT_NOT_INSTALLED",
              details: {
                install: "bun add playwright && npx playwright install chromium",
              },
            },
            503
          );
        }

        return c.json(
          {
            error: ERROR_RESPONSES.GENERATION_FAILED.message,
            code: ERROR_RESPONSES.GENERATION_FAILED.code,
            details: errorMessage,
          },
          ERROR_RESPONSES.GENERATION_FAILED.status
        );
      }

      // Create session for subsequent modifications
      const sessionId = generateDevSessionId();
      createDevSession(sessionId, "html-render", html, html, {});
      console.log(`[Create] Session created: ${sessionId}`);

      // Store document for hosted access
      const storedDoc = storeDocument({
        buffer: outputBuffer,
        format: format as "pdf" | "png",
        filename,
        source: { type: "html" },
        sessionId,
        ttlSeconds: ttl,
      });

      const baseUrl = getBaseUrl(c);
      const hostedUrl = `${baseUrl}/v1/documents/${storedDoc.id}`;

      // Track usage (fire and forget)
      trackCreateUsage(apiKeyId, tier, "html", undefined, format);

      const accept = c.req.header("Accept");
      if (accept?.includes("application/json") || !accept?.includes(contentType)) {
        return c.json({
          success: true,
          id: storedDoc.id,
          format,
          url: hostedUrl,
          dataUrl: `data:${contentType};base64,${outputBuffer.toString("base64")}`,
          size: outputBuffer.length,
          filename,
          expiresAt: storedDoc.expiresAt,
          source: { type: "html" },
          sessionId,
          _links: {
            self: `/v1/documents/${storedDoc.id}`,
            metadata: `/v1/documents/${storedDoc.id}/metadata`,
            modify: `/v1/modify`,
            generate: `/v1/generate`,
          },
        });
      }

      c.header("Content-Type", contentType);
      c.header("Content-Disposition", `attachment; filename="${filename}"`);
      c.header("Content-Length", String(outputBuffer.length));
      c.header("X-Glyph-Session-Id", sessionId);
      c.header("X-Glyph-Document-Id", storedDoc.id);
      c.header("X-Glyph-Document-Url", hostedUrl);
      return c.body(new Uint8Array(outputBuffer));
    }

    // ========================================================================
    // Path 3: Data-driven generation (original flow)
    // Analyze data, auto-detect or use specified template, generate layout
    // ========================================================================
    // data is guaranteed non-undefined here due to the .refine() check
    const resolvedData = data!;

    console.log(`[Create] Data path: starting one-shot generation for ${format} document`);

    // Step 1: If templateId is provided, try to render using that template directly
    if (templateId) {
      console.log(`[Create] Using specified template: ${templateId}`);

      let fullHtml: string | null = null;
      let templateHtml: string | null = null;

      // Check if this is a custom template (tpl_xxx format)
      if (isCustomTemplateId(templateId)) {
        const customTemplate = getCustomTemplate(templateId);
        if (!customTemplate) {
          return c.json(
            {
              error: "Custom template not found or expired",
              code: ERROR_RESPONSES.TEMPLATE_NOT_FOUND.code,
              details: {
                templateId,
                hint: "Custom templates expire after 24 hours. Create a new one with POST /v1/templates",
              },
            },
            ERROR_RESPONSES.TEMPLATE_NOT_FOUND.status
          );
        }

        // Render custom template with Mustache
        try {
          templateHtml = customTemplate.html;
          fullHtml = Mustache.render(customTemplate.html, resolvedData);
          console.log(`[Create] Custom template ${templateId} rendered successfully`);
        } catch (err) {
          console.error(`[Create] Custom template render failed for ${templateId}:`, err);
          return c.json(
            {
              error: "Failed to render custom template",
              code: "TEMPLATE_RENDER_ERROR",
              details: err instanceof Error ? err.message : "Unknown error",
            },
            400
          );
        }
      } else {
        // Check built-in templates
        const availableTemplates = templateEngine.getAvailableTemplates();
        if (!availableTemplates.includes(templateId)) {
          return c.json(
            {
              error: ERROR_RESPONSES.TEMPLATE_NOT_FOUND.message,
              code: ERROR_RESPONSES.TEMPLATE_NOT_FOUND.code,
              details: {
                templateId,
                availableTemplates,
              },
            },
            ERROR_RESPONSES.TEMPLATE_NOT_FOUND.status
          );
        }

        let templateResult;
        try {
          templateResult = await templateEngine.render(
            templateId,
            resolvedData as any
          );
          fullHtml = templateResult.html;
          templateHtml = templateResult.templateHtml;
        } catch (err) {
          console.error(`[Create] Template render failed for ${templateId}:`, err);
          // Fall through to auto-detect path if template render fails
          console.log("[Create] Falling back to auto-detect path");
        }
      }

      if (fullHtml) {
        console.log(`[Create] Template ${templateId} rendered successfully`);

        let outputBuffer: Buffer;
        let contentType: string;
        let filename: string;

        try {
          if (format === "pdf") {
            outputBuffer = await generatePDF(fullHtml, pdfOptions);
            contentType = "application/pdf";
            filename = `glyph-${templateId}-${Date.now()}.pdf`;
          } else {
            outputBuffer = await generatePNG(fullHtml, pngOptions);
            contentType = "image/png";
            filename = `glyph-${templateId}-${Date.now()}.png`;
          }
          console.log(`[Create] ${format.toUpperCase()} generated: ${outputBuffer.length} bytes`);
        } catch (err) {
          console.error("[Create] Output generation failed:", err);
          const errorMessage = err instanceof Error ? err.message : "Unknown error";

          if (errorMessage.includes("Playwright")) {
            return c.json(
              {
                error: "PDF generation not available. Playwright is not installed.",
                code: "PLAYWRIGHT_NOT_INSTALLED",
                details: {
                  install: "bun add playwright && npx playwright install chromium",
                },
              },
              503
            );
          }

          return c.json(
            {
              error: ERROR_RESPONSES.GENERATION_FAILED.message,
              code: ERROR_RESPONSES.GENERATION_FAILED.code,
              details: errorMessage,
            },
            ERROR_RESPONSES.GENERATION_FAILED.status
          );
        }

        // Create session for modifications
        const sessionId = generateDevSessionId();
        createDevSession(
          sessionId,
          templateId,
          fullHtml,
          templateHtml || fullHtml,
          resolvedData
        );
        console.log(`[Create] Session created: ${sessionId}`);

        // Store document for hosted access
        const storedDoc = storeDocument({
          buffer: outputBuffer,
          format: format as "pdf" | "png",
          filename,
          source: { type: "template", templateId },
          sessionId,
          ttlSeconds: ttl,
        });

        const baseUrl = getBaseUrl(c);
        const hostedUrl = `${baseUrl}/v1/documents/${storedDoc.id}`;

        // Track usage (fire and forget)
        trackCreateUsage(apiKeyId, tier, "data", templateId, format);

        const accept = c.req.header("Accept");
        if (accept?.includes("application/json") || !accept?.includes(contentType)) {
          return c.json({
            success: true,
            id: storedDoc.id,
            format,
            url: hostedUrl,
            dataUrl: `data:${contentType};base64,${outputBuffer.toString("base64")}`,
            size: outputBuffer.length,
            filename,
            expiresAt: storedDoc.expiresAt,
            source: { type: "template", templateId },
            sessionId,
            _links: {
              self: `/v1/documents/${storedDoc.id}`,
              metadata: `/v1/documents/${storedDoc.id}/metadata`,
              modify: `/v1/modify`,
              generate: `/v1/generate`,
            },
          });
        }

        c.header("Content-Type", contentType);
        c.header("Content-Disposition", `attachment; filename="${filename}"`);
        c.header("Content-Length", String(outputBuffer.length));
        c.header("X-Glyph-Session-Id", sessionId);
        c.header("X-Glyph-Document-Type", templateId);
        c.header("X-Glyph-Document-Id", storedDoc.id);
        c.header("X-Glyph-Document-Url", hostedUrl);
        return c.body(new Uint8Array(outputBuffer));
      }
    }

    // Step 2: Auto-detect via data analysis (original flow)
    let analysis: DataAnalysis;
    try {
      analysis = await analyzeData(resolvedData, intent);
      console.log(
        `[Create] Data analyzed: ${analysis.documentType} (confidence: ${analysis.confidence.toFixed(2)})`
      );
    } catch (err) {
      console.error("[Create] Analysis failed:", err);
      return c.json(
        {
          error: ERROR_RESPONSES.ANALYSIS_FAILED.message,
          code: ERROR_RESPONSES.ANALYSIS_FAILED.code,
          details: err instanceof Error ? err.message : "Unknown error",
        },
        ERROR_RESPONSES.ANALYSIS_FAILED.status
      );
    }

    // Step 3: Generate layout HTML
    const layoutOptions: LayoutOptions = {
      style: style || (analysis.styling.suggestedStyle as LayoutOptions["style"]) || "stripe-clean",
      pageSize: options?.pageSize || "letter",
      orientation: options?.orientation || "portrait",
      userInstructions: intent,
    };

    let fullHtml: string;
    try {
      fullHtml = await generateFullDocument(resolvedData, analysis, layoutOptions);
      console.log(`[Create] Layout generated with style: ${layoutOptions.style}`);
    } catch (err) {
      console.error("[Create] Layout generation failed:", err);
      return c.json(
        {
          error: ERROR_RESPONSES.GENERATION_FAILED.message,
          code: ERROR_RESPONSES.GENERATION_FAILED.code,
          details: "Failed to generate document layout",
        },
        ERROR_RESPONSES.GENERATION_FAILED.status
      );
    }

    // Step 4: Generate output (PDF or PNG)
    let outputBuffer: Buffer;
    let contentType: string;
    let filename: string;

    try {
      if (format === "pdf") {
        outputBuffer = await generatePDF(fullHtml, pdfOptions);
        contentType = "application/pdf";
        filename = `glyph-${analysis.documentType}-${Date.now()}.pdf`;
      } else {
        outputBuffer = await generatePNG(fullHtml, pngOptions);
        contentType = "image/png";
        filename = `glyph-${analysis.documentType}-${Date.now()}.png`;
      }
      console.log(`[Create] ${format.toUpperCase()} generated: ${outputBuffer.length} bytes`);
    } catch (err) {
      console.error("[Create] Output generation failed:", err);

      const errorMessage = err instanceof Error ? err.message : "Unknown error";

      // Provide helpful message for Playwright issues
      if (errorMessage.includes("Playwright")) {
        return c.json(
          {
            error: "PDF generation not available. Playwright is not installed.",
            code: "PLAYWRIGHT_NOT_INSTALLED",
            details: {
              install: "bun add playwright && npx playwright install chromium",
            },
          },
          503
        );
      }

      return c.json(
        {
          error: ERROR_RESPONSES.GENERATION_FAILED.message,
          code: ERROR_RESPONSES.GENERATION_FAILED.code,
          details: errorMessage,
        },
        ERROR_RESPONSES.GENERATION_FAILED.status
      );
    }

    // Step 5: Create session for potential modifications
    const sessionId = generateDevSessionId();
    const layout = await generateLayout(resolvedData, analysis, layoutOptions);

    createDevSession(
      sessionId,
      `generated-${analysis.documentType}`,
      fullHtml,
      layout.html, // template HTML for modifications
      resolvedData
    );
    console.log(`[Create] Session created: ${sessionId}`);

    // Store document for hosted access
    const storedDoc = storeDocument({
      buffer: outputBuffer,
      format: format as "pdf" | "png",
      filename,
      source: { type: "data" },
      sessionId,
      ttlSeconds: ttl,
    });

    const baseUrl = getBaseUrl(c);
    const hostedUrl = `${baseUrl}/v1/documents/${storedDoc.id}`;

    // Track usage (fire and forget)
    trackCreateUsage(apiKeyId, tier, "data", `generated-${analysis.documentType}`, format);

    // Determine response format based on Accept header
    const accept = c.req.header("Accept");

    if (accept?.includes("application/json") || !accept?.includes(contentType)) {
      // Return JSON with hosted URL + backward-compatible dataUrl
      return c.json({
        success: true,
        id: storedDoc.id,
        format,
        url: hostedUrl,
        dataUrl: `data:${contentType};base64,${outputBuffer.toString("base64")}`,
        size: outputBuffer.length,
        filename,
        expiresAt: storedDoc.expiresAt,
        analysis: {
          detectedType: analysis.documentType,
          confidence: analysis.confidence,
          fieldsIdentified: Object.keys(analysis.fields).filter(
            (k) => analysis.fields[k as keyof typeof analysis.fields].length > 0
          ),
          layoutDecisions: [
            `${analysis.layout.headerStyle} header`,
            `${analysis.layout.contentStyle} content`,
            `${analysis.layout.summaryStyle} summary`,
          ],
        },
        sessionId, // For subsequent modifications via /v1/modify
        _links: {
          self: `/v1/documents/${storedDoc.id}`,
          metadata: `/v1/documents/${storedDoc.id}/metadata`,
          modify: `/v1/modify`,
          generate: `/v1/generate`,
        },
      });
    }

    // Return raw file
    c.header("Content-Type", contentType);
    c.header("Content-Disposition", `attachment; filename="${filename}"`);
    c.header("Content-Length", String(outputBuffer.length));
    c.header("X-Glyph-Session-Id", sessionId);
    c.header("X-Glyph-Document-Type", analysis.documentType);
    c.header("X-Glyph-Document-Id", storedDoc.id);
    c.header("X-Glyph-Document-Url", hostedUrl);

    return c.body(new Uint8Array(outputBuffer));
  } catch (err) {
    console.error("[Create] Unexpected error:", err);

    const errorMessage = err instanceof Error ? err.message : "Unknown error";

    return c.json(
      {
        error: errorMessage,
        code: "CREATE_ERROR",
      },
      500
    );
  }
});

/**
 * POST /v1/create/analyze
 * Analysis-only endpoint (no PDF generation)
 *
 * Useful for:
 * - Understanding how Glyph will interpret your data
 * - Debugging data structure issues
 * - Pre-flight checks before generation
 */
create.post("/analyze", async (c) => {
  try {
    const body = await c.req.json();

    // Validate request
    const parsed = analyzeRequestSchema.safeParse(body);
    if (!parsed.success) {
      const error: ApiError = {
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: parsed.error.issues,
      };
      return c.json(error, 400);
    }

    const { data, intent } = parsed.data;

    console.log("[Create/Analyze] Starting data analysis");

    // Analyze data structure
    let analysis: DataAnalysis;
    try {
      analysis = await analyzeData(data, intent);
      console.log(
        `[Create/Analyze] Complete: ${analysis.documentType} (confidence: ${analysis.confidence.toFixed(2)})`
      );
    } catch (err) {
      console.error("[Create/Analyze] Analysis failed:", err);
      return c.json(
        {
          error: ERROR_RESPONSES.ANALYSIS_FAILED.message,
          code: ERROR_RESPONSES.ANALYSIS_FAILED.code,
          details: err instanceof Error ? err.message : "Unknown error",
        },
        ERROR_RESPONSES.ANALYSIS_FAILED.status
      );
    }

    return c.json({
      success: true,
      analysis: {
        documentType: analysis.documentType,
        confidence: analysis.confidence,
        fields: {
          header: analysis.fields.header.map(summarizeField),
          recipient: analysis.fields.recipient.map(summarizeField),
          lineItems: analysis.fields.lineItems.map(summarizeField),
          summary: analysis.fields.summary.map(summarizeField),
          metadata: analysis.fields.metadata.map(summarizeField),
          footer: analysis.fields.footer.map(summarizeField),
        },
        layout: analysis.layout,
        styling: analysis.styling,
      },
      recommendations: {
        suggestedStyle: analysis.styling.suggestedStyle,
        suggestedLayout: analysis.layout.contentStyle,
        fieldsFound: countFields(analysis),
        tips: generateTips(analysis),
      },
    });
  } catch (err) {
    console.error("[Create/Analyze] Unexpected error:", err);

    const errorMessage = err instanceof Error ? err.message : "Unknown error";

    return c.json(
      {
        error: errorMessage,
        code: "ANALYZE_ERROR",
      },
      500
    );
  }
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Summarize a field for the analysis response
 */
function summarizeField(field: {
  path: string;
  name: string;
  type: string;
  role: string;
}): { path: string; name: string; type: string; role: string } {
  return {
    path: field.path,
    name: field.name,
    type: field.type,
    role: field.role,
  };
}

/**
 * Count total fields identified
 */
function countFields(analysis: DataAnalysis): number {
  return (
    analysis.fields.header.length +
    analysis.fields.recipient.length +
    analysis.fields.lineItems.length +
    analysis.fields.summary.length +
    analysis.fields.metadata.length +
    analysis.fields.footer.length
  );
}

/**
 * Generate helpful tips based on analysis
 */
function generateTips(analysis: DataAnalysis): string[] {
  const tips: string[] = [];

  if (analysis.confidence < 0.5) {
    tips.push(
      "Low confidence in document type detection. Consider adding more descriptive field names or providing an intent."
    );
  }

  if (analysis.fields.lineItems.length === 0) {
    tips.push(
      "No line items detected. If your document has items/rows, use array fields named 'items', 'lineItems', or 'products'."
    );
  }

  if (analysis.fields.summary.length === 0) {
    tips.push(
      "No totals detected. Add fields like 'total', 'subtotal', or 'tax' for automatic summary section."
    );
  }

  if (analysis.fields.recipient.length === 0) {
    tips.push(
      "No recipient information found. Add 'customer', 'client', or 'recipient' fields for better document structure."
    );
  }

  if (!analysis.layout.hasLogo) {
    tips.push(
      "No logo detected. Add a 'logo' or 'logoUrl' field to include branding in the header."
    );
  }

  if (tips.length === 0) {
    tips.push("Your data structure looks good! Ready for professional document generation.");
  }

  return tips;
}

export default create;
