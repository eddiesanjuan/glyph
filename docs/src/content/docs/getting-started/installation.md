---
title: Installation
description: Different ways to add Glyph to your project
---

Glyph can be integrated into your project in several ways, depending on your tech stack and preferences.

## CDN (Recommended for Quick Start)

The simplest way to get started. No build step required:

```html
<script src="https://cdn.glyph.so/v1.js"></script>
```

This loads the latest stable version and registers the `<glyph-editor>` web component globally.

### Specific Version

Pin to a specific version for production:

```html
<script src="https://cdn.glyph.so/v1.0.0/glyph.js"></script>
```

### Async Loading

For better page performance, load asynchronously:

```html
<script src="https://cdn.glyph.so/v1.js" async></script>
```

When loading async, wait for the component to be defined:

```javascript
customElements.whenDefined('glyph-editor').then(() => {
  // Safe to use glyph-editor
});
```

## npm Package

For modern JavaScript projects with a build step:

```bash
npm install @glyph/sdk
```

### ES Modules

```javascript
import { GlyphEditor, GlyphAPI } from '@glyph/sdk';

// The web component is auto-registered
// You can also use the API client directly
const api = new GlyphAPI('gk_your_key_here');
```

### CommonJS

```javascript
const { GlyphEditor, GlyphAPI } = require('@glyph/sdk');
```

## Framework-Specific Setup

### React

```jsx
import '@glyph/sdk';

function QuoteEditor({ quoteData }) {
  return (
    <glyph-editor
      api-key="gk_your_key_here"
      template="quote-modern"
      data={JSON.stringify(quoteData)}
    />
  );
}
```

For TypeScript, add type declarations:

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

### Vue

```vue
<template>
  <glyph-editor
    :api-key="apiKey"
    template="quote-modern"
    :data="JSON.stringify(quoteData)"
    @glyph:ready="onReady"
    @glyph:modified="onModified"
  />
</template>

<script setup>
import '@glyph/sdk';

const apiKey = 'gk_your_key_here';
const quoteData = { /* ... */ };

function onReady(event) {
  console.log('Editor ready:', event.detail);
}

function onModified(event) {
  console.log('Changes:', event.detail.changes);
}
</script>
```

In `vite.config.js`, tell Vue about the custom element:

```javascript
export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag === 'glyph-editor'
        }
      }
    })
  ]
});
```

### Svelte

```svelte
<script>
  import '@glyph/sdk';

  export let quoteData;

  function handleReady(event) {
    console.log('Ready:', event.detail);
  }
</script>

<glyph-editor
  api-key="gk_your_key_here"
  template="quote-modern"
  data={JSON.stringify(quoteData)}
  on:glyph:ready={handleReady}
/>
```

## Direct API Usage

If you don't need the visual editor, you can use the API directly:

```javascript
import { GlyphAPI } from '@glyph/sdk';

const api = new GlyphAPI('gk_your_key_here');

// Generate a preview
const { html, sessionId } = await api.preview('quote-modern', quoteData);

// Modify with AI
const { html: modifiedHtml, changes } = await api.modify(
  sessionId,
  'Make the header navy blue'
);

// Generate PDF
const pdfBlob = await api.generate(sessionId);
```

## Self-Hosting

For enterprise deployments, you can self-host the Glyph API:

```bash
# Clone the repository
git clone https://github.com/glyph-so/glyph.git

# Install dependencies
cd glyph/api
npm install

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Start the server
npm start
```

Point your SDK to your self-hosted instance:

```html
<glyph-editor
  api-key="gk_your_key_here"
  api-url="https://your-glyph-api.com"
  template="quote-modern"
  data='...'
></glyph-editor>
```

## Environment Requirements

| Environment | Minimum Version |
|-------------|-----------------|
| Node.js | 18.x (for npm package) |
| Browsers | Chrome 90+, Firefox 90+, Safari 14+, Edge 90+ |
| TypeScript | 4.7+ (optional) |

## Next Steps

- Learn [Basic Usage](/getting-started/basic-usage/) patterns
- Explore the [API Reference](/api/overview/)
- Check out [Examples](/examples/vanilla/) for your framework
