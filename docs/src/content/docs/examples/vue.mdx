---
title: Vue Integration
description: Using Glyph with Vue 3 applications
---

import { Aside, Tabs, TabItem } from '@astrojs/starlight/components';

This guide shows how to integrate the Glyph editor into a Vue 3 application using the Composition API with full TypeScript support.

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

Register Glyph's web component in your Vue app:

```typescript
// src/main.ts
import { createApp } from 'vue';
import '@glyph-sdk/web';
import App from './App.vue';

const app = createApp(App);

// Tell Vue to ignore glyph-* elements
app.config.compilerOptions.isCustomElement = (tag) => tag.startsWith('glyph-');

app.mount('#app');
```

### 2. Add TypeScript Declarations

Create type declarations for the web component:

```typescript
// src/types/glyph.d.ts
declare module 'vue' {
  interface GlobalComponents {
    'glyph-editor': {
      'api-key'?: string;
      template?: string;
      data?: string;
      'base-url'?: string;
      theme?: string;
    };
  }
}

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

export {};
```

## Vue Composable

Create a composable for easy integration:

```typescript
// src/composables/useGlyphEditor.ts
import { ref, onMounted, onUnmounted, watch, type Ref } from 'vue';

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
  };
  branding?: {
    logoUrl?: string;
    companyName?: string;
  };
}

export interface UseGlyphEditorOptions {
  onReady?: () => void;
  onModified?: (detail: { html: string; prompt: string }) => void;
  onSaved?: (detail: { sessionId: string }) => void;
  onError?: (detail: { code: string; message: string }) => void;
  onRegionSelected?: (detail: { region: string }) => void;
}

export function useGlyphEditor(
  editorRef: Ref<GlyphEditorElement | null>,
  data: Ref<QuoteData>,
  options: UseGlyphEditorOptions = {}
) {
  const isReady = ref(false);
  const isModifying = ref(false);
  const error = ref<string | null>(null);

  // Event handlers
  const handleReady = () => {
    isReady.value = true;
    options.onReady?.();
  };

  const handleModified = (e: CustomEvent) => {
    isModifying.value = false;
    options.onModified?.(e.detail);
  };

  const handleSaved = (e: CustomEvent) => {
    options.onSaved?.(e.detail);
  };

  const handleError = (e: CustomEvent) => {
    error.value = e.detail.message;
    isModifying.value = false;
    options.onError?.(e.detail);
  };

  const handleRegionSelected = (e: CustomEvent) => {
    options.onRegionSelected?.(e.detail);
  };

  // Attach/detach event listeners
  onMounted(() => {
    const editor = editorRef.value;
    if (!editor) return;

    editor.addEventListener('glyph:ready', handleReady);
    editor.addEventListener('glyph:modified', handleModified as EventListener);
    editor.addEventListener('glyph:saved', handleSaved as EventListener);
    editor.addEventListener('glyph:error', handleError as EventListener);
    editor.addEventListener('glyph:region-selected', handleRegionSelected as EventListener);
  });

  onUnmounted(() => {
    const editor = editorRef.value;
    if (!editor) return;

    editor.removeEventListener('glyph:ready', handleReady);
    editor.removeEventListener('glyph:modified', handleModified as EventListener);
    editor.removeEventListener('glyph:saved', handleSaved as EventListener);
    editor.removeEventListener('glyph:error', handleError as EventListener);
    editor.removeEventListener('glyph:region-selected', handleRegionSelected as EventListener);
  });

  // Sync data changes to editor
  watch(
    data,
    (newData) => {
      if (isReady.value && editorRef.value) {
        editorRef.value.setData(newData);
      }
    },
    { deep: true }
  );

  // Methods
  const modify = async (prompt: string, region?: string) => {
    if (!editorRef.value || isModifying.value) return;

    isModifying.value = true;
    error.value = null;

    try {
      await editorRef.value.modify(prompt, region ? { region } : undefined);
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Modification failed';
      isModifying.value = false;
    }
  };

  const generatePdf = async (options?: object): Promise<Blob | null> => {
    if (!editorRef.value) return null;
    return editorRef.value.generatePdf(options);
  };

  const generatePng = async (options?: object): Promise<Blob | null> => {
    if (!editorRef.value) return null;
    return editorRef.value.generatePng(options);
  };

  const getSessionId = (): string | null => {
    return editorRef.value?.getSessionId() ?? null;
  };

  const getHtml = (): string => {
    return editorRef.value?.getHtml() ?? '';
  };

  const undo = () => editorRef.value?.undo();
  const redo = () => editorRef.value?.redo();

  return {
    isReady,
    isModifying,
    error,
    modify,
    generatePdf,
    generatePng,
    getSessionId,
    getHtml,
    undo,
    redo,
  };
}
```

## Component Examples

### Basic Usage

