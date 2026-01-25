/**
 * Templates Routes
 * AI-powered template generation from Airtable schema
 *
 * POST /v1/templates/generate - Generate template from description + schema
 * POST /v1/templates/refine - Refine existing template with natural language
 * POST /v1/templates/preview - Render template with sample data
 * POST /v1/templates/batch - Generate PDFs for all records (small batches)
 * POST /v1/templates/batch/start - Start async batch job (large batches)
 * GET  /v1/templates/batch/:jobId - Get batch job status
 * GET  /v1/templates/batch/:jobId/download - Download completed batch ZIP
 * GET  /v1/templates/views - Get views for a table
 * GET  /v1/templates/count - Get record count for a view
 */

import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import Mustache from "mustache";
import {
  AirtableService,
  isValidAirtableKeyFormat,
} from "../services/airtable.js";
import {
  generateTemplateFromSchema,
  refineTemplate,
  type AirtableAISchema,
} from "../services/ai.js";
import {
  generateBatchSync,
  startBatchJob,
  getJobStatus,
  getJobResult,
  getTableViews,
  getRecordCount,
} from "../services/batch.js";
import type { ApiError } from "../lib/types.js";

const templates = new Hono();

// =============================================================================
// Request Schemas
// =============================================================================

const generateSchema = z.object({
  // Airtable connection info
  airtable: z.object({
    apiKey: z.string().min(1, "Airtable API key is required"),
    baseId: z.string().min(1, "Base ID is required"),
    tableId: z.string().min(1, "Table ID is required"),
  }),
  // User's natural language description
  description: z.string().min(10, "Please provide a more detailed description"),
  // Optional style preset
  style: z
    .enum(["modern", "professional", "classic", "vibrant", "minimal", "invoice", "report"])
    .optional(),
  // Include sample data for preview
  includeSample: z.boolean().optional().default(true),
});

const refineSchema = z.object({
  // Current template HTML
  html: z.string().min(1, "Template HTML is required"),
  // Airtable connection for schema context
  airtable: z.object({
    apiKey: z.string().min(1, "Airtable API key is required"),
    baseId: z.string().min(1, "Base ID is required"),
    tableId: z.string().min(1, "Table ID is required"),
  }),
  // User's modification request
  instruction: z.string().min(1, "Please describe what you want to change"),
});

const previewSchema = z.object({
  // Template HTML with Mustache placeholders
  html: z.string().min(1, "Template HTML is required"),
  // Data to render (typically from Airtable)
  data: z.record(z.unknown()),
});

// =============================================================================
// Routes
// =============================================================================

/**
 * POST /generate
 * Generate a new template from Airtable schema + natural language description
 *
 * This is the KILLER FEATURE - user describes what they want, we create it.
 */
templates.post(
  "/generate",
  zValidator("json", generateSchema, (result, c) => {
    if (!result.success) {
      const error: ApiError = {
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: result.error.issues,
      };
      return c.json(error, 400);
    }
    return;
  }),
  async (c) => {
    try {
      const { airtable, description, style, includeSample } =
        c.req.valid("json");

      // Validate Airtable key format
      if (!isValidAirtableKeyFormat(airtable.apiKey)) {
        const error: ApiError = {
          error:
            "Invalid Airtable API key format. Keys should start with 'pat' or 'key'.",
          code: "INVALID_KEY_FORMAT",
        };
        return c.json(error, 400);
      }

      // Create Airtable service
      const airtableService = new AirtableService(airtable.apiKey);

      // Get table schema
      const table = await airtableService.getTableSchema(
        airtable.baseId,
        airtable.tableId
      );

      if (!table) {
        const error: ApiError = {
          error: `Table '${airtable.tableId}' not found in base.`,
          code: "TABLE_NOT_FOUND",
        };
        return c.json(error, 404);
      }

      // Format schema for AI
      const aiSchema = airtableService.formatSchemaForAI(table);

      // Get sample data if requested
      let sampleData: Record<string, unknown> | undefined;
      let sampleRecord: unknown | undefined;

      if (includeSample) {
        try {
          const records = await airtableService.getSampleRecords(
            airtable.baseId,
            airtable.tableId
          );
          if (records.length > 0) {
            sampleRecord = airtableService.formatRecordForTemplate(
              records[0],
              table
            );
            sampleData = sampleRecord as Record<string, unknown>;
          }
        } catch (err) {
          console.warn("Could not fetch sample data:", err);
          // Continue without sample data
        }
      }

      // Generate template with AI
      const result = await generateTemplateFromSchema(aiSchema, description, {
        style,
        sampleData,
      });

      // Render preview if we have sample data
      let preview: string | undefined;
      if (sampleData) {
        try {
          preview = Mustache.render(result.fullHtml, sampleData);
        } catch (err) {
          console.warn("Could not render preview:", err);
        }
      }

      return c.json({
        success: true,
        template: {
          html: result.fullHtml,
          css: result.css,
          bodyHtml: result.html,
          fieldsUsed: result.fields,
        },
        preview: preview || null,
        sampleData: sampleData || null,
        schema: {
          tableName: aiSchema.tableName,
          fieldCount: aiSchema.fields.length,
          fields: aiSchema.fields.map((f) => ({
            name: f.name,
            type: f.type,
            mustachePath: f.mustachePath,
          })),
        },
        usage: {
          tokensUsed: result.tokensUsed,
        },
      });
    } catch (err) {
      console.error("Template generation error:", err);
      const error: ApiError = {
        error: err instanceof Error ? err.message : "Unknown error",
        code: "GENERATION_ERROR",
      };
      return c.json(error, 500);
    }
  }
);

