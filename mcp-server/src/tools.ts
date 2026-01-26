/**
 * Glyph MCP Tools
 * Implements all MCP tools for PDF generation and modification
 */

import {
  GlyphApiClient,
  GlyphApiError,
  storeSession,
  getSession,
  updateSessionHtml,
  type AnalyzeResult,
  type CreateResult,
} from "./api.js";

// Template detection patterns for auto-template feature
const TEMPLATE_PATTERNS = {
  invoice: [
    "invoice",
    "lineItems",
    "totals",
    "subtotal",
    "tax",
    "dueDate",
    "invoiceNumber",
  ],
  quote: [
    "quote",
    "proposal",
    "estimate",
    "validUntil",
    "quoteNumber",
    "lineItems",
  ],
  receipt: ["receipt", "paid", "paymentMethod", "transactionId", "items"],
  contract: ["contract", "agreement", "terms", "signature", "parties"],
  report: ["report", "summary", "metrics", "data", "analysis"],
} as const;

/**
 * Auto-detect the best template based on data structure
 */
function detectTemplate(data: Record<string, unknown>): string {
  const dataStr = JSON.stringify(data).toLowerCase();
  const dataKeys = Object.keys(flattenObject(data))
    .map((k) => k.toLowerCase())
    .join(" ");

  let bestMatch = "quote-modern"; // Default
  let bestScore = 0;

  for (const [template, patterns] of Object.entries(TEMPLATE_PATTERNS)) {
    let score = 0;
    for (const pattern of patterns) {
      if (dataStr.includes(pattern) || dataKeys.includes(pattern)) {
        score++;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = template === "quote" ? "quote-modern" : template;
    }
  }

  return bestMatch;
}

/**
 * Flatten nested object for key analysis
 */
function flattenObject(
  obj: Record<string, unknown>,
  prefix = ""
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;

    if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(
        result,
        flattenObject(value as Record<string, unknown>, newKey)
      );
    } else {
      result[newKey] = value;
    }
  }

  return result;
}

/**
 * Get API client from environment or parameter
 */
function getClient(apiKey?: string): GlyphApiClient {
  const key = apiKey || process.env.GLYPH_API_KEY;
  if (!key) {
    throw new GlyphApiError(
      "No API key provided. Set GLYPH_API_KEY environment variable or pass apiKey parameter.",
      "NO_API_KEY"
    );
  }
  return new GlyphApiClient(key);
}

// =============================================================================
// Tool Definitions (JSON Schema format for MCP)
// =============================================================================