```vue
<!-- src/components/QuoteEditor.vue -->
<script setup lang="ts">
import { ref, computed } from 'vue';
import { useGlyphEditor, type QuoteData } from '@/composables/useGlyphEditor';

const props = defineProps<{
  apiKey: string;
  template?: string;
}>();

const editorRef = ref<GlyphEditorElement | null>(null);
const prompt = ref('');

const quoteData = ref<QuoteData>({
  client: {
    name: 'Alice Johnson',
    company: 'Startup Labs',
    email: 'alice@startuplabs.io',
  },
  lineItems: [
    {
      description: 'Product Development',
      details: 'MVP development and launch',
      quantity: 1,
      unitPrice: 25000,
      total: 25000,
    },
  ],
  totals: {
    subtotal: 25000,
    total: 25000,
  },
  meta: {
    quoteNumber: 'Q-2024-001',
    date: new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
  },
});

const { isReady, isModifying, error, modify, generatePdf } = useGlyphEditor(
  editorRef,
  quoteData,
  {
    onReady: () => console.log('Editor ready'),
    onModified: ({ prompt }) => console.log('Modified with:', prompt),
    onError: ({ message }) => console.error('Error:', message),
  }
);

const dataJson = computed(() => JSON.stringify(quoteData.value));

const handleModify = async () => {
  if (!prompt.value.trim()) return;
  await modify(prompt.value);
  prompt.value = '';
};

const handleDownload = async () => {
  const pdf = await generatePdf();
  if (pdf) {
    const url = URL.createObjectURL(pdf);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quote-${quoteData.value.meta?.quoteNumber}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }
};
</script>

<template>
  <div class="quote-editor">
    <div class="toolbar">
      <input
        v-model="prompt"
        type="text"
        placeholder="Describe changes (e.g., 'Make the header blue')"
        :disabled="isModifying"
        @keydown.enter="handleModify"
      />
      <button @click="handleModify" :disabled="isModifying || !prompt.trim()">
        {{ isModifying ? 'Applying...' : 'Apply' }}
      </button>
      <button @click="handleDownload" :disabled="!isReady">
        Download PDF
      </button>
    </div>

    <div v-if="error" class="error">{{ error }}</div>

    <glyph-editor
      ref="editorRef"
      :api-key="apiKey"
      :template="template || 'quote-modern'"
      :data="dataJson"
    />
  </div>
</template>

<style scoped>
.quote-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.toolbar {
  display: flex;
  gap: 0.5rem;
  padding: 1rem;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.toolbar input {
  flex: 1;
  padding: 0.5rem 1rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
}

.toolbar button {
  padding: 0.5rem 1rem;
  background: #7c3aed;
  color: white;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
}

.toolbar button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error {
  padding: 0.75rem 1rem;
  background: #fef2f2;
  color: #dc2626;
  border-bottom: 1px solid #fecaca;
}

glyph-editor {
  flex: 1;
  min-height: 500px;
}
</style>
```

### With Reactive Form

```vue
<!-- src/components/QuoteBuilder.vue -->
<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useGlyphEditor, type QuoteData } from '@/composables/useGlyphEditor';

const editorRef = ref<GlyphEditorElement | null>(null);

// Form state
const clientName = ref('');
const clientCompany = ref('');
const clientEmail = ref('');
const items = ref([
  { description: '', quantity: 1, price: 0 },
]);

// Computed quote data
const quoteData = computed<QuoteData>(() => {
  const lineItems = items.value
    .filter(item => item.description.trim())
    .map(item => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.price,
      total: item.quantity * item.price,
    }));

  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);

  return {
    client: {
      name: clientName.value || 'Client Name',
      company: clientCompany.value || undefined,
      email: clientEmail.value || undefined,
    },
    lineItems: lineItems.length > 0 ? lineItems : [
      { description: 'Sample Item', quantity: 1, unitPrice: 0, total: 0 },
    ],
    totals: {
      subtotal,
      total: subtotal,
    },
  };
});

const { isReady, modify, generatePdf } = useGlyphEditor(editorRef, quoteData);

const addItem = () => {
  items.value.push({ description: '', quantity: 1, price: 0 });
};

const removeItem = (index: number) => {
  items.value.splice(index, 1);
};

const dataJson = computed(() => JSON.stringify(quoteData.value));
</script>

<template>
  <div class="quote-builder">
    <aside class="form-panel">
      <section>
        <h2>Client Information</h2>
        <div class="form-group">
          <label>Name</label>
          <input v-model="clientName" type="text" />
        </div>
        <div class="form-group">
          <label>Company</label>
          <input v-model="clientCompany" type="text" />
        </div>
        <div class="form-group">
          <label>Email</label>
          <input v-model="clientEmail" type="email" />
        </div>
      </section>

      <section>
        <h2>Line Items</h2>
        <div v-for="(item, index) in items" :key="index" class="line-item">
          <input
            v-model="item.description"
            type="text"
            placeholder="Description"
          />
          <input
            v-model.number="item.quantity"
            type="number"
            min="1"
            placeholder="Qty"
          />
          <input
            v-model.number="item.price"
            type="number"
            min="0"
            step="0.01"
            placeholder="Price"
          />
          <button @click="removeItem(index)" class="remove-btn">×</button>
        </div>
        <button @click="addItem" class="add-btn">+ Add Item</button>
      </section>
    </aside>

    <main class="preview-panel">
      <glyph-editor
        ref="editorRef"
        :api-key="$config.glyphApiKey"
        template="quote-modern"
        :data="dataJson"
      />
    </main>
  </div>
</template>

<style scoped>
.quote-builder {
  display: grid;
  grid-template-columns: 350px 1fr;
  height: 100vh;
}

.form-panel {
  padding: 1.5rem;
  background: #f8fafc;
  border-right: 1px solid #e2e8f0;
  overflow-y: auto;
}

.form-panel h2 {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: #334155;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  font-size: 0.875rem;
  color: #64748b;
  margin-bottom: 0.25rem;
}

.form-group input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
}

.line-item {
  display: grid;
  grid-template-columns: 1fr 60px 80px 32px;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.line-item input {
  padding: 0.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
}

.remove-btn {
  background: #fee2e2;
  color: #dc2626;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
}

.add-btn {
  width: 100%;
  padding: 0.5rem;
  background: #f1f5f9;
  border: 1px dashed #cbd5e1;
  border-radius: 0.375rem;
  cursor: pointer;
  color: #64748b;
}

.preview-panel {
  overflow: hidden;
}

.preview-panel glyph-editor {
  height: 100%;
}
</style>
```

