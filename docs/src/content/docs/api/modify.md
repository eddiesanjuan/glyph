---
title: POST /v1/modify
description: Apply AI-powered modifications to a document
---

import { Aside } from '@astrojs/starlight/components';

<span class="endpoint-badge post">POST</span> `/v1/modify`

Modifies a document using natural language instructions. The AI analyzes your request and applies appropriate changes to the HTML.

## Request Modes

This endpoint supports two modes:

1. **Session-based** (recommended) - Uses a `sessionId` from `/v1/preview`
2. **Direct** - Passes HTML directly for one-off modifications

## Session-Based Mode

### Request

```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "prompt": "Make the header navy blue and add our company logo",
  "region": "header"
}
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `sessionId` | string (UUID) | Yes | Session ID from `/v1/preview` |
| `prompt` | string | Yes | Natural language modification instruction (max 1000 chars) |
| `region` | string | No | Target region for focused modifications |

### Available Regions

| Region | Description |
|--------|-------------|
| `header` | Company branding, logo, document title |
| `meta` | Quote number, dates, reference info |
| `client-info` | Recipient name, company, contact |
| `line-items` | Products, services, prices table |
| `totals` | Subtotal, tax, discount, total |
| `notes` | Additional notes section |
| `footer` | Terms, conditions, signatures |

<Aside type="tip">
Specifying a `region` helps the AI focus its changes on the relevant section, resulting in more accurate modifications.
</Aside>

## Direct Mode

For one-off modifications without session management:

```json
{
  "html": "<!DOCTYPE html><html>...</html>",
  "instruction": "Change the background color to light gray",
  "context": {
    "documentType": "quote",
    "company": "Acme Corp"
  }
}
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `html` | string | Yes | HTML content to modify |
| `instruction` | string | Yes | Modification instruction |
| `context` | object | No | Additional context for the AI |

## Response

### Success (200)

```json
{
  "html": "<!DOCTYPE html><html>...</html>",
  "changes": [
    "Changed header background color to navy blue (#1e3a5f)",
    "Added company logo in the header section"
  ],
  "tokensUsed": 1250
}
```

| Field | Type | Description |
|-------|------|-------------|
| `html` | string | Modified HTML document |
| `changes` | array | List of changes made |
| `tokensUsed` | number | AI tokens consumed (session mode only) |
| `validationWarnings` | array | Optional warnings about modifications |

### Error Responses

**400 Bad Request** - Invalid prompt or validation error

```json
{
  "error": "Invalid prompt",
  "code": "GUARDRAIL_VIOLATION",
  "details": {
    "category": "unsafe_content"
  }
}
```

**404 Not Found** - Session not found

```json
{
  "error": "Session not found",
  "code": "HTTP_ERROR"
}
```

**410 Gone** - Session expired

```json
{
  "error": "Session expired",
  "code": "HTTP_ERROR"
}
```

## Example Prompts

Here are effective prompts for common modifications:

### Styling Changes

```json
{
  "sessionId": "...",
  "prompt": "Apply a professional navy blue and gold color scheme"
}
```

```json
{
  "sessionId": "...",
  "prompt": "Make the totals section larger and more prominent with bold styling",
  "region": "totals"
}
```

### Layout Changes

```json
{
  "sessionId": "...",
  "prompt": "Use a more compact layout with less whitespace"
}
```

```json
{
  "sessionId": "...",
  "prompt": "Move the client information to the right side",
  "region": "client-info"
}
```

### Content Changes

```json
{
  "sessionId": "...",
  "prompt": "Add a 10% discount row to the totals",
  "region": "totals"
}
```

```json
{
  "sessionId": "...",
  "prompt": "Add a note that payment is due within 30 days",
  "region": "notes"
}
```

## Code Examples

### cURL

```bash
curl -X POST https://api.glyph.so/v1/modify \
  -H "Authorization: Bearer gk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "prompt": "Make the header more professional with a darker blue color",
    "region": "header"
  }'
```

### JavaScript

```javascript
const response = await fetch('https://api.glyph.so/v1/modify', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer gk_your_api_key',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    sessionId: '550e8400-e29b-41d4-a716-446655440000',
    prompt: 'Add a company logo placeholder in the header',
    region: 'header'
  })
});

const { html, changes } = await response.json();
console.log('Changes made:', changes);
```

### Python

```python
import requests

response = requests.post(
    'https://api.glyph.so/v1/modify',
    headers={
        'Authorization': 'Bearer gk_your_api_key',
        'Content-Type': 'application/json'
    },
    json={
        'sessionId': '550e8400-e29b-41d4-a716-446655440000',
        'prompt': 'Emphasize the total amount with larger font',
        'region': 'totals'
    }
)

data = response.json()
print(f"Changes: {data['changes']}")
```

## Guardrails

The API includes safety guardrails to prevent:

- **Script injection** - No JavaScript, event handlers, or iframes
- **External content** - Limited external resource loading
- **Structural damage** - Prevents breaking the document structure
- **Inappropriate content** - Blocks harmful or offensive modifications

If a modification violates these guardrails, the content is automatically sanitized and a warning is returned:

```json
{
  "html": "...",
  "changes": ["Modified header styling"],
  "validationWarnings": ["Removed potentially unsafe content"]
}
```

## Best Practices

1. **Be specific** - "Make the header navy blue" works better than "make it look better"
2. **Use regions** - Target specific sections when possible
3. **Iterate** - Multiple small changes often work better than one large change
4. **Review changes** - Check the `changes` array to understand what was modified
