# @glyph-pdf/mcp-server

AI-native PDF generation for Claude Code, Cursor, Windsurf, and other AI coding tools.

Generate and customize professional PDFs using natural language. Describe what you want, and let AI handle the implementation.

## Features

- **Natural Language PDF Customization** - "Add a QR code for payment", "Make the header more prominent"
- **Smart Template Detection** - Auto-detects the best template from your data structure
- **AI Suggestions** - Get recommendations for improving your documents
- **Session-Based Workflow** - Create a preview, make modifications, generate final PDF

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

Add to `.cursor/mcp.json`:

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

1. Visit [glyph.so](https://glyph.so)
2. Sign up or log in
3. Navigate to Settings > API Keys
4. Create a new API key

## Available Tools

### `glyph_preview`

Create a PDF preview session with your data.

```typescript
// Example usage
glyph_preview({
  template: "auto", // or "quote-modern", "invoice", etc.
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

### `glyph_modify`

Modify a document using natural language.

```typescript
// Examples
glyph_modify({
  sessionId: "xxx",
  instruction: "Add a QR code for payment in the footer"
})

glyph_modify({
  sessionId: "xxx",
  instruction: "Make the header more prominent with a blue gradient"
})

glyph_modify({
  sessionId: "xxx",
  instruction: "Add a watermark that says DRAFT"
})
```

### `glyph_generate`

Generate the final PDF file.

```typescript
glyph_generate({
  sessionId: "xxx",
  format: "pdf", // or "png"
  outputPath: "./invoice.pdf" // optional - saves to file
})
```

### `glyph_templates`

List available document templates.

```typescript
glyph_templates()
// Returns: { templates: [...], styles: [...] }
```

### `glyph_schema`

Get the data schema for a template.

```typescript
glyph_schema({ template: "quote-modern" })
// Returns: { fields: [...], required: [...], example: {...} }
```

### `glyph_suggest`

Get AI-powered suggestions for improving your document.

```typescript
glyph_suggest({ sessionId: "xxx" })
// Returns: { suggestions: [...] }
```

## Resources

The MCP server exposes these resources:

- `glyph://templates` - List of available templates
- `glyph://schema/{templateId}` - Schema for a specific template
- `glyph://session/{sessionId}/preview` - Current HTML preview
- `glyph://session/{sessionId}/data` - Original data
- `glyph://session/{sessionId}/info` - Session metadata

## Example Workflow

```
User: Create a quote for John Doe for website design services, $3500

AI: [Uses glyph_preview to create the document]
    Created preview with session ID xxx

User: Add a QR code for payment and make it look more professional

AI: [Uses glyph_modify with "Add a QR code for payment in the footer"]
    [Uses glyph_modify with "Make the design more professional with subtle shadows"]
    Applied modifications successfully

User: Generate the PDF

AI: [Uses glyph_generate to create final PDF]
    PDF saved to ./quote-john-doe.pdf (45.2 KB)
```

## Typical Use Cases

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

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GLYPH_API_KEY` | Your Glyph API key | Yes (or pass in each tool call) |

## Development

```bash
# Clone the repository
git clone https://github.com/glyph-pdf/mcp-server

# Install dependencies
npm install

# Build
npm run build

# Run locally
GLYPH_API_KEY=your-key node dist/index.js
```

## API Reference

This MCP server communicates with the Glyph API at `https://api.glyph.you`.

Full API documentation: [docs.glyph.you](https://docs.glyph.you)

## Support

- Documentation: [docs.glyph.you](https://docs.glyph.you)
- Issues: [GitHub Issues](https://github.com/glyph-pdf/mcp-server/issues)
- Email: support@glyph.so

## License

MIT