export const TOOL_DEFINITIONS = [
  {
    name: "glyph_preview",
    description: `Create a PDF preview session with your data. Returns a session ID for modifications and the rendered HTML preview.

Use this as the first step when generating a PDF. The session ID is needed for subsequent modifications.

Example data structure for a quote/invoice:
{
  "client": { "name": "John Doe", "email": "john@example.com" },
  "lineItems": [{ "description": "Service", "quantity": 1, "unitPrice": 100, "total": 100 }],
  "totals": { "subtotal": 100, "total": 100 },
  "meta": { "quoteNumber": "Q-001", "date": "2024-01-15" }
}`,
    inputSchema: {
      type: "object",
      properties: {
        template: {
          type: "string",
          description:
            "Template name or 'auto' to detect best template from data structure. Available: quote-modern, invoice, receipt, contract, report",
          default: "auto",
        },
        data: {
          type: "object",
          description:
            "Your data object. Structure depends on document type. Common fields: client, lineItems, totals, meta, branding",
          additionalProperties: true,
        },
        apiKey: {
          type: "string",
          description:
            "Glyph API key. Uses GLYPH_API_KEY env var if not provided.",
        },
      },
      required: ["data"],
    },
  },
  {
    name: "glyph_modify",
    description: `Modify a PDF document using natural language. Describe what you want to change and the AI will update the document.

Examples:
- "Add a QR code for payment in the footer"
- "Make the header more prominent with a blue gradient"
- "Add a thank you note at the bottom"
- "Change the font to something more modern"
- "Add a watermark that says DRAFT"
- "Make the line items table more compact"

The modification is applied to the session and you can chain multiple modifications.`,
    inputSchema: {
      type: "object",
      properties: {
        sessionId: {
          type: "string",
          description: "Session ID from glyph_preview",
        },
        instruction: {
          type: "string",
          description:
            "Natural language instruction for what to change. Be specific about what you want.",
        },
        region: {
          type: "string",
          description:
            "Optional: Focus the modification on a specific region (header, footer, table, etc.)",
        },
      },
      required: ["sessionId", "instruction"],
    },
  },
  {
    name: "glyph_generate",
    description: `Generate the final PDF file from your session. Call this after you've finished all modifications.

The PDF is returned as a base64 data URL or can be saved to a file path.`,
    inputSchema: {
      type: "object",
      properties: {
        sessionId: {
          type: "string",
          description: "Session ID from glyph_preview",
        },
        format: {
          type: "string",
          enum: ["pdf", "png"],
          description: "Output format. Default is pdf.",
          default: "pdf",
        },
        outputPath: {
          type: "string",
          description:
            "Optional: File path to save the output. If not provided, returns base64 data URL.",
        },
        options: {
          type: "object",
          properties: {
            width: { type: "number", description: "Page width in pixels" },
            height: { type: "number", description: "Page height in pixels" },
            scale: {
              type: "number",
              description: "Scale factor (0.1 to 3)",
              minimum: 0.1,
              maximum: 3,
            },
          },
        },
      },
      required: ["sessionId"],
    },
  },
  {
    name: "glyph_schema",
    description: `Get the data schema for a template. Shows all available fields you can customize, their types, and examples.

Use this to understand what data structure a template expects.`,
    inputSchema: {
      type: "object",
      properties: {
        template: {
          type: "string",
          description: "Template name (e.g., quote-modern, invoice)",
        },
      },
      required: ["template"],
    },
  },
  {
    name: "glyph_templates",
    description: `List all available document templates. Each template is designed for a specific document type (invoice, quote, receipt, etc.) and has its own data schema.`,
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "glyph_suggest",
    description: `Get AI-powered suggestions for improving your document. Analyzes the current state of the document and provides actionable recommendations.

Suggestions include:
- Design improvements (layout, typography, colors)
- Content additions (missing fields, helpful information)
- Professional touches (QR codes, terms, branding)`,
    inputSchema: {
      type: "object",
      properties: {
        sessionId: {
          type: "string",
          description: "Session ID from glyph_preview",
        },
      },
      required: ["sessionId"],
    },
  },
  {
    name: "glyph_create",
    description: `Generate a PDF from raw data with natural language styling. No template needed - just send your data and describe what you want.

This is the fastest way to create professional PDFs:
- Send any JSON data structure
- Optionally describe how you want it styled
- Receive a beautiful, print-ready PDF

Examples:
- Invoice: { customer: {...}, items: [...], total: 1000 } + "professional invoice"
- Quote: { services: [...], total: 5000, validUntil: "..." } + "Stripe-styled proposal"
- Report: { metrics: {...}, summary: "..." } + "executive summary report"

The AI automatically:
- Detects document type (invoice, quote, receipt, report, etc.)
- Identifies field roles (header, line items, totals)
- Chooses optimal layout
- Applies professional styling`,
    inputSchema: {
      type: "object",
      properties: {
        data: {
          type: "object",
          description: "Your data in any structure. Common patterns: customer/client, items/lineItems, totals, metadata.",
          additionalProperties: true,
        },
        intent: {
          type: "string",
          description: "Natural language description of the document. Examples: 'professional invoice', 'modern quote with Stripe styling', 'simple receipt'",
        },
        style: {
          type: "string",
          enum: ["stripe-clean", "bold", "minimal", "corporate", "quote-modern"],
          description: "Style preset. quote-modern (default) is clean and professional.",
          default: "quote-modern",
        },
        format: {
          type: "string",
          enum: ["pdf", "png", "html"],
          description: "Output format. Default is pdf.",
          default: "pdf",
        },
        outputPath: {
          type: "string",
          description: "Optional file path to save the output. If not provided, returns base64 data URL.",
        },
        apiKey: {
          type: "string",
          description: "Glyph API key. Uses GLYPH_API_KEY env var if not provided.",
        },
      },
      required: ["data"],
    },
  },
  {
    name: "glyph_analyze",
    description: `Analyze a data structure to see how Glyph would interpret it for PDF generation.

Use this to:
- Understand what document type Glyph detects
- See which fields are identified and their roles
- Preview layout decisions before generating
- Debug why a PDF might not look as expected

This does NOT generate a PDF - just returns the analysis.`,
    inputSchema: {
      type: "object",
      properties: {
        data: {
          type: "object",
          description: "Your data to analyze",
          additionalProperties: true,
        },
        intent: {
          type: "string",
          description: "Optional intent to influence analysis",
        },
        apiKey: {
          type: "string",
          description: "Glyph API key. Uses GLYPH_API_KEY env var if not provided.",
        },
      },
      required: ["data"],
    },
  },
];

