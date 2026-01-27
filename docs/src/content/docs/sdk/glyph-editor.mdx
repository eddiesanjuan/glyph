---
title: <glyph-editor>
description: The main web component for document editing
---

import { Aside } from '@astrojs/starlight/components';

The `<glyph-editor>` web component provides a complete document editing experience with AI-powered customization and PDF export.

## Basic Usage

```html
<glyph-editor
  api-key="gk_your_api_key"
  template="quote-modern"
  data='{"client": {"name": "John Smith"}, "lineItems": [...], "totals": {...}}'
></glyph-editor>
```

## Attributes

### api-key (required)

Your Glyph API key.

```html
<glyph-editor api-key="gk_your_api_key" ...></glyph-editor>
```

<Aside type="caution">
For production applications, consider proxying API requests through your backend to keep the API key secure.
</Aside>

### template

Template ID to use for rendering. Default: `"quote-modern"`

```html
<glyph-editor template="quote-professional" ...></glyph-editor>
```

Available templates:
- `quote-modern` - Clean, minimal design
- `quote-professional` - Traditional business style
- `quote-bold` - High-impact modern design

### data (required)

JSON string containing the document data.

```html
<glyph-editor
  data='{
    "client": {
      "name": "John Smith",
      "company": "Acme Corp",
      "email": "john@acme.com"
    },
    "lineItems": [
      {
        "description": "Service",
        "quantity": 1,
        "unitPrice": 100,
        "total": 100
      }
    ],
    "totals": {
      "subtotal": 100,
      "total": 100
    }
  }'
  ...
></glyph-editor>
```

### theme

Theme customization as JSON string or preset name.

**Preset:**
```html
<glyph-editor theme="dark" ...></glyph-editor>
```

Available presets: `light`, `dark`, `auto`

**Custom theme:**
```html
<glyph-editor
  theme='{
    "primaryColor": "#1e3a5f",
    "fontFamily": "Georgia, serif",
    "borderRadius": "4px"
  }'
  ...
></glyph-editor>
```

Theme properties:
| Property | Description | Default |
|----------|-------------|---------|
| `primaryColor` | Accent color for buttons and highlights | `#1e3a5f` |
| `fontFamily` | Font stack for the editor UI | `system-ui, sans-serif` |
| `borderRadius` | Border radius for buttons and inputs | `8px` |

### api-url

Override the API endpoint. Useful for self-hosted deployments.

```html
<glyph-editor
  api-url="https://your-glyph-api.com"
  ...
></glyph-editor>
```

Default: `https://api.glyph.you`

## Observed Attributes

The component watches these attributes for changes:

| Attribute | Behavior on Change |
|-----------|-------------------|
| `api-key` | No automatic re-render |
| `template` | Re-initializes with new template |
| `data` | Re-initializes with new data |
| `theme` | Applies new theme immediately |
| `api-url` | No automatic re-render |

## Component Structure

The editor consists of:

1. **Preview Area** - Displays the rendered document in an iframe
2. **Quick Actions** - Pill buttons for common modifications
3. **Command Input** - Text input for custom AI commands
4. **Download Button** - Generates and downloads PDF

```text
┌─────────────────────────────────────┐
│         Preview Area                │
│   ┌─────────────────────────────┐   │
│   │                             │   │
│   │    [Document Preview]       │   │
│   │                             │   │
│   │    Click regions to select  │   │
│   │                             │   │
│   └─────────────────────────────┘   │
├─────────────────────────────────────┤
│ [Add logo] [Colors] [Pro] [...]     │
├─────────────────────────────────────┤
│ [Describe changes...      ] [Download]│
└─────────────────────────────────────┘
```

## Quick Actions

The editor includes pre-configured quick actions:

| Button | Action |
|--------|--------|
| Add logo | "Add company logo in the header" |
| Brand colors | "Apply a professional navy blue and gold color scheme" |
| More professional | "Make this look more professional with better typography" |
| Emphasize totals | "Make the totals section larger and more prominent" |
| Compact layout | "Use a more compact layout with less whitespace" |

