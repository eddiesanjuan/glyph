---
title: MCP Server
description: AI-native PDF generation for Claude Code, Cursor, Windsurf, and other AI coding assistants. 18 tools for document generation, template management, and data source integration.
---

The Glyph MCP (Model Context Protocol) server enables AI coding assistants to generate and customize PDFs using natural language. It exposes **18 tools** across four categories: document generation, discovery, saved templates, and data sources.

## What is MCP?

[Model Context Protocol](https://modelcontextprotocol.io) is an open standard created by Anthropic that lets AI assistants connect to external tools and data sources. Instead of copying code snippets or switching between apps, your AI assistant calls tools directly.

With the Glyph MCP server, you can say:

> "Create an invoice for Acme Corp, add a QR code for payment, and save it as invoice.pdf"

Your AI assistant handles the entire flow: creating the session, applying modifications, and generating the final PDF.

## Installation

### Claude Code

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "glyph": {
      "command": "npx",
      "args": ["@glyph-pdf/mcp-server"],
      "env": {
        "GLYPH_API_KEY": "your-api-key"
      }
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "glyph": {
      "command": "npx",
      "args": ["@glyph-pdf/mcp-server"],
      "env": {
        "GLYPH_API_KEY": "your-api-key"
      }
    }
  }
}
```

### Windsurf

Add to your Windsurf MCP configuration:

```json
{
  "mcpServers": {
    "glyph": {
      "command": "npx",
      "args": ["@glyph-pdf/mcp-server"],
      "env": {
        "GLYPH_API_KEY": "your-api-key"
      }
    }
  }
}
```

### Getting an API Key

1. Visit [glyph.you](https://glyph.you)
2. Sign up or log in
3. Navigate to the Dashboard
4. Create a new API key

All tools accept an optional `apiKey` parameter. If omitted, the `GLYPH_API_KEY` environment variable is used.

---

## Tools Overview

The MCP server exposes 18 tools organized into four categories:

| Category | Tools | Purpose |
|----------|-------|---------|
| **Document Generation** | `glyph_preview`, `glyph_modify`, `glyph_generate`, `glyph_create`, `glyph_analyze` | Create, modify, and export PDFs |
| **Discovery** | `glyph_schema`, `glyph_templates`, `glyph_suggest` | Explore templates and get recommendations |
| **Saved Templates** | `glyph_templates_list`, `glyph_template_save`, `glyph_template_get`, `glyph_template_update`, `glyph_template_delete` | Persist and manage reusable templates |
| **Data Sources** | `glyph_create_source`, `glyph_list_sources`, `glyph_generate_from_source`, `glyph_suggest_mappings`, `glyph_link_template` | Connect Airtable, REST APIs, and webhooks |

---

## Document Generation

### glyph_create

**The fastest path to a PDF.** Send any JSON data with an optional natural language intent, and Glyph auto-detects the document type, maps fields, and generates the output.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `data` | object | Yes | Your data in any structure |
| `intent` | string | No | Natural language description (e.g., "professional invoice", "Stripe-styled proposal") |
| `style` | string | No | Style preset: `stripe-clean`, `bold`, `minimal`, `corporate`, `quote-modern` (default) |
| `format` | string | No | Output format: `pdf` (default), `png`, `html` |
| `outputPath` | string | No | File path to save the output |

```typescript
glyph_create({
  data: {
    customer: { name: "Acme Corp", email: "billing@acme.com" },
    items: [
      { description: "API Integration", quantity: 1, price: 5000, total: 5000 },
      { description: "Support Plan", quantity: 12, price: 200, total: 2400 }
    ],
    subtotal: 7400,
    tax: 592,
    total: 7992
  },
  intent: "professional invoice with Stripe styling",
  style: "stripe-clean",
  outputPath: "./invoice-acme.pdf"
})
```

The AI automatically detects the document type from your data:

| Type | Detection Signals |
|------|-------------------|
| Invoice | `items`, `total`, `tax`, `dueDate`, `invoiceNumber` |
| Quote | `items`, `total`, `validUntil`, `quoteNumber` |
| Receipt | `items`, `paid`, `transactionId`, `paymentMethod` |
| Contract | `contract`, `agreement`, `terms`, `signature`, `parties` |
| Report | `summary`, `metrics`, `analysis`, `findings` |

### glyph_preview

Create a preview session from a template and data. Returns a `sessionId` used by all subsequent tools.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `data` | object | Yes | Data to render into the template |
| `template` | string | No | Template name or `"auto"` (default) to auto-detect |

```typescript
glyph_preview({
  template: "quote-modern",
  data: {
    client: { name: "John Doe", email: "john@example.com" },
    lineItems: [
      { description: "Website Design", quantity: 1, unitPrice: 3500, total: 3500 }
    ],
    totals: { subtotal: 3500, total: 3500 },
    meta: { quoteNumber: "Q-001", date: "January 15, 2025" },
    branding: { companyName: "Your Company" }
  }
})
// Returns: { sessionId: "abc123", html: "..." }
```

### glyph_modify

Modify a document using natural language. Chain multiple calls to build up changes.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `sessionId` | string | Yes | Session ID from `glyph_preview` or `glyph_create` |
| `instruction` | string | Yes | Natural language description of the change |
| `region` | string | No | Focus area: `header`, `footer`, `table`, etc. |

```typescript
// Add visual elements
glyph_modify({
  sessionId: "abc123",
  instruction: "Add a QR code for payment in the footer"
})

