/**
 * Generate Route
 * POST /v1/generate - Generate PDF or PNG from HTML
 */

import { Hono } from "hono";
import { z } from "zod";
import { generatePdfCached, generatePng } from "../services/pdf.js";
import type { ApiError } from "../lib/types.js";
import { triggerEventSubscriptions } from "./subscriptions.js";
import { fireNotificationWebhooks } from "../services/notificationWebhooks.js";
import { storeDocument } from "../lib/documentStore.js";

const generate = new Hono();

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

// Request validation schema
const generateSchema = z.object({
  html: z.string().min(1, "HTML content is required"),
  format: z.enum(["pdf", "png"]),
  returnUrl: z.boolean().optional(), // When true, return hosted URL instead of binary
  ttl: z.number().positive().optional(), // TTL for hosted document (default: 24h)
  options: z
    .object({
      width: z.number().positive().optional(),
      height: z.number().positive().optional(),
      scale: z.number().positive().max(3).optional(),
    })
    .optional(),
});

generate.post("/", async (c) => {
  try {
    const tStart = Date.now();
    const body = await c.req.json();

    // Validate request
    const parsed = generateSchema.safeParse(body);
    if (!parsed.success) {
      const error: ApiError = {
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: parsed.error.issues,
      };
      return c.json(error, 400);
    }

    const { html, format, options, returnUrl, ttl } = parsed.data;

    // Generate document
    let buffer: Buffer;
    let contentType: string;
    let filename: string;
    const sessionId = body.sessionId || Date.now().toString();

    let cacheHit = false;
    const tRender = Date.now();
    if (format === "pdf") {
      try {
        const result = await generatePdfCached(html, options);
        buffer = result.buffer;
        cacheHit = result.cacheHit;
      } catch (pdfErr) {
        console.error("PDF generation error:", pdfErr);
        return c.json(
          {
            error: "pdf_generation_failed",
            message: "Failed to generate PDF. The document may contain invalid HTML.",
            status: 500,
          },
          500
        );
      }
      contentType = "application/pdf";
      filename = `glyph-document-${sessionId}.pdf`;
    } else {
      try {
        buffer = await generatePng(html, options);
      } catch (pngErr) {
        console.error("PNG generation error:", pngErr);
        return c.json(
          {
            error: "png_generation_failed",
            message: "Failed to generate PNG. The document may contain invalid HTML.",
            status: 500,
          },
          500
        );
      }
      contentType = "image/png";
      filename = `glyph-document-${sessionId}.png`;
    }
    const renderDuration = Date.now() - tRender;
    const totalDuration = Date.now() - tStart;
    console.log(`[perf:generate] render=${renderDuration}ms total=${totalDuration}ms format=${format} size=${buffer.length} cacheHit=${cacheHit}`);
    c.header('Server-Timing', `render;dur=${renderDuration}, total;dur=${totalDuration}, cache;desc="${cacheHit ? 'HIT' : 'MISS'}"`);

    // TODO(P2): Upload to Supabase Storage instead of returning raw buffer
    // Currently returns inline buffer which works but limits file size to ~10MB

    // Trigger event subscriptions (fire and forget)
    triggerEventSubscriptions("pdf.generated", {
      format,
      size: buffer.length,
      filename,
    });

    // Fire notification webhooks (fire and forget)
    fireNotificationWebhooks("pdf.generated", {
      session_id: body.sessionId || null,
      pdf_url_or_base64_snippet: `data:${contentType};base64,${buffer.toString("base64").substring(0, 100)}...`,
    });

    // If returnUrl is true, store the document and return a hosted URL
    // This is essential for integrations like Airtable scripts that can't handle binary responses
    if (returnUrl) {
      const storedDoc = storeDocument({
        buffer,
        format: format as "pdf" | "png",
        filename,
        source: { type: "html" },
        sessionId,
        ttlSeconds: ttl,
      });

      const baseUrl = getBaseUrl(c);
      const hostedUrl = `${baseUrl}/v1/documents/${storedDoc.id}`;

      return c.json({
        success: true,
        id: storedDoc.id,
        url: hostedUrl,
        format,
        size: buffer.length,
        filename,
        expiresAt: storedDoc.expiresAt,
        cacheHit,
        usage: {
          renderTimeMs: renderDuration,
          totalTimeMs: totalDuration,
          format,
          sizeBytes: buffer.length,
          cacheHit,
        },
      });
    }

    // Check Accept header to decide response format
    const accept = c.req.header("Accept");

    if (accept?.includes("application/json")) {
      // Return metadata with data URL (legacy behavior)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      const response = {
        url: `data:${contentType};base64,${buffer.toString("base64")}`,
        format,
        size: buffer.length,
        expiresAt: expiresAt.toISOString(),
        cacheHit,
        usage: {
          renderTimeMs: renderDuration,
          totalTimeMs: totalDuration,
          format,
          sizeBytes: buffer.length,
          cacheHit,
        },
      };

      return c.json(response);
    }

    // Return raw file (default behavior)
    c.header("Content-Type", contentType);
    c.header("Content-Disposition", `attachment; filename="${filename}"`);
    c.header("Content-Length", String(buffer.length));

    return c.body(new Uint8Array(buffer));
  } catch (err) {
    console.error("Generate error:", err);

    const errorMessage = err instanceof Error ? err.message : "Unknown error";

    // Provide helpful message for Playwright issues
    if (errorMessage.includes("Playwright")) {
      const error: ApiError = {
        error: "PDF generation not available. Playwright is not installed.",
        code: "PLAYWRIGHT_NOT_INSTALLED",
        details: {
          install: "bun add playwright && npx playwright install chromium",
        },
      };
      return c.json(error, 503);
    }

    const error: ApiError = {
      error: errorMessage,
      code: "GENERATE_ERROR",
    };
    return c.json(error, 500);
  }
});

export default generate;
