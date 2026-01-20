---
title: Basic Usage
description: Core concepts and common usage patterns
---

This guide covers the fundamental concepts of Glyph and how to use it effectively in your applications.

## Core Workflow

Glyph follows a simple three-step workflow:

1. **Preview** - Render a template with your data
2. **Modify** - Let users customize with AI
3. **Generate** - Export to PDF

```
Data + Template  -->  Preview  -->  AI Edits  -->  PDF
```

## The `<glyph-editor>` Component

The editor is the main interface for document customization:

```html
<glyph-editor
  api-key="gk_your_key_here"
  template="quote-modern"
  data='{"client": {...}, "lineItems": [...]}'
  theme='{"primaryColor": "#1e3a5f"}'
></glyph-editor>
```

### Required Attributes

| Attribute | Description |
|-----------|-------------|
| `api-key` | Your Glyph API key |
| `data` | JSON string with document data |

### Optional Attributes

| Attribute | Default | Description |
|-----------|---------|-------------|
| `template` | `"quote-modern"` | Template ID to use |
| `theme` | `{}` | Theme customization object |
| `api-url` | `"https://api.glyph.you"` | API endpoint (for self-hosted) |

## Preparing Your Data

Each template expects a specific data structure. For quote templates:

```javascript
const quoteData = {
  // Client information (required)
  client: {
    name: "John Smith",           // Required
    company: "Acme Corp",         // Optional
    email: "john@acme.com",       // Optional
    address: "123 Main St",       // Optional
    phone: "(555) 123-4567"       // Optional
  },

  // Line items (required, at least one)
  lineItems: [
    {
      description: "Website Design",
      details: "Custom responsive design",  // Optional
      quantity: 1,
      unitPrice: 3500,
      total: 3500
    }
  ],

  // Totals (required)
  totals: {
    subtotal: 3500,
    discount: 0,      // Optional
    tax: 280,         // Optional
    taxRate: 8,       // Optional, for display
    total: 3780
  },

  // Metadata (optional)
  meta: {
    quoteNumber: "Q-2024-001",
    date: "January 15, 2024",
    validUntil: "February 15, 2024",
    notes: "Payment due within 30 days",
    terms: "Standard terms and conditions apply",
    showSignature: true
  },

  // Branding (optional)
  branding: {
    logoUrl: "https://your-site.com/logo.png",
    companyName: "Your Company Name",
    companyAddress: "456 Business Ave\nCity, ST 12345"
  }
};
```

## Handling Events

The editor emits custom events you can listen to:

```javascript
const editor = document.querySelector('glyph-editor');

// Editor initialized and ready
editor.addEventListener('glyph:ready', (e) => {
  console.log('Session ID:', e.detail.sessionId);
});

// User made an AI modification
editor.addEventListener('glyph:modified', (e) => {
  console.log('Command:', e.detail.command);
  console.log('Changes:', e.detail.changes);
  console.log('Region:', e.detail.region);
});

// Document saved/downloaded
editor.addEventListener('glyph:saved', (e) => {
  console.log('PDF generated');
});

// Error occurred
editor.addEventListener('glyph:error', (e) => {
  console.error('Error:', e.detail.error);
});

// User selected a region
editor.addEventListener('glyph:region-selected', (e) => {
  console.log('Selected region:', e.detail.region);
});
```

## Programmatic Control

Access the editor's methods for programmatic control:

```javascript
const editor = document.querySelector('glyph-editor');

// Update data dynamically
editor.setData({
  client: { name: "New Client" },
  // ... rest of data
});

// Execute an AI modification
await editor.modify("Add a 10% discount");

// Generate and download PDF
const pdfBlob = await editor.generatePdf();

// Get current HTML
const html = editor.getHtml();

// Get session ID
const sessionId = editor.getSessionId();
```

## Dynamic Data Updates

Update the editor when your data changes:

```javascript
// Option 1: Update the data attribute
editor.setAttribute('data', JSON.stringify(newData));

// Option 2: Use the setData method
editor.setData(newData);
```

The editor will automatically re-render with the new data.

## Region-Based Editing

Users can click on document regions to target their edits:

| Region | Description |
|--------|-------------|
| `header` | Company branding and logo |
| `meta` | Quote number, dates |
| `client-info` | Recipient details |
| `line-items` | Products/services table |
| `totals` | Subtotal, tax, total |
| `notes` | Additional notes |
| `footer` | Terms and signature area |

When a region is selected, the AI will focus modifications on that section.

## Styling the Editor

The editor uses Shadow DOM for encapsulation. Customize the container:

```css
glyph-editor {
  /* Set the editor size */
  width: 100%;
  height: 600px;
  min-height: 400px;

  /* Add border/shadow */
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}
```

Use the `theme` attribute for internal theming:

```html
<glyph-editor
  theme='{"primaryColor": "#1e3a5f", "fontFamily": "Georgia, serif", "borderRadius": "4px"}'
  ...
></glyph-editor>
```

## Error Handling

Always handle potential errors:

```javascript
editor.addEventListener('glyph:error', (e) => {
  const { code, message } = e.detail;

  switch (code) {
    case 'PREVIEW_ERROR':
      // Failed to load preview
      showError('Could not load document preview');
      break;
    case 'MODIFY_ERROR':
      // AI modification failed
      showError('Could not apply changes: ' + message);
      break;
    case 'GENERATE_ERROR':
      // PDF generation failed
      showError('Could not generate PDF');
      break;
    default:
      showError('An error occurred');
  }
});
```

## Best Practices

1. **Validate data client-side** before passing to the editor
2. **Show loading states** while the editor initializes
3. **Handle errors gracefully** with user-friendly messages
4. **Use specific regions** for targeted modifications
5. **Cache session IDs** if you need to resume editing later

## Next Steps

- Deep dive into the [API Reference](/api/overview/)
- Explore [SDK Events](/sdk/events/) and [Methods](/sdk/methods/)
- Learn about [Theming](/sdk/theming/) options