/**
 * POST /refine
 * Modify an existing template based on natural language instruction
 */
templates.post(
  "/refine",
  zValidator("json", refineSchema, (result, c) => {
    if (!result.success) {
      const error: ApiError = {
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: result.error.issues,
      };
      return c.json(error, 400);
    }
    return;
  }),
  async (c) => {
    try {
      const { html, airtable, instruction } = c.req.valid("json");

      // Validate Airtable key format
      if (!isValidAirtableKeyFormat(airtable.apiKey)) {
        const error: ApiError = {
          error:
            "Invalid Airtable API key format. Keys should start with 'pat' or 'key'.",
          code: "INVALID_KEY_FORMAT",
        };
        return c.json(error, 400);
      }

      // Create Airtable service and get schema
      const airtableService = new AirtableService(airtable.apiKey);
      const table = await airtableService.getTableSchema(
        airtable.baseId,
        airtable.tableId
      );

      if (!table) {
        const error: ApiError = {
          error: `Table '${airtable.tableId}' not found in base.`,
          code: "TABLE_NOT_FOUND",
        };
        return c.json(error, 404);
      }

      // Format schema for AI
      const aiSchema: AirtableAISchema = airtableService.formatSchemaForAI(table);

      // Refine template with AI
      const result = await refineTemplate(html, aiSchema, instruction);

      // Get sample data for preview
      let preview: string | undefined;
      try {
        const records = await airtableService.getSampleRecords(
          airtable.baseId,
          airtable.tableId
        );
        if (records.length > 0) {
          const sampleData = airtableService.formatRecordForTemplate(
            records[0],
            table
          );
          preview = Mustache.render(result.fullHtml, sampleData);
        }
      } catch (err) {
        console.warn("Could not render preview:", err);
      }

      return c.json({
        success: true,
        template: {
          html: result.fullHtml,
          css: result.css,
          bodyHtml: result.html,
          fieldsUsed: result.fields,
        },
        preview: preview || null,
        usage: {
          tokensUsed: result.tokensUsed,
        },
      });
    } catch (err) {
      console.error("Template refinement error:", err);
      const error: ApiError = {
        error: err instanceof Error ? err.message : "Unknown error",
        code: "REFINEMENT_ERROR",
      };
      return c.json(error, 500);
    }
  }
);

/**
 * POST /preview
 * Render a template with provided data (no AI involved)
 */
templates.post(
  "/preview",
  zValidator("json", previewSchema, (result, c) => {
    if (!result.success) {
      const error: ApiError = {
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: result.error.issues,
      };
      return c.json(error, 400);
    }
    return;
  }),
  async (c) => {
    try {
      const { html, data } = c.req.valid("json");

      // Render template with Mustache
      const rendered = Mustache.render(html, data);

      return c.json({
        success: true,
        html: rendered,
      });
    } catch (err) {
      console.error("Template preview error:", err);
      const error: ApiError = {
        error: err instanceof Error ? err.message : "Template rendering failed",
        code: "PREVIEW_ERROR",
      };
      return c.json(error, 500);
    }
  }
);

/**
 * GET /styles
 * List available style presets
 * NOTE: These affect visual styling only. Document structure is determined
 * automatically from the user's description (invoice, receipt, report, etc.)
 */
