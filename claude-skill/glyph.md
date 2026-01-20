---
name: glyph-pdf
description: Integrate Glyph PDF generation - AI-powered document customization for invoices, quotes, receipts, contracts
triggers:
  - pdf generation
  - invoice generation
  - quote generation
  - document generation
  - glyph
---

# Glyph PDF Integration Skill

## What is Glyph?

Glyph is an AI-powered PDF generation and customization SDK. It lets you:
- Generate beautiful PDFs from data (invoices, quotes, receipts, etc.)
- Customize documents with natural language
- Embed a full editor in your app

## Quick Start

### 1. Install

```bash
npm install @glyph-pdf/core
```

### 2. Get API Key

Sign up at https://glyph.so to get your API key.

### 3. Basic Usage

```typescript
import { GlyphClient } from '@glyph-pdf/core';

const glyph = new GlyphClient({
  apiKey: process.env.GLYPH_API_KEY
});

// Generate a PDF
const pdf = await glyph.generate({
  template: 'invoice',
  data: {
    client: {
      name: 'John Smith',
      email: 'john@example.com'
    },
    lineItems: [
      { description: 'Web Development', quantity: 10, price: 150 }
    ],
    totals: {
      subtotal: 1500,
      tax: 150,
      total: 1650
    }
  }
});

// Save the PDF
await pdf.save('./invoice.pdf');
```

## Data Schemas

### Invoice Schema

```typescript
interface InvoiceData {
  client: {
    name: string;
    company?: string;
    email?: string;
    phone?: string;
    address?: string;
  };
  lineItems: Array<{
    description: string;
    quantity: number;
    price: number;
    total?: number;  // Auto-calculated if omitted
  }>;
  totals: {
    subtotal: number;
    tax?: number;
    discount?: number;
    total: number;
  };
  meta?: {
    invoiceNumber?: string;
    date?: string;
    dueDate?: string;
    terms?: string;
  };
  branding?: {
    companyName?: string;
    logoUrl?: string;
    accentColor?: string;
  };
}
```

### Quote Schema

```typescript
interface QuoteData {
  client: {
    name: string;
    company?: string;
    email?: string;
    phone?: string;
    address?: string;
  };
  lineItems: Array<{
    description: string;
    quantity: number;
    price: number;
    total?: number;
  }>;
  totals: {
    subtotal: number;
    tax?: number;
    discount?: number;
    total: number;
  };
  meta?: {
    quoteNumber?: string;
    date?: string;
    validUntil?: string;  // Quote expiration date
    terms?: string;
  };
  branding?: {
    companyName?: string;
    logoUrl?: string;
    accentColor?: string;
  };
}
```

### Receipt Schema

```typescript
interface ReceiptData {
  customer: {
    name: string;
    email?: string;
  };
  lineItems: Array<{
    description: string;
    quantity: number;
    price: number;
    total?: number;
  }>;
  totals: {
    subtotal: number;
    tax?: number;
    total: number;
  };
  meta?: {
    transactionId?: string;  // Unique transaction identifier
    date?: string;
    paymentMethod?: string;  // e.g., "Visa ending in 4242"
  };
  branding?: {
    companyName?: string;
    logoUrl?: string;
    accentColor?: string;
  };
}
```

## Framework Integration Examples

### Next.js (App Router)

```typescript
// app/api/invoice/route.ts
import { NextResponse } from 'next/server';
import { GlyphClient } from '@glyph-pdf/core';

const glyph = new GlyphClient({
  apiKey: process.env.GLYPH_API_KEY!
});

export async function POST(request: Request) {
  const data = await request.json();

  const pdf = await glyph.generate({
    template: 'invoice',
    data
  });

  return new NextResponse(pdf.buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="invoice.pdf"'
    }
  });
}
```

### Next.js (Pages Router)

```typescript
// pages/api/invoice.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { GlyphClient } from '@glyph-pdf/core';

const glyph = new GlyphClient({
  apiKey: process.env.GLYPH_API_KEY!
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const pdf = await glyph.generate({
    template: 'invoice',
    data: req.body
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="invoice.pdf"');
  res.send(pdf.buffer);
}
```