// =============================================================================
// Tool Handlers
// =============================================================================

export interface ToolResult {
  content: Array<{
    type: "text" | "image" | "resource";
    text?: string;
    data?: string;
    mimeType?: string;
    uri?: string;
  }>;
  isError?: boolean;
}

export async function handleGlyphPreview(args: {
  template?: string;
  data: Record<string, unknown>;
  apiKey?: string;
}): Promise<ToolResult> {
  try {
    const client = getClient(args.apiKey);

    // Auto-detect template if needed
    const template =
      args.template === "auto" || !args.template
        ? detectTemplate(args.data)
        : args.template;

    const result = await client.createPreview(template, args.data);

    // Store session locally for resource access
    storeSession(result.sessionId, result.html, template, args.data);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              sessionId: result.sessionId,
              template: template,
              message: `Preview created successfully. Use sessionId "${result.sessionId}" for modifications.`,
              htmlPreview:
                result.html.substring(0, 500) +
                (result.html.length > 500 ? "..." : ""),
              nextSteps: [
                'Use glyph_modify to make changes (e.g., "Add a company logo")',
                "Use glyph_generate to create the final PDF",
                "Use glyph_suggest to get improvement recommendations",
              ],
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    return formatError(error);
  }
}

export async function handleGlyphModify(args: {
  sessionId: string;
  instruction: string;
  region?: string;
  apiKey?: string;
}): Promise<ToolResult> {
  try {
    const client = getClient(args.apiKey);
    const result = await client.modify(
      args.sessionId,
      args.instruction,
      args.region
    );

    // Update local session
    updateSessionHtml(args.sessionId, result.html);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              changes: result.changes,
              tokensUsed: result.tokensUsed,
              validationWarnings: result.validationWarnings,
              message:
                result.changes.length > 0
                  ? `Applied ${result.changes.length} change(s): ${result.changes.join(", ")}`
                  : "Modification applied successfully",
              htmlPreview:
                result.html.substring(0, 500) +
                (result.html.length > 500 ? "..." : ""),
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    return formatError(error);
  }
}

