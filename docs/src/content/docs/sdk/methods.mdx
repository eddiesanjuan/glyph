---
title: Methods
description: Public methods available on the Glyph editor
---

import { Aside } from '@astrojs/starlight/components';

The `<glyph-editor>` component exposes public methods for programmatic control. Access them through the DOM element.

## Getting a Reference

```javascript
// By ID
const editor = document.getElementById('my-editor');

// By query selector
const editor = document.querySelector('glyph-editor');

// React ref
const editorRef = useRef(null);
// <glyph-editor ref={editorRef} />
// editorRef.current.setData(...)
```

## Available Methods

### setData(data)

Update the document data and re-render.

```javascript
editor.setData({
  client: {
    name: "New Client",
    company: "New Company",
    email: "new@example.com"
  },
  lineItems: [
    {
      description: "Updated Service",
      quantity: 2,
      unitPrice: 500,
      total: 1000
    }
  ],
  totals: {
    subtotal: 1000,
    total: 1000
  }
});
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `data` | `QuoteData` | New document data object |

**Notes:**
- Triggers a full re-initialization
- Creates a new session
- Previous session is abandoned

---

### getSessionId()

Get the current editing session ID.

```javascript
const sessionId = editor.getSessionId();
console.log(sessionId); // "550e8400-e29b-41d4-a716-446655440000"
```

**Returns:** `string | null`

**Notes:**
- Returns `null` if the editor hasn't initialized yet
- Useful for tracking or resuming sessions

---

### getHtml()

Get the current HTML content of the document.

```javascript
const html = editor.getHtml();
console.log(html); // "<!DOCTYPE html><html>..."
```

**Returns:** `string`

**Notes:**
- Returns the current state including all modifications
- Can be used to save drafts or implement undo

---

### modify(command)

Programmatically execute an AI modification.

```javascript
await editor.modify("Add a 10% discount to the totals");
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `command` | `string` | Natural language modification instruction |

**Returns:** `Promise<void>`

**Notes:**
- Waits for the modification to complete
- Throws on error
- Does not use the currently selected region (targets whole document)

**Example with error handling:**

```javascript
try {
  await editor.modify("Make the header more prominent");
  console.log("Modification applied successfully");
} catch (error) {
  console.error("Modification failed:", error.message);
}
```

---

### generatePdf()

Generate and return the PDF without triggering a download.

```javascript
const pdfBlob = await editor.generatePdf();

if (pdfBlob) {
  // Upload to server
  const formData = new FormData();
  formData.append('pdf', pdfBlob, 'quote.pdf');
  await fetch('/api/upload', { method: 'POST', body: formData });
}
```

**Returns:** `Promise<Blob | null>`

**Notes:**
- Returns `null` if the editor isn't ready or an error occurs
- Does not trigger a download
- Use for custom PDF handling (upload, email, etc.)

## Usage Examples

### Dynamic Data Updates

Update the editor when your application state changes:

```javascript
// React example
function QuoteEditor({ quoteData }) {
  const editorRef = useRef(null);

  useEffect(() => {
    if (editorRef.current && quoteData) {
      editorRef.current.setData(quoteData);
    }
  }, [quoteData]);

  return (
    <glyph-editor
      ref={editorRef}
      api-key={apiKey}
      template="quote-modern"
      data={JSON.stringify(quoteData)}
    />
  );
}
```

### Saving Drafts

Save the current state for later:

```javascript
function saveDraft() {
  const html = editor.getHtml();
  const sessionId = editor.getSessionId();

  localStorage.setItem('quote-draft', JSON.stringify({
    html,
    sessionId,
    savedAt: new Date().toISOString()
  }));

  showNotification('Draft saved!');
}
```

### Custom Download Flow

Implement custom PDF handling:

```javascript
async function emailQuote(recipientEmail) {
  const pdfBlob = await editor.generatePdf();

  if (!pdfBlob) {
    showError('Could not generate PDF');
    return;
  }

  const formData = new FormData();
  formData.append('pdf', pdfBlob, 'quote.pdf');
  formData.append('to', recipientEmail);

  await fetch('/api/email-quote', {
    method: 'POST',
    body: formData
  });

  showSuccess('Quote emailed successfully!');
}
```

### Automated Modifications

Apply a series of modifications programmatically:

```javascript
async function applyBrandTemplate() {
  const modifications = [
    "Set the header background to navy blue (#1e3a5f)",
    "Use Georgia font for all headings",
    "Make the totals section more prominent",
    "Add a professional footer with company info"
  ];

  for (const command of modifications) {
    try {
      await editor.modify(command);
      console.log('Applied:', command);
    } catch (error) {
      console.error('Failed:', command, error);
      break;
    }
  }

  console.log('Brand template applied!');
}
```

### Session Tracking

Track session IDs for analytics or debugging:

```javascript
editor.addEventListener('glyph:ready', (e) => {
  const sessionId = e.detail.sessionId;

  // Log to analytics
  analytics.track('quote_editor_opened', {
    sessionId,
    template: 'quote-modern',
    userId: currentUser.id
  });
});

editor.addEventListener('glyph:modified', (e) => {
  analytics.track('quote_modified', {
    sessionId: editor.getSessionId(),
    command: e.detail.command,
    region: e.detail.region
  });
});
```

## Method Availability

Methods are only available after the component is connected to the DOM:

```javascript
// Wait for the component to be ready
customElements.whenDefined('glyph-editor').then(() => {
  const editor = document.querySelector('glyph-editor');
  // Methods are now available
});

// Or listen for the ready event
editor.addEventListener('glyph:ready', () => {
  // Safe to call methods
  const sessionId = editor.getSessionId();
});
```

<Aside type="caution">
Calling methods before the component is initialized may result in `null` return values or errors.
</Aside>

## TypeScript Types

```typescript
interface GlyphEditorElement extends HTMLElement {
  setData(data: QuoteData): void;
  getSessionId(): string | null;
  getHtml(): string;
  modify(command: string): Promise<void>;
  generatePdf(): Promise<Blob | null>;
}

interface QuoteData {
  client: {
    name: string;
    company?: string;
    email?: string;
    address?: string;
  };
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
    details?: string;
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
    terms?: string;
  };
  branding?: {
    logoUrl?: string;
    companyName?: string;
    companyAddress?: string;
  };
}
```