### Express.js

```typescript
// routes/invoice.ts
import express from 'express';
import { GlyphClient } from '@glyph-pdf/core';

const router = express.Router();
const glyph = new GlyphClient({
  apiKey: process.env.GLYPH_API_KEY!
});

router.post('/generate', async (req, res) => {
  try {
    const pdf = await glyph.generate({
      template: 'invoice',
      data: req.body
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="invoice.pdf"');
    res.send(pdf.buffer);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

export default router;
```

### Fastify

```typescript
// routes/invoice.ts
import { FastifyInstance } from 'fastify';
import { GlyphClient } from '@glyph-pdf/core';

const glyph = new GlyphClient({
  apiKey: process.env.GLYPH_API_KEY!
});

export default async function invoiceRoutes(fastify: FastifyInstance) {
  fastify.post('/generate', async (request, reply) => {
    const pdf = await glyph.generate({
      template: 'invoice',
      data: request.body
    });

    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', 'attachment; filename="invoice.pdf"')
      .send(pdf.buffer);
  });
}
```

### React (Embeddable Editor)

```tsx
// components/InvoiceEditor.tsx
import { useEffect, useRef } from 'react';
import '@glyph-pdf/core';

interface InvoiceEditorProps {
  data: object;
  onSave: (data: object) => void;
}

export function InvoiceEditor({ data, onSave }: InvoiceEditorProps) {
  const editorRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const handleSave = (e: CustomEvent) => {
      onSave(e.detail);
    };

    editor.addEventListener('save', handleSave as EventListener);
    return () => {
      editor.removeEventListener('save', handleSave as EventListener);
    };
  }, [onSave]);

  return (
    <glyph-editor
      ref={editorRef}
      api-key={process.env.NEXT_PUBLIC_GLYPH_API_KEY}
      template="invoice"
      data={JSON.stringify(data)}
    />
  );
}
```

### Vue 3

```vue
<!-- components/InvoiceEditor.vue -->
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import '@glyph-pdf/core';

const props = defineProps<{
  data: object;
}>();

const emit = defineEmits<{
  save: [data: object];
}>();

const editorRef = ref<HTMLElement | null>(null);

const handleSave = (e: CustomEvent) => {
  emit('save', e.detail);
};

onMounted(() => {
  editorRef.value?.addEventListener('save', handleSave as EventListener);
});

onUnmounted(() => {
  editorRef.value?.removeEventListener('save', handleSave as EventListener);
});
</script>

<template>
  <glyph-editor
    ref="editorRef"
    :api-key="import.meta.env.VITE_GLYPH_API_KEY"
    template="invoice"
    :data="JSON.stringify(data)"
  />
</template>
```

## Natural Language Customization

Glyph supports natural language commands to customize documents:

```typescript
// Create a session for interactive customization
const session = await glyph.createSession({
  template: 'invoice',
  data: invoiceData
});

// Customize with natural language
await session.modify('Add a QR code for easy payment');
await session.modify('Make the header more prominent');
await session.modify('Add terms: Net 30, 2% early payment discount');
await session.modify('Use a modern sans-serif font');

// Get preview before final generation
const preview = await session.getPreview();

// Generate final PDF
const pdf = await session.generate();
await pdf.save('./customized-invoice.pdf');
```

### Common Modification Commands

```typescript
// Styling
await session.modify('Change accent color to navy blue');
await session.modify('Use a minimalist design');
await session.modify('Make the logo larger');

// Content
await session.modify('Add a thank you note at the bottom');
await session.modify('Include payment instructions');
await session.modify('Add company registration number: 12345678');

// Layout
await session.modify('Move the totals to the right side');
await session.modify('Add more spacing between line items');
await session.modify('Make this fit on one page');
```

## Available Templates

| Template | Best For | Key Features |
|----------|----------|--------------|
| `invoice` | Service invoices, billing | Line items, tax calculation, payment terms |
| `quote` | Estimates, proposals | Validity period, optional items |
| `receipt` | Transaction confirmations | Payment method, transaction ID |
| `contract` | Agreements, terms | Signature blocks, clause numbering |
| `resume` | CVs, professional profiles | Skills, experience sections |

