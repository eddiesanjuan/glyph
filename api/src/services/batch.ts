/**
 * Batch PDF Generation Service
 * Generates multiple PDFs from Airtable records and packages them as a ZIP file
 */

import JSZip from "jszip";
import pLimit from "p-limit";
import Mustache from "mustache";
import { generatePDF, type PDFOptions } from "./pdf.js";
import {
  AirtableService,
  type AirtableRecord,
  type AirtableTable,
} from "./airtable.js";

// =============================================================================
// Types
// =============================================================================

export interface BatchOptions {
  template: string;
  airtable: {
    apiKey: string;
    baseId: string;
    tableId: string;
    view?: string;
    maxRecords?: number;
    filterByFormula?: string;
  };
  output: {
    format: "pdf" | "zip";
    filename: string; // Template with {{fields.X}} placeholders
  };
  pdfOptions?: PDFOptions;
}

export interface BatchJob {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  total: number;
  completed: number;
  failed: number;
  errors: Array<{ recordId: string; error: string }>;
  startedAt: string;
  completedAt?: string;
  downloadUrl?: string;
}

export interface BatchResult {
  filename: string;
  pdf: Buffer;
  recordId: string;
}

// =============================================================================
// Job Storage (in-memory for now, could be Redis in production)
// =============================================================================

const jobs = new Map<string, BatchJob>();
const jobResults = new Map<string, Buffer>(); // Store completed ZIP files

// Clean up old jobs after 1 hour
const JOB_EXPIRY_MS = 60 * 60 * 1000;

function cleanupOldJobs() {
  const now = Date.now();
  for (const [id, job] of jobs) {
    const startTime = new Date(job.startedAt).getTime();
    if (now - startTime > JOB_EXPIRY_MS) {
      jobs.delete(id);
      jobResults.delete(id);
    }
  }
}

// Run cleanup every 10 minutes
setInterval(cleanupOldJobs, 10 * 60 * 1000);

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Generate a unique job ID
 */
function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Render a filename template with record data
 */