templates.get("/styles", (c) => {
  return c.json({
    styles: [
      {
        id: "modern",
        name: "Modern",
        description:
          "Clean, minimal design with lots of whitespace. Sans-serif fonts, subtle borders.",
      },
      {
        id: "professional",
        name: "Professional",
        description:
          "Traditional business style. Clean and formal, corporate appearance.",
      },
      {
        id: "classic",
        name: "Classic",
        description:
          "Traditional formal style. Serif headings, authoritative appearance.",
      },
      {
        id: "vibrant",
        name: "Vibrant",
        description:
          "Bold, colorful design with gradient accents. Eye-catching but professional.",
      },
      {
        id: "minimal",
        name: "Minimal",
        description:
          "Ultra-minimal with maximum whitespace. Typography-focused.",
      },
      {
        id: "invoice",
        name: "Invoice",
        description:
          "Optimized for financial documents. Clear tables and totals.",
      },
      {
        id: "report",
        name: "Report",
        description:
          "Professional report layout. Good for data summaries and overviews.",
      },
    ],
  });
});

// =============================================================================
// Batch Generation Schemas
// =============================================================================

const batchSchema = z.object({
  template: z.string().min(1, "Template HTML is required"),
  airtable: z.object({
    apiKey: z.string().min(1, "Airtable API key is required"),
    baseId: z.string().min(1, "Base ID is required"),
    tableId: z.string().min(1, "Table ID is required"),
    view: z.string().optional(),
    maxRecords: z.number().int().min(1).max(500).optional().default(100),
    filterByFormula: z.string().optional(),
  }),
  output: z.object({
    filename: z.string().min(1, "Filename template is required"),
  }),
  pdfOptions: z
    .object({
      format: z.enum(["letter", "a4"]).optional(),
      landscape: z.boolean().optional(),
      scale: z.number().min(0.1).max(2).optional(),
    })
    .optional(),
});

// =============================================================================
// Batch Generation Routes
// =============================================================================

/**
 * POST /batch
 * Generate PDFs for all records synchronously (for batches <= 20 records)
 * Returns ZIP file directly
 */
templates.post(
  "/batch",
  zValidator("json", batchSchema, (result, c) => {
    if (!result.success) {
      const error: ApiError = {
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: result.error.issues,
      };
      return c.json(error, 400);
    }
    return;
  }),
  async (c) => {
    try {
      const body = c.req.valid("json");

      // Validate Airtable key format
      if (!isValidAirtableKeyFormat(body.airtable.apiKey)) {
        const error: ApiError = {
          error:
            "Invalid Airtable API key format. Keys should start with 'pat' or 'key'.",
          code: "INVALID_KEY_FORMAT",
        };
        return c.json(error, 400);
      }

      // For sync batch, limit to 20 records to avoid timeout
      const maxRecords = Math.min(body.airtable.maxRecords || 20, 20);

      // Generate batch
      const zipBuffer = await generateBatchSync({
        template: body.template,
        airtable: {
          ...body.airtable,
          maxRecords,
        },
        output: {
          format: "zip",
          filename: body.output.filename,
        },
        pdfOptions: body.pdfOptions,
      });

      // Return ZIP file
      c.header("Content-Type", "application/zip");
      c.header(
        "Content-Disposition",
        `attachment; filename="batch-${Date.now()}.zip"`
      );
      c.header("Content-Length", zipBuffer.length.toString());

      return c.body(new Uint8Array(zipBuffer));
    } catch (err) {
      console.error("Batch generation error:", err);
      const error: ApiError = {
        error: err instanceof Error ? err.message : "Unknown error",
        code: "BATCH_ERROR",
      };
      return c.json(error, 500);
    }
  }
);

/**
 * POST /batch/start
 * Start an async batch job for large batches (> 20 records)
 * Returns job ID for polling
 */
templates.post(
  "/batch/start",
  zValidator("json", batchSchema, (result, c) => {
    if (!result.success) {
      const error: ApiError = {
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: result.error.issues,
      };
      return c.json(error, 400);
    }
    return;
  }),
  async (c) => {
    try {
      const body = c.req.valid("json");

      // Validate Airtable key format
      if (!isValidAirtableKeyFormat(body.airtable.apiKey)) {
        const error: ApiError = {
          error:
            "Invalid Airtable API key format. Keys should start with 'pat' or 'key'.",
          code: "INVALID_KEY_FORMAT",
        };
        return c.json(error, 400);
      }

      // Start batch job
      const jobId = await startBatchJob({
        template: body.template,
        airtable: body.airtable,
        output: {
          format: "zip",
          filename: body.output.filename,
        },
        pdfOptions: body.pdfOptions,
      });

      // Get initial status
      const status = getJobStatus(jobId);

      return c.json({
        success: true,
        jobId,
        status: status?.status || "pending",
        total: status?.total || 0,
        message: "Batch job started. Poll /batch/:jobId for status.",
      });
    } catch (err) {
      console.error("Batch start error:", err);
      const error: ApiError = {
        error: err instanceof Error ? err.message : "Unknown error",
        code: "BATCH_START_ERROR",
      };
      return c.json(error, 500);
    }
  }
);

