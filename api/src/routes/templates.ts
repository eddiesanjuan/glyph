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
import { resolve, join, dirname } from "path";
import { fileURLToPath } from "url";
import Mustache from "mustache";
import { createHash } from "crypto";
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
import { generatePNG } from "../services/pdf.js";
import { templateEngine } from "../services/template.js";
import type { ApiError } from "../lib/types.js";

// In-memory cache for template preview thumbnails
const thumbnailCache = new Map<string, Buffer>();

const templates = new Hono();

/** Generate a short ETag from content using SHA-256 (first 16 hex chars). */
function generateETag(content: string | Buffer | Uint8Array): string {
  const hash = createHash("sha256");
  if (typeof content === "string") {
    hash.update(content);
  } else {
    hash.update(content);
  }
  return `"${hash.digest("hex").slice(0, 16)}"`;
}

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
// Built-in Template Catalog
// =============================================================================

interface TemplateCatalogEntry {
  id: string;
  name: string;
  description: string;
  category: "quote" | "invoice" | "receipt" | "report" | "letter" | "contract" | "certificate";
  sampleData: Record<string, unknown>;
}

const TEMPLATE_CATALOG: TemplateCatalogEntry[] = [
  {
    id: "quote-modern",
    name: "Modern Quote",
    description: "Clean, minimal quote with sans-serif fonts and subtle borders.",
    category: "quote",
    sampleData: {
      meta: { quoteNumber: "Q-2024-001", date: "January 15, 2024", validUntil: "February 15, 2024" },
      client: { name: "John Smith", company: "Acme Corporation" },
      lineItems: [
        { description: "Website Design", quantity: 1, unitPrice: "3,500.00", total: "3,500.00" },
      ],
      totals: { subtotal: "3,500.00", total: "3,500.00" },
      branding: { companyName: "Design Studio Pro" },
    },
  },
  {
    id: "quote-bold",
    name: "Bold Quote",
    description: "High-impact modern design with strong visual hierarchy.",
    category: "quote",
    sampleData: {
      meta: { quoteNumber: "Q-2024-042", date: "January 18, 2024", validUntil: "February 18, 2024" },
      client: { name: "Sarah Chen", company: "Horizon Ventures" },
      lineItems: [
        { description: "Brand Strategy Workshop", quantity: 1, unitPrice: "5,000.00", total: "5,000.00" },
      ],
      totals: { subtotal: "5,000.00", total: "5,000.00" },
      branding: { companyName: "BOLD STUDIO" },
    },
  },
  {
    id: "quote-professional",
    name: "Professional Quote",
    description: "Traditional business style with formal serif typography.",
    category: "quote",
    sampleData: {
      meta: { quoteNumber: "Q-2024-001", date: "January 15, 2024", validUntil: "February 15, 2024" },
      client: { name: "John Smith", company: "Acme Corporation" },
      lineItems: [
        { description: "Consulting Services", quantity: 20, unitPrice: "250.00", total: "5,000.00" },
      ],
      totals: { subtotal: "5,000.00", total: "5,000.00" },
      branding: { companyName: "Professional Services Inc." },
    },
  },
  {
    id: "invoice-clean",
    name: "Clean Invoice",
    description: "Clear, structured invoice with line items, totals, and payment terms.",
    category: "invoice",
    sampleData: {
      invoice: { number: "INV-2024-0042", date: "January 20, 2024", dueDate: "February 19, 2024" },
      billTo: { name: "Sarah Chen", company: "Northwind Traders" },
      lineItems: [
        { description: "Brand Identity Package", quantity: 1, rate: "4,500.00", amount: "4,500.00" },
      ],
      totals: { subtotal: "4,500.00", total: "4,500.00" },
      branding: { companyName: "Studio Forma" },
    },
  },
  {
    id: "receipt-minimal",
    name: "Minimal Receipt",
    description: "Compact receipt layout for point-of-sale or digital transactions.",
    category: "receipt",
    sampleData: {
      merchant: { name: "The Daily Grind" },
      receipt: { number: "R-8847", date: "Jan 20, 2024", time: "9:32 AM" },
      items: [
        { name: "Oat Milk Latte (L)", quantity: 2, price: "5.50" },
      ],
      totals: { subtotal: "11.00", tax: "0.99", total: "11.99" },
      payment: { method: "Visa ending in 4242" },
    },
  },
  {
    id: "report-cover",
    name: "Report Cover Page",
    description: "Professional cover page for reports with title, author, and abstract.",
    category: "report",
    sampleData: {
      report: {
        title: "Q4 2024 Market Analysis",
        subtitle: "Trends, Opportunities, and Strategic Recommendations",
        author: "Dr. Emily Rodriguez",
        date: "January 15, 2024",
        organization: "Meridian Research Group",
      },
    },
  },
  {
    id: "contract-simple",
    name: "Simple Contract",
    description: "Clean service agreement with numbered clauses, party details, and signature lines.",
    category: "contract",
    sampleData: {
      contract: {
        title: "Service Agreement",
        number: "CTR-2024-0042",
        effectiveDate: "March 1, 2024",
        term: "12 months",
        jurisdiction: "State of California",
      },
      parties: {
        party1: { name: "Acme Solutions Inc.", address: "100 Innovation Drive\nSan Francisco, CA 94105" },
        party2: { name: "Northwind Traders LLC", address: "250 Commerce Street\nPortland, OR 97201" },
      },
      sections: [
        { number: "1", title: "Scope of Services", content: "The Service Provider agrees to deliver software development consulting services as outlined in Exhibit A." },
        { number: "2", title: "Compensation", content: "The Client agrees to pay a monthly retainer of $15,000 USD, due on the first business day of each month." },
        { number: "3", title: "Confidentiality", content: "Both parties agree to maintain the confidentiality of all proprietary information shared during the term of this agreement." },
        { number: "4", title: "Termination", content: "Either party may terminate this agreement with thirty (30) days written notice." },
      ],
      signatures: { showLines: true },
    },
  },
  {
    id: "certificate-modern",
    name: "Modern Certificate",
    description: "Elegant certificate of achievement with centered layout and decorative border.",
    category: "certificate",
    sampleData: {
      certificate: {
        title: "Certificate of Achievement",
        recipientName: "Alexandra Chen",
        description: "In recognition of exceptional performance and dedication in the Advanced Software Engineering Program.",
        date: "March 15, 2024",
        issuer: "Dr. James Walker",
        issuerTitle: "Program Director",
        organization: "Meridian Institute of Technology",
      },
    },
  },
  {
    id: "letter-business",
    name: "Business Letter",
    description: "Professional business letter with sender/recipient blocks, subject line, and formal layout.",
    category: "letter",
    sampleData: {
      letter: {
        date: "January 15, 2024",
        senderName: "Michael Torres",
        senderTitle: "Vice President, Business Development",
        senderCompany: "Cascade Partners LLC",
        senderAddress: "800 Fifth Avenue, Suite 3200\nSeattle, WA 98104",
        recipientName: "Sarah Chen",
        recipientTitle: "Chief Technology Officer",
        recipientCompany: "Horizon Dynamics Inc.",
        recipientAddress: "1200 Market Street\nSan Francisco, CA 94103",
        subject: "Strategic Partnership Proposal - Q1 2024",
        salutation: "Dear Ms. Chen,",
        body: [
          "I am writing to express our strong interest in establishing a strategic partnership between Cascade Partners and Horizon Dynamics.",
          "Cascade Partners brings over fifteen years of expertise in cloud infrastructure optimization. Combined with your innovative approach to AI-driven analytics, we see a significant opportunity.",
          "Please let me know if you are available for a meeting during the week of February 5th.",
        ],
        closing: "Sincerely,",
      },
    },
  },
  {
    id: "proposal-basic",
    name: "Basic Proposal",
    description: "Clean project proposal with deliverables, timeline, and pricing breakdown.",
    category: "proposal",
    sampleData: {
      proposal: {
        title: "Website Redesign & Development",
        number: "PROP-2024-018",
        date: "January 25, 2024",
        validUntil: "February 24, 2024",
        description: "A comprehensive redesign and development of your company website to improve user experience, modernize the visual identity, and increase conversion rates.",
      },
      client: {
        name: "James Mitchell",
        company: "Clearwater Analytics",
        address: "450 Market Street\nSuite 800\nSan Francisco, CA 94105",
        email: "james@clearwater.io",
      },
      deliverables: [
        { title: "Discovery & Research", description: "Stakeholder interviews, competitive analysis, user research, and requirements documentation." },
        { title: "UX Design", description: "Wireframes, user flows, and interactive prototypes for all key pages." },
        { title: "Visual Design", description: "High-fidelity mockups, design system, and component library." },
        { title: "Frontend Development", description: "Responsive implementation using Next.js with performance optimization." },
        { title: "QA & Launch", description: "Cross-browser testing, accessibility audit, and production deployment." },
      ],
      timeline: [
        { phase: "Discovery & Research", duration: "2 weeks", details: "Kickoff, interviews, audit" },
        { phase: "UX & Visual Design", duration: "3 weeks", details: "Wireframes, prototypes, mockups" },
        { phase: "Development", duration: "4 weeks", details: "Build, integrate, iterate" },
        { phase: "QA & Launch", duration: "1 week", details: "Testing, fixes, deployment" },
      ],
      pricing: {
        lineItems: [
          { description: "Discovery & Research", details: "Stakeholder interviews, competitive audit", amount: "3,500.00" },
          { description: "UX & Visual Design", details: "Wireframes, prototypes, design system", amount: "8,500.00" },
          { description: "Frontend Development", details: "Next.js implementation, CMS integration", amount: "12,000.00" },
          { description: "QA & Launch Support", details: "Testing, accessibility, deployment", amount: "2,000.00" },
        ],
        subtotal: "26,000.00",
        total: "26,000.00",
      },
      terms: "Payment is due in three installments: 40% upon signing, 30% at design approval, and 30% upon project completion.",
      branding: {
        logoInitial: "A",
        companyName: "Apex Digital Studio",
        companyAddress: "220 Design Way\nAustin, TX 78701",
      },
      styles: { accentColor: "#2563eb" },
    },
  },
];

