---
title: Authentication
description: API key authentication for Glyph
---

import { Aside } from '@astrojs/starlight/components';

All Glyph API requests require authentication using an API key. This guide covers how to obtain, use, and secure your API keys.

## Getting an API Key

1. Sign up at [dashboard.glyph.you](https://dashboard.glyph.you)
2. Navigate to **API Keys** in the sidebar
3. Click **Create New Key**
4. Copy your key immediately - it won't be shown again

<Aside type="caution">
Store your API key securely. If compromised, revoke it immediately and create a new one.
</Aside>

## Key Format

Glyph API keys follow a specific format:

```
gk_xxxxxxxxxxxxxxxxxxxx
```

- Prefix: `gk_` (Glyph Key)
- Length: 27 characters total
- Characters: Base64-safe (alphanumeric)

## Using Your API Key

### Authorization Header

Include your API key in the `Authorization` header with the `Bearer` scheme:

```bash
curl -X POST https://api.glyph.you/v1/preview \
  -H "Authorization: Bearer gk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"template": "quote-modern", "data": {...}}'
```

### JavaScript/TypeScript

```javascript
const response = await fetch('https://api.glyph.you/v1/preview', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.GLYPH_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ template: 'quote-modern', data: quoteData })
});
```

### Python

```python
import os
import requests

response = requests.post(
    'https://api.glyph.you/v1/preview',
    headers={
        'Authorization': f'Bearer {os.environ["GLYPH_API_KEY"]}',
        'Content-Type': 'application/json'
    },
    json={'template': 'quote-modern', 'data': quote_data}
)
```

### SDK Usage

When using the SDK, pass your API key to the component or client:

```html
<glyph-editor api-key="gk_your_api_key" ...></glyph-editor>
```

```javascript
import { GlyphAPI } from '@glyph/sdk';

const api = new GlyphAPI('gk_your_api_key');
```

## Error Responses

### Missing Authorization Header

```json
{
  "error": "Missing Authorization header",
  "code": "HTTP_ERROR"
}
```

HTTP Status: `401 Unauthorized`

### Invalid Authorization Format

```json
{
  "error": "Invalid Authorization format. Use: Bearer <api_key>",
  "code": "HTTP_ERROR"
}
```

HTTP Status: `401 Unauthorized`

### Invalid Key Format

```json
{
  "error": "Invalid API key format. Keys should start with 'gk_'",
  "code": "HTTP_ERROR"
}
```

HTTP Status: `401 Unauthorized`

### Invalid or Revoked Key

```json
{
  "error": "Invalid API key",
  "code": "HTTP_ERROR"
}
```

HTTP Status: `401 Unauthorized`

### Deactivated Key

```json
{
  "error": "API key is deactivated",
  "code": "HTTP_ERROR"
}
```

HTTP Status: `403 Forbidden`

### Monthly Limit Exceeded

```json
{
  "error": "Monthly API limit exceeded (100 requests)",
  "code": "HTTP_ERROR"
}
```

HTTP Status: `429 Too Many Requests`

## Security Best Practices

### Never Expose in Client Code

```javascript
// BAD - Key exposed in frontend code
const api = new GlyphAPI('gk_live_key_here');

// GOOD - Key stored securely on backend
// Frontend makes request to your backend, which calls Glyph
```

<Aside type="caution">
For browser-based applications, use a backend proxy to keep your API key secure. Never include production API keys in client-side JavaScript.
</Aside>

### Environment Variables

Store keys in environment variables:

```bash
# .env
GLYPH_API_KEY=gk_your_api_key
```

```javascript
// Node.js
const apiKey = process.env.GLYPH_API_KEY;
```

### Key Rotation

Periodically rotate your API keys:

1. Create a new key in the dashboard
2. Update your applications to use the new key
3. Verify the new key works in production
4. Revoke the old key

### Separate Keys for Environments

Use different keys for different environments:

| Environment | Key Name |
|-------------|----------|
| Development | `dev_key` |
| Staging | `staging_key` |
| Production | `production_key` |

## API Key Tiers

Your API key is associated with a pricing tier that determines:

- Rate limits (requests per minute)
- Monthly PDF generation limits
- Feature access

| Tier | Rate Limit | Monthly PDFs |
|------|------------|--------------|
| Free | 10/min | 100 |
| Pro | 60/min | 1,000 |
| Scale | 120/min | 10,000 |
| Enterprise | 300/min | Unlimited |

Check your current tier and usage in the [dashboard](https://glyph.you/dashboard).

## Key Management

### Viewing Keys

In your dashboard, you can see:
- Key prefix (first 11 characters)
- Creation date
- Last used date
- Current tier

<Aside type="note">
For security, full API keys are only shown once at creation. If you lose your key, create a new one.
</Aside>

### Revoking Keys

To revoke a key:

1. Go to **API Keys** in your dashboard
2. Find the key to revoke
3. Click **Revoke**
4. Confirm the action

Revoked keys immediately stop working for all requests.

## Validating Keys

Test if a key is valid:

```bash
curl https://api.glyph.you/v1/auth/validate \
  -H "Authorization: Bearer gk_your_api_key"
```

Response:

```json
{
  "valid": true,
  "tier": "pro"
}
```
