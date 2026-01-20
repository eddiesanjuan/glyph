# Integrating Glyph - The Developer Experience

This document describes how a developer (like you, integrating into Quoted) experiences Glyph.

## The Vision

You have an app that generates PDFs. Your users want to customize them. Instead of building a complex template editor, you add 2 lines of code and Glyph handles everything:

- Natural language customization ("make it look more professional")
- Click-to-edit any section
- AI that understands your data schema
- Self-checking that prevents broken outputs
- Gets better every day without you doing anything

## Integration in 2 Minutes

### Step 1: Add the SDK (1 line)

```html
<script src="https://sdk.glyph.you/glyph.min.js"></script>
```

### Step 2: Add the Editor (1 line)

```html
<glyph-editor
  api-key="gk_your_api_key"
  template="quote-modern"
  :data="yourQuoteData"
/>
```

That's it. Your users can now customize their PDFs with natural language.

## How It Works (The Magic)

### 1. Auto-Schema Detection

Glyph analyzes your data and automatically understands its structure:

```javascript
// Your data (from Quoted)
const quoteData = {
  client: {
    name: "Acme Corp",
    email: "contact@acme.com",
    address: "123 Main St"
  },
  lineItems: [
    { description: "Web Design", quantity: 1, unitPrice: 5000, total: 5000 },
    { description: "Development", quantity: 40, unitPrice: 150, total: 6000 }
  ],
  totals: {
    subtotal: 11000,
    tax: 880,
    total: 11880
  }
};

// Glyph automatically detects:
// - This is a quote/invoice document
// - client.* are customer fields
// - lineItems are repeatable rows
// - totals.* are summary calculations
```

### 2. Intelligent Template Mapping

Based on your data shape, Glyph:
- Selects the best matching template
- Maps your fields to template regions
- Preserves your branding (logo, colors)

```javascript
// You don't configure this - it just works
// Glyph sees "lineItems" array → creates item table
// Glyph sees "totals.tax" → adds tax line
// Glyph sees "client.email" → adds email field
```

### 3. Natural Language Understanding

Your users type what they want:

```
User: "Make the header navy blue with our company logo"
Glyph AI: Understands intent → Modifies CSS → Updates preview

User: "Add a QR code for payment"
Glyph AI: Detects feature request → Generates QR placeholder → Positions it

User: "Make it look like a Stripe invoice"
Glyph AI: Applies Stripe-style formatting → Clean typography → Subtle accents
```

### 4. Self-Checking Validator

Every AI modification is validated before returning:

```javascript
// Behind the scenes after each modification:
{
  "html": "...",           // The modified HTML
  "selfCheckPassed": true, // ← Glyph verified this is good
  "modifications": [...]
}

// If AI makes a mistake:
{
  "html": "...",
  "selfCheckPassed": false,
  "selfCheckIssues": ["Data binding for client.name is broken"]
  // Glyph auto-corrects or asks for clarification
}
```

### 5. Continuous Improvement

Glyph learns from every interaction:
- Common requests become quick actions
- Failure patterns are automatically fixed
- Templates evolve based on usage

**You don't do anything. It just gets better.**

## Full Integration Example (Quoted)

### React Component

```tsx
import { useEffect, useRef } from 'react';

// Your quote data from your app
interface Quote {
  id: string;
  client: { name: string; email: string; company?: string };
  lineItems: Array<{ description: string; quantity: number; unitPrice: number; total: number }>;
  totals: { subtotal: number; tax?: number; discount?: number; total: number };
  meta?: { quoteNumber?: string; date?: string; validUntil?: string; notes?: string };
  branding?: { logoUrl?: string; companyName?: string; primaryColor?: string };
}

function QuoteEditor({ quote, onSave }: { quote: Quote; onSave: (html: string) => void }) {
  const editorRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // Listen for changes
    const editor = editorRef.current;
    if (!editor) return;

    const handleUpdate = (e: CustomEvent) => {
      // e.detail.html contains the current HTML
      // e.detail.selfCheckPassed tells you if it's valid
      console.log('Quote updated:', e.detail);
    };

    editor.addEventListener('glyph:update', handleUpdate);
    return () => editor.removeEventListener('glyph:update', handleUpdate);
  }, []);

  const handleDownload = async () => {
    // Get PDF from the editor
    const editor = editorRef.current as any;
    if (editor?.downloadPdf) {
      await editor.downloadPdf();
    }
  };

  return (
    <div>
      {/* This is the entire integration */}
      <glyph-editor
        ref={editorRef}
        api-key="gk_your_production_key"
        template="quote-modern"
        data={JSON.stringify(quote)}
      />

      <button onClick={handleDownload}>Download PDF</button>
    </div>
  );
}
```

