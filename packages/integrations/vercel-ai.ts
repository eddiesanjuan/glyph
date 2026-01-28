/**
 * Glyph - Vercel AI SDK Integration
 *
 * Drop-in tool definitions for the Vercel AI SDK `tool()` helper.
 *
 * Usage:
 * ```typescript
 * import { generateText } from "ai";
 * import { openai } from "@ai-sdk/openai";
 * import { glyphTools } from "@glyph-pdf/integrations/vercel-ai";
 *
 * const { text, toolResults } = await generateText({
 *   model: openai("gpt-4o"),
 *   tools: glyphTools("gk_your_api_key"),
 *   prompt: "Create an invoice for Acme Corp with 3 line items totaling $4,500",
 * });
 *
 * for (const result of toolResults) {
 *   console.log(result.toolName, result.result);
 * }
 * ```
 *
 * Requires peer dependency: `zod`
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
// Tool definitions factory
// ---------------------------------------------------------------------------

/**
 * Create Vercel AI SDK tool definitions that call the Glyph API.
 *
 * Returns an object whose keys are tool names and values are objects with
 * `description`, `parameters` (Zod schema), and `execute` function -- the
 * exact shape expected by `generateText({ tools })` and `streamText({ tools })`.
 *
 * @param apiKey  - Glyph API key (gk_...)
 * @param baseUrl - Optional base URL override
 */
export function glyphTools(
  apiKey: string,
  baseUrl = "https://api.glyph.you"
) {
  const client = new GlyphClient({ apiKey, baseUrl });

  return {
    createPdf: {
      description:
        "Generate a professional PDF document from structured data, raw HTML, or a URL. " +
        "When data is provided the API auto-detects the document type (invoice, quote, contract, etc.) " +
        "and applies intelligent layout. Returns a base64 data URL of the generated file.",
      parameters: z.object({
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
            "Natural language hint describing the desired output style."
          ),
        style: z
          .enum(["stripe-clean", "bold", "minimal", "corporate"])
          .optional()
          .describe("Visual style preset."),
        format: z
          .enum(["pdf", "png"])
          .optional()
          .describe("Output format. Defaults to 'pdf'."),
        options: z
          .object({
            pageSize: z
              .enum(["A4", "letter", "legal"])
              .optional()
              .describe("Page size."),
            orientation: z
              .enum(["portrait", "landscape"])
              .optional()
              .describe("Page orientation."),
            scale: z
              .number()
              .min(0.1)
              .max(3)
              .optional()
              .describe("Render scale factor."),
          })
          .optional()
          .describe("Page layout options."),
      }),
      execute: async (args: CreatePdfParams) => {
        return await client.createPdf(args);
      },
    },

    listTemplates: {
      description:
        "List available PDF templates with names, descriptions, categories, and sample data. " +
        "Use this to discover templates before creating a PDF.",
      parameters: z.object({
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
          .describe("Filter by tag (e.g. 'bold', 'clean', 'formal')."),
      }),
      execute: async (args: ListTemplatesParams) => {
        return await client.listTemplates(args);
      },
    },

    getTemplateSchema: {
      description:
        "Get the JSON Schema and sample data for a specific template. " +
        "Shows exactly what fields are needed to populate the template.",
      parameters: z.object({
        templateId: z
          .string()
          .describe("Template ID (e.g. 'invoice-clean', 'quote-modern')."),
      }),
      execute: async (args: GetTemplateSchemaParams) => {
        return await client.getTemplateSchema(args);
      },
    },

    modifyDocument: {
      description:
        "Modify an existing PDF document using natural language instructions. " +
        "Requires a sessionId from a previous createPdf call.",
      parameters: z.object({
        sessionId: z
          .string()
          .describe("Session ID from a previous create/preview call."),
        prompt: z
          .string()
          .describe(
            "Natural language instruction (e.g. 'make the header blue', 'add a watermark')."
          ),
        region: z
          .string()
          .optional()
          .describe("Optional region ID to scope the modification."),
      }),
      execute: async (args: ModifyDocumentParams) => {
        return await client.modifyDocument(args);
      },
    },
  };
}