/**
 * GET /batch/:jobId
 * Get status of a batch job
 */
templates.get("/batch/:jobId", async (c) => {
  const jobId = c.req.param("jobId");

  const job = getJobStatus(jobId);

  if (!job) {
    const error: ApiError = {
      error: "Job not found",
      code: "JOB_NOT_FOUND",
    };
    return c.json(error, 404);
  }

  return c.json({
    jobId: job.id,
    status: job.status,
    total: job.total,
    completed: job.completed,
    failed: job.failed,
    progress: job.total > 0 ? Math.round((job.completed / job.total) * 100) : 0,
    errors: job.errors.length > 0 ? job.errors.slice(0, 10) : [], // Limit errors returned
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    downloadReady: job.status === "completed",
  });
});

/**
 * GET /batch/:jobId/download
 * Download the completed batch ZIP file
 */
templates.get("/batch/:jobId/download", async (c) => {
  const jobId = c.req.param("jobId");

  const job = getJobStatus(jobId);

  if (!job) {
    const error: ApiError = {
      error: "Job not found",
      code: "JOB_NOT_FOUND",
    };
    return c.json(error, 404);
  }

  if (job.status !== "completed") {
    const error: ApiError = {
      error: `Job is ${job.status}, not ready for download`,
      code: "JOB_NOT_READY",
    };
    return c.json(error, 400);
  }

  const zipBuffer = getJobResult(jobId);

  if (!zipBuffer) {
    const error: ApiError = {
      error: "Job result not found (may have expired)",
      code: "RESULT_NOT_FOUND",
    };
    return c.json(error, 404);
  }

  // Return ZIP file
  c.header("Content-Type", "application/zip");
  c.header("Content-Disposition", `attachment; filename="batch-${jobId}.zip"`);
  c.header("Content-Length", zipBuffer.length.toString());

  return c.body(new Uint8Array(zipBuffer));
});

/**
 * GET /views
 * Get views for a table (for UI dropdown)
 */
templates.get("/views", async (c) => {
  const apiKey = c.req.query("apiKey");
  const baseId = c.req.query("baseId");
  const tableId = c.req.query("tableId");

  if (!apiKey || !baseId || !tableId) {
    const error: ApiError = {
      error: "Missing required query parameters: apiKey, baseId, tableId",
      code: "MISSING_PARAMS",
    };
    return c.json(error, 400);
  }

  if (!isValidAirtableKeyFormat(apiKey)) {
    const error: ApiError = {
      error: "Invalid Airtable API key format",
      code: "INVALID_KEY_FORMAT",
    };
    return c.json(error, 400);
  }

  try {
    const views = await getTableViews(apiKey, baseId, tableId);
    return c.json({ success: true, views });
  } catch (err) {
    console.error("Get views error:", err);
    const error: ApiError = {
      error: err instanceof Error ? err.message : "Unknown error",
      code: "VIEWS_ERROR",
    };
    return c.json(error, 500);
  }
});

/**
 * GET /count
 * Get record count for a view (for UI display)
 */
templates.get("/count", async (c) => {
  const apiKey = c.req.query("apiKey");
  const baseId = c.req.query("baseId");
  const tableId = c.req.query("tableId");
  const view = c.req.query("view");

  if (!apiKey || !baseId || !tableId) {
    const error: ApiError = {
      error: "Missing required query parameters: apiKey, baseId, tableId",
      code: "MISSING_PARAMS",
    };
    return c.json(error, 400);
  }

  if (!isValidAirtableKeyFormat(apiKey)) {
    const error: ApiError = {
      error: "Invalid Airtable API key format",
      code: "INVALID_KEY_FORMAT",
    };
    return c.json(error, 400);
  }

  try {
    const count = await getRecordCount(apiKey, baseId, tableId, view);
    return c.json({ success: true, count });
  } catch (err) {
    console.error("Get count error:", err);
    const error: ApiError = {
      error: err instanceof Error ? err.message : "Unknown error",
      code: "COUNT_ERROR",
    };
    return c.json(error, 500);
  }
});

export default templates;
