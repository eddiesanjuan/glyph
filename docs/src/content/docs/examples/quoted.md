---
title: Quoted Integration
description: How Glyph powers the Quoted platform
---

import { Aside, Tabs, TabItem } from '@astrojs/starlight/components';

[Quoted](https://quoted.so) is a quote management platform built on Glyph. This example shows how Quoted integrates the Glyph SDK to provide AI-powered quote customization.

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                  Quoted Platform                     │
├─────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌──────────────────────────┐   │
│  │   Quote     │    │     <glyph-editor>       │   │
│  │   Builder   │───▶│                          │   │
│  │   (React)   │    │  ┌──────────────────┐   │   │
│  └─────────────┘    │  │  Live Preview    │   │   │
│                      │  │                  │   │   │
│  ┌─────────────┐    │  │  ┌────────────┐  │   │   │
│  │   Client    │    │  │  │  Template  │  │   │   │
│  │   Database  │    │  │  │  Regions   │  │   │   │
│  └─────────────┘    │  │  └────────────┘  │   │   │
│         │           │  │                  │   │   │
│         ▼           │  └──────────────────┘   │   │
│  ┌─────────────┐    │                          │   │
│  │   Line      │    │  ┌──────────────────┐   │   │
│  │   Items     │───▶│  │  AI Chat Panel   │   │   │
│  └─────────────┘    │  └──────────────────┘   │   │
│                      └──────────────────────────┘   │
└─────────────────────────────────────────────────────┘
                              │
                              ▼
                     ┌─────────────────┐
                     │   Glyph API     │
                     │  (glyph.so)     │
                     └─────────────────┘
```

## Key Integration Points

### 1. Quote Builder → Glyph Editor

The Quoted quote builder collects data that maps directly to Glyph's template schema:

```typescript
// quoted/src/components/QuoteBuilder.tsx
import { useEffect, useRef } from 'react';

interface QuoteBuilderProps {
  client: Client;
  lineItems: LineItem[];
  settings: QuoteSettings;
}

export function QuoteBuilder({ client, lineItems, settings }: QuoteBuilderProps) {
  const editorRef = useRef<HTMLElement>(null);

  // Transform Quoted data to Glyph format
  const glyphData = {
    client: {
      name: client.fullName,
      company: client.companyName,
      email: client.email,
      address: formatAddress(client.address),
    },
    lineItems: lineItems.map(item => ({
      description: item.name,
      details: item.description,
      quantity: item.qty,
      unitPrice: item.price,
      total: item.qty * item.price,
    })),
    totals: {
      subtotal: calculateSubtotal(lineItems),
      discount: settings.discountAmount,
      tax: calculateTax(lineItems, settings.taxRate),
      taxRate: settings.taxRate,
      total: calculateTotal(lineItems, settings),
    },
    meta: {
      quoteNumber: settings.quoteNumber,
      date: formatDate(new Date()),
      validUntil: formatDate(settings.expiryDate),
      terms: settings.termsAndConditions,
    },
    branding: {
      logoUrl: settings.company.logoUrl,
      companyName: settings.company.name,
      companyAddress: settings.company.address,
    },
  };

  return (
    <glyph-editor
      ref={editorRef}
      api-key={process.env.NEXT_PUBLIC_GLYPH_API_KEY}
      template={settings.templateId}
      data={JSON.stringify(glyphData)}
    />
  );
}
```

### 2. Real-time Data Synchronization

When users edit line items in Quoted, the changes reflect immediately in the Glyph preview:

```typescript
// quoted/src/hooks/useGlyphSync.ts
import { useCallback, useEffect, useRef } from 'react';
import { useQuoteStore } from '@/stores/quote';

export function useGlyphSync() {
  const editorRef = useRef<HTMLElement>(null);
  const { client, lineItems, settings } = useQuoteStore();

  // Sync data to Glyph editor whenever it changes
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const glyphData = transformToGlyphFormat({ client, lineItems, settings });

    // Use the setData method to update without full re-render
    (editor as any).setData(glyphData);
  }, [client, lineItems, settings]);

  // Handle modifications from Glyph
  const handleModified = useCallback((event: CustomEvent) => {
    const { html, prompt, timestamp } = event.detail;

    // Store modification history for undo/redo
    useQuoteStore.getState().addModification({
      html,
      prompt,
      timestamp,
    });
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    editor.addEventListener('glyph:modified', handleModified);
    return () => editor.removeEventListener('glyph:modified', handleModified);
  }, [handleModified]);

  return editorRef;
}
```

### 3. PDF Generation Flow

Quoted uses Glyph's generation API for final PDF output:

```typescript
// quoted/src/lib/pdf.ts
export async function generateQuotePdf(
  sessionId: string,
  options: PdfOptions
): Promise<Blob> {
  const response = await fetch('https://api.glyph.so/v1/generate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GLYPH_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sessionId,
      format: 'pdf',
      options: {
        pageSize: options.pageSize || 'letter',
        margins: options.margins || { top: 0.5, right: 0.5, bottom: 0.5, left: 0.5 },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new GlyphError(error.error.message, error.error.code);
  }

  return response.blob();
}

// Usage in component
async function handleDownload() {
  const sessionId = editorRef.current?.getSessionId();
  if (!sessionId) return;

  try {
    const pdf = await generateQuotePdf(sessionId, {
      pageSize: 'letter',
    });

    // Trigger download
    const url = URL.createObjectURL(pdf);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quote-${quoteNumber}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('PDF generation failed:', error);
    toast.error('Failed to generate PDF');
  }
}
```

## Template Selection

Quoted allows users to choose from multiple templates:

```typescript
// quoted/src/components/TemplateSelector.tsx
const TEMPLATES = [
  { id: 'quote-modern', name: 'Modern', description: 'Clean and minimal' },
  { id: 'quote-professional', name: 'Professional', description: 'Traditional business' },
  { id: 'quote-bold', name: 'Bold', description: 'High-impact design' },
];

export function TemplateSelector({ value, onChange }) {
  return (
    <div className="template-grid">
      {TEMPLATES.map(template => (
        <button
          key={template.id}
          className={`template-card ${value === template.id ? 'selected' : ''}`}
          onClick={() => onChange(template.id)}
        >
          <div className="template-preview">
            {/* Preview thumbnail */}
          </div>
          <h3>{template.name}</h3>
          <p>{template.description}</p>
        </button>
      ))}
    </div>
  );
}
```

## AI Customization Panel

Quoted wraps the Glyph editor with a custom AI chat interface:

```typescript
// quoted/src/components/AiPanel.tsx
import { useState } from 'react';

export function AiPanel({ editorRef }) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<Message[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;

    setLoading(true);
    setHistory(prev => [...prev, { role: 'user', content: prompt }]);

    try {
      const editor = editorRef.current;
      await editor.modify(prompt);

      setHistory(prev => [...prev, {
        role: 'assistant',
        content: 'Done! I\'ve updated the document.'
      }]);
    } catch (error) {
      setHistory(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${error.message}`
      }]);
    } finally {
      setLoading(false);
      setPrompt('');
    }
  };

  return (
    <div className="ai-panel">
      <div className="chat-history">
        {history.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            {msg.content}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="e.g., Make the header blue"
          disabled={loading}
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Updating...' : 'Send'}
        </button>
      </form>
    </div>
  );
}
```

## Error Handling

Quoted implements comprehensive error handling for Glyph interactions:

```typescript
// quoted/src/lib/glyph-errors.ts
export function handleGlyphError(error: GlyphError) {
  switch (error.code) {
    case 'RATE_LIMIT_EXCEEDED':
      return {
        message: 'You\'ve reached the modification limit. Please wait a moment.',
        action: 'retry',
        retryAfter: parseInt(error.headers?.['retry-after'] || '60'),
      };

    case 'SESSION_EXPIRED':
      return {
        message: 'Your session has expired. Refreshing...',
        action: 'refresh',
      };

    case 'GENERATION_FAILED':
      return {
        message: 'PDF generation failed. Please try again.',
        action: 'retry',
      };

    default:
      return {
        message: 'Something went wrong. Please try again.',
        action: 'retry',
      };
  }
}
```

## Performance Optimizations

### Debounced Updates

```typescript
// quoted/src/hooks/useDebouncedGlyphUpdate.ts
import { useDebouncedCallback } from 'use-debounce';

export function useDebouncedGlyphUpdate(editorRef, data) {
  const updateEditor = useDebouncedCallback(
    (newData) => {
      editorRef.current?.setData(newData);
    },
    300, // 300ms debounce
    { maxWait: 1000 } // Max 1 second wait
  );

  useEffect(() => {
    updateEditor(data);
  }, [data, updateEditor]);
}
```

### Session Caching

```typescript
// quoted/src/lib/session-cache.ts
const SESSION_CACHE = new Map<string, { sessionId: string; expires: Date }>();

export function cacheSession(quoteId: string, sessionId: string) {
  SESSION_CACHE.set(quoteId, {
    sessionId,
    expires: new Date(Date.now() + 30 * 60 * 1000), // 30 min
  });
}

export function getCachedSession(quoteId: string): string | null {
  const cached = SESSION_CACHE.get(quoteId);
  if (!cached) return null;
  if (cached.expires < new Date()) {
    SESSION_CACHE.delete(quoteId);
    return null;
  }
  return cached.sessionId;
}
```

<Aside type="tip">
Want to build something similar? Check out our [React example](/examples/react/) for a simpler starting point, then scale up to this architecture.
</Aside>

## Key Takeaways

1. **Data transformation**: Map your domain model to Glyph's template schema
2. **Real-time sync**: Use `setData()` for efficient updates without full re-renders
3. **Event handling**: Listen to Glyph events for modification history and error handling
4. **Session management**: Cache sessions to avoid unnecessary API calls
5. **Error recovery**: Implement graceful fallbacks for rate limits and failures
