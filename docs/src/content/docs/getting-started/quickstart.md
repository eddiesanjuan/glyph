---
title: Quick Start
description: Get your first PDF generated in under 5 minutes
---

This guide will walk you through creating your first AI-powered, customizable PDF document with Glyph. By the end, you'll have a working quote generator that your users can edit with natural language.

## Prerequisites

- A Glyph API key ([get one free](https://glyph.you/dashboard))
- A web page where you want to embed the editor

## Option 1: Data-First API (Recommended)

The fastest way to generate PDFs - just send your data:

```bash
curl -X POST https://api.glyph.you/v1/analyze/preview/auto \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "data": {
      "customer": { "name": "John Doe" },
      "items": [{ "description": "Widget", "quantity": 1, "price": 99, "total": 99 }],
      "subtotal": 99,
      "tax": 7.92,
      "total": 106.92
    }
  }'
```

Glyph automatically:
- Detects this is an invoice (from `items`, `total`, `tax` fields)
- Maps your fields to the template schema
- Generates a professional layout
- Returns a session ID for modifications

**No template selection. No field mapping. Just data in, PDF out.**

Then generate the final PDF:

```bash
curl -X POST https://api.glyph.you/v1/generate \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"sessionId": "YOUR_SESSION_ID", "format": "pdf"}'
```

Learn more: [Data-First API Reference](/api/overview/)

---

## Option 2: Web Component (Interactive Editor)

### Step 1: Add the Script

Add the Glyph SDK to your HTML page:

```html
<script src="https://sdk.glyph.you/glyph.min.js"></script>
```

This loads the `<glyph-editor>` web component and makes it available for use.

### Step 2: Add the Editor Component

Place the `<glyph-editor>` component where you want the document editor to appear:

```html
<glyph-editor
  api-key="gk_your_key_here"
  template="quote-modern"
  data='{"client": {"name": "John Smith"}, "lineItems": [{"description": "Consulting", "quantity": 10, "unitPrice": 150, "total": 1500}], "totals": {"subtotal": 1500, "total": 1500}}'
></glyph-editor>
```

### Step 3: See It in Action

That's it! Your users can now:

1. **View the preview** - See the rendered quote with their data
2. **Click to select** - Click on any region (header, line items, totals) to select it
3. **Edit with AI** - Type commands like "Make the header navy blue" or "Add a discount row"
4. **Download PDF** - Click the Download button to get a print-ready PDF

### Complete Example

Here's a complete HTML page you can copy and use:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Quote Generator</title>
  <script src="https://sdk.glyph.you/glyph.min.js"></script>
  <style>
    body {
      font-family: system-ui, sans-serif;
      max-width: 900px;
      margin: 0 auto;
      padding: 2rem;
      background: #f5f5f5;
    }
    h1 {
      color: #1e3a5f;
      margin-bottom: 1.5rem;
    }
    glyph-editor {
      height: 600px;
    }
  </style>
</head>
<body>
  <h1>Generate Your Quote</h1>

  <glyph-editor
    api-key="gk_your_key_here"
    template="quote-modern"
    data='{
      "client": {
        "name": "John Smith",
        "company": "Acme Corporation",
        "email": "john@acme.com"
      },
      "lineItems": [
        {
          "description": "Website Design",
          "quantity": 1,
          "unitPrice": 3500,
          "total": 3500
        },
        {
          "description": "Development Hours",
          "quantity": 40,
          "unitPrice": 150,
          "total": 6000
        }
      ],
      "totals": {
        "subtotal": 9500,
        "total": 9500
      },
      "meta": {
        "quoteNumber": "Q-2024-001",
        "date": "January 15, 2024",
        "validUntil": "February 15, 2024"
      },
      "branding": {
        "companyName": "Your Company",
        "companyAddress": "123 Main St, City, ST 12345"
      }
    }'
  ></glyph-editor>

  <script>
    // Listen for events
    document.querySelector('glyph-editor').addEventListener('glyph:ready', (e) => {
      console.log('Editor ready!', e.detail);
    });

    document.querySelector('glyph-editor').addEventListener('glyph:modified', (e) => {
      console.log('Document modified:', e.detail.changes);
    });
  </script>
</body>
</html>
```

## What's Next?

- [Data-First API](/api/overview/) - Generate PDFs from any data structure
- [Installation Options](/getting-started/installation/) - npm, CDN, and direct integration
- [API Reference](/api/overview/) - Building custom integrations
- [MCP Server](/integrations/mcp-server/) - Use with AI coding assistants
- [Templates](/templates/overview/) - Available document templates
- [Examples](/examples/quoted/) - Real-world integration patterns