### Vue Component

```vue
<template>
  <div>
    <glyph-editor
      ref="editor"
      api-key="gk_your_production_key"
      template="quote-modern"
      :data="JSON.stringify(quote)"
      @glyph:update="onUpdate"
    />
    <button @click="downloadPdf">Download PDF</button>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps(['quote']);
const editor = ref(null);

function onUpdate(e) {
  console.log('Quote updated:', e.detail);
}

async function downloadPdf() {
  await editor.value?.downloadPdf();
}
</script>
```

### Vanilla JavaScript

```html
<glyph-editor id="quote-editor"></glyph-editor>

<script>
  const editor = document.getElementById('quote-editor');

  // Set your data
  editor.setAttribute('api-key', 'gk_your_production_key');
  editor.setAttribute('template', 'quote-modern');
  editor.setAttribute('data', JSON.stringify(yourQuoteData));

  // Listen for updates
  editor.addEventListener('glyph:update', (e) => {
    console.log('Updated:', e.detail);
  });

  // Download PDF
  document.getElementById('download-btn').onclick = () => {
    editor.downloadPdf();
  };
</script>
```

## Advanced: Custom Templates

If the built-in templates don't fit, create your own:

### 1. Define Your Template HTML

```html
<!-- templates/my-custom-quote/template.html -->
<div class="quote" data-glyph-region="document">
  <header data-glyph-region="header">
    <img src="{{branding.logoUrl}}" alt="Logo" />
    <h1>{{branding.companyName}}</h1>
  </header>

  <section data-glyph-region="client-info">
    <h2>Quote For:</h2>
    <p>{{client.name}}</p>
    <p>{{client.email}}</p>
  </section>

  <section data-glyph-region="line-items">
    <table>
      {{#lineItems}}
      <tr>
        <td>{{description}}</td>
        <td>{{quantity}}</td>
        <td>{{unitPrice}}</td>
        <td>{{total}}</td>
      </tr>
      {{/lineItems}}
    </table>
  </section>

  <section data-glyph-region="totals">
    <p>Subtotal: {{totals.subtotal}}</p>
    <p>Tax: {{totals.tax}}</p>
    <p><strong>Total: {{totals.total}}</strong></p>
  </section>
</div>
```

### 2. Define Your Schema

```json
// templates/my-custom-quote/schema.json
{
  "type": "quote",
  "regions": ["header", "client-info", "line-items", "totals"],
  "fields": {
    "client": {
      "name": { "type": "string", "required": true },
      "email": { "type": "string", "format": "email" },
      "company": { "type": "string" }
    },
    "lineItems": {
      "type": "array",
      "items": {
        "description": { "type": "string" },
        "quantity": { "type": "number" },
        "unitPrice": { "type": "number" },
        "total": { "type": "number" }
      }
    },
    "totals": {
      "subtotal": { "type": "number" },
      "tax": { "type": "number" },
      "total": { "type": "number", "required": true }
    }
  }
}
```

### 3. Use Your Template

```html
<glyph-editor
  api-key="gk_xxx"
  template="my-custom-quote"
  :data="quoteData"
/>
```

## Events Reference

```javascript
// Editor is ready
editor.addEventListener('glyph:ready', (e) => {
  console.log('Editor initialized with session:', e.detail.sessionId);
});

// Preview updated after modification
editor.addEventListener('glyph:update', (e) => {
  console.log('HTML:', e.detail.html);
  console.log('Self-check passed:', e.detail.selfCheckPassed);
});

// Modification started
editor.addEventListener('glyph:modifying', (e) => {
  console.log('Processing:', e.detail.command);
});

// Error occurred
editor.addEventListener('glyph:error', (e) => {
  console.error('Error:', e.detail.message);
});

// PDF download started
editor.addEventListener('glyph:downloading', () => {
  console.log('Generating PDF...');
});

// PDF download complete
editor.addEventListener('glyph:downloaded', (e) => {
  console.log('PDF ready:', e.detail.filename);
});
```

## Why Glyph?

### Before Glyph
- Build complex template editor UI
- Handle all the edge cases
- Users still can't customize enough
- PDFs look generic

### After Glyph
- 2 lines of code
- Users customize with natural language
- AI handles edge cases
- PDFs look exactly how users want

### The Numbers
- Integration time: 5 minutes (vs weeks)
- User customization: Unlimited (vs fixed options)
- Maintenance: Zero (Glyph improves itself)

## Get Started

1. Get an API key at https://dashboard.glyph.you
2. Add the SDK script tag
3. Add the `<glyph-editor>` component
4. Ship it

Questions? Feedback? We ship fixes within hours.