export async function handleGlyphGenerate(args: {
  sessionId: string;
  format?: "pdf" | "png";
  outputPath?: string;
  options?: { width?: number; height?: number; scale?: number };
  apiKey?: string;
}): Promise<ToolResult> {
  try {
    const client = getClient(args.apiKey);
    const session = getSession(args.sessionId);

    if (!session) {
      throw new GlyphApiError(
        "Session not found. Create a preview first with glyph_preview.",
        "SESSION_NOT_FOUND"
      );
    }

    const result = await client.generate(
      session.html,
      args.format || "pdf",
      args.options
    );

    // If outputPath is provided, save the file
    if (args.outputPath) {
      const { writeFile } = await import("fs/promises");
      const base64Data = result.url.split(",")[1];
      const buffer = Buffer.from(base64Data, "base64");
      await writeFile(args.outputPath, buffer);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                format: result.format,
                size: result.size,
                savedTo: args.outputPath,
                message: `PDF saved to ${args.outputPath} (${formatBytes(result.size)})`,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              format: result.format,
              size: result.size,
              expiresAt: result.expiresAt,
              url: result.url.substring(0, 100) + "...[base64 data]",
              message: `Generated ${result.format.toUpperCase()} (${formatBytes(result.size)})`,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    return formatError(error);
  }
}

export async function handleGlyphSchema(args: {
  template: string;
}): Promise<ToolResult> {
  // Hardcoded schemas for now - in production these would come from the API
  const schemas: Record<string, object> = {
    "quote-modern": {
      template: "quote-modern",
      description:
        "Modern quote/proposal template with line items and totals",
      required: ["client", "lineItems", "totals", "branding"],
      fields: {
        meta: {
          type: "object",
          description: "Quote metadata",
          properties: {
            quoteNumber: { type: "string", example: "Q-2024-001" },
            date: { type: "string", example: "January 15, 2024" },
            validUntil: { type: "string", example: "February 15, 2024" },
            notes: { type: "string", example: "Payment due within 30 days" },
            terms: { type: "string", example: "Net 30" },
            showSignature: { type: "boolean", default: false },
          },
        },
        client: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string", example: "John Smith" },
            company: { type: "string", example: "Acme Corp" },
            address: { type: "string", example: "123 Main St" },
            email: { type: "string", example: "john@acme.com" },
            phone: { type: "string", example: "(555) 123-4567" },
          },
        },
        lineItems: {
          type: "array",
          description: "List of quoted items/services",
          itemProperties: {
            description: { type: "string", required: true },
            details: { type: "string" },
            quantity: { type: "number", required: true },
            unitPrice: { type: "number", required: true },
            total: { type: "number", required: true },
          },
        },
        totals: {
          type: "object",
          properties: {
            subtotal: { type: "number", required: true },
            discount: { type: "number" },
            discountPercent: { type: "number" },
            tax: { type: "number" },
            taxRate: { type: "number", example: 8.25 },
            total: { type: "number", required: true },
          },
        },
        branding: {
          type: "object",
          properties: {
            logoUrl: { type: "string", format: "uri" },
            companyName: { type: "string", required: true },
            companyAddress: { type: "string" },
          },
        },
        styles: {
          type: "object",
          description: "Optional style customizations",
          properties: {
            accentColor: { type: "string", default: "#1e3a5f" },
            fontFamily: { type: "string" },
            fontSize: { type: "string", default: "14px" },
          },
        },
      },
    },
  };

  const schema = schemas[args.template];

  if (!schema) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              error: `Template "${args.template}" not found`,
              availableTemplates: Object.keys(schemas),
              suggestion:
                "Use glyph_templates to see all available templates",
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(schema, null, 2),
      },
    ],
  };
}

export async function handleGlyphTemplates(args: {
  apiKey?: string;
}): Promise<ToolResult> {
  try {
    const client = getClient(args.apiKey);
    const templates = await client.getTemplates();
    const styles = await client.getStyles();

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              templates: templates.length > 0 ? templates : [
                {
                  id: "quote-modern",
                  name: "Quote Modern",
                  description:
                    "Clean, professional quote/proposal template with line items",
                },
              ],
              styles: styles,
              usage: {
                preview: 'glyph_preview with template="quote-modern"',
                autoDetect:
                  'glyph_preview with template="auto" to detect best template',
              },
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    // Return default templates if API fails
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              templates: [
                {
                  id: "quote-modern",
                  name: "Quote Modern",
                  description:
                    "Clean, professional quote/proposal template with line items",
                },
                {
                  id: "invoice",
                  name: "Invoice",
                  description: "Standard invoice template",
                },
                {
                  id: "receipt",
                  name: "Receipt",
                  description: "Payment receipt template",
                },
              ],
              note: "Using cached template list. Some templates may not be available.",
            },
            null,
            2
          ),
        },
      ],
    };
  }
}

export async function handleGlyphSuggest(args: {
  sessionId: string;
  apiKey?: string;
}): Promise<ToolResult> {
  const session = getSession(args.sessionId);

  if (!session) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              error: "Session not found",
              suggestion:
                "Create a preview first with glyph_preview, then use the sessionId for suggestions",
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }

  // Analyze the current state and provide suggestions
  const suggestions = analyzePdfForSuggestions(session.data, session.html);

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            sessionId: args.sessionId,
            template: session.template,
            suggestions: suggestions,
            howToApply:
              "Use glyph_modify with the suggestion text to apply any of these improvements",
          },
          null,
          2
        ),
      },
    ],
  };
}

