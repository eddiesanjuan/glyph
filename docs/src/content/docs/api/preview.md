---
title: POST /v1/preview
description: Generate an HTML preview from template and data
---

import { Aside } from '@astrojs/starlight/components';

<span class="endpoint-badge post">POST</span> `/v1/preview`

Renders a template with your data and returns the HTML preview along with a session ID for subsequent modifications.

## Request

### Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | `Bearer gk_your_api_key` |
| `Content-Type` | Yes | `application/json` |

### Body

```json
{
  "template": "quote-modern",
  "data": {
    "client": {
      "name": "John Smith",
      "company": "Acme Corp",
      "email": "john@acme.com",
      "address": "123 Main St\nNew York, NY 10001"
    },
    "lineItems": [
      {
        "description": "Website Design",
        "details": "Custom responsive design",
        "quantity": 1,
        "unitPrice": 3500,
        "total": 3500
      },
      {
        "description": "Development",
        "quantity": 40,
        "unitPrice": 150,
        "total": 6000
      }
    ],
    "totals": {
      "subtotal": 9500,
      "discount": 500,
      "tax": 720,
      "taxRate": 8,
      "total": 9720
    },
    "meta": {
      "quoteNumber": "Q-2024-001",
      "date": "January 15, 2024",
      "validUntil": "February 15, 2024",
      "notes": "Payment due within 30 days",
      "terms": "Standard terms apply"
    },
    "branding": {
      "logoUrl": "https://example.com/logo.png",
      "companyName": "Design Studio",
      "companyAddress": "456 Creative Ave\nSan Francisco, CA"
    }
  }
}
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `template` | string | No | Template ID. Defaults to `"quote-modern"` |
| `data` | object | Yes | Document data object |
| `data.client` | object | Yes | Client information |
| `data.client.name` | string | Yes | Client name |
| `data.client.company` | string | No | Company name |
| `data.client.email` | string | No | Email address |
| `data.client.address` | string | No | Mailing address |
| `data.lineItems` | array | Yes | List of line items |
| `data.totals` | object | Yes | Totals and calculations |
| `data.meta` | object | No | Document metadata |
| `data.branding` | object | No | Company branding |

## Response

### Success (200)

```json
{
  "html": "<!DOCTYPE html><html>...</html>",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `html` | string | Rendered HTML document |
| `sessionId` | string | UUID for this editing session |

<Aside type="tip">
Save the `sessionId` - you'll need it for `/v1/modify` and `/v1/generate` calls.
</Aside>

### Error Responses

**400 Bad Request** - Validation failed

```json
{
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": [
    {
      "path": ["data", "client", "name"],
      "message": "Required"
    }
  ]
}
```

**401 Unauthorized** - Invalid or missing API key

```json
{
  "error": "Missing Authorization header",
  "code": "HTTP_ERROR"
}
```

**500 Internal Server Error** - Server error

```json
{
  "error": "Unknown error",
  "code": "PREVIEW_ERROR"
}
```

## Example

### cURL

```bash
curl -X POST https://api.glyph.you/v1/preview \
  -H "Authorization: Bearer gk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "template": "quote-modern",
    "data": {
      "client": {"name": "John Smith"},
      "lineItems": [{"description": "Service", "quantity": 1, "unitPrice": 100, "total": 100}],
      "totals": {"subtotal": 100, "total": 100}
    }
  }'
```

### JavaScript

```javascript
const response = await fetch('https://api.glyph.you/v1/preview', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer gk_your_api_key',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    template: 'quote-modern',
    data: {
      client: { name: 'John Smith' },
      lineItems: [{ description: 'Service', quantity: 1, unitPrice: 100, total: 100 }],
      totals: { subtotal: 100, total: 100 }
    }
  })
});

const { html, sessionId } = await response.json();
console.log('Session ID:', sessionId);
```

### Python

```python
import requests

response = requests.post(
    'https://api.glyph.you/v1/preview',
    headers={
        'Authorization': 'Bearer gk_your_api_key',
        'Content-Type': 'application/json'
    },
    json={
        'template': 'quote-modern',
        'data': {
            'client': {'name': 'John Smith'},
            'lineItems': [{'description': 'Service', 'quantity': 1, 'unitPrice': 100, 'total': 100}],
            'totals': {'subtotal': 100, 'total': 100}
        }
    }
)

data = response.json()
print(f"Session ID: {data['sessionId']}")
```

## Available Templates

To list available templates:

```bash
curl https://api.glyph.you/v1/preview/templates \
  -H "Authorization: Bearer gk_your_api_key"
```

Response:

```json
{
  "templates": [
    {
      "id": "quote-modern",
      "name": "Modern Quote",
      "description": "Clean, minimal quote template"
    },
    {
      "id": "quote-professional",
      "name": "Professional Quote",
      "description": "Traditional business style"
    },
    {
      "id": "quote-bold",
      "name": "Bold Quote",
      "description": "High-impact modern design"
    }
  ]
}
```

## Session Behavior

- Sessions are created when you call `/v1/preview`
- Sessions expire after 1 hour of inactivity
- Each session tracks the current HTML state and modification history
- Sessions are tied to your API key for security
