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
  type TemplateType,
  type TemplateStyle,
  type SavedTemplate,
  type SourceType,
  type CreateSourceParams,
  type GenerateFromSourceParams,
  type LinkTemplateParams,
  type CloneTemplateParams,
  type CreateSessionFromMappingParams,
  type SaveTemplateFromSessionParams,
  type AutoGenerateParams,
  type AutoGenerateResult,
  type AcceptPreviewParams,
  type AcceptPreviewResult,
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

  // ===========================================================================
  // Saved Templates Tools
  // ===========================================================================

  {
    name: "glyph_templates_list",
    description: `List all saved templates for the current API key.

Use this to see what templates are available for PDF generation.
Returns template name, type, style, and ID (use ID with glyph_create for instant PDF generation).

Saved templates allow you to:
- Reuse templates without AI regeneration (much faster)
- Maintain consistent branding across documents
- Create once, generate many times`,
    inputSchema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: [
            "invoice",
            "quote",
            "report",
            "certificate",
            "letter",
            "receipt",
            "contract",
            "custom",
          ],
          description: "Filter by template type",
        },
        limit: {
          type: "number",
          description: "Max results (default 50, max 100)",
        },
        apiKey: {
          type: "string",
          description: "Glyph API key. Uses GLYPH_API_KEY env var if not provided.",
        },
      },
    },
  },
  {
    name: "glyph_template_save",
    description: `Save a template for reuse.

After creating a template you like, save it with a name so you can reuse it
without AI regeneration. Much faster for repeated PDF generation.

You can save templates from:
- HTML you've crafted manually
- Output from glyph_modify after customizing
- AI-generated templates you want to preserve

Set isDefault=true to make this the default template for its type.`,
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Template name (e.g., 'Invoice v1', 'Quote Template')",
        },
        html: {
          type: "string",
          description:
            "Full HTML template with Mustache placeholders (e.g., {{client.name}})",
        },
        type: {
          type: "string",
          enum: [
            "invoice",
            "quote",
            "report",
            "certificate",
            "letter",
            "receipt",
            "contract",
            "custom",
          ],
          description: "Template type for organization",
        },
        description: {
          type: "string",
          description: "Optional description of the template",
        },
        style: {
          type: "string",
          enum: [
            "stripe-clean",
            "professional",
            "minimal",
            "bold",
            "classic",
            "corporate",
            "modern",
            "vibrant",
          ],
          description: "Style preset used",
        },
        isDefault: {
          type: "boolean",
          description: "Make this the default template for its type",
        },
        apiKey: {
          type: "string",
          description: "Glyph API key. Uses GLYPH_API_KEY env var if not provided.",
        },
      },
      required: ["name", "html"],
    },
  },
  {
    name: "glyph_template_get",
    description: `Get a saved template by ID, including the full HTML.

Use this to:
- Retrieve the HTML to preview or modify
- Check the schema and field requirements
- Inspect template details before generating`,
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Template ID (UUID from glyph_templates_list)",
        },
        apiKey: {
          type: "string",
          description: "Glyph API key. Uses GLYPH_API_KEY env var if not provided.",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "glyph_template_update",
    description: `Update a saved template.

Use this to:
- Update the HTML after modifications
- Change template metadata (name, description, type)
- Set/unset as default template

Only include fields you want to update.`,
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Template ID to update",
        },
        name: {
          type: "string",
          description: "New template name",
        },
        html: {
          type: "string",
          description: "Updated HTML template",
        },
        type: {
          type: "string",
          enum: [
            "invoice",
            "quote",
            "report",
            "certificate",
            "letter",
            "receipt",
            "contract",
            "custom",
          ],
          description: "Template type",
        },
        description: {
          type: "string",
          description: "Template description",
        },
        style: {
          type: "string",
          enum: [
            "stripe-clean",
            "professional",
            "minimal",
            "bold",
            "classic",
            "corporate",
            "modern",
            "vibrant",
          ],
          description: "Style preset",
        },
        isDefault: {
          type: "boolean",
          description: "Set as default template for its type",
        },
        apiKey: {
          type: "string",
          description: "Glyph API key. Uses GLYPH_API_KEY env var if not provided.",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "glyph_template_delete",
    description: `Delete a saved template.

This permanently removes the template. Use with caution.`,
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Template ID to delete",
        },
        apiKey: {
          type: "string",
          description: "Glyph API key. Uses GLYPH_API_KEY env var if not provided.",
        },
      },
      required: ["id"],
    },
  },

  // ===========================================================================
  // Data Source Tools
  // ===========================================================================

  {
    name: "glyph_create_source",
    description: `Connect a data source (Airtable, REST API, etc.) for PDF generation.

This creates a reusable connection to your data source that can be linked to templates.

Supported source types:
- **airtable**: Connect to an Airtable base. Config needs: apiKey, baseId, tableName
- **rest_api**: Connect to a REST API endpoint. Config needs: url, headers (optional), auth (optional)
- **webhook**: Set up a webhook endpoint to receive data. Config is optional.

Example for Airtable:
{
  "type": "airtable",
  "name": "Invoices Table",
  "config": {
    "apiKey": "pat...",
    "baseId": "app...",
    "tableName": "Invoices"
  }
}`,
    inputSchema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["airtable", "rest_api", "webhook"],
          description: "Type of data source",
        },
        name: {
          type: "string",
          description: "Human-readable name for this source",
        },
        config: {
          type: "object",
          description: "Type-specific configuration (e.g., API keys, base IDs)",
          additionalProperties: true,
        },
        apiKey: {
          type: "string",
          description: "Glyph API key. Uses GLYPH_API_KEY env var if not provided.",
        },
      },
      required: ["type", "name", "config"],
    },
  },
  {
    name: "glyph_list_sources",
    description: `List all connected data sources.

Returns all data sources linked to your API key, including their status and configuration.
Use the source ID with glyph_generate_from_source or glyph_link_template.`,
    inputSchema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["airtable", "rest_api", "webhook"],
          description: "Filter by source type",
        },
        apiKey: {
          type: "string",
          description: "Glyph API key. Uses GLYPH_API_KEY env var if not provided.",
        },
      },
    },
  },
  {
    name: "glyph_generate_from_source",
    description: `Generate PDF from a saved template and connected data source.

This is the smart way to generate PDFs:
1. Uses your saved template (created with glyph_template_save)
2. Pulls data from your connected source (created with glyph_create_source)
3. Applies field mappings (set with glyph_link_template)
4. Generates one or multiple PDFs

You can generate:
- A single PDF by specifying recordId
- Multiple PDFs by using filter (e.g., all invoices from this month)

If sourceId is not specified, uses the default source linked to the template.`,
    inputSchema: {
      type: "object",
      properties: {
        templateId: {
          type: "string",
          description: "ID of the saved template (from glyph_templates_list)",
        },
        sourceId: {
          type: "string",
          description: "ID of the data source (optional - uses default if not specified)",
        },
        recordId: {
          type: "string",
          description: "Specific record ID to generate from (e.g., Airtable record ID)",
        },
        filter: {
          type: "object",
          description: "Filter for multiple records",
          properties: {
            formula: {
              type: "string",
              description: "Filter formula (Airtable formula syntax for Airtable sources)",
            },
            limit: {
              type: "number",
              description: "Maximum number of records to process",
            },
          },
        },
        outputPath: {
          type: "string",
          description: "Optional file path to save PDF (for single record only)",
        },
        apiKey: {
          type: "string",
          description: "Glyph API key. Uses GLYPH_API_KEY env var if not provided.",
        },
      },
      required: ["templateId"],
    },
  },
  {
    name: "glyph_suggest_mappings",
    description: `Get AI-powered field mapping suggestions between a template and data source.

When linking a template to a data source, field names often don't match exactly.
This tool uses AI to suggest the best mappings:

- Analyzes template placeholders (e.g., {{client.name}})
- Analyzes source fields (e.g., "Customer Name")
- Suggests mappings with confidence scores

Use the suggestions with glyph_link_template to create the actual mapping.`,
    inputSchema: {
      type: "object",
      properties: {
        templateId: {
          type: "string",
          description: "ID of the template (from glyph_templates_list)",
        },
        sourceId: {
          type: "string",
          description: "ID of the data source (from glyph_list_sources)",
        },
        apiKey: {
          type: "string",
          description: "Glyph API key. Uses GLYPH_API_KEY env var if not provided.",
        },
      },
      required: ["templateId", "sourceId"],
    },
  },
  {
    name: "glyph_link_template",
    description: `Link a template to a data source with field mappings.

This creates the connection between your template placeholders and your data source fields.

Example:
- Template has: {{client.name}}, {{client.email}}, {{total}}
- Source has: "Customer Name", "Email Address", "Invoice Total"
- Mapping: { "client.name": "Customer Name", "client.email": "Email Address", "total": "Invoice Total" }

Set isDefault=true to make this source the default for this template.`,
    inputSchema: {
      type: "object",
      properties: {
        templateId: {
          type: "string",
          description: "ID of the template",
        },
        sourceId: {
          type: "string",
          description: "ID of the data source",
        },
        fieldMappings: {
          type: "object",
          description: "Field mappings from template placeholder to source field name",
          additionalProperties: {
            type: "string",
          },
        },
        isDefault: {
          type: "boolean",
          description: "Set as default source for this template",
        },
        apiKey: {
          type: "string",
          description: "Glyph API key. Uses GLYPH_API_KEY env var if not provided.",
        },
      },
      required: ["templateId", "sourceId", "fieldMappings"],
    },
  },

  // ===========================================================================
  // Data-First Workflow Tools
  // ===========================================================================

  {
    name: "glyph_clone_template",
    description: `Clone a built-in template to your saved templates. This creates a copy you can customize.

Use this as the first step in a data-first workflow:
1. Clone a built-in template (this tool)
2. Create a mapping to your data source (glyph_link_template)
3. Create an editing session (glyph_create_session_from_mapping)
4. Make AI-powered modifications (glyph_modify)
5. Save your customized template (glyph_save_template_from_session)

You can optionally link to a data source in the same call by providing linkToSource.`,
    inputSchema: {
      type: "object",
      properties: {
        builtInTemplateId: {
          type: "string",
          description: "The built-in template ID to clone (e.g., 'quote-modern', 'invoice-clean')",
        },
        name: {
          type: "string",
          description: "Optional custom name for the cloned template",
        },
        linkToSource: {
          type: "string",
          description: "Optional source ID to automatically create a mapping",
        },
        apiKey: {
          type: "string",
          description: "Glyph API key. Uses GLYPH_API_KEY env var if not provided.",
        },
      },
      required: ["builtInTemplateId"],
    },
  },
  {
    name: "glyph_create_session_from_mapping",
    description: `Create an editable session from a template-source mapping.

Returns a sessionId that can be used with glyph_modify to make AI-powered changes while preserving template placeholders.

This is the key tool for data-first editing:
- Pulls real data from your source to preview
- Maintains Mustache placeholders in the HTML
- Allows AI modifications without breaking data binding

The session can be used with:
- glyph_modify: Make AI-powered changes
- glyph_generate: Generate a PDF
- glyph_save_template_from_session: Save back as a template`,
    inputSchema: {
      type: "object",
      properties: {
        mappingId: {
          type: "string",
          description: "The mapping ID (links a template to a source)",
        },
        recordId: {
          type: "string",
          description: "Optional specific record ID. If omitted, uses the first record.",
        },
        apiKey: {
          type: "string",
          description: "Glyph API key. Uses GLYPH_API_KEY env var if not provided.",
        },
      },
      required: ["mappingId"],
    },
  },
  {
    name: "glyph_save_template_from_session",
    description: `Save a template from an editing session, preserving Mustache placeholders.

Use this after making modifications with glyph_modify to save your customized template.
The AI-modified HTML is processed to restore Mustache placeholders ({{field.name}}).

Save options:
- "update": Replace the existing template with the modified version
- "variant": Create a new linked version (keeps history, useful for A/B testing)

This completes the data-first workflow - your template is now ready to generate PDFs from any record in your data source.`,
    inputSchema: {
      type: "object",
      properties: {
        templateId: {
          type: "string",
          description: "The saved template ID to update",
        },
        sessionId: {
          type: "string",
          description: "The session ID containing modifications",
        },
        saveAs: {
          type: "string",
          enum: ["update", "variant"],
          description: "How to save: 'update' replaces the template, 'variant' creates a new linked version",
        },
        variantName: {
          type: "string",
          description: "Name for the variant (required if saveAs is 'variant')",
        },
        apiKey: {
          type: "string",
          description: "Glyph API key. Uses GLYPH_API_KEY env var if not provided.",
        },
      },
      required: ["templateId", "sessionId"],
    },
  },

  // ===========================================================================
  // Auto-Generate Tools (One-Call Magic)
  // ===========================================================================

  {
    name: "glyph_auto_generate",
    description: `Generate a PDF from your data source in one call. Automatically:
- Detects document type (invoice, quote, receipt, etc.)
- Selects best matching template
- Maps fields from your source to template
- Generates a preview or PDF

This is the fastest way to generate PDFs from connected data sources:
1. Connect a data source with glyph_create_source (or pass rawData directly)
2. Call glyph_auto_generate with the sourceId
3. Review the preview and field mappings
4. Call glyph_accept_preview to save the configuration for future use

For production use, call glyph_accept_preview to persist the template and mapping.
After that, you can generate PDFs with just sourceId + recordId.

Example workflow:
1. glyph_auto_generate({ sourceId: "src_123", format: "preview" })
2. Review the mappings, make adjustments if needed
3. glyph_accept_preview({ sessionId: "...", setAsDefault: true })
4. Now generate PDFs: glyph_generate_from_source({ templateId: "...", recordId: "rec_456" })`,
    inputSchema: {
      type: "object",
      properties: {
        sourceId: {
          type: "string",
          description: "ID of connected data source (from glyph_create_source). Either sourceId or rawData is required.",
        },
        rawData: {
          type: "object",
          description: "Raw data object to generate PDF from. Use this for one-off generations without a saved source.",
          additionalProperties: true,
        },
        recordId: {
          type: "string",
          description: "Optional specific record ID from the data source. If omitted, uses the first record.",
        },
        templateId: {
          type: "string",
          description: "Optional template override (skip auto-selection). Can be a built-in template ID (e.g., 'quote-modern') or a saved template UUID.",
        },
        mappingOverrides: {
          type: "object",
          description: "Optional field mapping overrides. Format: { templateField: sourceField }",
          additionalProperties: {
            type: "string",
          },
        },
        format: {
          type: "string",
          enum: ["preview", "html", "pdf", "png"],
          default: "preview",
          description: "Output format. Use 'preview' to review before generating PDF.",
        },
        confidenceThreshold: {
          type: "number",
          minimum: 0,
          maximum: 1,
          default: 0.7,
          description: "Minimum confidence to proceed with auto-selected template (0-1, default 0.7).",
        },
        apiKey: {
          type: "string",
          description: "Glyph API key. Uses GLYPH_API_KEY env var if not provided.",
        },
      },
      required: [],
    },
  },
  {
    name: "glyph_accept_preview",
    description: `Save an auto-generated preview as your default template for a data source.
After accepting, you can generate PDFs with just sourceId + recordId.

This persists:
- The template (cloned from built-in if needed)
- The field mappings between your source and template
- Optionally sets this as the default for the source

Use this after glyph_auto_generate to lock in your configuration.

Example:
1. Call glyph_auto_generate to get a preview
2. Review the mappings and preview
3. Call glyph_accept_preview with the sessionId
4. Now use glyph_generate_from_source for fast PDF generation`,
    inputSchema: {
      type: "object",
      properties: {
        sessionId: {
          type: "string",
          description: "Session ID from glyph_auto_generate response",
        },
        templateName: {
          type: "string",
          description: "Optional custom name for the saved template. Defaults to '[TemplateName] - Auto Generated'.",
        },
        setAsDefault: {
          type: "boolean",
          default: true,
          description: "Set this template as the default for the data source. Default is true.",
        },
        mappingOverrides: {
          type: "object",
          description: "Optional field mapping overrides to apply before saving.",
          additionalProperties: {
            type: "string",
          },
        },
        apiKey: {
          type: "string",
          description: "Glyph API key. Uses GLYPH_API_KEY env var if not provided.",
        },
      },
      required: ["sessionId"],
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
  const { readFileSync, existsSync } = await import("fs");
  const { join, dirname } = await import("path");
  const { fileURLToPath } = await import("url");

  const AVAILABLE_TEMPLATES = [
    "quote-modern",
    "quote-bold",
    "quote-professional",
    "invoice-clean",
    "receipt-minimal",
    "report-cover",
    "contract-simple",
    "certificate-modern",
    "letter-business",
    "proposal-basic",
  ];

  // Resolve templates directory relative to this file (mcp-server/src/tools.ts -> templates/)
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const templatesDir = join(currentDir, "..", "..", "templates");

  const templateId = args.template;
  const schemaPath = join(templatesDir, templateId, "schema.json");

  if (!existsSync(schemaPath)) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              error: `Template "${templateId}" not found`,
              availableTemplates: AVAILABLE_TEMPLATES,
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

  try {
    const schemaContent = readFileSync(schemaPath, "utf-8");
    const schema = JSON.parse(schemaContent);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              template: templateId,
              ...schema,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (err) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              error: `Failed to read schema for "${templateId}": ${err instanceof Error ? err.message : String(err)}`,
              availableTemplates: AVAILABLE_TEMPLATES,
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
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
// Saved Templates Tool Handlers
// =============================================================================

export async function handleGlyphTemplatesList(args: {
  type?: TemplateType;
  limit?: number;
  apiKey?: string;
}): Promise<ToolResult> {
  try {
    const client = getClient(args.apiKey);
    const result = await client.listSavedTemplates({
      type: args.type,
      limit: args.limit,
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              templates: result.templates.map((t) => ({
                id: t.id,
                name: t.name,
                type: t.type,
                style: t.style,
                isDefault: t.isDefault,
                version: t.version,
                updatedAt: t.updatedAt,
              })),
              total: result.total,
              message: `Found ${result.total} saved template(s)`,
              usage:
                "Use template ID with glyph_template_get for full HTML, or use glyph_preview with your data",
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

export async function handleGlyphTemplateSave(args: {
  name: string;
  html: string;
  type?: TemplateType;
  description?: string;
  style?: TemplateStyle;
  isDefault?: boolean;
  apiKey?: string;
}): Promise<ToolResult> {
  try {
    const client = getClient(args.apiKey);
    const result = await client.saveTemplate({
      name: args.name,
      html: args.html,
      type: args.type,
      description: args.description,
      style: args.style,
      isDefault: args.isDefault,
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              template: {
                id: result.template.id,
                name: result.template.name,
                type: result.template.type,
                style: result.template.style,
                isDefault: result.template.isDefault,
                version: result.template.version,
                createdAt: result.template.createdAt,
              },
              message: `Template "${args.name}" saved successfully`,
              nextSteps: [
                `Use glyph_template_get with id "${result.template.id}" to retrieve the full HTML`,
                "Use glyph_templates_list to see all your saved templates",
                "Use glyph_preview with this template's HTML and your data to generate PDFs",
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

export async function handleGlyphTemplateGet(args: {
  id: string;
  apiKey?: string;
}): Promise<ToolResult> {
  try {
    const client = getClient(args.apiKey);
    const result = await client.getSavedTemplate(args.id);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              template: {
                id: result.template.id,
                name: result.template.name,
                type: result.template.type,
                description: result.template.description,
                style: result.template.style,
                isDefault: result.template.isDefault,
                version: result.template.version,
                schema: result.template.schema,
                createdAt: result.template.createdAt,
                updatedAt: result.template.updatedAt,
                html: result.template.html,
              },
              message: `Retrieved template "${result.template.name}"`,
              usage:
                "Use the HTML with glyph_modify to customize, or render with your data using glyph_preview",
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

export async function handleGlyphTemplateUpdate(args: {
  id: string;
  name?: string;
  html?: string;
  type?: TemplateType;
  description?: string;
  style?: TemplateStyle;
  isDefault?: boolean;
  apiKey?: string;
}): Promise<ToolResult> {
  try {
    const client = getClient(args.apiKey);

    // Build update params (only include provided fields)
    const updateParams: Record<string, unknown> = {};
    if (args.name !== undefined) updateParams.name = args.name;
    if (args.html !== undefined) updateParams.html = args.html;
    if (args.type !== undefined) updateParams.type = args.type;
    if (args.description !== undefined) updateParams.description = args.description;
    if (args.style !== undefined) updateParams.style = args.style;
    if (args.isDefault !== undefined) updateParams.isDefault = args.isDefault;

    const result = await client.updateSavedTemplate(
      args.id,
      updateParams as Parameters<typeof client.updateSavedTemplate>[1]
    );

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              template: {
                id: result.template.id,
                name: result.template.name,
                type: result.template.type,
                style: result.template.style,
                isDefault: result.template.isDefault,
                version: result.template.version,
                updatedAt: result.template.updatedAt,
              },
              message: `Template "${result.template.name}" updated (version ${result.template.version})`,
              fieldsUpdated: Object.keys(updateParams),
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

export async function handleGlyphTemplateDelete(args: {
  id: string;
  apiKey?: string;
}): Promise<ToolResult> {
  try {
    const client = getClient(args.apiKey);
    const result = await client.deleteSavedTemplate(args.id);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              deleted: result.deleted,
              message: `Template ${args.id} deleted successfully`,
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

// =============================================================================
// Data Source Tool Handlers
// =============================================================================

export async function handleGlyphCreateSource(args: {
  type: SourceType;
  name: string;
  config: Record<string, unknown>;
  apiKey?: string;
}): Promise<ToolResult> {
  try {
    const client = getClient(args.apiKey);
    const result = await client.createSource({
      type: args.type,
      name: args.name,
      config: args.config,
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              source: {
                id: result.source.id,
                type: result.source.type,
                name: result.source.name,
                status: result.source.status,
                createdAt: result.source.createdAt,
              },
              message: `Data source "${args.name}" created successfully`,
              nextSteps: [
                `Use glyph_suggest_mappings with sourceId "${result.source.id}" to get field mapping suggestions`,
                `Use glyph_link_template to connect this source to a template`,
                `Use glyph_generate_from_source to generate PDFs from this source`,
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

export async function handleGlyphListSources(args: {
  type?: SourceType;
  apiKey?: string;
}): Promise<ToolResult> {
  try {
    const client = getClient(args.apiKey);
    const result = await client.listSources(args.type);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              sources: result.sources.map((s) => ({
                id: s.id,
                type: s.type,
                name: s.name,
                status: s.status,
                lastSyncAt: s.lastSyncAt,
                createdAt: s.createdAt,
              })),
              total: result.total,
              message: `Found ${result.total} data source(s)`,
              usage: "Use source ID with glyph_link_template or glyph_generate_from_source",
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

export async function handleGlyphGenerateFromSource(args: {
  templateId: string;
  sourceId?: string;
  recordId?: string;
  filter?: { formula?: string; limit?: number };
  outputPath?: string;
  apiKey?: string;
}): Promise<ToolResult> {
  try {
    const client = getClient(args.apiKey);
    const result = await client.generateFromSource({
      templateId: args.templateId,
      sourceId: args.sourceId,
      recordId: args.recordId,
      filter: args.filter,
    });

    // If outputPath is provided and single record, save the file
    if (args.outputPath && result.generated.length === 1) {
      const { writeFile } = await import("fs/promises");
      const firstResult = result.generated[0];
      const base64Data = firstResult.url.split(",")[1];
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
                recordId: firstResult.recordId,
                format: firstResult.format,
                size: firstResult.size,
                message: `PDF saved to ${args.outputPath} (${formatBytes(firstResult.size)})`,
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
              generated: result.generated.map((g) => ({
                recordId: g.recordId,
                format: g.format,
                size: formatBytes(g.size),
                url: g.url.substring(0, 100) + "...[base64 data]",
              })),
              total: result.total,
              errors: result.errors,
              message: `Generated ${result.total} PDF(s)${result.errors?.length ? `, ${result.errors.length} failed` : ""}`,
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

export async function handleGlyphSuggestMappings(args: {
  templateId: string;
  sourceId: string;
  apiKey?: string;
}): Promise<ToolResult> {
  try {
    const client = getClient(args.apiKey);
    const result = await client.suggestMappings(args.templateId, args.sourceId);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              suggestions: result.suggestions.map((s) => ({
                templateField: s.templateField,
                sourceField: s.sourceField,
                confidence: `${Math.round(s.confidence * 100)}%`,
                reason: s.reason,
              })),
              unmappedTemplateFields: result.unmappedTemplateFields,
              unmappedSourceFields: result.unmappedSourceFields,
              message: `Found ${result.suggestions.length} mapping suggestion(s)`,
              nextSteps: [
                "Review the suggestions and adjust as needed",
                "Use glyph_link_template with the accepted mappings",
              ],
              exampleUsage: {
                tool: "glyph_link_template",
                params: {
                  templateId: args.templateId,
                  sourceId: args.sourceId,
                  fieldMappings: Object.fromEntries(
                    result.suggestions
                      .filter((s) => s.confidence >= 0.7)
                      .map((s) => [s.templateField, s.sourceField])
                  ),
                  isDefault: true,
                },
              },
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

export async function handleGlyphLinkTemplate(args: {
  templateId: string;
  sourceId: string;
  fieldMappings: Record<string, string>;
  isDefault?: boolean;
  apiKey?: string;
}): Promise<ToolResult> {
  try {
    const client = getClient(args.apiKey);
    const result = await client.linkTemplate({
      templateId: args.templateId,
      sourceId: args.sourceId,
      fieldMappings: args.fieldMappings,
      isDefault: args.isDefault,
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              mapping: {
                id: result.mapping.id,
                templateId: result.mapping.templateId,
                sourceId: result.mapping.sourceId,
                isDefault: result.mapping.isDefault,
                fieldCount: Object.keys(result.mapping.fieldMappings).length,
              },
              message: `Template linked to source with ${Object.keys(args.fieldMappings).length} field mapping(s)`,
              nextSteps: [
                `Use glyph_generate_from_source with templateId "${args.templateId}" to generate PDFs`,
                args.isDefault
                  ? "This source is now the default - you can omit sourceId in future calls"
                  : "Set isDefault=true to make this the default source for the template",
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

// =============================================================================
// Data-First Workflow Tool Handlers
// =============================================================================

export async function handleGlyphCloneTemplate(args: {
  builtInTemplateId: string;
  name?: string;
  linkToSource?: string;
  apiKey?: string;
}): Promise<ToolResult> {
  try {
    const client = getClient(args.apiKey);
    const result = await client.cloneTemplate({
      builtInTemplateId: args.builtInTemplateId,
      name: args.name,
      linkToSource: args.linkToSource,
    });

    const nextSteps = [
      `Use glyph_template_get with id "${result.template.id}" to view the template`,
    ];

    if (result.mapping) {
      nextSteps.push(
        `Use glyph_create_session_from_mapping with mappingId "${result.mapping.id}" to start editing`
      );
    } else {
      nextSteps.push(
        `Use glyph_link_template to connect this template to a data source`
      );
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              template: {
                id: result.template.id,
                name: result.template.name,
                type: result.template.type,
                style: result.template.style,
                version: result.template.version,
                createdAt: result.template.createdAt,
              },
              mapping: result.mapping
                ? {
                    id: result.mapping.id,
                    templateId: result.mapping.templateId,
                    sourceId: result.mapping.sourceId,
                  }
                : null,
              message: `Template "${args.builtInTemplateId}" cloned as "${result.template.name}"${result.mapping ? " and linked to source" : ""}`,
              nextSteps,
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

export async function handleGlyphCreateSessionFromMapping(args: {
  mappingId: string;
  recordId?: string;
  apiKey?: string;
}): Promise<ToolResult> {
  try {
    const client = getClient(args.apiKey);
    const result = await client.createSessionFromMapping({
      mappingId: args.mappingId,
      recordId: args.recordId,
    });

    // Store session locally for resource access and glyph_generate
    storeSession(
      result.sessionId,
      result.preview.html,
      result.template.name,
      {} // Data is managed server-side for mapping sessions
    );

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              sessionId: result.sessionId,
              template: {
                id: result.template.id,
                name: result.template.name,
              },
              source: {
                id: result.source.id,
                name: result.source.name,
              },
              recordId: result.preview.record_id,
              htmlPreview:
                result.preview.html.substring(0, 500) +
                (result.preview.html.length > 500 ? "..." : ""),
              message: `Session created from mapping. Using record "${result.preview.record_id}" from "${result.source.name}"`,
              nextSteps: [
                `Use glyph_modify with sessionId "${result.sessionId}" to make AI-powered changes`,
                `Use glyph_generate with sessionId "${result.sessionId}" to generate a PDF`,
                `Use glyph_save_template_from_session to save your modifications as a reusable template`,
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

export async function handleGlyphSaveTemplateFromSession(args: {
  templateId: string;
  sessionId: string;
  saveAs?: "update" | "variant";
  variantName?: string;
  apiKey?: string;
}): Promise<ToolResult> {
  try {
    const client = getClient(args.apiKey);
    const result = await client.saveTemplateFromSession(args.templateId, {
      sessionId: args.sessionId,
      saveAs: args.saveAs,
      variantName: args.variantName,
    });

    const saveAction = args.saveAs === "variant" ? "Created variant" : "Updated";

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              template: {
                id: result.template.id,
                name: result.template.name,
                version: result.template.version,
                updatedAt: result.template.updatedAt,
              },
              placeholdersPreserved: result.placeholdersPreserved,
              warnings: result.warnings || [],
              message: `${saveAction} template "${result.template.name}" (v${result.template.version}). ${result.placeholdersPreserved} placeholders preserved.`,
              nextSteps: [
                `Use glyph_generate_from_source with templateId "${result.template.id}" to generate PDFs from your data source`,
                result.warnings?.length
                  ? "Review warnings above - some placeholders may need attention"
                  : "All placeholders successfully preserved - template is ready for production",
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

// =============================================================================
// Auto-Generate Tool Handlers (One-Call Magic)
// =============================================================================

export async function handleGlyphAutoGenerate(args: {
  sourceId?: string;
  rawData?: Record<string, unknown>;
  recordId?: string;
  templateId?: string;
  mappingOverrides?: Record<string, string>;
  format?: "preview" | "html" | "pdf" | "png";
  confidenceThreshold?: number;
  apiKey?: string;
}): Promise<ToolResult> {
  try {
    // Validate that either sourceId or rawData is provided
    if (!args.sourceId && !args.rawData) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error: "Either sourceId or rawData is required",
                code: "VALIDATION_ERROR",
                usage: {
                  withSource: 'glyph_auto_generate({ sourceId: "src_123" })',
                  withRawData: 'glyph_auto_generate({ rawData: { customer: {...}, items: [...] } })',
                },
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }

    const client = getClient(args.apiKey);
    const result = await client.autoGenerate({
      sourceId: args.sourceId,
      rawData: args.rawData,
      recordId: args.recordId,
      templateId: args.templateId,
      mappingOverrides: args.mappingOverrides,
      format: args.format || "preview",
      confidenceThreshold: args.confidenceThreshold,
    });

    // Store session locally for subsequent glyph_modify and glyph_generate calls
    if (result.sessionId && result.preview?.html) {
      storeSession(
        result.sessionId,
        result.preview.html,
        result.templateUsed.id,
        args.rawData || {}
      );
    }

    // Build response based on format
    const response: Record<string, unknown> = {
      success: true,
      sessionId: result.sessionId,
      templateUsed: {
        id: result.templateUsed.id,
        name: result.templateUsed.name,
        confidence: `${Math.round(result.templateUsed.confidence * 100)}%`,
        reasoning: result.templateUsed.reasoning,
        isBuiltIn: result.templateUsed.isBuiltIn,
      },
      documentType: {
        detected: result.documentType.detected,
        confidence: `${Math.round(result.documentType.confidence * 100)}%`,
      },
      mappings: {
        applied: result.mappings.applied,
        unmapped: result.mappings.unmapped,
        coverage: `${Math.round(result.mappings.coverage * 100)}%`,
        suggestions: result.mappings.suggestions,
      },
      source: result.source,
      htmlPreview:
        result.preview.html.substring(0, 500) +
        (result.preview.html.length > 500 ? "..." : ""),
    };

    // Add output if PDF/PNG was generated
    if (result.output) {
      if (result.output.error) {
        response.outputError = {
          error: result.output.error,
          details: result.output.details,
          fallback: `Use glyph_generate with sessionId: ${result.sessionId}`,
        };
      } else {
        response.output = {
          format: result.output.format,
          url: result.output.url,
          size: formatBytes(result.output.size || 0),
          filename: result.output.filename,
          expiresAt: result.output.expiresAt,
        };
      }
    }

    // Determine next steps based on result
    const nextSteps: string[] = [];

    if (result.mappings.unmapped.length > 0) {
      nextSteps.push(
        `${result.mappings.unmapped.length} unmapped field(s). Consider providing mappingOverrides for: ${result.mappings.unmapped.slice(0, 3).join(", ")}`
      );
    }

    if (args.format === "preview" || !args.format) {
      nextSteps.push(
        `Use glyph_accept_preview with sessionId "${result.sessionId}" to save this configuration`
      );
      nextSteps.push(
        `Use glyph_modify with sessionId "${result.sessionId}" to customize the document`
      );
      nextSteps.push(
        `Use glyph_generate with sessionId "${result.sessionId}" to generate the final PDF`
      );
    } else if (result.output?.url) {
      nextSteps.push(
        `PDF generated successfully. Use glyph_accept_preview to save this configuration for future use.`
      );
    }

    response.nextSteps = nextSteps;
    response.message = `Auto-generated ${result.documentType.detected} document using "${result.templateUsed.name}" (${Math.round(result.templateUsed.confidence * 100)}% match). ${Object.keys(result.mappings.applied).length} field(s) mapped.`;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(response, null, 2),
        },
      ],
    };
  } catch (error) {
    return formatError(error);
  }
}

export async function handleGlyphAcceptPreview(args: {
  sessionId: string;
  templateName?: string;
  setAsDefault?: boolean;
  mappingOverrides?: Record<string, string>;
  apiKey?: string;
}): Promise<ToolResult> {
  try {
    const client = getClient(args.apiKey);
    const result = await client.acceptPreview({
      sessionId: args.sessionId,
      templateName: args.templateName,
      setAsDefault: args.setAsDefault ?? true,
      mappingOverrides: args.mappingOverrides,
    });

    const response: Record<string, unknown> = {
      success: true,
      savedTemplate: {
        id: result.savedTemplate.id,
        name: result.savedTemplate.name,
        type: result.savedTemplate.type,
        version: result.savedTemplate.version,
        isClone: result.savedTemplate.isClone,
        clonedFrom: result.savedTemplate.clonedFrom,
      },
      message: result.message,
    };

    if (result.mapping) {
      response.mapping = {
        id: result.mapping.id,
        templateId: result.mapping.templateId,
        sourceId: result.mapping.sourceId,
        fieldCount: Object.keys(result.mapping.fieldMappings).length,
        isDefault: result.mapping.isDefault,
      };
    }

    // Build next steps
    const nextSteps: string[] = [];

    if (result.mapping) {
      nextSteps.push(
        `Generate PDFs: glyph_generate_from_source({ templateId: "${result.savedTemplate.id}", recordId: "your_record_id" })`
      );
      if (result.defaultSet) {
        nextSteps.push(
          "This template is now the default for this source - sourceId is optional in future calls"
        );
      }
    } else {
      nextSteps.push(
        `Connect a data source with glyph_create_source, then use glyph_link_template to enable smart generation`
      );
    }

    nextSteps.push(
      `Edit template: glyph_template_get({ id: "${result.savedTemplate.id}" })`
    );

    response.nextSteps = nextSteps;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(response, null, 2),
        },
      ],
    };
  } catch (error) {
    // Handle specific error cases
    if (error instanceof GlyphApiError) {
      if (error.code === "DEMO_TIER_LIMITATION") {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  error: error.message,
                  code: error.code,
                  suggestion: "Sign up for a free API key at https://glyph.you to persist templates",
                  alternative: `You can still generate a one-time PDF using glyph_generate with sessionId: "${args.sessionId}"`,
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }
    }
    return formatError(error);
  }
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
    // Saved Templates tools
    case "glyph_templates_list":
      return handleGlyphTemplatesList(
        args as Parameters<typeof handleGlyphTemplatesList>[0]
      );
    case "glyph_template_save":
      return handleGlyphTemplateSave(
        args as Parameters<typeof handleGlyphTemplateSave>[0]
      );
    case "glyph_template_get":
      return handleGlyphTemplateGet(
        args as Parameters<typeof handleGlyphTemplateGet>[0]
      );
    case "glyph_template_update":
      return handleGlyphTemplateUpdate(
        args as Parameters<typeof handleGlyphTemplateUpdate>[0]
      );
    case "glyph_template_delete":
      return handleGlyphTemplateDelete(
        args as Parameters<typeof handleGlyphTemplateDelete>[0]
      );
    // Data Source tools
    case "glyph_create_source":
      return handleGlyphCreateSource(
        args as Parameters<typeof handleGlyphCreateSource>[0]
      );
    case "glyph_list_sources":
      return handleGlyphListSources(
        args as Parameters<typeof handleGlyphListSources>[0]
      );
    case "glyph_generate_from_source":
      return handleGlyphGenerateFromSource(
        args as Parameters<typeof handleGlyphGenerateFromSource>[0]
      );
    case "glyph_suggest_mappings":
      return handleGlyphSuggestMappings(
        args as Parameters<typeof handleGlyphSuggestMappings>[0]
      );
    case "glyph_link_template":
      return handleGlyphLinkTemplate(
        args as Parameters<typeof handleGlyphLinkTemplate>[0]
      );
    // Data-First Workflow tools
    case "glyph_clone_template":
      return handleGlyphCloneTemplate(
        args as Parameters<typeof handleGlyphCloneTemplate>[0]
      );
    case "glyph_create_session_from_mapping":
      return handleGlyphCreateSessionFromMapping(
        args as Parameters<typeof handleGlyphCreateSessionFromMapping>[0]
      );
    case "glyph_save_template_from_session":
      return handleGlyphSaveTemplateFromSession(
        args as Parameters<typeof handleGlyphSaveTemplateFromSession>[0]
      );
    // Auto-Generate tools (One-Call Magic)
    case "glyph_auto_generate":
      return handleGlyphAutoGenerate(
        args as Parameters<typeof handleGlyphAutoGenerate>[0]
      );
    case "glyph_accept_preview":
      return handleGlyphAcceptPreview(
        args as Parameters<typeof handleGlyphAcceptPreview>[0]
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
