---
title: POST /v1/generate
description: Generate PDF or PNG from a document
---

import { Aside } from '@astrojs/starlight/components';

<span class="endpoint-badge post">POST</span> `/v1/generate`

Generates a PDF or PNG file from HTML content. This endpoint uses Playwright to render the document with full CSS support.

<Aside type="note">
This endpoint counts against your monthly PDF generation limit. See [Rate Limits](/api/rate-limits/) for tier-specific limits.
</Aside>

## Request

### Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | `Bearer gk_your_api_key` |
| `Content-Type` | Yes | `application/json` |
| `Accept` | No | `application/json` for metadata, omit for raw file |

### Body

```json
{
  "html": "<!DOCTYPE html><html>...</html>",
  "format": "pdf",
  "options": {
    "width": 816,
    "height": 1056,
    "scale": 1
  }
}
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `html` | string | Yes | HTML content to render |
| `format` | string | Yes | Output format: `"pdf"` or `"png"` |
| `options` | object | No | Rendering options |
| `options.width` | number | No | Page width in pixels (default: 816 = 8.5in @ 96dpi) |
| `options.height` | number | No | Page height in pixels (default: 1056 = 11in @ 96dpi) |
| `options.scale` | number | No | Scale factor (0.1 to 3, default: 1) |

## Response

### Raw File Response (Default)

When no `Accept: application/json` header is provided, the response is the raw file:

**Headers:**
```http
Content-Type: application/pdf
Content-Disposition: attachment; filename="document-1705320000000.pdf"
Content-Length: 45678
```

**Body:** Binary PDF/PNG data

### JSON Response

When `Accept: application/json` is provided:

```json
{
  "url": "data:application/pdf;base64,JVBERi0xLjQK...",
  "format": "pdf",
  "size": 45678,
  "expiresAt": "2024-01-16T12:00:00.000Z"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `url` | string | Base64 data URL of the generated file |
| `format` | string | Output format (`pdf` or `png`) |
| `size` | number | File size in bytes |
| `expiresAt` | string | Expiration timestamp (24 hours) |

### Error Responses

**400 Bad Request** - Invalid parameters

```json
{
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": [
    {
      "path": ["format"],
      "message": "Invalid enum value. Expected 'pdf' | 'png'"
    }
  ]
}
```

**429 Too Many Requests** - Monthly limit exceeded

```json
{
  "error": "Monthly PDF limit exceeded",
  "code": "MONTHLY_LIMIT_EXCEEDED",
  "limit": 100,
  "used": 100,
  "tier": "free",
  "upgrade": "https://glyph.you/pricing"
}
```

**503 Service Unavailable** - Playwright not available

```json
{
  "error": "PDF generation not available. Playwright is not installed.",
  "code": "PLAYWRIGHT_NOT_INSTALLED",
  "details": {
    "install": "bun add playwright && npx playwright install chromium"
  }
}
```

## Code Examples

### cURL (Download PDF)

```bash
curl -X POST https://api.glyph.you/v1/generate \
  -H "Authorization: Bearer gk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "html": "<!DOCTYPE html><html><body><h1>Hello World</h1></body></html>",
    "format": "pdf"
  }' \
  --output document.pdf
```

### cURL (Get JSON metadata)

```bash
curl -X POST https://api.glyph.you/v1/generate \
  -H "Authorization: Bearer gk_your_api_key" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "html": "<!DOCTYPE html><html><body><h1>Hello World</h1></body></html>",
    "format": "pdf"
  }'
```

### JavaScript (Browser Download)

```javascript
const response = await fetch('https://api.glyph.you/v1/generate', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer gk_your_api_key',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    html: document.querySelector('glyph-editor').getHtml(),
    format: 'pdf'
  })
});

// Create download link
const blob = await response.blob();
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'quote.pdf';
a.click();
URL.revokeObjectURL(url);
```

### JavaScript (Node.js - Save to File)

```javascript
import { writeFileSync } from 'fs';

const response = await fetch('https://api.glyph.you/v1/generate', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer gk_your_api_key',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    html: htmlContent,
    format: 'pdf'
  })
});

const buffer = Buffer.from(await response.arrayBuffer());
writeFileSync('document.pdf', buffer);
```

### Python

```python
import requests

response = requests.post(
    'https://api.glyph.you/v1/generate',
    headers={
        'Authorization': 'Bearer gk_your_api_key',
        'Content-Type': 'application/json'
    },
    json={
        'html': html_content,
        'format': 'pdf'
    }
)

# Save to file
with open('document.pdf', 'wb') as f:
    f.write(response.content)
```

## Page Sizes

Common page sizes in pixels (at 96 DPI):

| Size | Width | Height |
|------|-------|--------|
| Letter (8.5" x 11") | 816 | 1056 |
| A4 (210mm x 297mm) | 794 | 1123 |
| Legal (8.5" x 14") | 816 | 1344 |
| Tabloid (11" x 17") | 1056 | 1632 |

### Custom Sizes

```json
{
  "html": "...",
  "format": "pdf",
  "options": {
    "width": 794,
    "height": 1123
  }
}
```

## PNG Generation

For image output:

```json
{
  "html": "...",
  "format": "png",
  "options": {
    "scale": 2
  }
}
```

<Aside type="tip">
Use `scale: 2` for retina/high-DPI displays. The output will be 2x the specified dimensions.
</Aside>

## Best Practices

1. **Use session-based workflow** - Generate from a session to ensure you have the latest modifications
2. **Handle large files** - PDFs can be several MB; use streaming for large documents
3. **Cache when possible** - Store generated PDFs to avoid regenerating unchanged documents
4. **Monitor usage** - Check your monthly limit headers to avoid interruptions