function renderFilename(
  template: string,
  fields: Record<string, unknown>,
  recordId: string
): string {
  // Replace {{fields.X}} placeholders
  let filename = template;

  // Handle {{fields.X}} format
  filename = Mustache.render(filename, { fields, record: { id: recordId } });

  // Sanitize filename - remove invalid characters
  filename = filename.replace(/[<>:"/\\|?*]/g, "-");

  // Ensure .pdf extension
  if (!filename.toLowerCase().endsWith(".pdf")) {
    filename += ".pdf";
  }

  return filename;
}

/**
 * Generate a single PDF from a record
 */
async function generateSinglePdf(
  template: string,
  record: AirtableRecord,
  table: AirtableTable,
  airtableService: AirtableService,
  filenameTemplate: string,
  pdfOptions?: PDFOptions
): Promise<BatchResult> {
  // Format record data for template
  const recordData = airtableService.formatRecordForTemplate(record, table);

  // Render HTML with record data
  const html = Mustache.render(template, recordData);

  // Generate PDF
  const pdf = await generatePDF(html, pdfOptions);

  // Generate filename
  const filename = renderFilename(
    filenameTemplate,
    recordData.fields as Record<string, unknown>,
    record.id
  );

  return {
    filename,
    pdf,
    recordId: record.id,
  };
}

/**
 * Generate batch PDFs synchronously (for small batches, returns ZIP directly)
 */
export async function generateBatchSync(
  options: BatchOptions
): Promise<Buffer> {
  const { template, airtable, output, pdfOptions } = options;

  // Create Airtable service
  const airtableService = new AirtableService(airtable.apiKey);

  // Get table schema for data formatting
  const table = await airtableService.getTableSchema(
    airtable.baseId,
    airtable.tableId
  );

  if (!table) {
    throw new Error(`Table '${airtable.tableId}' not found`);
  }

  // Fetch all records
  const records = await airtableService.listRecords(
    airtable.baseId,
    airtable.tableId,
    {
      view: airtable.view,
      maxRecords: airtable.maxRecords || 100,
      filterByFormula: airtable.filterByFormula,
    }
  );

  if (records.length === 0) {
    throw new Error("No records found in the table");
  }

  // Limit concurrency to 5 parallel PDF generations
  const limit = pLimit(5);

  // Generate PDFs in parallel
  const results = await Promise.all(
    records.map((record) =>
      limit(() =>
        generateSinglePdf(
          template,
          record,
          table,
          airtableService,
          output.filename,
          pdfOptions
        )
      )
    )
  );

  // Create ZIP file
  const zip = new JSZip();

  // Track filenames to avoid duplicates
  const usedFilenames = new Set<string>();

  for (const result of results) {
    let filename = result.filename;

    // Handle duplicate filenames by adding record ID
    if (usedFilenames.has(filename)) {
      const parts = filename.split(".");
      const ext = parts.pop();
      const base = parts.join(".");
      filename = `${base}_${result.recordId}.${ext}`;
    }

    usedFilenames.add(filename);
    zip.file(filename, result.pdf);
  }

  // Generate ZIP buffer
  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

/**
 * Start an async batch job (for large batches)
 */
export async function startBatchJob(options: BatchOptions): Promise<string> {
  const jobId = generateJobId();

  // Create Airtable service
  const airtableService = new AirtableService(options.airtable.apiKey);

  // Get record count first
  const records = await airtableService.listRecords(
    options.airtable.baseId,
    options.airtable.tableId,
    {
      view: options.airtable.view,
      maxRecords: options.airtable.maxRecords || 100,
      filterByFormula: options.airtable.filterByFormula,
    }
  );

  // Create job entry
  const job: BatchJob = {
    id: jobId,
    status: "pending",
    total: records.length,
    completed: 0,
    failed: 0,
    errors: [],
    startedAt: new Date().toISOString(),
  };

  jobs.set(jobId, job);

  // Process in background
  processBatchJob(jobId, options, records).catch((err) => {
    const job = jobs.get(jobId);
    if (job) {
      job.status = "failed";
      job.errors.push({ recordId: "system", error: err.message });
    }
  });

  return jobId;
}

/**
 * Process a batch job in the background
 */
async function processBatchJob(
  jobId: string,
  options: BatchOptions,
  records: AirtableRecord[]
): Promise<void> {
  const job = jobs.get(jobId);
  if (!job) return;

  job.status = "processing";

  const { template, airtable, output, pdfOptions } = options;

  // Create Airtable service
  const airtableService = new AirtableService(airtable.apiKey);

  // Get table schema
  const table = await airtableService.getTableSchema(
    airtable.baseId,
    airtable.tableId
  );

  if (!table) {
    job.status = "failed";
    job.errors.push({ recordId: "system", error: "Table not found" });
    return;
  }

  // Limit concurrency
  const limit = pLimit(5);

  // Create ZIP file
  const zip = new JSZip();
  const usedFilenames = new Set<string>();

  // Process records
  const tasks = records.map((record) =>
    limit(async () => {
      try {
        const result = await generateSinglePdf(
          template,
          record,
          table,
          airtableService,
          output.filename,
          pdfOptions
        );

        let filename = result.filename;
        if (usedFilenames.has(filename)) {
          const parts = filename.split(".");
          const ext = parts.pop();
          const base = parts.join(".");
          filename = `${base}_${result.recordId}.${ext}`;
        }
        usedFilenames.add(filename);

        zip.file(filename, result.pdf);
        job.completed++;
      } catch (err) {
        job.failed++;
        job.errors.push({
          recordId: record.id,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    })
  );

  await Promise.all(tasks);

  // Generate ZIP
  const zipBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  // Store result
  jobResults.set(jobId, zipBuffer);

  // Update job status
  job.status = job.failed === job.total ? "failed" : "completed";
  job.completedAt = new Date().toISOString();
}

/**
 * Get job status
 */
export function getJobStatus(jobId: string): BatchJob | null {
  return jobs.get(jobId) || null;
}

/**
 * Get job result (ZIP file)
 */
export function getJobResult(jobId: string): Buffer | null {
  return jobResults.get(jobId) || null;
}

/**
 * Get views for a table (for UI dropdown)
 */
export async function getTableViews(
  apiKey: string,
  baseId: string,
  tableId: string
): Promise<Array<{ id: string; name: string; type: string }>> {
  const airtableService = new AirtableService(apiKey);
  const table = await airtableService.getTableSchema(baseId, tableId);

  if (!table) {
    return [];
  }

  return table.views.map((v) => ({
    id: v.id,
    name: v.name,
    type: v.type,
  }));
}

/**
 * Get record count for a view (for UI display)
 */
export async function getRecordCount(
  apiKey: string,
  baseId: string,
  tableId: string,
  view?: string
): Promise<number> {
  const airtableService = new AirtableService(apiKey);

  // Airtable doesn't have a direct count endpoint, so we fetch with minimal fields
  // and count the results (up to a reasonable limit)
  const records = await airtableService.listRecords(baseId, tableId, {
    view,
    maxRecords: 1000, // Reasonable limit for counting
    fields: [], // Empty fields means minimal data returned
  });

  return records.length;
}
