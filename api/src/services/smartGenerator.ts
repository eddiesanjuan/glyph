/**
 * Smart Generator Service
 * Generates PDFs from template + data source combination
 *
 * This is the core of the intelligent template system - it fetches data from
 * configured sources, applies field mappings, renders templates, and generates PDFs.
 */

import JSZip from "jszip";
import pLimit from "p-limit";
import Mustache from "mustache";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createConnector } from "./connectors/index.js";
import { applyMappings } from "./fieldMapper.js";
import { generatePDF, type PDFOptions } from "./pdf.js";
import type {
  DataSource,
  TemplateSourceMapping,
  EnhancedTemplate,
} from "../types/data-sources.js";
import type { SourceRecord } from "./sourceConnector.js";

// =============================================================================
// Types
// =============================================================================

export interface SmartGenerateOptions {
  templateId: string;
  sourceId?: string;
  recordId?: string;
  filter?: {
    formula?: string;
    limit?: number;
  };
  format?: "pdf" | "png" | "html";
  options?: PDFOptions;
}

export interface SmartGenerateResult {
  success: boolean;
  format: string;
  data?: string; // Base64 encoded for pdf/png, raw for html
  contentType?: string;
  recordCount: number;
  generatedAt: string;
  error?: string;
  warnings?: string[];
}

export interface BatchGenerateResult {
  filename: string;
  pdf: Buffer;
  recordId: string;
  warnings: string[];
}

