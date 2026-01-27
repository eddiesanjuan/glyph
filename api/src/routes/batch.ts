/**
 * Batch Generate Route
 * POST /v1/batch/generate - Process multiple PDF generation requests in one call
 *
 * Each item: template+data -> preview session -> apply modifications -> generate PDF
 * Items processed sequentially to avoid overwhelming Playwright.
 * Individual failures do not abort the batch.
 */

import { Hono } from "hono";
import { z } from "zod";
import { analyzeData, type DataAnalysis } from "../services/dataAnalyzer.js";
import {
  generateFullDocument,
  type LayoutOptions,
} from "../services/layoutGenerator.js";
import { generatePDF, generatePNG, type PDFOptions, type PNGOptions } from "../services/pdf.js";
import { modifyHtml } from "../services/ai.js";
import type { ApiError } from "../lib/types.js";

const batch = new Hono();

// ============================================================================
// Request Validation
// ============================================================================

const batchItemSchema = z.object({
  template: z.string().optional().default("auto"),
  data: z.record(z.unknown()).refine((val) => Object.keys(val).length > 0, {
    message: "Data object cannot be empty",
  }),
  modifications: z.array(z.string().min(1).max(1000)).optional().default([]),
  format: z.enum(["pdf", "png"]).optional().default("pdf"),
  style: z.enum(["stripe-clean", "bold", "minimal", "corporate"]).optional(),
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
});

const batchRequestSchema = z.object({
  items: z
    .array(batchItemSchema)
    .min(1, "At least one item is required")
    .max(10, "Maximum 10 items per batch"),
});

// ============================================================================
// Types
// ============================================================================

interface BatchItemResult {
  index: number;
  status: "success" | "error";
  url?: string;
  filename?: string;
  size?: number;
  format?: string;
  processingTimeMs: number;
  error?: string;
  errorCode?: string;
}

// ============================================================================
// Route
// ============================================================================

batch.post("/generate", async (c) => {
  const batchStart = Date.now();

  try {
    const body = await c.req.json();

    const parsed = batchRequestSchema.safeParse(body);
    if (!parsed.success) {
      const error: ApiError = {
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: parsed.error.issues,
      };
      return c.json(error, 400);
    }

    const { items } = parsed.data;

    console.log(`[Batch] Starting batch generation: ${items.length} items`);

    const results: BatchItemResult[] = [];

    // Process items sequentially to avoid overwhelming Playwright
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemStart = Date.now();

      try {
        // Step 1: Analyze data structure
        const analysis: DataAnalysis = await analyzeData(item.data);
        console.log(
          `[Batch] Item ${i}: analyzed as ${analysis.documentType} (confidence: ${analysis.confidence.toFixed(2)})`
        );

        // Step 2: Generate layout HTML
        const layoutOptions: LayoutOptions = {
          style:
            item.style ||
            (analysis.styling.suggestedStyle as LayoutOptions["style"]) ||
            "stripe-clean",
          pageSize: item.options?.pageSize || "letter",
          orientation: item.options?.orientation || "portrait",
        };

        let fullHtml: string = await generateFullDocument(
          item.data,
          analysis,
          layoutOptions
        );

        // Step 3: Apply modifications sequentially
        if (item.modifications.length > 0) {
          for (const instruction of item.modifications) {
            try {
              const result = await modifyHtml({
                html: fullHtml,
                instruction,
              });
              fullHtml = result.html;
              console.log(
                `[Batch] Item ${i}: applied modification "${instruction.substring(0, 50)}..."`
              );
            } catch (modErr) {
              console.warn(
                `[Batch] Item ${i}: modification failed: "${instruction.substring(0, 50)}..."`,
                modErr instanceof Error ? modErr.message : modErr
              );
              // Continue with current HTML despite modification failure
            }
          }
        }

        // Step 4: Generate output
        let outputBuffer: Buffer;
        let contentType: string;
        let filename: string;

        if (item.format === "pdf") {
          const pdfOptions: PDFOptions = {
            format: item.options?.pageSize === "A4" ? "a4" : "letter",
            landscape: item.options?.orientation === "landscape",
            margin: item.options?.margin,
            scale: item.options?.scale,
          };
          outputBuffer = await generatePDF(fullHtml, pdfOptions);
          contentType = "application/pdf";
          filename = `${analysis.documentType}-${i}-${Date.now()}.pdf`;
        } else {
          const pngOptions: PNGOptions = {
            scale: item.options?.scale,
          };
          outputBuffer = await generatePNG(fullHtml, pngOptions);
          contentType = "image/png";
          filename = `${analysis.documentType}-${i}-${Date.now()}.png`;
        }

        const processingTimeMs = Date.now() - itemStart;
        console.log(
          `[Batch] Item ${i}: ${item.format} generated (${outputBuffer.length} bytes, ${processingTimeMs}ms)`
        );

        results.push({
          index: i,
          status: "success",
          url: `data:${contentType};base64,${outputBuffer.toString("base64")}`,
          filename,
          size: outputBuffer.length,
          format: item.format,
          processingTimeMs,
        });
      } catch (err) {
        const processingTimeMs = Date.now() - itemStart;
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";

        console.error(`[Batch] Item ${i} failed (${processingTimeMs}ms):`, errorMessage);

        results.push({
          index: i,
          status: "error",
          processingTimeMs,
          error: errorMessage,
          errorCode: "ITEM_GENERATION_FAILED",
        });
      }
    }

    const totalTimeMs = Date.now() - batchStart;
    const successCount = results.filter((r) => r.status === "success").length;
    const failCount = results.filter((r) => r.status === "error").length;

    console.log(
      `[Batch] Complete: ${successCount}/${items.length} succeeded in ${totalTimeMs}ms`
    );

    return c.json({
      results,
      totalTimeMs,
      successCount,
      failCount,
    });
  } catch (err) {
    console.error("[Batch] Unexpected error:", err);

    const errorMessage = err instanceof Error ? err.message : "Unknown error";

    return c.json(
      {
        error: errorMessage,
        code: "BATCH_ERROR",
      },
      500
    );
  }
});

export default batch;
