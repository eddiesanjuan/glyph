---
title: Custom Templates
description: Create your own Glyph templates
---

import { Aside } from '@astrojs/starlight/components';

While Glyph provides professional templates out of the box, you can create custom templates for complete control over your document design.

<Aside type="note">
Custom templates are available on Pro tier and above. Contact us for Enterprise template development.
</Aside>

## Template Structure

A Glyph template consists of three files:

```
my-template/
  template.html    # HTML structure with Mustache placeholders
  styles.css       # Template-specific styles
  schema.json      # Data validation schema
```

## Creating a Template

### 1. HTML Template

Use Mustache syntax for data binding:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{meta.documentTitle}}</title>
  <style>
    /* Inline critical styles or link external CSS */
  </style>
</head>
<body>
  <div class="document">
    <!-- Header region -->
    <header data-glyph-region="header">
      {{#branding.logoUrl}}
      <img src="{{branding.logoUrl}}" alt="Logo" class="logo">
      {{/branding.logoUrl}}
      <h1>{{branding.companyName}}</h1>
    </header>

    <!-- Client info region -->
    <section data-glyph-region="client-info">
      <h2>Prepared For</h2>
      <p><strong>{{client.name}}</strong></p>
      {{#client.company}}<p>{{client.company}}</p>{{/client.company}}
      {{#client.email}}<p>{{client.email}}</p>{{/client.email}}
    </section>

    <!-- Line items region -->
    <table data-glyph-region="line-items">
      <thead>
        <tr>
          <th>Description</th>
          <th>Qty</th>
          <th>Price</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        {{#lineItems}}
        <tr>
          <td>{{description}}</td>
          <td>{{quantity}}</td>
          <td>${{unitPrice}}</td>
          <td>${{total}}</td>
        </tr>
        {{/lineItems}}
      </tbody>
    </table>

    <!-- Totals region -->
    <section data-glyph-region="totals">
      <div class="total-row">
        <span>Subtotal</span>
        <span>${{totals.subtotal}}</span>
      </div>
      {{#totals.tax}}
      <div class="total-row">
        <span>Tax</span>
        <span>${{totals.tax}}</span>
      </div>
      {{/totals.tax}}
      <div class="total-row final">
        <span>Total</span>
        <span>${{totals.total}}</span>
      </div>
    </section>
  </div>
</body>
</html>
```

### 2. Mustache Syntax Reference

| Syntax | Description | Example |
|--------|-------------|---------|
| `{{variable}}` | Output variable | `{{client.name}}` |
| `{{#section}}...{{/section}}` | Conditional/loop | `{{#lineItems}}...{{/lineItems}}` |
| `{{^section}}...{{/section}}` | Inverted (if empty) | `{{^discount}}No discount{{/discount}}` |
| `{{{raw}}}` | Unescaped HTML | `{{{customHtml}}}` |

### 3. Define Regions

Mark interactive regions with `data-glyph-region`:

```html
<header data-glyph-region="header">...</header>
<section data-glyph-region="custom-section">...</section>
```

The AI can target these regions for focused modifications.

### 4. Create Schema

Define expected data structure in `schema.json`:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "MyTemplateData",
  "type": "object",
  "required": ["client", "lineItems", "totals"],
  "properties": {
    "client": {
      "type": "object",
      "required": ["name"],
      "properties": {
        "name": {
          "type": "string",
          "description": "Client name"
        },
        "company": {
          "type": "string",
          "description": "Company name"
        },
        "email": {
          "type": "string",
          "format": "email"
        }
      }
    },
    "lineItems": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["description", "quantity", "unitPrice", "total"],
        "properties": {
          "description": { "type": "string" },
          "quantity": { "type": "number" },
          "unitPrice": { "type": "number" },
          "total": { "type": "number" }
        }
      }
    },
    "totals": {
      "type": "object",
      "required": ["subtotal", "total"],
      "properties": {
        "subtotal": { "type": "number" },
        "tax": { "type": "number" },
        "total": { "type": "number" }
      }
    }
  }
}
```

## Styling Best Practices

### Print-Friendly CSS

```css
/* Base styles */
.document {
  max-width: 8.5in;
  margin: 0 auto;
  padding: 0.75in;
  font-family: system-ui, sans-serif;
}

/* Print styles */
@media print {
  body {
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }

  .document {
    padding: 0;
    max-width: none;
  }
}

@page {
  size: letter;
  margin: 0.5in;
}
```

### CSS Variables for Theming

```css
:root {
  --accent-color: #1e3a5f;
  --text-primary: #1a1a1a;
  --text-secondary: #666666;
  --border-color: #e5e5e5;
}

/* Use in template */
.header {
  border-color: var(--accent-color);
}
```

Allow overrides via data:

```html
<style>
  :root {
    --accent-color: {{styles.accentColor}};
  }
</style>
```

### Region Styling

```css
/* Visual feedback for interactive regions */
[data-glyph-region] {
  cursor: pointer;
  transition: outline 0.15s;
}

[data-glyph-region]:hover {
  outline: 2px dashed rgba(30, 58, 95, 0.3);
  outline-offset: 2px;
}
```

## Uploading Custom Templates

### Self-Hosted

1. Place template files in your templates directory:
   ```
   templates/
     my-template/
       template.html
       styles.css
       schema.json
   ```

2. Register the template in your template registry

3. Use it:
   ```html
   <glyph-editor template="my-template" ...></glyph-editor>
   ```

### Glyph Cloud

1. Go to your [dashboard](https://glyph.so/dashboard)
2. Navigate to **Templates**
3. Click **Upload Template**
4. Provide your files and metadata
5. Submit for review (Enterprise) or activate (Pro)

## Template Development Tips

### 1. Start from an Existing Template

Fork `quote-modern` and modify:

```bash
cp -r templates/quote-modern templates/my-template
```

### 2. Test with Sample Data

Create test data that covers all cases:

```json
{
  "client": { "name": "Test Client", "company": "Test Corp" },
  "lineItems": [
    { "description": "Item 1", "quantity": 1, "unitPrice": 100, "total": 100 },
    { "description": "Item with very long description that might wrap", "quantity": 99, "unitPrice": 9999.99, "total": 989900.01 }
  ],
  "totals": { "subtotal": 989900.01, "tax": 79192, "discount": 10000, "total": 1059092.01 }
}
```

### 3. Test Print Output

Always generate a PDF to verify:
- Page breaks
- Color accuracy
- Font rendering
- Margin handling

### 4. Handle Edge Cases

- Very long text
- Missing optional fields
- Large numbers
- Empty arrays

## Example: Invoice Template

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <style>
    /* Invoice-specific styles */
    .invoice-header {
      display: flex;
      justify-content: space-between;
      border-bottom: 3px solid var(--accent-color);
      padding-bottom: 1rem;
      margin-bottom: 2rem;
    }

    .invoice-number {
      font-size: 2rem;
      font-weight: bold;
      color: var(--accent-color);
    }

    .status-badge {
      display: inline-block;
      padding: 0.25rem 1rem;
      background: #fef3c7;
      color: #92400e;
      border-radius: 9999px;
      font-weight: 600;
    }

    .status-badge.paid {
      background: #d1fae5;
      color: #065f46;
    }
  </style>
</head>
<body>
  <div class="invoice" data-glyph-region="header">
    <div class="invoice-header">
      <div>
        <div class="invoice-number">INVOICE #{{meta.invoiceNumber}}</div>
        <span class="status-badge {{meta.status}}">{{meta.status}}</span>
      </div>
      <div>
        {{#branding.logoUrl}}
        <img src="{{branding.logoUrl}}" alt="Logo">
        {{/branding.logoUrl}}
      </div>
    </div>
    <!-- ... rest of template -->
  </div>
</body>
</html>
```

<Aside type="tip">
Need help creating a custom template? Our team can design and implement templates for Enterprise customers. Contact sales@glyph.so.
</Aside>