// Batch job store
export interface SmartBatchJob {
  id: string;
  templateId: string;
  sourceId: string;
  filter?: { formula?: string; limit?: number };
  format: "pdf" | "png" | "html";
  status: "pending" | "processing" | "completed" | "failed";
  progress: {
    total: number;
    completed: number;
    failed: number;
  };
  results: Array<{ recordId: string; filename: string; error?: string }>;
  errors: Array<{ recordId: string; error: string }>;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

// In-memory batch job store
const batchJobs = new Map<string, SmartBatchJob>();
const batchResults = new Map<string, Buffer>(); // Store completed ZIP files

// Clean up old jobs after 1 hour
const JOB_EXPIRY_MS = 60 * 60 * 1000;

function cleanupOldJobs() {
  const now = Date.now();
  for (const [id, job] of batchJobs) {
    if (now - job.createdAt.getTime() > JOB_EXPIRY_MS) {
      batchJobs.delete(id);
      batchResults.delete(id);
    }
  }
}

// Run cleanup every 10 minutes
setInterval(cleanupOldJobs, 10 * 60 * 1000);

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate a unique job ID
 */
function generateJobId(): string {
  return `smart_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get template from database with ownership validation
 */
async function getTemplate(
  supabase: SupabaseClient,
  templateId: string,
  apiKeyId: string
): Promise<EnhancedTemplate> {
  const { data, error } = await supabase
    .from("templates")
    .select("*")
    .eq("id", templateId)
    .eq("api_key_id", apiKeyId)
    .is("deleted_at", null)
    .single();

  if (error || !data) {
    throw new Error(`Template not found: ${templateId}`);
  }

  return data as EnhancedTemplate;
}

/**
 * Get data source from database with ownership validation
 */
async function getSource(
  supabase: SupabaseClient,
  sourceId: string,
  apiKeyId: string
): Promise<DataSource> {
  const { data, error } = await supabase
    .from("data_sources")
    .select("*")
    .eq("id", sourceId)
    .eq("api_key_id", apiKeyId)
    .is("deleted_at", null)
    .single();

  if (error || !data) {
    throw new Error(`Data source not found: ${sourceId}`);
  }

  return data as DataSource;
}

/**
 * Get mapping for template-source pair
 */
async function getMapping(
  supabase: SupabaseClient,
  templateId: string,
  sourceId: string
): Promise<TemplateSourceMapping> {
  const { data, error } = await supabase
    .from("template_source_mappings")
    .select("*")
    .eq("template_id", templateId)
    .eq("source_id", sourceId)
    .single();

  if (error || !data) {
    throw new Error(
      `No mapping found for template ${templateId} and source ${sourceId}. ` +
      `Please create a mapping first using POST /v1/mappings.`
    );
  }

  return data as TemplateSourceMapping;
}

/**
 * Render filename template with record data
 */
function renderFilename(
  template: EnhancedTemplate,
  record: SourceRecord,
  mappedData: Record<string, unknown>
): string {
  // Use template name or record ID as default
  let filename = template.name.replace(/[^a-zA-Z0-9-_]/g, "_");

  // Try to get a meaningful identifier from the mapped data
  const possibleIds = ["id", "number", "name", "title", "reference"];
  for (const key of possibleIds) {
    if (mappedData[key]) {
      filename = `${filename}-${String(mappedData[key]).replace(/[^a-zA-Z0-9-_]/g, "_")}`;
      break;
    }
  }

  // Add record ID for uniqueness
  filename = `${filename}-${record.id}`;

  return `${filename}.pdf`;
}

// =============================================================================
// Main Functions
// =============================================================================

/**
 * Generate document from template + data source
 */
export async function generateFromSource(
  supabase: SupabaseClient,
  apiKeyId: string,
  options: SmartGenerateOptions
): Promise<SmartGenerateResult> {
  const warnings: string[] = [];

  try {
    // 1. Get template
    const template = await getTemplate(supabase, options.templateId, apiKeyId);

    // 2. Get source (specified or default)
    const sourceId = options.sourceId || template.default_source_id;
    if (!sourceId) {
      throw new Error(
        "No source specified and no default source set on template. " +
        "Either specify sourceId in the request or set default_source_id on the template."
      );
    }

    const source = await getSource(supabase, sourceId, apiKeyId);

    // 3. Get mapping
    const mapping = await getMapping(supabase, options.templateId, sourceId);

    // 4. Fetch record(s) from source
    const connector = createConnector(source);

    let records: SourceRecord[];
    if (options.recordId) {
      // Single record
      const record = await connector.fetchRecord(options.recordId);
      records = [record];
    } else {
      // Multiple records with filter
      records = await connector.fetchRecords({
        filter: options.filter?.formula,
        limit: options.filter?.limit,
      });
    }

    if (records.length === 0) {
      throw new Error("No records found matching the criteria");
    }

    // 5. For single record, generate PDF directly
    if (records.length === 1) {
      const record = records[0];

      // Apply field mappings
      const mappingResult = applyMappings(
        record,
        mapping.field_mappings,
        mapping.transformations
      );

      if (mappingResult.warnings.length > 0) {
        warnings.push(...mappingResult.warnings);
      }

      if (mappingResult.unmappedFields.length > 0) {
        warnings.push(
          `Unmapped fields: ${mappingResult.unmappedFields.join(", ")}`
        );
      }

      // Render template with mapped data
      const html = Mustache.render(template.html_template, mappingResult.data);

      // Handle different output formats
      const format = options.format || "pdf";

      if (format === "html") {
        return {
          success: true,
          format: "html",
          data: html,
          contentType: "text/html",
          recordCount: 1,
          generatedAt: new Date().toISOString(),
          warnings: warnings.length > 0 ? warnings : undefined,
        };
      }

      // Generate PDF
      const pdfBuffer = await generatePDF(html, options.options);

      return {
        success: true,
        format: "pdf",
        data: pdfBuffer.toString("base64"),
        contentType: "application/pdf",
        recordCount: 1,
        generatedAt: new Date().toISOString(),
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    }

    // 6. For multiple records, return info (use batch endpoint instead)
    return {
      success: true,
      format: options.format || "pdf",
      recordCount: records.length,
      generatedAt: new Date().toISOString(),
      warnings: [
        `Found ${records.length} records. For multiple records, use POST /v1/generate/smart/batch instead.`,
      ],
    };
  } catch (err) {
    console.error("Smart generation error:", err);
    return {
      success: false,
      format: options.format || "pdf",
      recordCount: 0,
      generatedAt: new Date().toISOString(),
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Start a batch generation job
 */
export async function startSmartBatchJob(
  supabase: SupabaseClient,
  apiKeyId: string,
  options: SmartGenerateOptions
): Promise<{ jobId: string; status: string; totalRecords: number }> {
  const jobId = generateJobId();

  // Get template and source to validate and count records
  const template = await getTemplate(supabase, options.templateId, apiKeyId);

  const sourceId = options.sourceId || template.default_source_id;
  if (!sourceId) {
    throw new Error("No source specified and no default source set on template");
  }

  const source = await getSource(supabase, sourceId, apiKeyId);

  // Validate mapping exists
  await getMapping(supabase, options.templateId, sourceId);

  // Get record count
  const connector = createConnector(source);
  const records = await connector.fetchRecords({
    filter: options.filter?.formula,
    limit: options.filter?.limit || 100,
  });

  // Create job entry
  const job: SmartBatchJob = {
    id: jobId,
    templateId: options.templateId,
    sourceId,
    filter: options.filter,
    format: options.format || "pdf",
    status: "pending",
    progress: {
      total: records.length,
      completed: 0,
      failed: 0,
    },
    results: [],
    errors: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  batchJobs.set(jobId, job);

  // Process in background
  processSmartBatchJob(jobId, supabase, apiKeyId, options, records).catch(
    (err) => {
      const job = batchJobs.get(jobId);
      if (job) {
        job.status = "failed";
        job.errors.push({ recordId: "system", error: err.message });
        job.updatedAt = new Date();
      }
    }
  );

  return {
    jobId,
    status: "pending",
    totalRecords: records.length,
  };
}

/**
 * Process batch job in background
 */
async function processSmartBatchJob(
  jobId: string,
  supabase: SupabaseClient,
  apiKeyId: string,
  options: SmartGenerateOptions,
  records: SourceRecord[]
): Promise<void> {
  const job = batchJobs.get(jobId);
  if (!job) return;

  job.status = "processing";
  job.updatedAt = new Date();

  try {
    // Get template and mapping
    const template = await getTemplate(supabase, options.templateId, apiKeyId);
    const sourceId = options.sourceId || template.default_source_id!;
    const mapping = await getMapping(supabase, options.templateId, sourceId);

    // Limit concurrency
    const limit = pLimit(5);

    // Create ZIP file
    const zip = new JSZip();
    const usedFilenames = new Set<string>();

    // Process records
    const tasks = records.map((record) =>
      limit(async () => {
        try {
          // Apply mappings
          const mappingResult = applyMappings(
            record,
            mapping.field_mappings,
            mapping.transformations
          );

          // Render template
          const html = Mustache.render(template.html_template, mappingResult.data);

          // Generate PDF
          const pdfBuffer = await generatePDF(html, options.options);

          // Generate filename
          let filename = renderFilename(template, record, mappingResult.data);

          // Handle duplicate filenames
          if (usedFilenames.has(filename)) {
            const parts = filename.split(".");
            const ext = parts.pop();
            const base = parts.join(".");
            filename = `${base}_${Date.now()}.${ext}`;
          }
          usedFilenames.add(filename);

          // Add to ZIP
          zip.file(filename, pdfBuffer);

          job.progress.completed++;
          job.results.push({ recordId: record.id, filename });
          job.updatedAt = new Date();
        } catch (err) {
          job.progress.failed++;
          const errorMsg = err instanceof Error ? err.message : "Unknown error";
          job.errors.push({ recordId: record.id, error: errorMsg });
          job.results.push({ recordId: record.id, filename: "", error: errorMsg });
          job.updatedAt = new Date();
        }
      })
    );

    await Promise.all(tasks);

    // Generate ZIP buffer
    const zipBuffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    // Store result
    batchResults.set(jobId, zipBuffer);

    // Update job status
    job.status = job.progress.failed === job.progress.total ? "failed" : "completed";
    job.completedAt = new Date();
    job.updatedAt = new Date();
  } catch (err) {
    job.status = "failed";
    job.errors.push({
      recordId: "system",
      error: err instanceof Error ? err.message : "Unknown error",
    });
    job.updatedAt = new Date();
  }
}

/**
 * Get batch job status
 */
export function getSmartBatchJobStatus(jobId: string): SmartBatchJob | null {
  return batchJobs.get(jobId) || null;
}

/**
 * Get batch job result (ZIP file)
 */
export function getSmartBatchJobResult(jobId: string): Buffer | null {
  return batchResults.get(jobId) || null;
}

/**
 * Generate a single PDF from template + record (helper for batch)
 */
export async function generateSingleFromRecord(
  supabase: SupabaseClient,
  apiKeyId: string,
  templateId: string,
  sourceId: string,
  record: SourceRecord,
  pdfOptions?: PDFOptions
): Promise<BatchGenerateResult> {
  // Get template and mapping
  const template = await getTemplate(supabase, templateId, apiKeyId);
  const mapping = await getMapping(supabase, templateId, sourceId);

  // Apply mappings
  const mappingResult = applyMappings(
    record,
    mapping.field_mappings,
    mapping.transformations
  );

  // Render template
  const html = Mustache.render(template.html_template, mappingResult.data);

  // Generate PDF
  const pdfBuffer = await generatePDF(html, pdfOptions);

  // Generate filename
  const filename = renderFilename(template, record, mappingResult.data);

  return {
    filename,
    pdf: pdfBuffer,
    recordId: record.id,
    warnings: mappingResult.warnings,
  };
}