export async function handleGlyphCreate(args: {
  data: Record<string, unknown>;
  intent?: string;
  style?: string;
  format?: "pdf" | "png" | "html";
  outputPath?: string;
  apiKey?: string;
}): Promise<ToolResult> {
  try {
    const client = getClient(args.apiKey);

    const result = await client.create({
      data: args.data,
      intent: args.intent,
      style: args.style || "quote-modern",
      format: args.format || "pdf",
    });

    // Store session locally for potential follow-up modifications
    if (result.sessionId) {
      // Extract HTML from base64 if html format, otherwise store placeholder
      let html = "";
      if (result.format === "html" && result.url.startsWith("data:text/html;base64,")) {
        html = Buffer.from(result.url.split(",")[1], "base64").toString("utf-8");
      }
      storeSession(
        result.sessionId,
        html,
        result.analysis.template,
        args.data
      );
    }

    // If outputPath is provided, save the file
    if (args.outputPath && result.url) {
      const { writeFile } = await import("fs/promises");
      const base64Data = result.url.split(",")[1];
      const buffer = Buffer.from(base64Data, "base64");
      await writeFile(args.outputPath, buffer);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                savedTo: args.outputPath,
                format: result.format,
                size: result.size,
                analysis: {
                  documentType: result.analysis.documentType,
                  confidence: `${Math.round(result.analysis.confidence * 100)}%`,
                  template: result.analysis.template,
                  fieldsMapped: result.analysis.fieldMappings.length,
                  warnings: result.analysis.warnings,
                },
                sessionId: result.sessionId,
                message: `${result.format.toUpperCase()} created and saved to ${args.outputPath} (${formatBytes(result.size)})`,
                nextSteps: [
                  `Use glyph_modify with sessionId "${result.sessionId}" to make changes`,
                  "Use glyph_generate to regenerate after modifications",
                ],
              },
              null,
              2
            ),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              format: result.format,
              size: result.size,
              analysis: {
                documentType: result.analysis.documentType,
                confidence: `${Math.round(result.analysis.confidence * 100)}%`,
                template: result.analysis.template,
                fieldsMapped: result.analysis.fieldMappings.length,
                missingFields: result.analysis.missingFields,
                warnings: result.analysis.warnings,
              },
              sessionId: result.sessionId,
              url: result.url.substring(0, 100) + "...[base64 data]",
              message: `Generated ${result.format.toUpperCase()} (${formatBytes(result.size)})`,
              nextSteps: [
                `Use glyph_modify with sessionId "${result.sessionId}" to make changes`,
                "Use outputPath parameter to save to file",
              ],
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    return formatError(error);
  }
}

export async function handleGlyphAnalyze(args: {
  data: Record<string, unknown>;
  intent?: string;
  apiKey?: string;
}): Promise<ToolResult> {
  try {
    const client = getClient(args.apiKey);
    const analysis = await client.analyze(args.data, args.intent);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              analysis: {
                documentType: analysis.documentType,
                confidence: `${Math.round(analysis.confidence * 100)}%`,
                suggestedTemplate: analysis.suggestedTemplate,
                fieldMappings: analysis.fieldMappings.map((f) => ({
                  detected: f.source,
                  mapsTo: f.target,
                  confidence: `${Math.round(f.confidence * 100)}%`,
                  required: f.required || false,
                })),
                missingFields: analysis.missingFields,
                warnings: analysis.warnings,
              },
              interpretation: formatAnalysisForHumans(analysis),
              nextSteps: [
                "Use glyph_create to generate a PDF with this data",
                "Adjust your data structure if the analysis doesn't match your intent",
                `Preview URL: ${analysis.previewUrl}`,
              ],
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    return formatError(error);
  }
}

function formatAnalysisForHumans(analysis: AnalyzeResult): string {
  const lines = [
    `Document Type: ${analysis.documentType} (${Math.round(analysis.confidence * 100)}% confidence)`,
    `Suggested Template: ${analysis.suggestedTemplate}`,
    "",
    "Field Mappings:",
  ];

  for (const field of analysis.fieldMappings) {
    const requiredTag = field.required ? " [required]" : "";
    lines.push(`  - ${field.source} -> ${field.target}${requiredTag}`);
  }

  if (analysis.missingFields.length > 0) {
    lines.push("");
    lines.push("Missing Fields:");
    for (const missing of analysis.missingFields) {
      lines.push(`  - ${missing.field}: ${missing.reason}`);
    }
  }

  if (analysis.warnings.length > 0) {
    lines.push("");
    lines.push("Warnings:");
    for (const warning of analysis.warnings) {
      lines.push(`  - ${warning}`);
    }
  }

  return lines.join("\n");
}