// Change styling
glyph_modify({
  sessionId: "abc123",
  instruction: "Make the header more prominent with a blue gradient",
  region: "header"
})

// Add content
glyph_modify({
  sessionId: "abc123",
  instruction: "Add a watermark that says DRAFT"
})

// Adjust layout
glyph_modify({
  sessionId: "abc123",
  instruction: "Make the line items table more compact"
})
```

### glyph_generate

Generate the final PDF or PNG from a session.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `sessionId` | string | Yes | Session ID |
| `format` | string | No | `pdf` (default) or `png` |
| `outputPath` | string | No | File path to save output. If omitted, returns base64 data URL. |
| `options` | object | No | `width`, `height` (pixels), `scale` (0.1-3) |

```typescript
glyph_generate({
  sessionId: "abc123",
  format: "pdf",
  outputPath: "./quote-john-doe.pdf"
})
// Returns: { savedTo: "./quote-john-doe.pdf", size: "45.2 KB" }
```

### glyph_analyze

Analyze a data structure without generating a PDF. Useful for debugging or previewing how Glyph interprets your data.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `data` | object | Yes | Data to analyze |
| `intent` | string | No | Optional intent to influence analysis |

```typescript
glyph_analyze({
  data: {
    customer: { name: "Jane Smith" },
    items: [{ description: "Consulting", hours: 40, rate: 150 }],
    total: 6000
  },
  intent: "invoice"
})
// Returns: {
//   documentType: "invoice",
//   confidence: "92%",
//   suggestedTemplate: "invoice-clean",
//   fieldMappings: [
//     { detected: "customer", mapsTo: "client", confidence: "95%" },
//     { detected: "items", mapsTo: "lineItems", confidence: "98%" }
//   ],
//   missingFields: [{ field: "invoiceNumber", reason: "Standard invoice identifier" }]
// }
```

---

## Discovery

### glyph_templates

List all available document templates and style presets.

```typescript
glyph_templates()
// Returns: { templates: [...], styles: [...] }
```

### glyph_schema

Get the data schema for a specific template, including field types, required fields, and examples.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `template` | string | Yes | Template name (e.g., `quote-modern`, `invoice-clean`) |

```typescript
glyph_schema({ template: "quote-modern" })
// Returns: { fields: [...], required: [...], example: {...} }
```

### glyph_suggest

Get AI-powered improvement suggestions for a document session. Analyzes design, content, and professional touches.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `sessionId` | string | Yes | Session ID |

```typescript
glyph_suggest({ sessionId: "abc123" })
// Returns suggestions like:
// - "Add a company logo to make the document more professional" (Branding, high)
// - "Add payment terms and conditions" (Legal, high)
// - "Add a QR code for quick mobile payment" (Modern, low)
```

---

## Saved Templates

Save templates for reuse without AI regeneration. Saved templates are faster, consistent, and versioned.

### glyph_templates_list

List all saved templates for your API key.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `type` | string | No | Filter by type: `invoice`, `quote`, `report`, `certificate`, `letter`, `receipt`, `contract`, `custom` |
| `limit` | number | No | Max results (default 50, max 100) |

```typescript
glyph_templates_list({ type: "invoice" })
// Returns: { templates: [{ id: "tmpl_xxx", name: "Invoice v1", type: "invoice", ... }], total: 3 }
```

### glyph_template_save

Save a template for reuse.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Template name |
| `html` | string | Yes | Full HTML with Mustache placeholders (e.g., `{{client.name}}`) |
| `type` | string | No | Template type for organization |
| `description` | string | No | Description |
| `style` | string | No | Style preset: `stripe-clean`, `professional`, `minimal`, `bold`, `classic`, `corporate`, `modern`, `vibrant` |
| `isDefault` | boolean | No | Make this the default for its type |

```typescript
glyph_template_save({
  name: "Invoice v2",
  html: "<html>...{{client.name}}...</html>",
  type: "invoice",
  style: "stripe-clean",
  isDefault: true
})
// Returns: { template: { id: "tmpl_xxx", name: "Invoice v2", version: 1 } }
```

### glyph_template_get

Retrieve a saved template by ID, including full HTML.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Template ID (UUID from `glyph_templates_list`) |

```typescript
glyph_template_get({ id: "tmpl_xxx" })
// Returns: { template: { id, name, html, type, schema, ... } }
```

### glyph_template_update

Update a saved template. Only include fields you want to change.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Template ID |
| `name` | string | No | New name |
| `html` | string | No | Updated HTML |
| `type` | string | No | Template type |
| `description` | string | No | Description |
| `style` | string | No | Style preset |
| `isDefault` | boolean | No | Set as default |

```typescript
glyph_template_update({
  id: "tmpl_xxx",
  html: "<html>...updated...</html>",
  isDefault: true
})
// Returns: { template: { id, name, version: 2, updatedAt: "..." } }
```

### glyph_template_delete

Permanently delete a saved template.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Template ID |

```typescript
glyph_template_delete({ id: "tmpl_xxx" })
// Returns: { deleted: true }
```

---

## Data Sources

Connect external data sources and generate PDFs directly from your data, without manually passing JSON.

### glyph_create_source

Connect a data source for PDF generation.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `type` | string | Yes | `airtable`, `rest_api`, or `webhook` |
| `name` | string | Yes | Human-readable name |
| `config` | object | Yes | Type-specific configuration (see below) |

**Airtable config:**
```typescript
glyph_create_source({
  type: "airtable",
  name: "Invoices Table",
  config: {
    apiKey: "pat...",
    baseId: "app...",
    tableName: "Invoices"
  }
})
```

**REST API config:**
```typescript
glyph_create_source({
  type: "rest_api",
  name: "Orders API",
  config: {
    url: "https://api.example.com/orders",
    headers: { "Authorization": "Bearer ..." }
  }
})
```

**Webhook config:**
```typescript
glyph_create_source({
  type: "webhook",
  name: "Order Webhook",
  config: {}
})
```

### glyph_list_sources

List all connected data sources.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `type` | string | No | Filter by source type: `airtable`, `rest_api`, `webhook` |

```typescript
glyph_list_sources({ type: "airtable" })
// Returns: { sources: [{ id: "src_xxx", type: "airtable", name: "Invoices Table", status: "active" }] }
```

### glyph_suggest_mappings

Get AI-powered field mapping suggestions between a template and data source.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `templateId` | string | Yes | Template ID |
| `sourceId` | string | Yes | Data source ID |

```typescript
glyph_suggest_mappings({
  templateId: "tmpl_xxx",
  sourceId: "src_xxx"
})
// Returns: {
//   suggestions: [
//     { templateField: "client.name", sourceField: "Customer Name", confidence: "95%", reason: "Semantic match" },
//     { templateField: "total", sourceField: "Invoice Total", confidence: "90%", reason: "Field name similarity" }
//   ],
//   unmappedTemplateFields: ["meta.terms"],
//   unmappedSourceFields: ["Internal Notes"]
// }
```

### glyph_link_template

Link a template to a data source with field mappings.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `templateId` | string | Yes | Template ID |
| `sourceId` | string | Yes | Data source ID |
| `fieldMappings` | object | Yes | Map of template placeholder to source field name |
| `isDefault` | boolean | No | Set as default source for this template |

```typescript
glyph_link_template({
  templateId: "tmpl_xxx",
  sourceId: "src_xxx",
  fieldMappings: {
    "client.name": "Customer Name",
    "client.email": "Email Address",
    "total": "Invoice Total"
  },
  isDefault: true
})
```

### glyph_generate_from_source

Generate PDFs from a saved template and connected data source.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `templateId` | string | Yes | Saved template ID |
| `sourceId` | string | No | Data source ID (uses default if omitted) |
| `recordId` | string | No | Specific record ID for single PDF |
| `filter` | object | No | `formula` (Airtable formula syntax) and `limit` for batch generation |
| `outputPath` | string | No | File path for single-record output |

```typescript
// Single record
glyph_generate_from_source({
  templateId: "tmpl_xxx",
  recordId: "rec_abc",
  outputPath: "./invoice-abc.pdf"
})

