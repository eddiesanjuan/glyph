---
title: API Overview
description: Introduction to the Glyph REST API
---

The Glyph API provides programmatic access to document generation and AI-powered customization. Use it to build custom integrations, automate document workflows, or create your own editor experiences.

## Base URL

```text
https://api.glyph.you
```

For self-hosted deployments, use your own domain.

## API Version

The current API version is `v1`. All endpoints are prefixed with `/v1/`.

## Authentication

All API requests require authentication via API key:

```bash
curl -X POST https://api.glyph.you/v1/preview \
  -H "Authorization: Bearer gk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"template": "quote-modern", "data": {...}}'
```

See [Authentication](/api/authentication/) for details.

## Core Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /v1/analyze/preview/auto` | **Data-first**: Auto-detect document type and generate preview |
| `POST /v1/preview` | Render template with data, get HTML and session ID |
| `POST /v1/modify` | Apply AI modifications to a session |
| `POST /v1/generate` | Generate PDF or PNG from session |
| `POST /v1/analyze` | Analyze data structure without generating preview |

## Typical Workflow

| Step | Request | Response |
|------|---------|----------|
| **1. Preview** | `Client → POST /v1/preview (template + data) → API` | `API → HTML + sessionId → Client` |
| **2. Modify** | `Client → POST /v1/modify (sessionId + prompt) → API → Claude AI` | `Claude AI → Modified HTML → API → New HTML + changes → Client` |
| **3. Generate** | `Client → POST /v1/generate (sessionId) → API` | `API → PDF file → Client` |

## Request Format

All POST requests accept JSON:

```json
{
  "template": "quote-modern",
  "data": {
    "client": { "name": "John Smith" },
    "lineItems": [...],
    "totals": { "subtotal": 1000, "total": 1000 }
  }
}
```

## Response Format

Successful responses return JSON:

```json
{
  "html": "<html>...</html>",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

Error responses include an error code:

```json
{
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": [...]
}
```

## Rate Limiting

All endpoints are rate-limited based on your tier:

| Tier | Requests/Minute |
|------|-----------------|
| Free | 10 |
| Pro | 60 |
| Scale | 120 |
| Enterprise | 300 |

See [Rate Limits](/api/rate-limits/) for details.

## Health Check

Check API availability:

```bash
curl https://api.glyph.you/health
```

Response:

```json
{
  "status": "ok",
  "version": "0.1.0",
  "timestamp": "2024-01-15T12:00:00.000Z"
}
```

## SDKs

While you can use the API directly, we provide SDKs for easier integration:

- **JavaScript/TypeScript**: `@glyph/sdk` - Includes the `<glyph-editor>` web component
- **Python**: Interested? Let us know at hello@glyph.you
- **Ruby**: Interested? Let us know at hello@glyph.you

## Next Steps

- [Data-First API](/api/create/) - Generate PDFs from any data structure (recommended)
- [Authentication](/api/authentication/) - API key setup and usage
- [POST /v1/preview](/api/preview/) - Generate document previews
- [POST /v1/modify](/api/modify/) - AI-powered modifications
- [POST /v1/generate](/api/generate/) - PDF generation