## Region Selection

Users can click on document regions to target their modifications:

| Region | CSS Selector | Description |
|--------|--------------|-------------|
| header | `[data-glyph-region="header"]` | Logo and company info |
| meta | `[data-glyph-region="meta"]` | Quote number, dates |
| client-info | `[data-glyph-region="client-info"]` | Recipient details |
| line-items | `[data-glyph-region="line-items"]` | Items table |
| totals | `[data-glyph-region="totals"]` | Calculations |
| notes | `[data-glyph-region="notes"]` | Notes section |
| footer | `[data-glyph-region="footer"]` | Terms and signatures |

When a region is selected:
- It gets a visual highlight
- The input placeholder updates to "Edit the [region]..."
- AI modifications are focused on that region

## Styling

### Container Styling

Style the outer container:

```css
glyph-editor {
  /* Dimensions */
  width: 100%;
  height: 600px;
  min-height: 400px;

  /* Appearance */
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);

  /* Display */
  display: block;
}
```

### CSS Custom Properties

The component exposes CSS custom properties on `:host`:

```css
glyph-editor {
  --glyph-primary: #7c3aed;
  --glyph-font: 'Inter', sans-serif;
  --glyph-radius: 8px;
}
```

<Aside type="note">
Internal styles are encapsulated in Shadow DOM. Use the `theme` attribute for internal customization.
</Aside>

## Lifecycle

1. **Connected** - Component added to DOM
2. **Initialize** - Fetches preview from API
3. **Ready** - Emits `glyph:ready` event
4. **Interactive** - User can edit and download
5. **Disconnected** - Cleanup on removal

```javascript
// Check if component is initialized
const editor = document.querySelector('glyph-editor');
if (editor.getSessionId()) {
  console.log('Editor is ready');
}
```

## Error States

The component handles errors gracefully:

- **Missing API key** - Shows error in preview area
- **Invalid data** - Shows error with message
- **Network error** - Shows error and allows retry
- **Modification error** - Shows toast notification

## Example: Full Implementation

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Quote Generator</title>
  <script src="https://sdk.glyph.you/glyph.min.js"></script>
  <style>
    body {
      font-family: system-ui, sans-serif;
      max-width: 900px;
      margin: 0 auto;
      padding: 2rem;
    }

    glyph-editor {
      height: 700px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    }

    .status {
      margin-top: 1rem;
      padding: 0.5rem;
      background: #f0f0f0;
      border-radius: 4px;
      font-size: 0.875rem;
    }
  </style>
</head>
<body>
  <h1>Create Your Quote</h1>

  <glyph-editor
    id="editor"
    api-key="gk_your_api_key"
    template="quote-modern"
    theme='{"primaryColor": "#7c3aed"}'
    data='{
      "client": {"name": "Sample Client", "company": "Sample Corp"},
      "lineItems": [{"description": "Service", "quantity": 1, "unitPrice": 1000, "total": 1000}],
      "totals": {"subtotal": 1000, "total": 1000},
      "meta": {"quoteNumber": "Q-001", "date": "Today"},
      "branding": {"companyName": "Your Company"}
    }'
  ></glyph-editor>

  <div class="status" id="status">Loading...</div>

  <script>
    const editor = document.getElementById('editor');
    const status = document.getElementById('status');

    editor.addEventListener('glyph:ready', (e) => {
      status.textContent = `Ready! Session: ${e.detail.sessionId.slice(0, 8)}...`;
    });

    editor.addEventListener('glyph:modified', (e) => {
      status.textContent = `Modified: ${e.detail.changes[0]}`;
    });

    editor.addEventListener('glyph:saved', () => {
      status.textContent = 'PDF downloaded successfully!';
    });

    editor.addEventListener('glyph:error', (e) => {
      status.textContent = `Error: ${e.detail.error}`;
      status.style.background = '#fee';
    });
  </script>
</body>
</html>
```
