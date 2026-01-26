/**
 * Create Route
 * POST /v1/create - One-shot data-to-PDF generation
 * POST /v1/create/analyze - Analysis-only endpoint (no PDF generation)
 *
 * The star of the show: One API call, beautiful PDF.
 */

import { Hono } from "hono";
import { z } from "zod";
import { analyzeData, DataAnalysis } from "../services/dataAnalyzer.js";
import { generateLayout, generateFullDocument, LayoutOptions } from "../services/layoutGenerator.js";
import { generatePDF, generatePNG, PDFOptions, PNGOptions } from "../services/pdf.js";
import {
  createDevSession,
  generateDevSessionId,
} from "../lib/devSessions.js";
import type { ApiError } from "../lib/types.js";

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
};

// ============================================================================
// Request Validation
// ============================================================================

const createRequestSchema = z.object({
  data: z.record(z.unknown()).refine((val) => Object.keys(val).length > 0, {
    message: "Data object cannot be empty",
  }),
  intent: z.string().optional(),
  style: z.enum(["stripe-clean", "bold", "minimal", "corporate"]).optional(),
  format: z.enum(["pdf", "png"]).optional().default("pdf"),
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
 * One-shot data-to-PDF generation
 *
 * Flow:
 * 1. Analyze data structure
 * 2. Generate layout HTML
 * 3. Generate PDF/PNG output
 * 4. Create session for subsequent modifications
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

    const { data, intent, style, format, options } = parsed.data;

    console.log(`[Create] Starting one-shot generation for ${format} document`);

    // Step 1: Analyze data structure
    let analysis: DataAnalysis;
    try {
      analysis = await analyzeData(data, intent);
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

    // Step 2: Generate layout HTML
    const layoutOptions: LayoutOptions = {
      style: style || (analysis.styling.suggestedStyle as LayoutOptions["style"]) || "stripe-clean",
      pageSize: options?.pageSize || "letter",
      orientation: options?.orientation || "portrait",
      userInstructions: intent,
    };

    let fullHtml: string;
    try {
      fullHtml = await generateFullDocument(data, analysis, layoutOptions);
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

    // Step 3: Generate output (PDF or PNG)
    let outputBuffer: Buffer;
    let contentType: string;
    let filename: string;

    try {
      if (format === "pdf") {
        const pdfOptions: PDFOptions = {
          format: options?.pageSize === "A4" ? "a4" : "letter",
          landscape: options?.orientation === "landscape",
          margin: options?.margin,
          scale: options?.scale,
        };
        outputBuffer = await generatePDF(fullHtml, pdfOptions);
        contentType = "application/pdf";
        filename = `${analysis.documentType}-${Date.now()}.pdf`;
      } else {
        const pngOptions: PNGOptions = {
          scale: options?.scale,
        };
        outputBuffer = await generatePNG(fullHtml, pngOptions);
        contentType = "image/png";
        filename = `${analysis.documentType}-${Date.now()}.png`;
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

    // Step 4: Create session for potential modifications
    const sessionId = generateDevSessionId();
    const layout = await generateLayout(data, analysis, layoutOptions);

    createDevSession(
      sessionId,
      `generated-${analysis.documentType}`,
      fullHtml,
      layout.html, // template HTML for modifications
      data
    );
    console.log(`[Create] Session created: ${sessionId}`);

    // Build response
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Determine response format based on Accept header
    const accept = c.req.header("Accept");

    if (accept?.includes("application/json") || !accept?.includes(contentType)) {
      // Return JSON with base64 data URL
      return c.json({
        success: true,
        format,
        url: `data:${contentType};base64,${outputBuffer.toString("base64")}`,
        size: outputBuffer.length,
        filename,
        expiresAt: expiresAt.toISOString(),
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
