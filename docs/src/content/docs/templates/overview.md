---
title: Templates Overview
description: Understanding Glyph document templates
---

import { Aside } from '@astrojs/starlight/components';

Glyph templates are pre-designed document layouts that you populate with your data. Each template includes HTML structure, CSS styling, and a data schema.

## Available Templates

| Template | Description | Best For |
|----------|-------------|----------|
| [`quote-modern`](/templates/quote-modern/) | Clean, minimal design with generous whitespace | SaaS, tech companies, agencies |
| [`quote-professional`](/templates/quote-professional/) | Traditional business style with formal typography | Law firms, consulting, B2B |
| [`quote-bold`](/templates/quote-bold/) | High-impact design with dark header | Creative agencies, startups |

## Template Structure

Each template consists of:

```
templates/
  quote-modern/
    template.html    # HTML structure with Mustache placeholders
    styles.css       # Template-specific styles
    schema.json      # Data validation schema
```

### HTML Template

Templates use [Mustache](https://mustache.github.io/) syntax for data binding:

```html
<h1>{{branding.companyName}}</h1>
<p>Prepared for: {{client.name}}</p>

{{#lineItems}}
<tr>
  <td>{{description}}</td>
  <td>{{quantity}}</td>
  <td>${{unitPrice}}</td>
  <td>${{total}}</td>
</tr>
{{/lineItems}}
```

### Regions

Templates define clickable regions using `data-glyph-region` attributes:

```html
<header data-glyph-region="header">
  <!-- Logo and company info -->
</header>

<section data-glyph-region="client-info">
  <!-- Client details -->
</section>

<table data-glyph-region="line-items">
  <!-- Products/services -->
</table>
```

Users can click these regions to target AI modifications.

## Standard Regions

All quote templates include these regions:

| Region | Description | Typical Content |
|--------|-------------|-----------------|
| `header` | Document header | Logo, company name, document title |
| `meta` | Document metadata | Quote number, date, valid until |
| `client-info` | Recipient info | Name, company, email, address |
| `line-items` | Items table | Products, services, quantities, prices |
| `totals` | Calculations | Subtotal, tax, discount, total |
| `notes` | Additional info | Special instructions, comments |
| `footer` | Document footer | Terms, conditions, signatures |

## Data Schema

Each template defines expected data using JSON Schema:

```json
{
  "required": ["client", "lineItems", "totals"],
  "properties": {
    "client": {
      "type": "object",
      "required": ["name"],
      "properties": {
        "name": { "type": "string" },
        "company": { "type": "string" },
        "email": { "type": "string", "format": "email" }
      }
    }
  }
}
```

## Selecting a Template

Pass the template ID to the editor or API:

### Editor

```html
<glyph-editor template="quote-professional" ...></glyph-editor>
```

### API

```javascript
const { html, sessionId } = await api.preview('quote-bold', data);
```

## Template Customization

Templates can be customized in several ways:

### 1. Style Properties in Data

Some templates accept style customization via data:

```json
{
  "styles": {
    "accentColor": "#7c3aed",
    "fontFamily": "Georgia, serif"
  }
}
```

### 2. AI Modifications

Use natural language to modify any aspect:

```javascript
await editor.modify("Change the accent color to purple");
await editor.modify("Use a more formal serif font");
await editor.modify("Make the header smaller");
```

### 3. Custom Templates

Create your own templates for complete control. See [Custom Templates](/templates/custom/).

## Listing Templates

Get available templates via the API:

```javascript
const response = await fetch('https://api.glyph.so/v1/preview/templates', {
  headers: { 'Authorization': 'Bearer gk_your_key' }
});

const { templates } = await response.json();
// [{ id: 'quote-modern', name: 'Modern Quote', ... }, ...]
```

## Template Categories

Templates are organized by document type:

| Category | Templates | Status |
|----------|-----------|--------|
| Quote | `quote-modern`, `quote-professional`, `quote-bold` | Available |
| Invoice | `invoice-modern`, `invoice-classic` | Coming Soon |
| Proposal | `proposal-executive`, `proposal-minimal` | Coming Soon |
| Contract | `contract-standard` | Planned |
| Report | `report-modern` | Planned |

<Aside type="note">
Want a specific template? Let us know at feedback@glyph.so
</Aside>

## Next Steps

- [quote-modern](/templates/quote-modern/) - Detailed template reference
- [quote-professional](/templates/quote-professional/) - Traditional business style
- [quote-bold](/templates/quote-bold/) - High-impact modern design
- [Custom Templates](/templates/custom/) - Create your own