// =============================================================================
// Helper Functions
// =============================================================================

function formatError(error: unknown): ToolResult {
  if (error instanceof GlyphApiError) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              error: error.message,
              code: error.code,
              details: error.details,
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            error: error instanceof Error ? error.message : "Unknown error",
            code: "UNKNOWN_ERROR",
          },
          null,
          2
        ),
      },
    ],
    isError: true,
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

interface Suggestion {
  category: string;
  suggestion: string;
  priority: "high" | "medium" | "low";
  modifyCommand: string;
}

function analyzePdfForSuggestions(
  data: Record<string, unknown>,
  html: string
): Suggestion[] {
  const suggestions: Suggestion[] = [];

  // Check for missing branding
  const branding = data.branding as Record<string, unknown> | undefined;
  if (!branding?.logoUrl) {
    suggestions.push({
      category: "Branding",
      suggestion: "Add a company logo to make the document more professional",
      priority: "high",
      modifyCommand: "Add a placeholder for a company logo in the header",
    });
  }

  // Check for missing contact info
  const client = data.client as Record<string, unknown> | undefined;
  if (client && !client.phone && !client.email) {
    suggestions.push({
      category: "Contact",
      suggestion: "Consider adding client contact information (email or phone)",
      priority: "medium",
      modifyCommand: "Add space for client email and phone in the header",
    });
  }

  // Check for missing terms
  const meta = data.meta as Record<string, unknown> | undefined;
  if (!meta?.terms) {
    suggestions.push({
      category: "Legal",
      suggestion: "Add payment terms and conditions to protect your business",
      priority: "high",
      modifyCommand:
        "Add a terms and conditions section at the bottom of the document",
    });
  }

  // Check for missing validity date
  if (!meta?.validUntil) {
    suggestions.push({
      category: "Business",
      suggestion:
        "Add an expiration date to create urgency and protect pricing",
      priority: "medium",
      modifyCommand: "Add a 'Valid Until' date prominently near the quote date",
    });
  }

  // Check HTML for potential improvements
  if (!html.includes("qr") && !html.includes("QR")) {
    suggestions.push({
      category: "Modern",
      suggestion: "Add a QR code for quick payment or contact",
      priority: "low",
      modifyCommand: "Add a QR code in the footer for quick mobile payment",
    });
  }

  // Check for color/style customization
  const styles = data.styles as Record<string, unknown> | undefined;
  if (!styles?.accentColor) {
    suggestions.push({
      category: "Design",
      suggestion: "Customize the accent color to match your brand",
      priority: "low",
      modifyCommand: "Change the accent color to match the company brand",
    });
  }

  // Add a signature line suggestion
  if (!html.includes("signature") && !html.includes("Signature")) {
    suggestions.push({
      category: "Legal",
      suggestion: "Add signature lines for formal approval",
      priority: "medium",
      modifyCommand:
        "Add signature lines at the bottom for client and company signatures",
    });
  }

  return suggestions;
}

// Tool dispatcher
export async function handleTool(
  name: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  switch (name) {
    case "glyph_preview":
      return handleGlyphPreview(
        args as Parameters<typeof handleGlyphPreview>[0]
      );
    case "glyph_modify":
      return handleGlyphModify(args as Parameters<typeof handleGlyphModify>[0]);
    case "glyph_generate":
      return handleGlyphGenerate(
        args as Parameters<typeof handleGlyphGenerate>[0]
      );
    case "glyph_schema":
      return handleGlyphSchema(args as Parameters<typeof handleGlyphSchema>[0]);
    case "glyph_templates":
      return handleGlyphTemplates(
        args as Parameters<typeof handleGlyphTemplates>[0]
      );
    case "glyph_suggest":
      return handleGlyphSuggest(
        args as Parameters<typeof handleGlyphSuggest>[0]
      );
    case "glyph_create":
      return handleGlyphCreate(
        args as Parameters<typeof handleGlyphCreate>[0]
      );
    case "glyph_analyze":
      return handleGlyphAnalyze(
        args as Parameters<typeof handleGlyphAnalyze>[0]
      );
    default:
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: `Unknown tool: ${name}`,
              availableTools: TOOL_DEFINITIONS.map((t) => t.name),
            }),
          },
        ],
        isError: true,
      };
  }
}
