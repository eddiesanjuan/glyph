---
title: React Integration
description: Using Glyph with React applications
---

import { Aside, Tabs, TabItem, Code } from '@astrojs/starlight/components';

This guide shows how to integrate the Glyph editor into a React application with full TypeScript support.

## Installation

<Tabs>
  <TabItem label="npm">
    ```bash
    npm install @glyph-sdk/web
    ```
  </TabItem>
  <TabItem label="yarn">
    ```bash
    yarn add @glyph-sdk/web
    ```
  </TabItem>
  <TabItem label="pnpm">
    ```bash
    pnpm add @glyph-sdk/web
    ```
  </TabItem>
</Tabs>

## Basic Setup

### 1. Register the Web Component

Register Glyph's web component once at your app's entry point:

```tsx
// src/main.tsx or src/index.tsx
import '@glyph-sdk/web';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

### 2. Add TypeScript Declarations

Create type declarations for the web component:

```typescript
// src/types/glyph.d.ts
declare namespace JSX {
  interface IntrinsicElements {
    'glyph-editor': React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        'api-key'?: string;
        template?: string;
        data?: string;
        'base-url'?: string;
        theme?: string;
      },
      HTMLElement
    >;
  }
}

// Extend the HTMLElement for ref typing
interface GlyphEditorElement extends HTMLElement {
  setData(data: object): void;
  setTemplate(templateId: string): void;
  getSessionId(): string | null;
  getHtml(): string;
  modify(prompt: string, options?: { region?: string }): Promise<void>;
  generatePdf(options?: object): Promise<Blob>;
  generatePng(options?: object): Promise<Blob>;
  undo(): void;
  redo(): void;
}
```

## React Component Wrapper

Create a reusable React component that wraps the Glyph editor:

```tsx
// src/components/GlyphEditor.tsx
import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';

export interface QuoteData {
  client: {
    name: string;
    company?: string;
    email?: string;
    address?: string;
  };
  lineItems: Array<{
    description: string;
    details?: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  totals: {
    subtotal: number;
    discount?: number;
    tax?: number;
    total: number;
  };
  meta?: {
    quoteNumber?: string;
    date?: string;
    validUntil?: string;
    notes?: string;
  };
  branding?: {
    logoUrl?: string;
    companyName?: string;
  };
}

export interface GlyphEditorProps {
  apiKey: string;
  template?: string;
  data: QuoteData;
  baseUrl?: string;
  theme?: 'light' | 'dark' | 'system';
  className?: string;
  onReady?: () => void;
  onModified?: (detail: { html: string; prompt: string }) => void;
  onSaved?: (detail: { sessionId: string }) => void;
  onError?: (detail: { code: string; message: string }) => void;
  onRegionSelected?: (detail: { region: string; element: HTMLElement }) => void;
}

export interface GlyphEditorRef {
  modify: (prompt: string, options?: { region?: string }) => Promise<void>;
  generatePdf: (options?: object) => Promise<Blob>;
  generatePng: (options?: object) => Promise<Blob>;
  getSessionId: () => string | null;
  getHtml: () => string;
  setData: (data: QuoteData) => void;
  undo: () => void;
  redo: () => void;
}

export const GlyphEditor = forwardRef<GlyphEditorRef, GlyphEditorProps>(
  (
    {
      apiKey,
      template = 'quote-modern',
      data,
      baseUrl,
      theme = 'system',
      className,
      onReady,
      onModified,
      onSaved,
      onError,
      onRegionSelected,
    },
    ref
  ) => {
    const editorRef = useRef<GlyphEditorElement>(null);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      modify: (prompt, options) => editorRef.current!.modify(prompt, options),
      generatePdf: (options) => editorRef.current!.generatePdf(options),
      generatePng: (options) => editorRef.current!.generatePng(options),
      getSessionId: () => editorRef.current!.getSessionId(),
      getHtml: () => editorRef.current!.getHtml(),
      setData: (newData) => editorRef.current!.setData(newData),
      undo: () => editorRef.current!.undo(),
      redo: () => editorRef.current!.redo(),
    }));

    // Event handlers
    const handleReady = useCallback(() => onReady?.(), [onReady]);
    const handleModified = useCallback(
      (e: CustomEvent) => onModified?.(e.detail),
      [onModified]
    );
    const handleSaved = useCallback(
      (e: CustomEvent) => onSaved?.(e.detail),
      [onSaved]
    );
    const handleError = useCallback(
      (e: CustomEvent) => onError?.(e.detail),
      [onError]
    );
    const handleRegionSelected = useCallback(
      (e: CustomEvent) => onRegionSelected?.(e.detail),
      [onRegionSelected]
    );

    // Attach event listeners
    useEffect(() => {
      const editor = editorRef.current;
      if (!editor) return;

      editor.addEventListener('glyph:ready', handleReady);
      editor.addEventListener('glyph:modified', handleModified as EventListener);
      editor.addEventListener('glyph:saved', handleSaved as EventListener);
      editor.addEventListener('glyph:error', handleError as EventListener);
      editor.addEventListener('glyph:region-selected', handleRegionSelected as EventListener);

      return () => {
        editor.removeEventListener('glyph:ready', handleReady);
        editor.removeEventListener('glyph:modified', handleModified as EventListener);
        editor.removeEventListener('glyph:saved', handleSaved as EventListener);
        editor.removeEventListener('glyph:error', handleError as EventListener);
        editor.removeEventListener('glyph:region-selected', handleRegionSelected as EventListener);
      };
    }, [handleReady, handleModified, handleSaved, handleError, handleRegionSelected]);

    return (
      <glyph-editor
        ref={editorRef}
        api-key={apiKey}
        template={template}
        data={JSON.stringify(data)}
        base-url={baseUrl}
        theme={theme}
        className={className}
      />
    );
  }
);