// Batch with filter
glyph_generate_from_source({
  templateId: "tmpl_xxx",
  filter: {
    formula: "AND({Status} = 'Pending', {Date} >= '2025-01-01')",
    limit: 50
  }
})
// Returns: { generated: [...], total: 12 }
```

---

## MCP Resources

The server exposes these read-only resources accessible via `resource://` URIs:

| Resource | Description |
|----------|-------------|
| `glyph://templates` | List of available templates |
| `glyph://schema/{templateId}` | Schema for a specific template |
| `glyph://session/{sessionId}/preview` | Current HTML preview of a session |
| `glyph://session/{sessionId}/data` | Original data passed to the session |
| `glyph://session/{sessionId}/info` | Session metadata (template, creation time) |

---

## Common Workflows

### Generate an invoice from scratch

```text
You: Create an invoice for Acme Corp. 3 line items: API integration ($5,000),
     custom dashboard ($3,000), training ($1,500). Due in 30 days.

AI:  [glyph_create] -> Detects invoice, generates PDF
     Saved to ./invoice-acme-corp.pdf (52 KB)
```

### Customize an existing template

```text
You: Use the quote-modern template for a proposal to Jane Smith.
     Make it look like Stripe's design. Add a QR code.

AI:  [glyph_preview]  -> Creates session with quote-modern template
     [glyph_modify]   -> "Apply Stripe-inspired clean design"
     [glyph_modify]   -> "Add a QR code for payment in the footer"
     [glyph_generate] -> Exports final PDF
```

