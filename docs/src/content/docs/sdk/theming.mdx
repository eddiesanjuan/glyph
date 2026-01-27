---
title: Theming
description: Customize the look and feel of the Glyph editor
---

import { Aside } from '@astrojs/starlight/components';

The `<glyph-editor>` component can be themed to match your application's design. This guide covers all theming options.

## Theme Presets

Use built-in presets for quick theming:

```html
<glyph-editor theme="light" ...></glyph-editor>
<glyph-editor theme="dark" ...></glyph-editor>
<glyph-editor theme="auto" ...></glyph-editor>
```

| Preset | Description |
|--------|-------------|
| `light` | Default light theme |
| `dark` | Dark theme with blue accent |
| `auto` | Follows system preference (via `prefers-color-scheme`) |

## Custom Theme Object

Pass a JSON object for fine-grained control:

```html
<glyph-editor
  theme='{
    "primaryColor": "#7c3aed",
    "fontFamily": "Inter, system-ui, sans-serif",
    "borderRadius": "12px"
  }'
  ...
></glyph-editor>
```

### Available Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `primaryColor` | CSS color | `#1e3a5f` | Accent color for buttons, links, highlights |
| `fontFamily` | CSS font-family | `system-ui, sans-serif` | Font stack for editor UI |
| `borderRadius` | CSS length | `8px` | Border radius for buttons, inputs, cards |

### Color Examples

```html
<!-- Purple theme -->
<glyph-editor theme='{"primaryColor": "#7c3aed"}' ...></glyph-editor>

<!-- Green theme -->
<glyph-editor theme='{"primaryColor": "#059669"}' ...></glyph-editor>

<!-- Orange theme -->
<glyph-editor theme='{"primaryColor": "#ea580c"}' ...></glyph-editor>

<!-- Corporate blue -->
<glyph-editor theme='{"primaryColor": "#1e40af"}' ...></glyph-editor>
```

### Font Examples

```html
<!-- Serif font -->
<glyph-editor theme='{"fontFamily": "Georgia, Times, serif"}' ...></glyph-editor>

<!-- Modern sans-serif -->
<glyph-editor theme='{"fontFamily": "Inter, -apple-system, sans-serif"}' ...></glyph-editor>

<!-- Monospace (for technical docs) -->
<glyph-editor theme='{"fontFamily": "JetBrains Mono, monospace"}' ...></glyph-editor>
```

## CSS Custom Properties

The editor exposes CSS custom properties on the `:host` element:

```css
glyph-editor {
  /* Override custom properties */
  --glyph-primary: #7c3aed;
  --glyph-primary-hover: #6d28d9;
  --glyph-font: 'Inter', sans-serif;
  --glyph-radius: 12px;
  --glyph-bg: #ffffff;
  --glyph-bg-secondary: #fafafa;
  --glyph-border: #e5e7eb;
  --glyph-text: #1f2937;
  --glyph-text-muted: #6b7280;
  --glyph-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
```

<Aside type="note">
CSS custom properties set externally may be overridden by the `theme` attribute. For consistent results, use one method or the other.
</Aside>

### Available Custom Properties

| Property | Description |
|----------|-------------|
| `--glyph-primary` | Primary accent color |
| `--glyph-primary-hover` | Primary color on hover |
| `--glyph-font` | Font family |
| `--glyph-radius` | Border radius |
| `--glyph-bg` | Background color |
| `--glyph-bg-secondary` | Secondary background |
| `--glyph-border` | Border color |
| `--glyph-text` | Primary text color |
| `--glyph-text-muted` | Secondary text color |
| `--glyph-shadow` | Box shadow |

## Container Styling

Style the outer container with regular CSS:

```css
glyph-editor {
  /* Dimensions */
  width: 100%;
  height: 600px;
  min-height: 400px;
  max-width: 1200px;

  /* Spacing */
  margin: 2rem auto;
  padding: 0;

  /* Appearance */
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  border: 1px solid #e0e0e0;

  /* Display */
  display: block;
}
```

### Responsive Sizing

```css
glyph-editor {
  width: 100%;
  height: 500px;
}

@media (min-width: 768px) {
  glyph-editor {
    height: 600px;
  }
}

@media (min-width: 1024px) {
  glyph-editor {
    height: 700px;
  }
}
```

## Dark Mode

### Using the Preset

```html
<glyph-editor theme="dark" ...></glyph-editor>
```

### System Preference

```html
<glyph-editor theme="auto" ...></glyph-editor>
```

### Manual Dark Mode

```javascript
// Toggle based on your app's dark mode state
function updateEditorTheme(isDark) {
  const editor = document.querySelector('glyph-editor');
  editor.setAttribute('theme', isDark ? 'dark' : 'light');
}
```

### CSS Media Query Approach

```css
@media (prefers-color-scheme: dark) {
  glyph-editor {
    --glyph-bg: #1e293b;
    --glyph-bg-secondary: #0f172a;
    --glyph-text: #f8fafc;
    --glyph-border: #334155;
  }
}
```

## Matching Your Brand

### Example: Corporate Blue

```html
<glyph-editor
  theme='{
    "primaryColor": "#0066cc",
    "fontFamily": "Helvetica Neue, Arial, sans-serif",
    "borderRadius": "4px"
  }'
  ...
></glyph-editor>

<style>
  glyph-editor {
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    border: 1px solid #ddd;
  }
</style>
```

### Example: Startup Purple

```html
<glyph-editor
  theme='{
    "primaryColor": "#7c3aed",
    "fontFamily": "Inter, system-ui, sans-serif",
    "borderRadius": "12px"
  }'
  ...
></glyph-editor>

<style>
  glyph-editor {
    box-shadow: 0 8px 30px rgba(124, 58, 237, 0.15);
    border: none;
  }
</style>
```

### Example: Minimal

```html
<glyph-editor
  theme='{
    "primaryColor": "#000000",
    "fontFamily": "system-ui",
    "borderRadius": "0"
  }'
  ...
></glyph-editor>

<style>
  glyph-editor {
    box-shadow: none;
    border: 1px solid #000;
  }
</style>
```

## Dynamic Theming

Update the theme at runtime:

```javascript
const editor = document.querySelector('glyph-editor');

// Apply new theme
function setTheme(theme) {
  editor.setAttribute('theme', JSON.stringify(theme));
}

// Example: User picks a color
colorPicker.addEventListener('change', (e) => {
  setTheme({ primaryColor: e.target.value });
});
```

## Accessibility Considerations

When customizing colors, ensure sufficient contrast:

- Text on backgrounds: minimum 4.5:1 contrast ratio
- Large text: minimum 3:1 contrast ratio
- Interactive elements: clearly distinguishable focus states

```javascript
// Check contrast programmatically
function hasGoodContrast(foreground, background) {
  // Use a library like 'color' to calculate contrast ratio
  const ratio = getContrastRatio(foreground, background);
  return ratio >= 4.5;
}
```

<Aside type="tip">
Use tools like [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) to verify your color choices meet accessibility standards.
</Aside>

## Document Template Theming

The document preview (inside the iframe) uses its own styles from the template. To customize the document appearance, use the `styles` property in your data:

```json
{
  "styles": {
    "accentColor": "#7c3aed",
    "fontFamily": "Georgia, serif"
  },
  "client": {...},
  "lineItems": [...],
  "totals": {...}
}
```

Or use the AI to modify document styles:

```javascript
await editor.modify("Change the accent color to purple #7c3aed");
await editor.modify("Use Georgia font for all text");
```
