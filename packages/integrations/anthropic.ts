/**
 * Glyph - Anthropic Tool Use Integration
 *
 * Drop-in tool definitions for `anthropic.messages.create({ tools })`.
 *
 * Usage:
 * ```typescript
 * import Anthropic from "@anthropic-ai/sdk";
 * import { glyphTools, handleGlyphToolCall } from "@glyph-pdf/integrations/anthropic";
 *
 * const anthropic = new Anthropic();
 *
 * const response = await anthropic.messages.create({
 *   model: "claude-sonnet-4-20250514",
 *   max_tokens: 4096,
 *   tools: glyphTools,
 *   messages: [{ role: "user", content: "Generate a professional invoice for Acme Corp" }],
 * });
 *
 * for (const block of response.content) {
 *   if (block.type === "tool_use") {
 *     const result = await handleGlyphToolCall(block.name, block.input, "gk_your_api_key");
 *     console.log(result);
 *   }
 * }
 * ```
 */

import {
  GlyphClient,
  type CreatePdfParams,
  type ListTemplatesParams,
  type GetTemplateSchemaParams,
  type ModifyDocumentParams,
} from "./types";

// ---------------------------------------------------------------------------
// Tool Definitions (Anthropic tool use format)
// ---------------------------------------------------------------------------

export const glyphTools = [
  {
    name: "create_pdf",
    description:
      "Generate a professional PDF document from structured data, raw HTML, or a URL. " +
      "When data is provided, the API auto-detects the document type (invoice, quote, contract, etc.) " +
      "and applies intelligent layout. Returns a base64 data URL of the generated file.",
    input_schema: {
      type: "object" as const,
      properties: {
        templateId: {
          type: "string",
          description:
            "Built-in template ID (e.g. 'invoice-clean', 'quote-modern', 'receipt-minimal', 'contract-simple', 'certificate-modern', 'letter-business', 'proposal-basic', 'shipping-label'). If omitted, the best template is auto-detected from the data.",
        },
        data: {
          type: "object",
          description:
            "Structured document data to populate the template. Shape depends on document type. " +
            "For invoices: { invoice: { number, date, dueDate }, billTo: { name, company }, lineItems: [{ description, quantity, rate, amount }], totals: { subtotal, total } }. " +
            "For quotes: { meta: { quoteNumber, date }, client: { name, company }, lineItems: [...], totals: { subtotal, total } }.",
        },
        html: {
          type: "string",
          description:
            "Raw HTML string to convert directly to PDF. Use this instead of templateId + data when you have pre-built HTML.",
        },
        url: {
          type: "string",
          description:
            "Public URL to capture as PDF. The page will be rendered and converted.",
        },
        intent: {
          type: "string",
          description:
            "Natural language hint describing the desired output style (e.g. 'formal invoice with blue accent', 'minimal receipt'). Helps the AI choose layout decisions.",
        },
        style: {
          type: "string",
          enum: ["stripe-clean", "bold", "minimal", "corporate"],
          description: "Visual style preset for data-driven generation.",
        },
        format: {
          type: "string",
          enum: ["pdf", "png"],
          description: "Output format. Defaults to 'pdf'.",
        },
        options: {
          type: "object",
          properties: {
            pageSize: {
              type: "string",
              enum: ["A4", "letter", "legal"],
              description: "Page size. Defaults to 'letter'.",
            },
            orientation: {
              type: "string",
              enum: ["portrait", "landscape"],
              description: "Page orientation. Defaults to 'portrait'.",
            },
            scale: {
              type: "number",
              description: "Render scale factor (0.1 to 3). Defaults to 1.",
            },
          },
          description: "Page layout options.",
        },
      },
      required: [],
    },
  },
  {
    name: "list_pdf_templates",
    description:
      "List available PDF templates with their names, descriptions, categories, and sample data. " +
      "Use this to discover what templates are available before creating a PDF.",
    input_schema: {
      type: "object" as const,
      properties: {
        category: {
          type: "string",
          enum: [
            "quote",
            "invoice",
            "receipt",
            "report",
            "letter",
            "contract",
            "certificate",
            "proposal",
            "shipping",
          ],
          description: "Filter by document category.",
        },
        search: {
          type: "string",
          description:
            "Full-text search across template names and descriptions.",
        },
        style: {
          type: "string",
          enum: ["modern", "traditional", "minimal"],
          description: "Filter by visual style preset.",
        },
        tag: {
          type: "string",
          description:
            "Filter by tag (e.g. 'bold', 'clean', 'formal', 'compact').",
        },
      },
    },
  },
  {
    name: "get_template_schema",
    description:
      "Get the full JSON Schema and sample data for a specific template. " +
      "Shows exactly what fields are needed to populate the template. " +
      "Call this before create_pdf to understand the required data shape.",
    input_schema: {
      type: "object" as const,
      properties: {
        templateId: {
          type: "string",
          description:
            "Template ID (e.g. 'invoice-clean', 'quote-modern').",
        },
      },
      required: ["templateId"],
    },
  },
  {
    name: "modify_document",
    description:
      "Modify an existing PDF document using natural language instructions. " +
      "Requires a sessionId from a previous create_pdf call. " +
      "Example prompts: 'make the header blue', 'add a watermark', 'change font to serif'.",
    input_schema: {
      type: "object" as const,
      properties: {
        sessionId: {
          type: "string",
          description:
            "Session ID from a previous create_pdf or preview call.",
        },
        prompt: {
          type: "string",
          description:
            "Natural language instruction for the modification (e.g. 'add a QR code to the footer', 'use Stripe-style typography').",
        },
        region: {
          type: "string",
          description:
            "Optional region ID to scope the modification to a specific part of the document.",
        },
      },
      required: ["sessionId", "prompt"],
    },
  },
];

// ---------------------------------------------------------------------------
// Handler Function
// ---------------------------------------------------------------------------

/**
 * Execute a Glyph tool call from an Anthropic tool_use content block.
 *
 * @param toolName  - The tool name (e.g. "create_pdf")
 * @param input     - The input object from the tool_use block
 * @param apiKey    - Glyph API key (gk_...)
 * @param baseUrl   - Optional base URL override (defaults to https://api.glyph.you)
 * @returns         - The tool result as a plain object (use JSON.stringify for tool_result content)
 */
export async function handleGlyphToolCall(
  toolName: string,
  input: Record<string, unknown>,
  apiKey: string,
  baseUrl?: string
): Promise<Record<string, unknown>> {
  const client = new GlyphClient({ apiKey, baseUrl });

  try {
    switch (toolName) {
      case "create_pdf":
        return (await client.createPdf(
          input as CreatePdfParams
        )) as unknown as Record<string, unknown>;

      case "list_pdf_templates":
        return (await client.listTemplates(
          input as ListTemplatesParams
        )) as unknown as Record<string, unknown>;

      case "get_template_schema":
        return (await client.getTemplateSchema(
          input as unknown as GetTemplateSchemaParams
        )) as unknown as Record<string, unknown>;

      case "modify_document":
        return (await client.modifyDocument(
          input as unknown as ModifyDocumentParams
        )) as unknown as Record<string, unknown>;

      default:
        return {
          error: `Unknown tool: ${toolName}`,
          availableTools: [
            "create_pdf",
            "list_pdf_templates",
            "get_template_schema",
            "modify_document",
          ],
        };
    }
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Unknown error",
      code: (err as { code?: string })?.code ?? "TOOL_ERROR",
    };
  }
}
