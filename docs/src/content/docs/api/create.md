---
title: POST /v1/analyze/preview/auto - Data-First PDF Generation
description: Generate professional PDFs from raw data with automatic type detection
---

import { Aside } from '@astrojs/starlight/components';

<span class="endpoint-badge post">POST</span> `/v1/analyze/preview/auto`

Generate professional PDFs from raw data with natural language intent. No templates required - Glyph automatically detects your document type and creates a beautiful layout.

**One API call. Beautiful PDF.**

## Overview

The Data-First approach is the simplest way to generate PDFs with Glyph:

1. Send your data in any JSON structure
2. Glyph analyzes and detects the document type
3. Fields are automatically mapped to the best template
4. A professional PDF preview is generated

No template selection. No field mapping. Just data in, PDF out.

## Request

### Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | `Bearer gk_your_api_key` |
| `Content-Type` | Yes | `application/json` |

### Body

```json
{
  "data": {
    "company": { "name": "Acme Inc", "email": "hello@acme.com" },
    "customer": { "name": "John Doe", "email": "john@example.com" },
    "items": [
      { "description": "Consulting", "hours": 10, "rate": 150, "total": 1500 }
    ],
    "subtotal": 1500,
    "tax": 120,
    "total": 1620
  },
  "template": "auto"
}
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `data` | object | Yes | Your data in any JSON structure |
| `template` | string | No | Override detected template. Use `"auto"` for detection (default) |

## Response

### Success (200)

```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "html": "<!DOCTYPE html><html>...</html>",
  "analysis": {
    "documentType": "invoice",
    "confidence": 0.95,
    "template": "quote-modern",
    "fieldMappings": [
      { "source": "customer.name", "target": "client.name", "mapped": true },
      { "source": "items", "target": "lineItems", "mapped": true },
      { "source": "total", "target": "totals.total", "mapped": true }
    ],
    "missingFields": [],
    "warnings": []
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `sessionId` | string | Session ID for modifications and PDF generation |
| `html` | string | Rendered HTML preview |
| `analysis` | object | How Glyph interpreted your data |
| `analysis.documentType` | string | Detected document type |
| `analysis.confidence` | number | Detection confidence (0-1) |
| `analysis.template` | string | Template used for rendering |
| `analysis.fieldMappings` | array | How your fields were mapped |

<Aside type="tip">
Use the `sessionId` with `/v1/modify` to make AI-powered changes, then `/v1/generate` to create the final PDF.
</Aside>

## How It Works

1. **Data Analysis**: AI examines your data structure to detect document type (invoice, quote, receipt, report, etc.)
2. **Field Identification**: Semantic roles are assigned (header, line items, totals, metadata)
3. **Template Selection**: The best-matching template is chosen automatically
4. **Layout Generation**: Professional HTML is generated with proper formatting
5. **Session Creation**: A session is created for further modifications

## Detected Document Types

| Type | Detection Signals |
|------|-------------------|
| `invoice` | lineItems + totals + dueDate, invoiceNumber |
| `quote` | lineItems + totals + validUntil, quoteNumber |
| `receipt` | items + paid, transactionId, paymentMethod |
| `report` | summary, metrics, analysis, findings |
| `certificate` | awarded, completion, certifiedTo |
| `letter` | recipient, sender, body, salutation |

## Example: Invoice

### cURL

```bash
curl -X POST https://api.glyph.you/v1/analyze/preview/auto \
  -H "Authorization: Bearer gk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "company": { "name": "Acme Inc", "email": "billing@acme.com" },
      "customer": { "name": "John Doe", "email": "john@example.com" },
      "items": [
        { "description": "Consulting", "hours": 10, "rate": 150, "total": 1500 },
        { "description": "Development", "hours": 20, "rate": 125, "total": 2500 }
      ],
      "subtotal": 4000,
      "tax": 320,
      "total": 4320,
      "invoiceNumber": "INV-2024-001",
      "date": "2024-01-15",
      "dueDate": "2024-02-15"
    }
  }'
```

### JavaScript

```javascript
const response = await fetch('https://api.glyph.you/v1/analyze/preview/auto', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer gk_your_api_key',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    data: {
      company: { name: 'Acme Inc' },
      customer: { name: 'John Doe' },
      items: [
        { description: 'Consulting', hours: 10, rate: 150, total: 1500 }
      ],
      subtotal: 1500,
      tax: 120,
      total: 1620
    }
  })
});

const { sessionId, html, analysis } = await response.json();
console.log(`Detected: ${analysis.documentType} (${analysis.confidence * 100}% confidence)`);
console.log(`Session ID: ${sessionId}`);
```

### Python

```python
import requests

response = requests.post(
    'https://api.glyph.you/v1/analyze/preview/auto',
    headers={
        'Authorization': 'Bearer gk_your_api_key',
        'Content-Type': 'application/json'
    },
    json={
        'data': {
            'company': {'name': 'Acme Inc'},
            'customer': {'name': 'John Doe'},
            'items': [
                {'description': 'Consulting', 'hours': 10, 'rate': 150, 'total': 1500}
            ],
            'subtotal': 1500,
            'tax': 120,
            'total': 1620
        }
    }
)

data = response.json()
print(f"Detected: {data['analysis']['documentType']}")
print(f"Session ID: {data['sessionId']}")
```

## Analysis-Only Endpoint

To see how Glyph would interpret your data without generating a preview:

<span class="endpoint-badge post">POST</span> `/v1/analyze`

```bash
curl -X POST https://api.glyph.you/v1/analyze \
  -H "Authorization: Bearer gk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "data": { "items": [{"name": "Widget", "price": 99}], "total": 99 }
  }'
```

Response:

```json
{
  "documentType": "receipt",
  "confidence": 0.8,
  "suggestedTemplate": "quote-modern",
  "fieldMappings": [
    { "source": "items", "target": "lineItems", "example": [...], "confidence": 0.9, "required": true }
  ],
  "missingFields": [
    { "field": "client.name", "reason": "No customer/client name detected" }
  ],
  "warnings": ["Consider adding a document number for tracking"]
}
```

## Field Mappings Reference

Glyph automatically maps common field names to template fields:

<span class="endpoint-badge get">GET</span> `/v1/analyze/mappings`

```bash
curl https://api.glyph.you/v1/analyze/mappings \
  -H "Authorization: Bearer gk_your_api_key"
```

Returns a comprehensive reference of field name variations that Glyph recognizes.

## Tips for Best Results

- **Use descriptive field names**: Names like `customer`, `total`, `items` are recognized automatically
- **Include line items as arrays**: Use arrays for products, services, or items
- **Add context fields**: Include `invoiceNumber`, `date`, `dueDate` to improve detection
- **Use ISO dates**: Dates in ISO format (`2024-01-15`) or human-readable strings work well
- **The more structure, the better**: Nested objects with clear naming improve accuracy

## Complete Workflow

```javascript
// 1. Create preview with auto-detection
const preview = await fetch('https://api.glyph.you/v1/analyze/preview/auto', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer gk_xxx', 'Content-Type': 'application/json' },
  body: JSON.stringify({ data: invoiceData })
}).then(r => r.json());

console.log(`Detected: ${preview.analysis.documentType}`);

// 2. Optionally modify with AI
await fetch('https://api.glyph.you/v1/modify', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer gk_xxx', 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: preview.sessionId,
    instruction: 'Add a professional watermark that says DRAFT'
  })
});

// 3. Generate final PDF
const pdf = await fetch('https://api.glyph.you/v1/generate', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer gk_xxx', 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: preview.sessionId,
    format: 'pdf'
  })
}).then(r => r.json());

console.log(`PDF generated: ${pdf.size} bytes`);
```

## Error Responses

**400 Bad Request** - Validation failed

```json
{
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": [{ "path": ["data"], "message": "Required" }]
}
```

**401 Unauthorized** - Invalid API key

```json
{
  "error": "Invalid API key",
  "code": "AUTH_ERROR"
}
```

**500 Internal Server Error** - Processing error

```json
{
  "error": "Analysis failed",
  "code": "ANALYZE_ERROR"
}
```

## Next Steps

- [POST /v1/modify](/api/modify/) - Make AI-powered changes to your document
- [POST /v1/generate](/api/generate/) - Generate the final PDF
- [MCP Server](/integrations/mcp-server/) - Use with AI coding assistants
