# Invoice Generator

A showcase application demonstrating Glyph's AI-powered PDF customization. Generate professional invoices and modify them using natural language.

## What It Does

- Enter invoice data (company info, client details, line items)
- Generate a live PDF preview via Glyph API
- Customize the invoice using AI: "Add a PAID stamp", "Apply Stripe styling"
- Download the final PDF

## Running Locally

```bash
cd showcase-apps/invoice-generator
python -m http.server 8000
# Open http://localhost:8000
```

The app uses the demo API key (`gk_demo_playground_2024`) which connects to the production Glyph API.

To test against a local API:
```javascript
// In browser console
localStorage.setItem('USE_LOCAL_API', 'true');
```

## Glyph Integration

### Configuration

```javascript
const GLYPH_CONFIG = {
  apiUrl: 'https://api.glyph.you',
  apiKey: 'gk_demo_playground_2024',
  template: 'quote-modern'
};
```

### Generating a Preview

```javascript
const response = await fetch(`${GLYPH_CONFIG.apiUrl}/v1/preview`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${GLYPH_CONFIG.apiKey}`
  },
  body: JSON.stringify({
    template: GLYPH_CONFIG.template,
    data: formData  // Your invoice data
  })
});

const { sessionId, html } = await response.json();
```

### AI Modification

```javascript
const response = await fetch(`${GLYPH_CONFIG.apiUrl}/v1/modify`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${GLYPH_CONFIG.apiKey}`
  },
  body: JSON.stringify({
    sessionId: state.sessionId,
    prompt: 'Add a large green PAID stamp diagonally across the document',
    html: state.currentHtml
  })
});

const { html } = await response.json();
```

### PDF Download

```javascript
const response = await fetch(`${GLYPH_CONFIG.apiUrl}/v1/generate`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${GLYPH_CONFIG.apiKey}`
  },
  body: JSON.stringify({
    sessionId: state.sessionId,
    format: 'pdf',
    filename: 'invoice.pdf'
  })
});

const blob = await response.blob();
// Trigger download...
```

## Key Files

| File | Purpose |
|------|---------|
| `index.html` | UI structure with form inputs, preview area, and quick actions |
| `app.js` | Application logic, Glyph API integration, state management |
| `styles.css` | Dark theme styling matching the Glyph landing page |

## Features

- **Quick Actions**: Pre-built prompts for common modifications
  - Add PAID Stamp
  - Add 10% Discount
  - Apply Stripe Style
  - Add Payment Terms

- **Custom Prompts**: Free-form AI modifications via text input

- **Live Preview**: See changes rendered in real-time

- **Responsive Design**: Works on desktop and mobile

## API Endpoints Used

| Endpoint | Purpose |
|----------|---------|
| `POST /v1/preview` | Create session and generate initial HTML |
| `POST /v1/modify` | Apply AI-powered changes to the document |
| `POST /v1/generate` | Convert session HTML to downloadable PDF |

## Data Structure

The app maps form inputs to Glyph's template data format:

```javascript
{
  branding: { companyName, companyAddress, logoUrl },
  meta: { quoteNumber, date, validUntil, notes, terms },
  client: { name, company, email, address },
  lineItems: [{ description, quantity, unitPrice, total }],
  totals: { subtotal, tax, total }
}
```
