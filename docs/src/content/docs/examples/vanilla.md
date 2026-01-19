---
title: Vanilla JavaScript
description: Using Glyph without a framework
---

import { Aside, Tabs, TabItem } from '@astrojs/starlight/components';

This guide shows how to use the Glyph editor with plain HTML and JavaScript - no build tools or frameworks required.

## Quick Start

The fastest way to get started is with the CDN:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Quote Editor</title>
  <script type="module" src="https://glyph-sdk.vercel.app/glyph.min.js"></script>
  <style>
    body {
      margin: 0;
      font-family: system-ui, sans-serif;
    }
    .container {
      display: grid;
      grid-template-columns: 1fr 2fr;
      height: 100vh;
    }
    .controls {
      padding: 1.5rem;
      background: #f8fafc;
      border-right: 1px solid #e2e8f0;
    }
    .editor-wrapper {
      overflow: hidden;
    }
    glyph-editor {
      height: 100%;
    }
    .input-group {
      margin-bottom: 1rem;
    }
    .input-group label {
      display: block;
      font-size: 0.875rem;
      color: #64748b;
      margin-bottom: 0.25rem;
    }
    .input-group input,
    .input-group textarea {
      width: 100%;
      padding: 0.5rem;
      border: 1px solid #e2e8f0;
      border-radius: 0.375rem;
      box-sizing: border-box;
    }
    button {
      padding: 0.5rem 1rem;
      background: #7c3aed;
      color: white;
      border: none;
      border-radius: 0.375rem;
      cursor: pointer;
      margin-right: 0.5rem;
    }
    button:hover {
      background: #6d28d9;
    }
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="controls">
      <h2>AI Customization</h2>
      <div class="input-group">
        <label for="prompt">Describe changes</label>
        <textarea id="prompt" rows="3" placeholder="e.g., Make the header blue and add our company tagline"></textarea>
      </div>
      <button id="apply-btn">Apply Changes</button>
      <button id="download-btn">Download PDF</button>
    </div>

    <div class="editor-wrapper">
      <glyph-editor
        id="editor"
        api-key="gk_your_api_key"
        template="quote-modern"
      ></glyph-editor>
    </div>
  </div>

  <script type="module">
    const editor = document.getElementById('editor');
    const promptInput = document.getElementById('prompt');
    const applyBtn = document.getElementById('apply-btn');
    const downloadBtn = document.getElementById('download-btn');

    // Set initial data
    const quoteData = {
      client: {
        name: 'John Smith',
        company: 'Acme Corp',
        email: 'john@acme.com',
      },
      lineItems: [
        {
          description: 'Consulting Services',
          details: 'Strategic planning and implementation',
          quantity: 10,
          unitPrice: 250,
          total: 2500,
        },
        {
          description: 'Development',
          details: 'Custom application development',
          quantity: 40,
          unitPrice: 175,
          total: 7000,
        },
      ],
      totals: {
        subtotal: 9500,
        tax: 760,
        total: 10260,
      },
      meta: {
        quoteNumber: 'Q-2024-001',
        date: new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
      },
      branding: {
        companyName: 'My Company',
      },
    };

    // Set data attribute
    editor.setAttribute('data', JSON.stringify(quoteData));

    // Wait for editor to be ready
    editor.addEventListener('glyph:ready', () => {
      console.log('Editor is ready');
      applyBtn.disabled = false;
      downloadBtn.disabled = false;
    });

    // Handle modifications
    editor.addEventListener('glyph:modified', (event) => {
      console.log('Document modified:', event.detail.prompt);
    });

    // Handle errors
    editor.addEventListener('glyph:error', (event) => {
      console.error('Error:', event.detail.message);
      alert('Error: ' + event.detail.message);
    });

    // Apply AI changes
    applyBtn.addEventListener('click', async () => {
      const prompt = promptInput.value.trim();
      if (!prompt) return;

      applyBtn.disabled = true;
      applyBtn.textContent = 'Applying...';

      try {
        await editor.modify(prompt);
        promptInput.value = '';
      } catch (error) {
        console.error('Modification failed:', error);
      } finally {
        applyBtn.disabled = false;
        applyBtn.textContent = 'Apply Changes';
      }
    });

    // Download PDF
    downloadBtn.addEventListener('click', async () => {
      downloadBtn.disabled = true;
      downloadBtn.textContent = 'Generating...';

      try {
        const pdf = await editor.generatePdf();
        const url = URL.createObjectURL(pdf);
        const a = document.createElement('a');
        a.href = url;
        a.download = `quote-${quoteData.meta.quoteNumber}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error('PDF generation failed:', error);
        alert('Failed to generate PDF');
      } finally {
        downloadBtn.disabled = false;
        downloadBtn.textContent = 'Download PDF';
      }
    });
  </script>
</body>
</html>
```

## Installation Options

<Tabs>
  <TabItem label="CDN (Recommended)">
    ```html
    <script type="module" src="https://glyph-sdk.vercel.app/glyph.min.js"></script>
    ```
  </TabItem>
  <TabItem label="Self-Hosted">
    Download the SDK and serve it from your own server:
    ```html
    <script type="module" src="/js/glyph.min.js"></script>
    ```
  </TabItem>
  <TabItem label="npm + Bundler">
    If you're using a bundler like Vite, Webpack, or Rollup:
    ```bash
    npm install @glyph-sdk/web
    ```
    ```javascript
    import '@glyph-sdk/web';
    ```
  </TabItem>
</Tabs>

## Working with the Editor Element

### Getting a Reference

```javascript
// By ID
const editor = document.getElementById('my-editor');

// By query selector
const editor = document.querySelector('glyph-editor');

// Multiple editors
const editors = document.querySelectorAll('glyph-editor');
```

### Setting Data Programmatically

```javascript
// Method 1: Set attribute (triggers full re-render)
editor.setAttribute('data', JSON.stringify(quoteData));

// Method 2: Use setData method (more efficient for updates)
editor.setData(quoteData);
```

### Available Methods

```javascript
// Modify the document with AI
await editor.modify('Make the header blue');
await editor.modify('Add a discount line', { region: 'line-items' });

// Generate outputs
const pdf = await editor.generatePdf();
const png = await editor.generatePng();

// Get current state
const sessionId = editor.getSessionId();
const html = editor.getHtml();

// Undo/Redo
editor.undo();
editor.redo();

// Update data without re-render
editor.setData(newData);

// Change template
editor.setTemplate('quote-professional');
```

## Event Handling

### All Available Events

```javascript
// Editor initialized and ready
editor.addEventListener('glyph:ready', () => {
  console.log('Ready!');
});

// Document was modified by AI
editor.addEventListener('glyph:modified', (event) => {
  const { html, prompt, timestamp } = event.detail;
  console.log(`Modified with: ${prompt}`);
});

// Document saved/exported
editor.addEventListener('glyph:saved', (event) => {
  const { sessionId, format } = event.detail;
  console.log(`Saved as ${format}`);
});

// Error occurred
editor.addEventListener('glyph:error', (event) => {
  const { code, message } = event.detail;
  console.error(`Error ${code}: ${message}`);
});

// User clicked a region
editor.addEventListener('glyph:region-selected', (event) => {
  const { region, element } = event.detail;
  console.log(`Selected region: ${region}`);
});
```

### Event Delegation Pattern

For dynamically created editors:

```javascript
document.addEventListener('glyph:ready', (event) => {
  const editor = event.target;
  console.log('Editor ready:', editor.id);
}, true);

document.addEventListener('glyph:error', (event) => {
  const editor = event.target;
  console.error(`Error in ${editor.id}:`, event.detail.message);
}, true);
```

## Dynamic Quote Builder

A complete example with form inputs that update the preview in real-time:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Quote Builder</title>
  <script type="module" src="https://glyph-sdk.vercel.app/glyph.min.js"></script>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: system-ui, sans-serif;
      background: #f1f5f9;
    }
    .app {
      display: grid;
      grid-template-columns: 400px 1fr;
      height: 100vh;
    }
    .sidebar {
      background: white;
      padding: 1.5rem;
      overflow-y: auto;
      border-right: 1px solid #e2e8f0;
    }
    .sidebar h1 {
      font-size: 1.25rem;
      margin: 0 0 1.5rem;
    }
    .section {
      margin-bottom: 1.5rem;
    }
    .section h2 {
      font-size: 0.875rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
      margin: 0 0 0.75rem;
    }
    .form-row {
      margin-bottom: 0.75rem;
    }
    .form-row label {
      display: block;
      font-size: 0.875rem;
      margin-bottom: 0.25rem;
    }
    .form-row input,
    .form-row select {
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
    .btn {
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 0.375rem;
      cursor: pointer;
    }
    .btn-primary {
      background: #7c3aed;
      color: white;
    }
    .btn-secondary {
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
    }
    .btn-danger {
      background: #fee2e2;
      color: #dc2626;
    }
    .btn:hover { opacity: 0.9; }
    .totals {
      background: #f8fafc;
      padding: 1rem;
      border-radius: 0.5rem;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 0.5rem;
    }
    .total-row.final {
      font-weight: bold;
      font-size: 1.125rem;
      border-top: 1px solid #e2e8f0;
      padding-top: 0.5rem;
    }
    .preview {
      padding: 1.5rem;
      overflow: hidden;
    }
    .preview-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }
    .preview-header h2 {
      margin: 0;
      font-size: 1rem;
    }
    glyph-editor {
      height: calc(100vh - 120px);
      border-radius: 0.5rem;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    }
    .ai-bar {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }
    .ai-bar input {
      flex: 1;
      padding: 0.75rem 1rem;
      border: 1px solid #e2e8f0;
      border-radius: 0.5rem;
    }
  </style>
</head>
<body>
  <div class="app">
    <div class="sidebar">
      <h1>Quote Builder</h1>

      <div class="section">
        <h2>Client</h2>
        <div class="form-row">
          <label>Name</label>
          <input type="text" id="client-name" placeholder="Client name">
        </div>
        <div class="form-row">
          <label>Company</label>
          <input type="text" id="client-company" placeholder="Company name">
        </div>
        <div class="form-row">
          <label>Email</label>
          <input type="email" id="client-email" placeholder="email@example.com">
        </div>
      </div>

      <div class="section">
        <h2>Line Items</h2>
        <div id="line-items"></div>
        <button class="btn btn-secondary" id="add-item">+ Add Item</button>
      </div>

      <div class="section">
        <h2>Totals</h2>
        <div class="totals">
          <div class="total-row">
            <span>Subtotal</span>
            <span id="subtotal">$0.00</span>
          </div>
          <div class="total-row">
            <span>Tax (8%)</span>
            <span id="tax">$0.00</span>
          </div>
          <div class="total-row final">
            <span>Total</span>
            <span id="total">$0.00</span>
          </div>
        </div>
      </div>

      <div class="section">
        <h2>Template</h2>
        <div class="form-row">
          <select id="template-select">
            <option value="quote-modern">Modern</option>
            <option value="quote-professional">Professional</option>
            <option value="quote-bold">Bold</option>
          </select>
        </div>
      </div>
    </div>

    <div class="preview">
      <div class="preview-header">
        <h2>Preview</h2>
        <button class="btn btn-primary" id="download">Download PDF</button>
      </div>

      <div class="ai-bar">
        <input type="text" id="ai-prompt" placeholder="Describe AI changes (e.g., 'Make the header green')">
        <button class="btn btn-primary" id="ai-apply">Apply</button>
      </div>

      <glyph-editor
        id="editor"
        api-key="gk_your_api_key"
        template="quote-modern"
      ></glyph-editor>
    </div>
  </div>

  <script type="module">
    // State
    let lineItems = [
      { description: 'Service', quantity: 1, price: 100 },
    ];

    // DOM references
    const editor = document.getElementById('editor');
    const lineItemsContainer = document.getElementById('line-items');
    const addItemBtn = document.getElementById('add-item');
    const templateSelect = document.getElementById('template-select');
    const downloadBtn = document.getElementById('download');
    const aiPrompt = document.getElementById('ai-prompt');
    const aiApplyBtn = document.getElementById('ai-apply');

    // Format currency
    const formatCurrency = (amount) =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(amount);

    // Render line items
    function renderLineItems() {
      lineItemsContainer.innerHTML = lineItems
        .map(
          (item, index) => `
          <div class="line-item" data-index="${index}">
            <input type="text" class="item-desc" value="${item.description}" placeholder="Description">
            <input type="number" class="item-qty" value="${item.quantity}" min="1">
            <input type="number" class="item-price" value="${item.price}" min="0" step="0.01">
            <button class="btn btn-danger remove-item">×</button>
          </div>
        `
        )
        .join('');
    }

    // Calculate totals
    function calculateTotals() {
      const subtotal = lineItems.reduce(
        (sum, item) => sum + item.quantity * item.price,
        0
      );
      const tax = subtotal * 0.08;
      const total = subtotal + tax;

      document.getElementById('subtotal').textContent = formatCurrency(subtotal);
      document.getElementById('tax').textContent = formatCurrency(tax);
      document.getElementById('total').textContent = formatCurrency(total);

      return { subtotal, tax, total };
    }

    // Build quote data
    function buildQuoteData() {
      const totals = calculateTotals();

      return {
        client: {
          name: document.getElementById('client-name').value || 'Client Name',
          company: document.getElementById('client-company').value || undefined,
          email: document.getElementById('client-email').value || undefined,
        },
        lineItems: lineItems.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.price,
          total: item.quantity * item.price,
        })),
        totals: {
          subtotal: totals.subtotal,
          tax: totals.tax,
          taxRate: 8,
          total: totals.total,
        },
        meta: {
          quoteNumber: 'Q-' + Date.now().toString().slice(-6),
          date: new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }),
        },
      };
    }

    // Update editor
    function updateEditor() {
      const data = buildQuoteData();
      editor.setData(data);
    }

    // Debounce helper
    function debounce(fn, delay) {
      let timeout;
      return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), delay);
      };
    }

    const debouncedUpdate = debounce(updateEditor, 300);

    // Event: Add item
    addItemBtn.addEventListener('click', () => {
      lineItems.push({ description: '', quantity: 1, price: 0 });
      renderLineItems();
      debouncedUpdate();
    });

    // Event: Line item changes
    lineItemsContainer.addEventListener('input', (e) => {
      const row = e.target.closest('.line-item');
      const index = parseInt(row.dataset.index);

      if (e.target.classList.contains('item-desc')) {
        lineItems[index].description = e.target.value;
      } else if (e.target.classList.contains('item-qty')) {
        lineItems[index].quantity = parseInt(e.target.value) || 1;
      } else if (e.target.classList.contains('item-price')) {
        lineItems[index].price = parseFloat(e.target.value) || 0;
      }

      debouncedUpdate();
    });

    // Event: Remove item
    lineItemsContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('remove-item')) {
        const row = e.target.closest('.line-item');
        const index = parseInt(row.dataset.index);
        lineItems.splice(index, 1);
        renderLineItems();
        debouncedUpdate();
      }
    });

    // Event: Client info changes
    document.querySelectorAll('#client-name, #client-company, #client-email').forEach((input) => {
      input.addEventListener('input', debouncedUpdate);
    });

    // Event: Template change
    templateSelect.addEventListener('change', (e) => {
      editor.setTemplate(e.target.value);
    });

    // Event: AI apply
    aiApplyBtn.addEventListener('click', async () => {
      const prompt = aiPrompt.value.trim();
      if (!prompt) return;

      aiApplyBtn.disabled = true;
      aiApplyBtn.textContent = 'Applying...';

      try {
        await editor.modify(prompt);
        aiPrompt.value = '';
      } catch (error) {
        console.error('AI modification failed:', error);
      } finally {
        aiApplyBtn.disabled = false;
        aiApplyBtn.textContent = 'Apply';
      }
    });

    aiPrompt.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') aiApplyBtn.click();
    });

    // Event: Download PDF
    downloadBtn.addEventListener('click', async () => {
      downloadBtn.disabled = true;
      downloadBtn.textContent = 'Generating...';

      try {
        const pdf = await editor.generatePdf();
        const url = URL.createObjectURL(pdf);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'quote.pdf';
        a.click();
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error('PDF generation failed:', error);
        alert('Failed to generate PDF');
      } finally {
        downloadBtn.disabled = false;
        downloadBtn.textContent = 'Download PDF';
      }
    });

    // Initialize
    renderLineItems();
    editor.addEventListener('glyph:ready', () => {
      updateEditor();
    });
  </script>
</body>
</html>
```

## Error Handling Best Practices

```javascript
// Wrap all async operations
async function safeModify(prompt) {
  try {
    await editor.modify(prompt);
    return { success: true };
  } catch (error) {
    // Handle specific error types
    if (error.code === 'RATE_LIMIT_EXCEEDED') {
      const retryAfter = error.retryAfter || 60;
      showNotification(`Rate limited. Try again in ${retryAfter}s`);
    } else if (error.code === 'SESSION_EXPIRED') {
      // Re-initialize the editor
      location.reload();
    } else {
      showNotification('Something went wrong. Please try again.');
    }
    return { success: false, error };
  }
}

// Generic error notification
function showNotification(message) {
  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.textContent = message;
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 5000);
}
```

<Aside type="tip">
For production use, consider adding a loading state indicator while the editor initializes. The `glyph:ready` event fires when the editor is fully loaded and ready for interaction.
</Aside>

## Next Steps

- [React Integration](/examples/react/) - React wrapper component
- [Vue Integration](/examples/vue/) - Vue 3 composables
- [SDK Methods](/sdk/methods/) - Complete API reference
- [Theming](/sdk/theming/) - Customize the editor appearance
