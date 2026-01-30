# @glyphpdf/sdk

Generate PDFs with AI. One function call to create professional PDFs from data or HTML.

```
npm install @glyphpdf/sdk
```

## Quick Start

```js
const glyph = require("@glyphpdf/sdk")("gk_your_api_key");

const result = await glyph.create({
  data: { company: "Acme Corp", invoice_number: "INV-001", total: "$1,250.00" },
});
console.log(result.url); // Base64 data URL of the generated PDF
```

Three lines. Data in, PDF out.

## Installation

```bash
npm install @glyphpdf/sdk
# or
yarn add @glyphpdf/sdk
# or
pnpm add @glyphpdf/sdk
```

Requires Node.js 18+ (uses native `fetch`). Also works in Bun and Deno.

## Usage

### Initialize

```js
// Simple — just pass your API key
const glyph = require("@glyphpdf/sdk")("gk_your_api_key");

// With options
const glyph = require("@glyphpdf/sdk")({
  apiKey: "gk_your_api_key",
  baseUrl: "https://api.glyph.you", // optional, this is the default
});
```

### Create a PDF

```js
const result = await glyph.create({
  data: {
    company: "Acme Corp",
    invoice_number: "INV-001",
    items: [
      { description: "Consulting", quantity: 10, rate: "$125.00", amount: "$1,250.00" },
    ],
    total: "$1,250.00",
  },
  intent: "professional invoice with blue accents",
  style: "stripe-clean",
  format: "pdf",
});

console.log(result.url);       // Base64 data URL
console.log(result.sessionId); // Use with /v1/modify for further edits
console.log(result.analysis);  // AI-detected document type and fields
```

### Discover Templates

```js
const templates = await glyph.templates();
// => [{ id: "quote-modern", name: "Modern Quote", ... }, ...]

// Filter by category
const invoices = await glyph.templates("invoice");
```

### Get Template Schema

```js
const schema = await glyph.templateSchema("invoice-clean");
// Returns JSON Schema describing the data structure
```

### Generate a PNG

```js
const png = await glyph.create({
  data: { title: "Q4 Report", author: "Jane Doe" },
  format: "png",
});
```

### Page Options

```js
const result = await glyph.create({
  data: { /* ... */ },
  options: {
    pageSize: "A4",
    orientation: "landscape",
    margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" },
    scale: 1,
  },
});
```

## TypeScript

Full type definitions are included. No additional `@types/` package needed.

```typescript
import glyph, { Glyph, GlyphError, CreateOptions, CreateResult, TemplateInfo } from "@glyphpdf/sdk";

const client: Glyph = glyph({ apiKey: "gk_your_api_key" });

try {
  const result: CreateResult = await client.create({
    data: { company: "Acme Corp" },
    style: "bold",
  });
} catch (err) {
  if (err instanceof GlyphError) {
    console.error(`[${err.code}] ${err.message} (HTTP ${err.status})`);
  }
}
```

## Error Handling

All API errors throw `GlyphError` with structured fields:

```js
try {
  await glyph.create({ data: {} });
} catch (err) {
  err.message; // "Data object cannot be empty"
  err.status;  // 400
  err.code;    // "VALIDATION_ERROR"
}
```

## API Reference

### `glyph(config)`

Factory function. Returns a `Glyph` instance.

| Parameter | Type | Description |
|-----------|------|-------------|
| `config` | `string \| GlyphConfig` | API key string, or `{ apiKey, baseUrl? }` |

### `glyph.create(options)`

Generate a PDF or PNG from data.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `data` | `Record<string, unknown>` | Yes | Document data (field values) |
| `templateId` | `string` | No | Built-in template ID |
| `html` | `string` | No | Raw HTML input |
| `format` | `"pdf" \| "png"` | No | Output format (default: `"pdf"`) |
| `style` | `string` | No | Visual style: `stripe-clean`, `bold`, `minimal`, `corporate` |
| `intent` | `string` | No | Natural language description of desired output |
| `options` | `object` | No | Page size, orientation, margins, scale |

Returns `CreateResult` with `url`, `sessionId`, `format`, `size`, `filename`, `expiresAt`, and optional `analysis`.

### `glyph.templates(category?)`

List built-in templates. Optionally filter by category (`quote`, `invoice`, `receipt`, `report`, `letter`, `contract`, `certificate`, `proposal`).

### `glyph.templateSchema(templateId)`

Get the JSON Schema for a specific template. Useful for validating data before generation.

## License

BUSL-1.1
