# @glyph-pdf/sdk

Embeddable PDF editor SDK with AI-powered document generation. Add professional PDF editing to any web app with a single web component.

## Installation

```bash
npm install @glyph-pdf/sdk
```

Or via CDN:

```html
<script src="https://unpkg.com/@glyph-pdf/sdk"></script>
```

## Quick Start

### ES Modules (Recommended)

```javascript
import { GlyphEditor, GlyphAPI } from '@glyph-pdf/sdk';

// The GlyphEditor web component is automatically registered
// Just use it in your HTML:
const editor = document.createElement('glyph-editor');
editor.setAttribute('api-key', 'your-api-key');
document.body.appendChild(editor);
```

### HTML / CDN

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://unpkg.com/@glyph-pdf/sdk"></script>
</head>
<body>
  <glyph-editor api-key="your-api-key"></glyph-editor>

  <script>
    const editor = document.querySelector('glyph-editor');

    // Listen for events
    editor.addEventListener('glyph:ready', () => {
      console.log('Editor ready!');
    });

    editor.addEventListener('glyph:generate', (e) => {
      console.log('PDF generated:', e.detail);
    });
  </script>
</body>
</html>
```

### React

```jsx
import { useEffect, useRef } from 'react';
import '@glyph-pdf/sdk';

function PdfEditor({ apiKey, data }) {
  const editorRef = useRef(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const handleGenerate = (e) => {
      console.log('PDF generated:', e.detail);
    };

    editor.addEventListener('glyph:generate', handleGenerate);
    return () => editor.removeEventListener('glyph:generate', handleGenerate);
  }, []);

  return (
    <glyph-editor
      ref={editorRef}
      api-key={apiKey}
      data={JSON.stringify(data)}
    />
  );
}
```

### Vue

```vue
<template>
  <glyph-editor
    :api-key="apiKey"
    :data="JSON.stringify(data)"
    @glyph:generate="onGenerate"
  />
</template>

<script setup>
import '@glyph-pdf/sdk';

const props = defineProps(['apiKey', 'data']);

const onGenerate = (e) => {
  console.log('PDF generated:', e.detail);
};
</script>
```

## Components

### GlyphEditor

The main web component for PDF editing.

```html
<glyph-editor
  api-key="your-api-key"
  template="quote-template-id"
  data='{"companyName": "Acme Corp"}'
  theme="light"
></glyph-editor>
```

**Attributes:**

| Attribute | Type | Description |
|-----------|------|-------------|
| `api-key` | string | Your Glyph API key (required) |
| `template` | string | Template ID to load |
| `data` | string (JSON) | Data to populate the template |
| `theme` | string | Theme: `light`, `dark`, or `auto` |
| `api-url` | string | Custom API URL (for self-hosted) |

**Events:**

| Event | Detail | Description |
|-------|--------|-------------|
| `glyph:ready` | `{ version }` | Editor initialized |
| `glyph:generate` | `{ blob, url }` | PDF generated |
| `glyph:save` | `{ document }` | Document saved |
| `glyph:error` | `{ code, message }` | Error occurred |

### GlyphPreview

Read-only PDF preview component.

```html
<glyph-preview
  api-key="your-api-key"
  document-id="doc-123"
></glyph-preview>
```

### GlyphChat

AI chat interface for document generation.

```html
<glyph-chat
  api-key="your-api-key"
  template="quote-template-id"
></glyph-chat>
```

## API Client

For programmatic access without UI components:

```javascript
import { GlyphAPI, createApiClient } from '@glyph-pdf/sdk';

// Using the singleton
GlyphAPI.configure({ apiKey: 'your-api-key' });

const pdf = await GlyphAPI.generatePdf({
  templateId: 'quote-template',
  data: {
    companyName: 'Acme Corp',
    lineItems: [
      { description: 'Widget', quantity: 10, unitPrice: 99.99 }
    ]
  }
});

// Or create a custom client
const client = createApiClient({
  apiKey: 'your-api-key',
  baseUrl: 'https://custom.api.url'
});
```

### API Methods

```javascript
// Generate PDF
const pdf = await GlyphAPI.generatePdf(options);

// Get templates
const templates = await GlyphAPI.getTemplates();

// Get single template
const template = await GlyphAPI.getTemplate('template-id');

// Create document
const doc = await GlyphAPI.createDocument(data);

// Get document
const doc = await GlyphAPI.getDocument('doc-id');
```

## TypeScript

Full TypeScript support is included:

```typescript
import {
  GlyphEditor,
  GlyphAPI,
  GlyphTemplate,
  GlyphDocument,
  GeneratePdfOptions,
  QuoteData,
  QuoteLineItem
} from '@glyph-pdf/sdk';

const quoteData: QuoteData = {
  companyName: 'Acme Corp',
  lineItems: [
    { description: 'Widget', quantity: 10, unitPrice: 99.99 }
  ]
};

const options: GeneratePdfOptions = {
  quality: 'high',
  includeMetadata: true
};
```

## Field Autocomplete

For building custom form interfaces:

```javascript
import { FieldAutocomplete, autocompleteStyles } from '@glyph-pdf/sdk';

// Inject styles into shadow DOM or document
const styleEl = document.createElement('style');
styleEl.textContent = autocompleteStyles;
document.head.appendChild(styleEl);

// Initialize autocomplete
const autocomplete = new FieldAutocomplete(inputElement, {
  fields: [
    { name: 'companyName', type: 'text', description: 'Company name' },
    { name: 'total', type: 'number', description: 'Total amount' }
  ],
  onSelect: (field) => {
    console.log('Selected:', field);
  }
});
```

## Browser Support

- Chrome 80+
- Firefox 75+
- Safari 13.1+
- Edge 80+

## Links

- [Documentation](https://glyphpdf.com/docs)
- [Dashboard](https://glyphpdf.com/dashboard)
- [GitHub](https://github.com/eddiesanjuan/glyph)

## License

Business Source License 1.1 (BSL-1.1) - See [LICENSE](../LICENSE) for details.
