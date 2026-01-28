/**
 * Glyph - OpenAI Function Calling Integration
 *
 * Drop-in tool definitions for `openai.chat.completions.create({ tools })`.
 *
 * Usage:
 * ```typescript
 * import OpenAI from "openai";
 * import { glyphTools, handleGlyphToolCall } from "@glyph-pdf/integrations/openai";
 *
 * const openai = new OpenAI();
 *
 * const response = await openai.chat.completions.create({
 *   model: "gpt-4o",
 *   messages: [{ role: "user", content: "Create an invoice PDF for Acme Corp, 3 items totaling $4,500" }],
 *   tools: glyphTools,
 * });
 *
 * for (const call of response.choices[0].message.tool_calls ?? []) {
 *   const result = await handleGlyphToolCall(call.function.name, JSON.parse(call.function.arguments), "gk_your_api_key");
 *   console.log(result);
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
// Tool Definitions (OpenAI function calling format)
// ---------------------------------------------------------------------------

export const glyphTools = [
  {
    type: "function" as const,
    function: {
      name: "create_pdf",
      description:
        "Generate a professional PDF document from structured data, raw HTML, or a URL. " +
        "When data is provided, the API auto-detects the document type (invoice, quote, contract, etc.) " +
        "and applies intelligent layout. Returns a base64 data URL of the generated file.",
      parameters: {
        type: "object",
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
  },
  {
    type: "function" as const,
    function: {
      name: "list_pdf_templates",
      description:
        "List available PDF templates with their names, descriptions, categories, and sample data. " +
        "Use this to discover what templates are available before creating a PDF.",
      parameters: {
        type: "object",
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
  },
  {
    type: "function" as const,
    function: {
      name: "get_template_schema",
      description:
        "Get the full JSON Schema and sample data for a specific template. " +
        "Shows exactly what fields are needed to populate the template. " +
        "Call this before create_pdf to understand the required data shape.",
      parameters: {
        type: "object",
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
  },
  {
    type: "function" as const,
    function: {
      name: "modify_document",
      description:
        "Modify an existing PDF document using natural language instructions. " +
        "Requires a sessionId from a previous create_pdf call. " +
        "Example prompts: 'make the header blue', 'add a watermark', 'change font to serif'.",
      parameters: {
        type: "object",
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
  },
] as const;

// ---------------------------------------------------------------------------
// Handler Function
// ---------------------------------------------------------------------------

/**
 * Execute a Glyph tool call from an OpenAI function calling response.
 *
 * @param toolName  - The function name from the tool call (e.g. "create_pdf")
 * @param args      - Parsed JSON arguments from the tool call
 * @param apiKey    - Glyph API key (gk_...)
 * @param baseUrl   - Optional base URL override (defaults to https://api.glyph.you)
 * @returns         - JSON string of the tool result (ready to send back as tool message)
 */
export async function handleGlyphToolCall(
  toolName: string,
  args: Record<string, unknown>,
  apiKey: string,
  baseUrl?: string
): Promise<string> {
  const client = new GlyphClient({ apiKey, baseUrl });

  try {
    switch (toolName) {
      case "create_pdf": {
        const result = await client.createPdf(args as CreatePdfParams);
        return JSON.stringify(result);
      }

      case "list_pdf_templates": {
        const result = await client.listTemplates(
          args as ListTemplatesParams
        );
        return JSON.stringify(result);
      }

      case "get_template_schema": {
        const result = await client.getTemplateSchema(
          args as unknown as GetTemplateSchemaParams
        );
        return JSON.stringify(result);
      }

      case "modify_document": {
        const result = await client.modifyDocument(
          args as unknown as ModifyDocumentParams
        );
        return JSON.stringify(result);
      }

      default:
        return JSON.stringify({
          error: `Unknown tool: ${toolName}`,
          availableTools: [
            "create_pdf",
            "list_pdf_templates",
            "get_template_schema",
            "modify_document",
          ],
        });
    }
  } catch (err) {
    return JSON.stringify({
      error: err instanceof Error ? err.message : "Unknown error",
      code: (err as { code?: string })?.code ?? "TOOL_ERROR",
    });
  }
}
