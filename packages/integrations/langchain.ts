/**
 * Glyph - LangChain Tool Integration
 *
 * Provides Zod schemas and a factory function that returns tools compatible
 * with LangChain's `DynamicStructuredTool`.
 *
 * Usage:
 * ```typescript
 * import { ChatOpenAI } from "@langchain/openai";
 * import { createGlyphTools } from "@glyph-pdf/integrations/langchain";
 *
 * const tools = createGlyphTools("gk_your_api_key");
 * const model = new ChatOpenAI({ model: "gpt-4o" }).bindTools(tools);
 *
 * const result = await model.invoke("Create an invoice for Acme Corp");
 * ```
 *
 * Requires peer dependencies: `zod`, `@langchain/core`
 */

import { z } from "zod";
import {
  GlyphClient,
  type CreatePdfParams,
  type ListTemplatesParams,
  type GetTemplateSchemaParams,
  type ModifyDocumentParams,
} from "./types";

// ---------------------------------------------------------------------------
// Zod Schemas (exported for reuse)
// ---------------------------------------------------------------------------

export const pageOptionsSchema = z
  .object({
    pageSize: z
      .enum(["A4", "letter", "legal"])
      .optional()
      .describe("Page size. Defaults to 'letter'."),
    orientation: z
      .enum(["portrait", "landscape"])
      .optional()
      .describe("Page orientation. Defaults to 'portrait'."),
    scale: z
      .number()
      .min(0.1)
      .max(3)
      .optional()
      .describe("Render scale factor (0.1 to 3). Defaults to 1."),
  })
  .optional()
  .describe("Page layout options.");

export const createPdfSchema = z.object({
  templateId: z
    .string()
    .optional()
    .describe(
      "Built-in template ID (e.g. 'invoice-clean', 'quote-modern', 'receipt-minimal', 'contract-simple', 'certificate-modern', 'letter-business', 'proposal-basic', 'shipping-label'). If omitted, auto-detected from data."
    ),
  data: z
    .record(z.unknown())
    .optional()
    .describe(
      "Structured document data to populate the template. Shape depends on document type."
    ),
  html: z
    .string()
    .optional()
    .describe("Raw HTML string to convert directly to PDF."),
  url: z
    .string()
    .optional()
    .describe("Public URL to capture as PDF."),
  intent: z
    .string()
    .optional()
    .describe(
      "Natural language hint describing the desired output style (e.g. 'formal invoice with blue accent')."
    ),
  style: z
    .enum(["stripe-clean", "bold", "minimal", "corporate"])
    .optional()
    .describe("Visual style preset."),
  format: z
    .enum(["pdf", "png"])
    .optional()
    .describe("Output format. Defaults to 'pdf'."),
  options: pageOptionsSchema,
});

export const listTemplatesSchema = z.object({
  category: z
    .enum([
      "quote",
      "invoice",
      "receipt",
      "report",
      "letter",
      "contract",
      "certificate",
      "proposal",
      "shipping",
    ])
    .optional()
    .describe("Filter by document category."),
  search: z
    .string()
    .optional()
    .describe("Full-text search across template names and descriptions."),
  style: z
    .enum(["modern", "traditional", "minimal"])
    .optional()
    .describe("Filter by visual style preset."),
  tag: z
    .string()
    .optional()
    .describe("Filter by tag (e.g. 'bold', 'clean', 'formal', 'compact')."),
});

export const getTemplateSchemaSchema = z.object({
  templateId: z
    .string()
    .describe("Template ID (e.g. 'invoice-clean', 'quote-modern')."),
});

export const modifyDocumentSchema = z.object({
  sessionId: z
    .string()
    .describe("Session ID from a previous create_pdf or preview call."),
  prompt: z
    .string()
    .describe(
      "Natural language instruction for the modification (e.g. 'add a QR code to the footer')."
    ),
  region: z
    .string()
    .optional()
    .describe(
      "Optional region ID to scope the modification to a specific part of the document."
    ),
});

// ---------------------------------------------------------------------------
// Tool Factory
// ---------------------------------------------------------------------------

/**
 * Create an array of LangChain-compatible tool definitions that call the
 * Glyph API.
 *
 * These are plain objects with `name`, `description`, `schema`, and `func`
 * properties, compatible with `DynamicStructuredTool` or
 * `ChatModel.bindTools()`.
 *
 * @param apiKey  - Glyph API key (gk_...)
 * @param baseUrl - Optional base URL override
 */
export function createGlyphTools(
  apiKey: string,
  baseUrl = "https://api.glyph.you"
) {
  const client = new GlyphClient({ apiKey, baseUrl });

  return [
    {
      name: "create_pdf",
      description:
        "Generate a professional PDF document from structured data, raw HTML, or a URL. " +
        "Auto-detects document type and applies intelligent layout. Returns a base64 data URL.",
      schema: createPdfSchema,
      func: async (input: z.infer<typeof createPdfSchema>) => {
        const result = await client.createPdf(input as CreatePdfParams);
        return JSON.stringify(result);
      },
    },
    {
      name: "list_pdf_templates",
      description:
        "List available PDF templates with names, descriptions, categories, and sample data.",
      schema: listTemplatesSchema,
      func: async (input: z.infer<typeof listTemplatesSchema>) => {
        const result = await client.listTemplates(
          input as ListTemplatesParams
        );
        return JSON.stringify(result);
      },
    },
    {
      name: "get_template_schema",
      description:
        "Get the JSON Schema and sample data for a specific template. Shows what fields are needed.",
      schema: getTemplateSchemaSchema,
      func: async (input: z.infer<typeof getTemplateSchemaSchema>) => {
        const result = await client.getTemplateSchema(
          input as GetTemplateSchemaParams
        );
        return JSON.stringify(result);
      },
    },
    {
      name: "modify_document",
      description:
        "Modify an existing PDF document using natural language. Requires a sessionId from a previous create_pdf call.",
      schema: modifyDocumentSchema,
      func: async (input: z.infer<typeof modifyDocumentSchema>) => {
        const result = await client.modifyDocument(
          input as ModifyDocumentParams
        );
        return JSON.stringify(result);
      },
    },
  ];
}
