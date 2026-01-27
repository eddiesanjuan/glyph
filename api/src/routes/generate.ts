/**
 * Generate Route
 * POST /v1/generate - Generate PDF or PNG from HTML
 */

import { Hono } from "hono";
import { z } from "zod";
import { generatePdf, generatePng } from "../services/pdf.js";
import type { GenerateResponse, ApiError } from "../lib/types.js";
import { triggerEventSubscriptions } from "./subscriptions.js";

const generate = new Hono();

// Request validation schema
const generateSchema = z.object({
  html: z.string().min(1, "HTML content is required"),
  format: z.enum(["pdf", "png"]),
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

    const { html, format, options } = parsed.data;

    // Generate document
    let buffer: Buffer;
    let contentType: string;
    let filename: string;

    if (format === "pdf") {
      buffer = await generatePdf(html, options);
      contentType = "application/pdf";
      filename = `document-${Date.now()}.pdf`;
    } else {
      buffer = await generatePng(html, options);
      contentType = "image/png";
      filename = `document-${Date.now()}.png`;
    }

    // TODO: Upload to Supabase Storage instead of returning raw buffer
    // For now, return the file directly

    // Trigger event subscriptions (fire and forget)
    triggerEventSubscriptions("pdf.generated", {
      format,
      size: buffer.length,
      filename,
    });

    // Check Accept header to decide response format
    const accept = c.req.header("Accept");

    if (accept?.includes("application/json")) {
      // Return metadata (would include URL after Supabase upload)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      const response: GenerateResponse = {
        url: `data:${contentType};base64,${buffer.toString("base64")}`,
        format,
        size: buffer.length,
        expiresAt: expiresAt.toISOString(),
      };

      return c.json(response);
    }

    // Return raw file
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
