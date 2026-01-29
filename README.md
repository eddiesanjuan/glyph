# Glyph - AI-Powered PDF Generation API

Generate professional PDFs from JSON data, raw HTML, or any URL with a single API call. Glyph is a PDF API for developers that handles layout, styling, and document intelligence automatically.

## Quick Start

```bash
curl -X POST https://api.glyph.you/v1/create \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"templateId": "invoice-clean", "data": {"company": {"name": "Acme Inc"}, "customer": {"name": "Jane Doe"}, "items": [{"description": "Consulting", "total": 1500}], "total": 1500}}'
```

One call. Data in, PDF out.

## Features

- **One API call** -- send data, get a PDF URL back. No sessions, no multi-step workflows.
- **11 professional templates** -- invoice, contract, proposal, certificate, receipt, report, letter, shipping label, and more.
- **Three input paths** -- structured JSON data with templates, raw HTML strings, or any URL captured as PDF.
- **AI document intelligence** -- auto-detects document type, chooses layout, applies professional styling.
- **Natural language customization** -- modify any generated document by describing changes in plain English.
- **MCP server** -- integrate with Claude Code, Cursor, Windsurf, and other AI coding assistants.
- **Node.js SDK and Python SDK** -- first-class support for the two most common backend languages.
- **Agent framework integrations** -- works with OpenAI Agents, Anthropic tool use, LangChain, Vercel AI SDK.

## Installation

### Node.js

```bash
npm install @glyph-pdf/sdk
```

```javascript
import { Glyph } from '@glyph-pdf/sdk';

const glyph = new Glyph({ apiKey: 'gk_your_api_key' });

const pdf = await glyph.create({
  templateId: 'invoice-clean',
  data: {
    company: { name: 'Acme Inc', email: 'billing@acme.com' },
    customer: { name: 'Jane Doe', email: 'jane@example.com' },
    items: [
      { description: 'Consulting', hours: 10, rate: 150, total: 1500 },
      { description: 'Development', hours: 20, rate: 125, total: 2500 }
    ],
    subtotal: 4000,
    tax: 320,
    total: 4320,
    invoiceNumber: 'INV-2026-001'
  }
});

console.log(pdf.url);     // hosted PDF URL
console.log(pdf.size);    // file size in bytes
```

### Python

```bash
pip install glyph-pdf
```

```python
from glyph_pdf import Glyph

glyph = Glyph(api_key="gk_your_api_key")

pdf = glyph.create(
    template_id="invoice-clean",
    data={
        "company": {"name": "Acme Inc", "email": "billing@acme.com"},
        "customer": {"name": "Jane Doe", "email": "jane@example.com"},
        "items": [
            {"description": "Consulting", "hours": 10, "rate": 150, "total": 1500}
        ],
        "subtotal": 1500,
        "tax": 120,
        "total": 1620,
    },
)

print(pdf.url)
```

## Usage

### Generate PDF from Data + Template

```bash
curl -X POST https://api.glyph.you/v1/create \
  -H "Authorization: Bearer gk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "invoice-clean",
    "data": {
      "company": { "name": "Acme Inc" },
      "customer": { "name": "Jane Doe" },
      "items": [{ "description": "Consulting", "total": 1500 }],
      "total": 1500
    }
  }' --output invoice.pdf
```

### Generate PDF from Raw HTML

```bash
curl -X POST https://api.glyph.you/v1/create \
  -H "Authorization: Bearer gk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "html": "<html><body><h1>Hello World</h1><p>Generated with Glyph.</p></body></html>"
  }' --output output.pdf
```

### Capture Any URL as PDF

```bash
curl -X POST https://api.glyph.you/v1/create \
  -H "Authorization: Bearer gk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/report"
  }' --output capture.pdf
```

### Auto-Detect Document Type (No Template)

Send raw JSON and Glyph figures out the document type automatically:

```bash
curl -X POST https://api.glyph.you/v1/create \
  -H "Authorization: Bearer gk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "company": { "name": "Acme Inc" },
      "customer": { "name": "Jane Doe" },
      "items": [{ "description": "Widget", "quantity": 5, "price": 99, "total": 495 }],
      "total": 495,
      "invoiceNumber": "INV-001"
    },
    "intent": "professional invoice"
  }'
```

## Templates

Built-in templates for common document types:

| Template | ID | Use Case |
|----------|----|----------|
| Invoice | `invoice-clean` | Billing, accounts receivable |
| Contract | `contract-simple` | Agreements, terms of service |
| Proposal | `proposal-basic` | Sales proposals, project bids |
| Certificate | `certificate-modern` | Awards, completion certificates |
| Receipt | `receipt-minimal` | Purchase receipts, payment confirmations |
| Report | `report-cover` | Cover pages, executive summaries |
| Letter | `letter-business` | Business correspondence |
| Shipping Label | `shipping-label` | Logistics, fulfillment |
| Quote (Modern) | `quote-modern` | Price quotes, estimates |
| Quote (Bold) | `quote-bold` | Price quotes with bold styling |
| Quote (Professional) | `quote-professional` | Formal price quotes |

Browse all templates and their schemas: [docs.glyph.you/templates/overview](https://docs.glyph.you/templates/overview/)

## AI Agent Integration

### MCP Server

Glyph provides an MCP (Model Context Protocol) server for direct integration with AI coding assistants like Claude Code, Cursor, and Windsurf.

```json
{
  "mcpServers": {
    "glyph": {
      "command": "npx",
      "args": ["@glyph-pdf/mcp-server"],
      "env": {
        "GLYPH_API_KEY": "gk_your_api_key"
      }
    }
  }
}
```

### Agent Frameworks

Glyph works with popular AI agent frameworks:

- **OpenAI Agents** -- tool definition for PDF generation
- **Anthropic Tool Use** -- native function calling support
- **LangChain** -- custom tool wrapper
- **Vercel AI SDK** -- server action integration

See the [agent integration docs](https://docs.glyph.you/integrations/mcp-server/) for setup instructions and examples.

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/create` | POST | One-call PDF generation from data, HTML, or URL |
| `/v1/create/analyze` | POST | Analyze data structure without generating |
| `/v1/preview` | POST | Create interactive editing session |
| `/v1/modify` | POST | AI-powered document modifications |
| `/v1/generate` | POST | Export session to PDF/PNG |
| `/v1/templates` | GET | List available templates |
| `/health` | GET | Service health check |

Full API documentation: [docs.glyph.you](https://docs.glyph.you)

## Documentation

- [Quick Start Guide](https://docs.glyph.you/guides/quickstart/)
- [API Reference](https://docs.glyph.you/api/create/)
- [Template Catalog](https://docs.glyph.you/templates/overview/)
- [MCP Server Setup](https://docs.glyph.you/integrations/mcp-server/)
- [Airtable Integration](https://docs.glyph.you/integrations/airtable/)

## License

MIT
