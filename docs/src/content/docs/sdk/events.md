---
title: Events
description: Custom events emitted by the Glyph editor
---

import { Aside } from '@astrojs/starlight/components';

The `<glyph-editor>` component emits custom events that you can listen to for integrating with your application.

## Event Overview

| Event | When Fired |
|-------|------------|
| `glyph:ready` | Editor initialized and preview loaded |
| `glyph:modified` | AI modification applied |
| `glyph:saved` | PDF downloaded successfully |
| `glyph:error` | An error occurred |
| `glyph:region-selected` | User clicked on a document region |

## Listening to Events

### JavaScript

```javascript
const editor = document.querySelector('glyph-editor');

editor.addEventListener('glyph:ready', (event) => {
  console.log('Editor ready:', event.detail);
});
```

### Vue

```vue
<template>
  <glyph-editor
    @glyph:ready="onReady"
    @glyph:modified="onModified"
    @glyph:error="onError"
    ...
  />
</template>
```

### React

```jsx
function QuoteEditor() {
  const editorRef = useRef(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const handleReady = (e) => console.log('Ready:', e.detail);
    const handleModified = (e) => console.log('Modified:', e.detail);

    editor.addEventListener('glyph:ready', handleReady);
    editor.addEventListener('glyph:modified', handleModified);

    return () => {
      editor.removeEventListener('glyph:ready', handleReady);
      editor.removeEventListener('glyph:modified', handleModified);
    };
  }, []);

  return <glyph-editor ref={editorRef} ... />;
}
```

## Event Details

### glyph:ready

Fired when the editor has loaded the initial preview and is ready for interaction.

```javascript
editor.addEventListener('glyph:ready', (event) => {
  const { sessionId } = event.detail;
  console.log('Session ID:', sessionId);

  // Safe to call editor methods now
  // editor.modify('Add company branding');
});
```

**Event detail:**

| Property | Type | Description |
|----------|------|-------------|
| `sessionId` | string | UUID for this editing session |

### glyph:modified

Fired after an AI modification is successfully applied.

```javascript
editor.addEventListener('glyph:modified', (event) => {
  const { command, changes, region } = event.detail;

  console.log('Command:', command);
  console.log('Changes made:', changes);
  console.log('Target region:', region);
});
```

**Event detail:**

| Property | Type | Description |
|----------|------|-------------|
| `command` | string | The modification command that was executed |
| `changes` | string[] | List of changes made by the AI |
| `region` | string \| null | The targeted region, if any |

**Example detail:**

```json
{
  "command": "Make the header navy blue",
  "changes": [
    "Changed header background color to navy blue (#1e3a5f)",
    "Updated header text color to white for contrast"
  ],
  "region": "header"
}
```

### glyph:saved

Fired when a PDF is successfully generated and downloaded.

```javascript
editor.addEventListener('glyph:saved', (event) => {
  const { blob, sessionId } = event.detail;

  console.log('PDF size:', blob.size, 'bytes');
  console.log('Session:', sessionId);

  // You could upload the blob to your server
  // uploadToServer(blob);
});
```

**Event detail:**

| Property | Type | Description |
|----------|------|-------------|
| `blob` | Blob | The generated PDF file |
| `sessionId` | string | Session that was exported |

### glyph:error

Fired when an error occurs during any operation.

```javascript
editor.addEventListener('glyph:error', (event) => {
  const { error, code, message } = event.detail;

  switch (code) {
    case 'PREVIEW_ERROR':
      showNotification('Failed to load document preview');
      break;
    case 'MODIFY_ERROR':
      showNotification('Could not apply changes: ' + message);
      break;
    case 'GENERATE_ERROR':
      showNotification('PDF generation failed');
      break;
    default:
      showNotification('An error occurred');
  }
});
```

**Event detail:**

| Property | Type | Description |
|----------|------|-------------|
| `error` | string | Error message |
| `code` | string | Error code (optional) |
| `message` | string | Detailed message (optional) |

**Error codes:**

| Code | Description |
|------|-------------|
| `PREVIEW_ERROR` | Failed to load initial preview |
| `MODIFY_ERROR` | AI modification failed |
| `GENERATE_ERROR` | PDF generation failed |

### glyph:region-selected

Fired when a user clicks on a document region.

```javascript
editor.addEventListener('glyph:region-selected', (event) => {
  const { region } = event.detail;

  console.log('Selected region:', region);

  // Show region-specific help
  showHelp(region);
});
```

**Event detail:**

| Property | Type | Description |
|----------|------|-------------|
| `region` | string | The selected region ID |

**Possible regions:**

- `header`
- `meta`
- `client-info`
- `line-items`
- `totals`
- `notes`
- `footer`

## Event Bubbling

All events are configured with:
- `bubbles: true` - Events bubble up the DOM tree
- `composed: true` - Events cross Shadow DOM boundaries

This means you can listen at any parent level:

```javascript
// Listen on document
document.addEventListener('glyph:ready', (event) => {
  console.log('An editor became ready');
});
```

## Callback Properties

For programmatic usage, you can also set callback properties directly:

```javascript
const editor = document.querySelector('glyph-editor');

editor.onSave = (document) => {
  console.log('Document saved:', document);
};

editor.onGenerate = (pdf) => {
  console.log('PDF generated:', pdf);
};

editor.onError = (error) => {
  console.error('Error:', error);
};
```

<Aside type="note">
Callback properties are called in addition to event listeners, not instead of them.
</Aside>

## Complete Example

```html
<glyph-editor id="editor" ...></glyph-editor>

<div id="status">Initializing...</div>
<div id="changes"></div>

<script>
const editor = document.getElementById('editor');
const statusEl = document.getElementById('status');
const changesEl = document.getElementById('changes');

// Track all events
editor.addEventListener('glyph:ready', (e) => {
  statusEl.textContent = 'Ready';
  statusEl.className = 'status ready';
});

editor.addEventListener('glyph:modified', (e) => {
  statusEl.textContent = 'Modified';

  // Show changes
  const changesList = e.detail.changes
    .map(c => `<li>${c}</li>`)
    .join('');
  changesEl.innerHTML = `<ul>${changesList}</ul>`;
});

editor.addEventListener('glyph:saved', () => {
  statusEl.textContent = 'PDF Downloaded!';
  statusEl.className = 'status success';
});

editor.addEventListener('glyph:error', (e) => {
  statusEl.textContent = `Error: ${e.detail.error}`;
  statusEl.className = 'status error';
});

editor.addEventListener('glyph:region-selected', (e) => {
  statusEl.textContent = `Editing: ${e.detail.region}`;
});
</script>
```