// =============================================================================
// Routes
// =============================================================================

/**
 * GET /
 * List all available built-in templates with metadata and sample data.
 */
templates.get("/", (c) => {
  const category = c.req.query("category");
  const search = c.req.query("search");

  let filtered = TEMPLATE_CATALOG;

  if (category) {
    const categoryLower = category.toLowerCase();
    filtered = filtered.filter((t) => t.category.toLowerCase() === categoryLower);
  }

  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
    );
  }

  const body = JSON.stringify({
    templates: filtered,
    count: filtered.length,
  });
  const etag = generateETag(body);

  if (c.req.header("If-None-Match") === etag) {
    return c.body(null, 304);
  }

  c.header("Cache-Control", "public, max-age=3600");
  c.header("ETag", etag);
  c.header("Content-Type", "application/json; charset=UTF-8");
  return c.body(body);
});

/**
 * GET /:id/preview
 * Return a PNG thumbnail of a built-in template rendered with sample data.
 * Results are cached in-memory after first generation.
 */
templates.get("/:id/preview", async (c) => {
  const id = c.req.param("id");

  // Find template in catalog
  const catalogEntry = TEMPLATE_CATALOG.find((t) => t.id === id);
  if (!catalogEntry) {
    const error: ApiError = {
      error: `Template '${id}' not found`,
      code: "TEMPLATE_NOT_FOUND",
    };
    return c.json(error, 404);
  }

  // Return cached thumbnail if available
  if (thumbnailCache.has(id)) {
    const cached = thumbnailCache.get(id)!;
    const etag = generateETag(cached);

    if (c.req.header("If-None-Match") === etag) {
      return c.body(null, 304);
    }

    c.header("Content-Type", "image/png");
    c.header("Content-Length", String(cached.length));
    c.header("Cache-Control", "public, max-age=86400");
    c.header("ETag", etag);
    return c.body(new Uint8Array(cached));
  }

  try {
    // Load template HTML and render with sample data
    const templateHtml = await templateEngine.getTemplateHtml(id);
    const renderedHtml = Mustache.render(templateHtml, catalogEntry.sampleData);

    // Generate PNG thumbnail at 400x300
    const pngBuffer = await generatePNG(renderedHtml, {
      width: 400,
      height: 300,
    });

    // Cache for future requests
    thumbnailCache.set(id, pngBuffer);

    const etag = generateETag(pngBuffer);
    c.header("Content-Type", "image/png");
    c.header("Content-Length", String(pngBuffer.length));
    c.header("Cache-Control", "public, max-age=86400");
    c.header("ETag", etag);
    return c.body(new Uint8Array(pngBuffer));
  } catch (err) {
    console.error(`Thumbnail generation error for '${id}':`, err);
    const error: ApiError = {
      error: err instanceof Error ? err.message : "Thumbnail generation failed",
      code: "THUMBNAIL_ERROR",
    };
    return c.json(error, 500);
  }
});

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
  const body = JSON.stringify({
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
  const etag = generateETag(body);

  if (c.req.header("If-None-Match") === etag) {
    return c.body(null, 304);
  }

  c.header("Cache-Control", "public, max-age=3600");
  c.header("ETag", etag);
  c.header("Content-Type", "application/json; charset=UTF-8");
  return c.body(body);
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

// =============================================================================
// Validate Request Schema
// =============================================================================

const validateBodySchema = z.object({
  data: z.record(z.unknown()),
});

/**
 * POST /:id/validate
 * Validate user-provided data against a template's JSON schema.
 * Checks for missing required fields and basic type mismatches.
 */
templates.post(
  "/:id/validate",
  zValidator("json", validateBodySchema, (result, c) => {
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
    const id = c.req.param("id");

    // Find template in catalog
    const catalogEntry = TEMPLATE_CATALOG.find((t) => t.id === id);
    if (!catalogEntry) {
      const error: ApiError = {
        error: `Template '${id}' not found`,
        code: "TEMPLATE_NOT_FOUND",
      };
      return c.json(error, 404);
    }

    // Read schema.json
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const templatesDir = resolve(currentDir, "..", "..", "..", "templates");
    const schemaPath = join(templatesDir, id, "schema.json");

    try {
      const { readFile, access } = await import("fs/promises");

      try {
        await access(schemaPath);
      } catch {
        const error: ApiError = {
          error: `Schema file not found for template '${id}'`,
          code: "SCHEMA_NOT_FOUND",
        };
        return c.json(error, 404);
      }

      const raw = await readFile(schemaPath, "utf-8");
      const schema = JSON.parse(raw);
      const { data } = c.req.valid("json");

      const errors: Array<{ field: string; message: string }> = [];
      const warnings: Array<{ field: string; message: string }> = [];

      // Recursively validate properties against data
      function validateProperties(
        properties: Record<string, any>,
        requiredFields: string[],
        dataObj: Record<string, unknown>,
        prefix: string
      ) {
        for (const [key, prop] of Object.entries(properties)) {
          const fieldPath = prefix ? `${prefix}.${key}` : key;
          const value = dataObj?.[key];
          const isRequired = requiredFields.includes(key);

          if (value === undefined || value === null) {
            if (isRequired) {
              errors.push({ field: fieldPath, message: "Required field is missing" });
            } else {
              warnings.push({ field: fieldPath, message: "Optional field not provided" });
            }
            continue;
          }

          // Basic type checking
          const propDef = prop as Record<string, any>;
          const expectedType = propDef.type;

          if (expectedType) {
            let typeMatch = true;

            switch (expectedType) {
              case "string":
                typeMatch = typeof value === "string";
                break;
              case "number":
              case "integer":
                typeMatch = typeof value === "number";
                break;
              case "boolean":
                typeMatch = typeof value === "boolean";
                break;
              case "array":
                typeMatch = Array.isArray(value);
                break;
              case "object":
                typeMatch = typeof value === "object" && !Array.isArray(value);
                break;
            }

            if (!typeMatch) {
              errors.push({
                field: fieldPath,
                message: `Expected type '${expectedType}', got '${Array.isArray(value) ? "array" : typeof value}'`,
              });
              continue;
            }
          }

          // Recurse into nested objects
          if (
            propDef.type === "object" &&
            propDef.properties &&
            typeof value === "object" &&
            !Array.isArray(value)
          ) {
            validateProperties(
              propDef.properties,
              propDef.required || [],
              value as Record<string, unknown>,
              fieldPath
            );
          }
        }
      }

      if (schema.properties) {
        validateProperties(
          schema.properties,
          schema.required || [],
          data,
          ""
        );
      }

      return c.json({
        valid: errors.length === 0,
        templateId: id,
        errors,
        warnings,
      });
    } catch (err) {
      console.error(`Validation error for '${id}':`, err);
      const error: ApiError = {
        error: err instanceof Error ? err.message : "Validation failed",
        code: "VALIDATION_ERROR",
      };
      return c.json(error, 500);
    }
  }
);

/**
 * GET /:id
 * Return full template detail including JSON schema, metadata, and sample data.
 * Registered last to avoid matching static routes like /styles, /views, /count.
 */
templates.get("/:id", async (c) => {
  const id = c.req.param("id");

  // Find template in catalog
  const catalogEntry = TEMPLATE_CATALOG.find((t) => t.id === id);
  if (!catalogEntry) {
    const error: ApiError = {
      error: "Template not found",
      code: "TEMPLATE_NOT_FOUND",
    };
    return c.json(error, 404);
  }

  // Read schema.json from templates directory
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const templatesDir = resolve(currentDir, "..", "..", "..", "templates");
  const schemaPath = join(templatesDir, id, "schema.json");

  try {
    const { readFile, access } = await import("fs/promises");

    try {
      await access(schemaPath);
    } catch {
      const error: ApiError = {
        error: "Template not found",
        code: "TEMPLATE_NOT_FOUND",
      };
      return c.json(error, 404);
    }

    const raw = await readFile(schemaPath, "utf-8");
    const schema = JSON.parse(raw);
    const sampleData = Array.isArray(schema.examples) && schema.examples.length > 0
      ? schema.examples[0]
      : catalogEntry.sampleData;

    const body = JSON.stringify({
      id: catalogEntry.id,
      name: catalogEntry.name,
      description: catalogEntry.description,
      schema,
      sampleData,
    });

    const etag = generateETag(body);
    if (c.req.header("If-None-Match") === etag) {
      return c.body(null, 304);
    }

    c.header("Cache-Control", "public, max-age=3600");
    c.header("ETag", etag);
    c.header("Content-Type", "application/json; charset=UTF-8");
    return c.body(body);
  } catch (err) {
    console.error(`Schema read error for '${id}':`, err);
    const error: ApiError = {
      error: err instanceof Error ? err.message : "Failed to read template schema",
      code: "SCHEMA_READ_ERROR",
    };
    return c.json(error, 500);
  }
});

export default templates;
