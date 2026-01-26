/**
 * Smart Generation Routes
 * Template + source + record -> PDF generation
 *
 * These endpoints enable the intelligent template system's core workflow:
 * 1. Single PDF: POST /v1/generate/smart - Generate from template + source + record
 * 2. Batch start: POST /v1/generate/smart/batch - Start batch generation job
 * 3. Batch status: GET /v1/generate/smart/batch/:jobId - Check batch progress
 * 4. Batch download: GET /v1/generate/smart/batch/:jobId/download - Download ZIP
 */

import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { getSupabase } from "../lib/supabase.js";
import {
  generateFromSource,
  startSmartBatchJob,
  getSmartBatchJobStatus,
  getSmartBatchJobResult,
} from "../services/smartGenerator.js";
import type { ApiError } from "../lib/types.js";

const generateSmart = new Hono();

// =============================================================================
// Request Schemas
// =============================================================================

const smartGenerateSchema = z.object({
  templateId: z.string().uuid("Invalid template ID format"),
  sourceId: z.string().uuid("Invalid source ID format").optional(),
  recordId: z.string().min(1, "Record ID is required").optional(),
  filter: z
    .object({
      formula: z.string().optional(),
      limit: z.number().int().min(1).max(1000).optional(),
    })
    .optional(),
  format: z.enum(["pdf", "png", "html"]).optional().default("pdf"),
  options: z
    .object({
      format: z.enum(["letter", "a4"]).optional(),
      landscape: z.boolean().optional(),
      scale: z.number().min(0.1).max(2).optional(),
      margin: z
        .object({
          top: z.string().optional(),
          bottom: z.string().optional(),
          left: z.string().optional(),
          right: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

const batchGenerateSchema = z.object({
  templateId: z.string().uuid("Invalid template ID format"),
  sourceId: z.string().uuid("Invalid source ID format").optional(),
  filter: z
    .object({
      formula: z.string().optional(),
      limit: z.number().int().min(1).max(1000).optional().default(100),
    })
    .optional(),
  format: z.enum(["pdf", "png", "html"]).optional().default("pdf"),
  options: z
    .object({
      format: z.enum(["letter", "a4"]).optional(),
      landscape: z.boolean().optional(),
      scale: z.number().min(0.1).max(2).optional(),
    })
    .optional(),
});

// =============================================================================
// Routes
// =============================================================================

/**
 * POST / - Smart generation (template + source + record)
 *
 * Generate a PDF (or HTML/PNG) from a template using data fetched from a
 * configured data source. This is the main "magic" endpoint that brings
 * together templates, sources, and mappings.
 *
 * For single record: Returns the generated document
 * For multiple records: Returns info about the records found (use batch endpoint)
 */
generateSmart.post(
  "/",
  zValidator("json", smartGenerateSchema, (result, c) => {
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
      const apiKeyId = c.get("apiKeyId");
      if (!apiKeyId) {
        const error: ApiError = {
          error: "API key not found in context. This endpoint requires authentication.",
          code: "AUTH_REQUIRED",
        };
        return c.json(error, 401);
      }

      const body = c.req.valid("json");
      const supabase = getSupabase();

      // Generate document
      const result = await generateFromSource(supabase, apiKeyId, {
        templateId: body.templateId,
        sourceId: body.sourceId,
        recordId: body.recordId,
        filter: body.filter,
        format: body.format,
        options: body.options,
      });

      if (!result.success) {
        const error: ApiError = {
          error: result.error || "Generation failed",
          code: "GENERATION_ERROR",
        };
        return c.json(error, 400);
      }

      // Check Accept header for response format
      const accept = c.req.header("Accept");

      // If single record and client wants the file directly
      if (result.data && result.recordCount === 1) {
        if (!accept?.includes("application/json")) {
          // Return raw file
          if (result.format === "html") {
            c.header("Content-Type", "text/html");
            return c.body(result.data);
          }

          // PDF - decode base64
          const buffer = Buffer.from(result.data, "base64");
          c.header("Content-Type", result.contentType || "application/pdf");
          c.header(
            "Content-Disposition",
            `attachment; filename="document-${Date.now()}.pdf"`
          );
          c.header("Content-Length", String(buffer.length));
          return c.body(new Uint8Array(buffer));
        }
      }

      // Return JSON response
      return c.json({
        success: true,
        format: result.format,
        data: result.data,
        contentType: result.contentType,
        recordCount: result.recordCount,
        generatedAt: result.generatedAt,
        warnings: result.warnings,
      });
    } catch (err) {
      console.error("Smart generation error:", err);
      const error: ApiError = {
        error: err instanceof Error ? err.message : "Unknown error",
        code: "GENERATION_ERROR",
      };
      return c.json(error, 500);
    }
  }
);

/**
 * POST /batch - Start batch generation job
 *
 * For generating PDFs from multiple records. Returns a job ID that can be
 * polled for status and eventually downloaded as a ZIP file.
 */
generateSmart.post(
  "/batch",
  zValidator("json", batchGenerateSchema, (result, c) => {
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
      const apiKeyId = c.get("apiKeyId");
      if (!apiKeyId) {
        const error: ApiError = {
          error: "API key not found in context. This endpoint requires authentication.",
          code: "AUTH_REQUIRED",
        };
        return c.json(error, 401);
      }

      const body = c.req.valid("json");
      const supabase = getSupabase();

      // Start batch job
      const jobResult = await startSmartBatchJob(supabase, apiKeyId, {
        templateId: body.templateId,
        sourceId: body.sourceId,
        filter: body.filter,
        format: body.format,
        options: body.options,
      });

      return c.json({
        success: true,
        jobId: jobResult.jobId,
        status: jobResult.status,
        totalRecords: jobResult.totalRecords,
        message:
          "Batch job started. Poll GET /v1/generate/smart/batch/:jobId for status.",
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
 * GET /batch/:jobId - Check batch status
 *
 * Poll this endpoint to check the progress of a batch generation job.
 */
generateSmart.get("/batch/:jobId", async (c) => {
  const jobId = c.req.param("jobId");

  const job = getSmartBatchJobStatus(jobId);

  if (!job) {
    const error: ApiError = {
      error: "Job not found",
      code: "JOB_NOT_FOUND",
    };
    return c.json(error, 404);
  }

  return c.json({
    success: true,
    jobId: job.id,
    status: job.status,
    progress: {
      total: job.progress.total,
      completed: job.progress.completed,
      failed: job.progress.failed,
      percentage:
        job.progress.total > 0
          ? Math.round((job.progress.completed / job.progress.total) * 100)
          : 0,
    },
    errors: job.errors.length > 0 ? job.errors.slice(0, 10) : [], // Limit errors in response
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    completedAt: job.completedAt?.toISOString(),
    downloadReady: job.status === "completed",
  });
});

/**
 * GET /batch/:jobId/download - Download batch ZIP
 *
 * Download the completed batch as a ZIP file containing all generated PDFs.
 * Only available when the job status is "completed".
 */
generateSmart.get("/batch/:jobId/download", async (c) => {
  const jobId = c.req.param("jobId");

  const job = getSmartBatchJobStatus(jobId);

  if (!job) {
    const error: ApiError = {
      error: "Job not found",
      code: "JOB_NOT_FOUND",
    };
    return c.json(error, 404);
  }

  if (job.status !== "completed") {
    const error: ApiError = {
      error: `Job is ${job.status}, not ready for download. ` +
        (job.status === "processing"
          ? `Progress: ${job.progress.completed}/${job.progress.total}`
          : ""),
      code: "JOB_NOT_READY",
    };
    return c.json(error, 400);
  }

  const zipBuffer = getSmartBatchJobResult(jobId);

  if (!zipBuffer) {
    const error: ApiError = {
      error: "Job result not found (may have expired after 1 hour)",
      code: "RESULT_NOT_FOUND",
    };
    return c.json(error, 404);
  }

  // Return ZIP file
  c.header("Content-Type", "application/zip");
  c.header(
    "Content-Disposition",
    `attachment; filename="batch-${jobId}.zip"`
  );
  c.header("Content-Length", String(zipBuffer.length));

  return c.body(new Uint8Array(zipBuffer));
});

/**
 * GET /batch/:jobId/results - Get detailed results for each record
 *
 * Returns information about each record that was processed, including
 * filenames and any errors that occurred.
 */
generateSmart.get("/batch/:jobId/results", async (c) => {
  const jobId = c.req.param("jobId");

  const job = getSmartBatchJobStatus(jobId);

  if (!job) {
    const error: ApiError = {
      error: "Job not found",
      code: "JOB_NOT_FOUND",
    };
    return c.json(error, 404);
  }

  // Parse pagination parameters
  const limit = Math.min(parseInt(c.req.query("limit") || "50", 10), 100);
  const offset = parseInt(c.req.query("offset") || "0", 10);

  const paginatedResults = job.results.slice(offset, offset + limit);

  return c.json({
    success: true,
    jobId: job.id,
    status: job.status,
    results: paginatedResults,
    pagination: {
      total: job.results.length,
      limit,
      offset,
      hasMore: offset + limit < job.results.length,
    },
  });
});

export default generateSmart;