### Connect Airtable and generate PDFs

```text
You: Connect my Airtable invoices table and generate PDFs for all
     pending invoices this month.

AI:  [glyph_create_source]        -> Connects Airtable
     [glyph_templates_list]       -> Finds your saved invoice template
     [glyph_suggest_mappings]     -> Gets field mapping suggestions
     [glyph_link_template]        -> Links template to source
     [glyph_generate_from_source] -> Generates PDFs for matching records
     Generated 12 PDFs from 12 records.
```

### Save and reuse a template

```text
You: Save this template as "Invoice v2" so I can reuse it.

AI:  [glyph_template_save] -> Saves with name "Invoice v2", type "invoice"
     Template saved with ID tmpl_xxx. Use it with glyph_create or
     glyph_generate_from_source for instant PDF generation.
```

---

## Troubleshooting

### "API key not found"

Make sure `GLYPH_API_KEY` is set in your MCP configuration's `env` block, or pass `apiKey` directly to each tool call.

### "Template not found"

Use `glyph_templates()` to list available templates, or use `"auto"` for automatic template detection.

### "Session not found"

Sessions expire after 1 hour. Create a new session with `glyph_preview` or `glyph_create`.

### Connection issues

Verify your internet connection and that `api.glyph.you` is accessible:

```bash
curl https://api.glyph.you/health
```

---

## Next Steps

- Explore [Templates](/templates/overview/) to see available document types
- Read the [API Reference](/api/overview/) for building custom integrations
- Set up [Airtable integration](/integrations/airtable/) for data-driven PDF generation
- Check out [Examples](/examples/quoted/) for real-world usage patterns
