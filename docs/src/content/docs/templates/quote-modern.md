---
title: quote-modern
description: Clean, minimal quote template
---

import { Aside } from '@astrojs/starlight/components';

The `quote-modern` template features a clean, minimal design with generous whitespace and professional typography. It's the default template and works well for most use cases.

## Preview

A typical quote-modern document includes:
- Clean header with logo and company info
- Metadata bar with quote number and dates
- Client information section
- Professional line items table
- Clear totals breakdown
- Optional notes and terms

## Usage

```html
<glyph-editor
  api-key="gk_your_key"
  template="quote-modern"
  data='...'
></glyph-editor>
```

## Data Schema

### Required Fields

```typescript
interface QuoteModernData {
  client: {
    name: string;           // Required
    company?: string;
    email?: string;
    address?: string;
    phone?: string;
  };

  lineItems: Array<{
    description: string;    // Required
    details?: string;
    quantity: number;       // Required
    unitPrice: number;      // Required
    total: number;          // Required
  }>;

  totals: {
    subtotal: number;       // Required
    discount?: number;
    tax?: number;
    taxRate?: number;
    total: number;          // Required
  };
}
```

### Optional Fields

```typescript
interface QuoteModernOptional {
  meta?: {
    quoteNumber?: string;
    date?: string;
    validUntil?: string;
    notes?: string;
    terms?: string;
    showSignature?: boolean;
  };

  branding?: {
    logoUrl?: string;
    companyName?: string;
    companyAddress?: string;
  };

  styles?: {
    accentColor?: string;   // Default: #1e3a5f
    fontFamily?: string;
    fontSize?: string;
  };
}
```

## Complete Example

```json
{
  "client": {
    "name": "John Smith",
    "company": "Acme Corporation",
    "email": "john@acme.com",
    "address": "123 Main Street\nSuite 400\nNew York, NY 10001",
    "phone": "(555) 123-4567"
  },
  "lineItems": [
    {
      "description": "Website Design",
      "details": "Custom responsive design with up to 10 pages",
      "quantity": 1,
      "unitPrice": 3500,
      "total": 3500
    },
    {
      "description": "Development",
      "details": "Next.js implementation with CMS integration",
      "quantity": 40,
      "unitPrice": 150,
      "total": 6000
    },
    {
      "description": "Hosting Setup",
      "quantity": 1,
      "unitPrice": 500,
      "total": 500
    }
  ],
  "totals": {
    "subtotal": 10000,
    "discount": 500,
    "tax": 760,
    "taxRate": 8,
    "total": 10260
  },
  "meta": {
    "quoteNumber": "Q-2024-001",
    "date": "January 15, 2024",
    "validUntil": "February 15, 2024",
    "notes": "Price includes standard shipping. Express shipping available upon request.",
    "terms": "Payment due within 30 days of invoice date.\nAll prices in USD.",
    "showSignature": true
  },
  "branding": {
    "logoUrl": "https://example.com/logo.png",
    "companyName": "Design Studio Pro",
    "companyAddress": "456 Creative Ave\nSan Francisco, CA 94102"
  },
  "styles": {
    "accentColor": "#1e3a5f"
  }
}
```

## Regions

| Region | Selector | Content |
|--------|----------|---------|
| `header` | `[data-glyph-region="header"]` | Logo, company name, "Quote" title |
| `meta` | `[data-glyph-region="meta"]` | Quote number, date, valid until |
| `client-info` | `[data-glyph-region="client-info"]` | "Prepared For" section with client details |
| `line-items` | `[data-glyph-region="line-items"]` | Table with items, quantities, prices |
| `totals` | `[data-glyph-region="totals"]` | Subtotal, discount, tax, total |
| `notes` | `[data-glyph-region="notes"]` | Additional notes (if provided) |
| `footer` | `[data-glyph-region="footer"]` | Terms and signature lines (if enabled) |

## Styling Options

### Accent Color

The accent color is used for:
- Header border
- Table header background
- Total row text
- Section titles

```json
{
  "styles": {
    "accentColor": "#7c3aed"
  }
}
```

### Common AI Modifications

```javascript
// Color changes
await editor.modify("Change the accent color to navy blue");
await editor.modify("Use a green color scheme");

// Typography
await editor.modify("Make the headings larger");
await editor.modify("Use a more formal serif font");

// Layout
await editor.modify("Make this more compact");
await editor.modify("Add more whitespace between sections");

// Content
await editor.modify("Add a watermark that says DRAFT");
await editor.modify("Add a thank you message at the bottom");
```

## Print Optimization

The template includes print-specific styles:

```css
@media print {
  .quote-document {
    padding: 0;
    max-width: none;
  }
}

@page {
  size: letter;
  margin: 0.5in;
}
```

Generated PDFs are optimized for US Letter size (8.5" x 11").

## Customization Examples

### Minimal Style

```javascript
await editor.modify("Remove the background colors and use a minimal black and white style");
```

### Corporate Style

```javascript
await editor.modify("Apply a professional corporate style with navy blue accents");
await editor.modify("Add our company logo prominently in the header");
```

### Creative Style

```javascript
await editor.modify("Make this more modern and creative with bold colors");
await editor.modify("Use a gradient in the header");
```

## Best Practices

1. **Always include required fields** - The template will render incorrectly without them
2. **Format currency consistently** - Use strings like "1,500.00" for formatted display
3. **Keep line item descriptions concise** - Use the `details` field for longer explanations
4. **Test print output** - Generate a PDF to verify the print layout looks correct

<Aside type="tip">
For the best visual results, provide a square or horizontal logo via `branding.logoUrl`. The maximum displayed size is 180px wide by 60px tall.
</Aside>
