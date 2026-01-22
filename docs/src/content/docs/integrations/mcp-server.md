---
title: MCP Server
description: AI-native PDF generation for Claude Code, Cursor, Windsurf, and other AI coding assistants
---

The Glyph MCP (Model Context Protocol) server enables AI coding assistants to generate and customize PDFs using natural language. Just describe what you want, and your AI assistant handles the implementation.

## Why MCP?

MCP is an open protocol that lets AI assistants like Claude Code, Cursor, and Windsurf access external tools directly. With the Glyph MCP server:

- **Conversational PDF generation** - Ask your AI to "create an invoice for client X" and get a professional PDF
- **Natural language customization** - "Add a QR code for payment" or "Make the header more prominent"
- **Zero context switching** - Generate and modify PDFs without leaving your editor
- **AI-powered suggestions** - Get recommendations for improving your documents

## Quick Start

Tell your AI assistant:

> "Create a quote for John Doe for website design services, $3500. Add a QR code for payment and make it look professional."

Your AI will use the Glyph tools to create the preview, apply modifications, and generate the final PDF.

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

Add to your MCP configuration:

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

## Getting an API Key

1. Visit [glyph.you](https://glyph.you)
2. Sign up or log in
3. Navigate to the Dashboard
4. Create a new API key

## Available Tools

The MCP server exposes six tools that your AI assistant can use:

### glyph_preview

Create a PDF preview session with your data.

```typescript
glyph_preview({
  template: "auto", // or "quote-modern", "quote-professional", etc.
  data: {
    client: { name: "John Doe", email: "john@example.com" },
    lineItems: [
      { description: "Website Design", quantity: 1, unitPrice: 3500, total: 3500 }
    ],
    totals: { subtotal: 3500, total: 3500 },
    meta: { quoteNumber: "Q-001", date: "January 15, 2024" },
    branding: { companyName: "Your Company" }
  }
})
// Returns: { sessionId: "xxx", html: "..." }
```

### glyph_modify

Modify a document using natural language.

```typescript
// Add visual elements
glyph_modify({
  sessionId: "xxx",
  instruction: "Add a QR code for payment in the footer"
})

// Change styling
glyph_modify({
  sessionId: "xxx",
  instruction: "Make the header more prominent with a blue gradient"
})

// Add watermarks
glyph_modify({
  sessionId: "xxx",
  instruction: "Add a watermark that says DRAFT"
})
```

### glyph_generate

Generate the final PDF file.

```typescript
glyph_generate({
  sessionId: "xxx",
  format: "pdf", // or "png"
  outputPath: "./invoice.pdf" // optional - saves to file
})
```

### glyph_templates

List available document templates.

```typescript
glyph_templates()
// Returns: { templates: [...], styles: [...] }
```

### glyph_schema

Get the data schema for a template.

```typescript
glyph_schema({ template: "quote-modern" })
// Returns: { fields: [...], required: [...], example: {...} }
```

### glyph_suggest

Get AI-powered suggestions for improving your document.

```typescript
glyph_suggest({ sessionId: "xxx" })
// Returns: { suggestions: [...] }
```

## MCP Resources

The MCP server also exposes these resources for direct access:

| Resource | Description |
|----------|-------------|
| `glyph://templates` | List of available templates |
| `glyph://schema/{templateId}` | Schema for a specific template |
| `glyph://session/{sessionId}/preview` | Current HTML preview |
| `glyph://session/{sessionId}/data` | Original data |
| `glyph://session/{sessionId}/info` | Session metadata |

## Example Workflow

Here's a typical conversation with your AI assistant:

```
You: Create a quote for John Doe for website design services, $3500

AI: [Uses glyph_preview to create the document]
    Created preview with session ID xxx

You: Add a QR code for payment and make it look more professional

AI: [Uses glyph_modify with "Add a QR code for payment in the footer"]
    [Uses glyph_modify with "Make the design more professional with subtle shadows"]
    Applied modifications successfully

You: Generate the PDF

AI: [Uses glyph_generate to create final PDF]
    PDF saved to ./quote-john-doe.pdf (45.2 KB)
```

## Use Cases

### Invoices & Quotes
- Generate invoices from order data
- Create quotes with line items and totals
- Add company branding and terms

### Contracts & Agreements
- Generate contracts from templates
- Add signature lines
- Include terms and conditions

### Reports & Summaries
- Create data reports
- Generate executive summaries
- Build dashboards as PDFs

## Troubleshooting

### "API key not found"

Make sure your `GLYPH_API_KEY` environment variable is set in the MCP configuration.

### "Template not found"

Use `glyph_templates()` to list available templates, or use `"auto"` for automatic template detection.

### Connection issues

Verify your internet connection and that `api.glyph.you` is accessible.

## Next Steps

- Explore [Templates](/templates/overview/) to see available document types
- Learn about [API Reference](/api/overview/) for building custom integrations
- Check out [Examples](/examples/quoted/) for real-world usage patterns