GlyphEditor.displayName = 'GlyphEditor';
```

## Usage Examples

### Basic Usage

```tsx
// src/App.tsx
import { GlyphEditor, GlyphEditorRef, QuoteData } from './components/GlyphEditor';
import { useRef, useState } from 'react';

function App() {
  const editorRef = useRef<GlyphEditorRef>(null);
  const [prompt, setPrompt] = useState('');

  const quoteData: QuoteData = {
    client: {
      name: 'Jane Smith',
      company: 'Tech Innovations Inc.',
      email: 'jane@techinnovations.com',
    },
    lineItems: [
      {
        description: 'Web Application Development',
        details: 'Full-stack React + Node.js application',
        quantity: 1,
        unitPrice: 15000,
        total: 15000,
      },
      {
        description: 'UI/UX Design',
        details: 'Complete design system and prototypes',
        quantity: 1,
        unitPrice: 5000,
        total: 5000,
      },
    ],
    totals: {
      subtotal: 20000,
      tax: 1600,
      total: 21600,
    },
    meta: {
      quoteNumber: 'Q-2024-042',
      date: 'January 18, 2024',
      validUntil: 'February 18, 2024',
    },
    branding: {
      companyName: 'DevStudio Pro',
    },
  };

  const handleModify = async () => {
    if (!prompt.trim()) return;
    await editorRef.current?.modify(prompt);
    setPrompt('');
  };

  const handleDownload = async () => {
    const pdf = await editorRef.current?.generatePdf();
    if (pdf) {
      const url = URL.createObjectURL(pdf);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'quote.pdf';
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="app">
      <div className="toolbar">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe changes..."
          onKeyDown={(e) => e.key === 'Enter' && handleModify()}
        />
        <button onClick={handleModify}>Apply</button>
        <button onClick={handleDownload}>Download PDF</button>
      </div>

      <GlyphEditor
        ref={editorRef}
        apiKey={import.meta.env.VITE_GLYPH_API_KEY}
        template="quote-modern"
        data={quoteData}
        onReady={() => console.log('Editor ready')}
        onModified={({ prompt }) => console.log('Modified:', prompt)}
        onError={({ message }) => console.error('Error:', message)}
      />
    </div>
  );
}

export default App;
```

### With React Hook Form

```tsx
// src/components/QuoteForm.tsx
import { useForm, useFieldArray } from 'react-hook-form';
import { GlyphEditor, GlyphEditorRef, QuoteData } from './GlyphEditor';
import { useRef, useMemo } from 'react';

interface QuoteFormData {
  clientName: string;
  clientCompany: string;
  clientEmail: string;
  items: Array<{
    description: string;
    quantity: number;
    price: number;
  }>;
}

export function QuoteForm() {
  const editorRef = useRef<GlyphEditorRef>(null);

  const { register, control, watch } = useForm<QuoteFormData>({
    defaultValues: {
      clientName: '',
      clientCompany: '',
      clientEmail: '',
      items: [{ description: '', quantity: 1, price: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const formData = watch();

  // Transform form data to Glyph format
  const glyphData: QuoteData = useMemo(() => {
    const lineItems = formData.items.map((item) => ({
      description: item.description || 'Untitled Item',
      quantity: item.quantity || 1,
      unitPrice: item.price || 0,
      total: (item.quantity || 1) * (item.price || 0),
    }));

    const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);

    return {
      client: {
        name: formData.clientName || 'Client Name',
        company: formData.clientCompany,
        email: formData.clientEmail,
      },
      lineItems: lineItems.length > 0 ? lineItems : [
        { description: 'Sample Item', quantity: 1, unitPrice: 0, total: 0 }
      ],
      totals: {
        subtotal,
        total: subtotal,
      },
    };
  }, [formData]);

  // Update editor when data changes
  useEffect(() => {
    editorRef.current?.setData(glyphData);
  }, [glyphData]);

  return (
    <div className="quote-builder">
      <div className="form-panel">
        <h2>Client Information</h2>
        <input {...register('clientName')} placeholder="Client Name" />
        <input {...register('clientCompany')} placeholder="Company" />
        <input {...register('clientEmail')} placeholder="Email" />

        <h2>Line Items</h2>
        {fields.map((field, index) => (
          <div key={field.id} className="line-item-row">
            <input
              {...register(`items.${index}.description`)}
              placeholder="Description"
            />
            <input
              {...register(`items.${index}.quantity`, { valueAsNumber: true })}
              type="number"
              placeholder="Qty"
            />
            <input
              {...register(`items.${index}.price`, { valueAsNumber: true })}
              type="number"
              placeholder="Price"
            />
            <button type="button" onClick={() => remove(index)}>
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => append({ description: '', quantity: 1, price: 0 })}
        >
          Add Item
        </button>
      </div>

      <div className="preview-panel">
        <GlyphEditor
          ref={editorRef}
          apiKey={import.meta.env.VITE_GLYPH_API_KEY}
          data={glyphData}
        />
      </div>
    </div>
  );
}
```

### With Zustand State Management

```tsx
// src/stores/quoteStore.ts
import { create } from 'zustand';
import type { QuoteData } from '../components/GlyphEditor';

interface QuoteState {
  data: QuoteData;
  template: string;
  modifications: string[];
  setClient: (client: QuoteData['client']) => void;
  addLineItem: (item: QuoteData['lineItems'][0]) => void;
  removeLineItem: (index: number) => void;
  setTemplate: (template: string) => void;
  addModification: (prompt: string) => void;
}

export const useQuoteStore = create<QuoteState>((set) => ({
  data: {
    client: { name: '' },
    lineItems: [],
    totals: { subtotal: 0, total: 0 },
  },
  template: 'quote-modern',
  modifications: [],

  setClient: (client) =>
    set((state) => ({
      data: { ...state.data, client },
    })),

  addLineItem: (item) =>
    set((state) => {
      const lineItems = [...state.data.lineItems, item];
      const subtotal = lineItems.reduce((sum, i) => sum + i.total, 0);
      return {
        data: {
          ...state.data,
          lineItems,
          totals: { ...state.data.totals, subtotal, total: subtotal },
        },
      };
    }),

  removeLineItem: (index) =>
    set((state) => {
      const lineItems = state.data.lineItems.filter((_, i) => i !== index);
      const subtotal = lineItems.reduce((sum, i) => sum + i.total, 0);
      return {
        data: {
          ...state.data,
          lineItems,
          totals: { ...state.data.totals, subtotal, total: subtotal },
        },
      };
    }),

  setTemplate: (template) => set({ template }),

  addModification: (prompt) =>
    set((state) => ({
      modifications: [...state.modifications, prompt],
    })),
}));
```

```tsx
// src/components/QuoteEditor.tsx
import { useRef, useEffect } from 'react';
import { GlyphEditor, GlyphEditorRef } from './GlyphEditor';
import { useQuoteStore } from '../stores/quoteStore';

export function QuoteEditor() {
  const editorRef = useRef<GlyphEditorRef>(null);
  const { data, template, addModification } = useQuoteStore();

  // Sync store changes to editor
  useEffect(() => {
    editorRef.current?.setData(data);
  }, [data]);

  return (
    <GlyphEditor
      ref={editorRef}
      apiKey={import.meta.env.VITE_GLYPH_API_KEY}
      template={template}
      data={data}
      onModified={({ prompt }) => addModification(prompt)}
    />
  );
}
```

## Styling

### CSS Module

```css
/* src/components/GlyphEditor.module.css */
.editor-container {
  height: 100%;
  min-height: 600px;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
}

.editor-container :global(glyph-editor) {
  --glyph-accent: #7c3aed;
  --glyph-radius: 8px;
}
```

### Tailwind CSS

```tsx
<GlyphEditor
  className="h-full min-h-[600px] rounded-lg shadow-lg overflow-hidden
             [--glyph-accent:theme(colors.purple.600)]"
  {...props}
/>
```

<Aside type="tip">
The Glyph editor respects your app's color scheme. Set `theme="system"` to automatically match the user's preference.
</Aside>

## Error Boundary

Wrap the editor in an error boundary for production resilience:

```tsx
// src/components/GlyphErrorBoundary.tsx
import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class GlyphErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="error-fallback">
          <h2>Document preview unavailable</h2>
          <p>Please refresh the page to try again.</p>
        </div>
      );
    }

    return this.props.children;
  }
}

// Usage
<GlyphErrorBoundary>
  <GlyphEditor {...props} />
</GlyphErrorBoundary>
```

## Next Steps

- [Vue Integration](/examples/vue/) - Vue 3 Composition API example
- [Vanilla JS](/examples/vanilla/) - Framework-agnostic usage
- [SDK Reference](/sdk/overview/) - Complete API documentation