## API Reference

### GlyphClient

```typescript
import { GlyphClient } from '@glyph-pdf/core';

const glyph = new GlyphClient({
  apiKey: string;           // Required - Your Glyph API key
  baseUrl?: string;         // Optional - Custom API URL (for self-hosted)
});
```

### Client Methods

```typescript
// Generate PDF directly (no customization)
const pdf = await glyph.generate({
  template: string;         // Template name (e.g., 'invoice')
  data: object;             // Data matching template schema
  options?: {
    format?: 'A4' | 'Letter' | 'Legal';
    orientation?: 'portrait' | 'landscape';
  };
});

// Create interactive customization session
const session = await glyph.createSession({
  template: string;
  data: object;
});

// List available templates
const templates = await glyph.getTemplates();
// Returns: [{ name: 'invoice', description: '...' }, ...]
```

### PDF Object

```typescript
interface PDF {
  buffer: Buffer;           // Raw PDF bytes

  save(path: string): Promise<void>;        // Save to file
  toBase64(): string;                        // Get base64 string
  toDataUrl(): string;                       // Get data URL for embedding
}
```

### Session Methods

```typescript
interface Session {
  // Natural language modification
  modify(instruction: string): Promise<void>;

  // Get current state
  getPreview(): Promise<string>;    // Returns HTML preview
  getData(): object;                // Returns current data

  // Generate final PDF
  generate(): Promise<PDF>;

  // History
  undo(): Promise<void>;
  redo(): Promise<void>;
  getHistory(): Array<{ instruction: string; timestamp: Date }>;

  // Cleanup
  close(): Promise<void>;
}
```

## Environment Variables

```bash
# Required
GLYPH_API_KEY=gk_live_your_key_here

# For client-side editor (React, Vue, etc.)
NEXT_PUBLIC_GLYPH_API_KEY=gk_live_your_key_here  # Next.js
VITE_GLYPH_API_KEY=gk_live_your_key_here          # Vite
REACT_APP_GLYPH_API_KEY=gk_live_your_key_here     # Create React App
```

## Error Handling

```typescript
import { GlyphClient, GlyphError } from '@glyph-pdf/core';

try {
  const pdf = await glyph.generate({
    template: 'invoice',
    data: invoiceData
  });
} catch (error) {
  if (error instanceof GlyphError) {
    switch (error.code) {
      case 'INVALID_API_KEY':
        console.error('Check your GLYPH_API_KEY');
        break;
      case 'TEMPLATE_NOT_FOUND':
        console.error('Template does not exist');
        break;
      case 'VALIDATION_ERROR':
        console.error('Data validation failed:', error.details);
        break;
      case 'RATE_LIMITED':
        console.error('Too many requests, retry after:', error.retryAfter);
        break;
      default:
        console.error('Glyph error:', error.message);
    }
  }
  throw error;
}
```

## Troubleshooting

### "Invalid API key"
- Verify `GLYPH_API_KEY` environment variable is set
- Check the key starts with `gk_live_` or `gk_test_`
- Get a valid key from https://glyph.so/dashboard

### "Template not found"
- Run `await glyph.getTemplates()` to list available templates
- Check template name spelling (case-sensitive)
- Custom templates require a paid plan

### "Data validation failed"
- Ensure all required fields are present
- Check data types match the schema
- Use TypeScript interfaces for compile-time validation

### "Rate limited"
- Wait for the `retryAfter` period
- Implement exponential backoff
- Consider upgrading your plan for higher limits

### PDF is blank or corrupted
- Check that `data` object is not empty
- Verify `lineItems` array has at least one item
- Check server logs for generation errors

## Links

- Documentation: https://docs.glyph.so
- Dashboard: https://glyph.so/dashboard
- API Reference: https://api.glyph.so/docs
- GitHub: https://github.com/eddiesanjuan/glyph
- Support: support@glyph.so