### With Pinia Store

```typescript
// src/stores/quote.ts
import { defineStore } from 'pinia';
import type { QuoteData } from '@/composables/useGlyphEditor';

interface QuoteState {
  data: QuoteData;
  template: string;
  modifications: Array<{ prompt: string; timestamp: Date }>;
}

export const useQuoteStore = defineStore('quote', {
  state: (): QuoteState => ({
    data: {
      client: { name: '' },
      lineItems: [],
      totals: { subtotal: 0, total: 0 },
    },
    template: 'quote-modern',
    modifications: [],
  }),

  getters: {
    subtotal: (state) =>
      state.data.lineItems.reduce((sum, item) => sum + item.total, 0),
    hasItems: (state) => state.data.lineItems.length > 0,
  },

  actions: {
    setClient(client: QuoteData['client']) {
      this.data.client = client;
    },

    addLineItem(item: QuoteData['lineItems'][0]) {
      this.data.lineItems.push(item);
      this.recalculateTotals();
    },

    removeLineItem(index: number) {
      this.data.lineItems.splice(index, 1);
      this.recalculateTotals();
    },

    updateLineItem(index: number, item: Partial<QuoteData['lineItems'][0]>) {
      Object.assign(this.data.lineItems[index], item);
      this.recalculateTotals();
    },

    recalculateTotals() {
      const subtotal = this.data.lineItems.reduce(
        (sum, item) => sum + item.total,
        0
      );
      this.data.totals = {
        ...this.data.totals,
        subtotal,
        total: subtotal - (this.data.totals.discount || 0),
      };
    },

    setTemplate(template: string) {
      this.template = template;
    },

    addModification(prompt: string) {
      this.modifications.push({ prompt, timestamp: new Date() });
    },
  },
});
```

```vue
<!-- src/components/QuoteEditorWithStore.vue -->
<script setup lang="ts">
import { ref, computed, toRef } from 'vue';
import { storeToRefs } from 'pinia';
import { useQuoteStore } from '@/stores/quote';
import { useGlyphEditor } from '@/composables/useGlyphEditor';

const store = useQuoteStore();
const { data, template } = storeToRefs(store);

const editorRef = ref<GlyphEditorElement | null>(null);

const { isReady, modify, generatePdf } = useGlyphEditor(editorRef, data, {
  onModified: ({ prompt }) => store.addModification(prompt),
});

const dataJson = computed(() => JSON.stringify(data.value));
</script>

<template>
  <glyph-editor
    ref="editorRef"
    :api-key="$config.glyphApiKey"
    :template="template"
    :data="dataJson"
  />
</template>
```

## Nuxt 3 Integration

For Nuxt 3, create a plugin to register the component:

```typescript
// plugins/glyph.client.ts
export default defineNuxtPlugin(() => {
  if (process.client) {
    import('@glyph-sdk/web');
  }
});
```

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  vue: {
    compilerOptions: {
      isCustomElement: (tag) => tag.startsWith('glyph-'),
    },
  },
});
```

<Aside type="caution">
The Glyph SDK only works on the client side. Always use the `.client.ts` suffix for the plugin or wrap usage in `<ClientOnly>` components.
</Aside>

## Styling with CSS Variables

```vue
<style>
glyph-editor {
  --glyph-accent: #7c3aed;
  --glyph-accent-hover: #6d28d9;
  --glyph-radius: 0.5rem;
  --glyph-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  --glyph-font: 'Inter', system-ui, sans-serif;
}

/* Dark mode */
.dark glyph-editor {
  --glyph-bg: #1e293b;
  --glyph-text: #f1f5f9;
  --glyph-border: #334155;
}
</style>
```

## Next Steps

- [React Integration](/examples/react/) - React example with hooks
- [Vanilla JS](/examples/vanilla/) - Framework-agnostic usage
- [Theming Guide](/sdk/theming/) - Complete styling reference
