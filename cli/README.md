# @glyph-pdf/cli

AI-powered PDF generation from the command line. Instantly add PDF generation to any project.

## Quick Start

```bash
# Initialize Glyph in your project
npx @glyph-pdf/cli init

# Generate a PDF
glyph generate --template invoice --data invoice.json --output invoice.pdf
```

## Installation

```bash
npm install -g @glyph-pdf/cli
# or
npx @glyph-pdf/cli <command>
```

## Commands

### `glyph init`

Initialize Glyph in your project. Automatically detects your project type and adds the appropriate integration code.

```bash
glyph init
```

**Supported project types:**
- Next.js (App Router & Pages Router)
- Express / Node.js APIs
- React
- Vue.js
- Svelte
- Generic Node.js

**Options:**
- `--force` - Create files even if project type cannot be detected
- `--skip-install` - Skip the SDK install instructions

### `glyph preview`

Start a local preview server with hot reload. Changes to your data file will automatically update the preview.

```bash
glyph preview --data invoice.json
```

**Options:**
- `-t, --template <name>` - Template name (default: "invoice")
- `-d, --data <file>` - JSON data file
- `-p, --port <port>` - Server port (default: 3847)
- `--no-open` - Don't open browser automatically

### `glyph generate`

Generate a PDF from template and data.

```bash
glyph generate --template invoice --data data.json --output invoice.pdf
```

**Options:**
- `-t, --template <name>` - Template name (default: "invoice")
- `-d, --data <file>` - JSON data file (required)
- `-o, --output <file>` - Output PDF file path

### `glyph interactive`

Start an interactive editing session with natural language commands. The best way to iterate on your documents.

```bash
glyph interactive --data invoice.json
```

This opens a preview in your browser and a command prompt in your terminal. Type natural language commands to modify the document:

```
> add QR code for payment
  + Added QR code (preview updated)

> make the company logo bigger
  + Logo enlarged (preview updated)

> add terms: Net 30, 2% early payment discount
  + Terms added (preview updated)

> save
  Saved to document-1705123456789.pdf

> quit
```

**Commands in interactive mode:**
- Type any modification in natural language
- `save` or `s` - Generate and save PDF
- `undo` or `u` - Undo last change
- `quit` or `q` - Exit interactive mode
- `help` or `h` - Show available commands

### `glyph templates`

List all available templates.

```bash
glyph templates
```

### `glyph template:generate`

Generate a custom template from your data structure using AI.

```bash
glyph template:generate --data sample.json
```

This analyzes your data structure and generates an optimal HTML template plus a schema file.

**Options:**
- `-d, --data <file>` - Sample data file (JSON)
- `-o, --output <name>` - Output file name (without extension)
- `--description <text>` - Description to guide the AI

## Configuration

### API Key

Set your Glyph API key as an environment variable:

```bash
export GLYPH_API_KEY=gk_your_api_key_here
```

Or pass it to each command:

```bash
glyph generate --api-key gk_xxx --data data.json
```

Get your API key at [dashboard.glyph.you](https://dashboard.glyph.you).

### API URL

For self-hosted or development environments:

```bash
glyph generate --api-url http://localhost:3000 --data data.json
```

## Example Data Files

### Invoice

```json
{
  "invoiceNumber": "INV-2024-001",
  "date": "2024-01-15",
  "dueDate": "2024-02-14",
  "company": {
    "name": "Your Company",
    "address": "123 Business St, Suite 100",
    "email": "billing@yourcompany.com"
  },
  "client": {
    "name": "Client Corp",
    "address": "456 Client Ave",
    "email": "accounts@client.com"
  },
  "lineItems": [
    { "description": "Consulting Services", "quantity": 10, "unitPrice": 200 },
    { "description": "Development Work", "quantity": 40, "unitPrice": 150 }
  ],
  "subtotal": 8000,
  "taxRate": 10,
  "tax": 800,
  "total": 8800,
  "notes": "Thank you for your business!"
}
```

### Quote

```json
{
  "quoteNumber": "Q-2024-001",
  "date": "2024-01-15",
  "validUntil": "2024-02-14",
  "company": {
    "name": "Your Company",
    "logo": "https://yourcompany.com/logo.png"
  },
  "customer": {
    "name": "Potential Client",
    "email": "client@example.com"
  },
  "lineItems": [
    { "description": "Website Design", "quantity": 1, "unitPrice": 5000 },
    { "description": "Development", "quantity": 80, "unitPrice": 150 }
  ],
  "subtotal": 17000,
  "total": 17000,
  "terms": "50% deposit required to begin work"
}
```

## License

Business Source License 1.1 (BSL-1.1) - See [LICENSE](../LICENSE) for details.
