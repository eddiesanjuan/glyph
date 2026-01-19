---
title: SDK Overview
description: Introduction to the Glyph JavaScript SDK
---

import { Aside } from '@astrojs/starlight/components';

The Glyph SDK provides a drop-in web component for document editing and PDF generation. It handles the UI, API communication, and PDF download - you just provide the data.

## Installation

### CDN (Quickest)

```html
<script src="https://glyph-sdk.vercel.app/glyph.min.js"></script>
```

### npm

```bash
npm install @glyph/sdk
```

```javascript
import '@glyph/sdk';
// or import specific components
import { GlyphEditor, GlyphAPI } from '@glyph/sdk';
```

## What's Included

### Components

| Component | Description |
|-----------|-------------|
| `<glyph-editor>` | Full document editor with preview, AI editing, and PDF download |
| `GlyphPreview` | Preview-only component (no editing) |
| `GlyphChat` | AI chat interface component |

### API Client

| Class | Description |
|-------|-------------|
| `GlyphAPI` | Simplified API client for editor workflow |
| `GlyphApiClient` | Full-featured API client |
| `createApiClient()` | Factory function for API client |

## Basic Usage

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://glyph-sdk.vercel.app/glyph.min.js"></script>
</head>
<body>
  <glyph-editor
    api-key="gk_your_api_key"
    template="quote-modern"
    data='{"client": {"name": "John"}, "lineItems": [], "totals": {"subtotal": 0, "total": 0}}'
  ></glyph-editor>
</body>
</html>
```

## Architecture

```
┌─────────────────────────────────────────┐
│           <glyph-editor>                │
│  ┌─────────────────────────────────┐    │
│  │      Document Preview           │    │
│  │   (iframe with HTML content)    │    │
│  └─────────────────────────────────┘    │
│  ┌─────────────────────────────────┐    │
│  │    Quick Action Pills           │    │
│  │  [Add logo] [Colors] [Pro] ...  │    │
│  └─────────────────────────────────┘    │
│  ┌──────────────────────┐ ┌──────────┐  │
│  │   Command Input      │ │ Download │  │
│  └──────────────────────┘ └──────────┘  │
└─────────────────────────────────────────┘
         │                    │
         ▼                    ▼
    GlyphAPI            GlyphAPI
   .modify()           .generate()
         │                    │
         ▼                    ▼
  ┌────────────────────────────────┐
  │         Glyph API              │
  │  POST /v1/modify               │
  │  POST /v1/generate             │
  └────────────────────────────────┘
```

The component uses Shadow DOM for style encapsulation, ensuring it doesn't conflict with your page styles.

## Key Features

### Region-Based Editing

Click on document sections (header, line items, totals, etc.) to target AI modifications to that specific region.

### Quick Actions

Pre-built modification buttons for common changes:
- Add logo
- Brand colors
- More professional
- Emphasize totals
- Compact layout

### Custom Commands

Type any natural language instruction in the command input to modify the document.

### Real-Time Preview

See changes instantly as they're applied, before downloading the final PDF.

## TypeScript Support

The SDK includes TypeScript definitions. For framework-specific type support:

```typescript
// types/glyph.d.ts
declare namespace JSX {
  interface IntrinsicElements {
    'glyph-editor': React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        'api-key': string;
        template?: string;
        data?: string;
        theme?: string;
        'api-url'?: string;
      },
      HTMLElement
    >;
  }
}
```

## Browser Support

| Browser | Minimum Version |
|---------|-----------------|
| Chrome | 90+ |
| Firefox | 90+ |
| Safari | 14+ |
| Edge | 90+ |

<Aside type="note">
The SDK requires support for Custom Elements v1, Shadow DOM, and ES2020 features.
</Aside>

## Next Steps

- [<glyph-editor>](/sdk/glyph-editor/) - Detailed component documentation
- [Events](/sdk/events/) - Listen for editor events
- [Methods](/sdk/methods/) - Programmatic control
- [Theming](/sdk/theming/) - Customize the look and feel
