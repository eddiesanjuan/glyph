# Glyph

AI-powered PDF customization. 2 lines of code. Unlimited possibilities.

## Quick Start

```html
<script src="https://sdk.glyph.you/glyph.min.js"></script>
<glyph-editor api-key="gk_xxx" template="quote-modern" :data="quoteData" />
```

## Features

- **Drop-in Web Component** - Works with any framework or vanilla HTML
- **AI-Powered Customization** - Natural language template modifications
- **Professional Templates** - Quotes, invoices, proposals, and more
- **Real-time Preview** - See changes as you make them
- **Export Anywhere** - PDF, PNG, or direct email delivery

## Project Structure

```
glyph/
├── api/              # Backend API (Bun + Hono)
├── sdk/              # Web component SDK
├── templates/        # PDF templates
├── dashboard/        # API key management UI
├── docs/             # Documentation site
├── www/              # Landing page with demo
├── cli/              # Command-line interface
└── mcp-server/       # MCP server for AI integrations
```

## Deployment

All services are deployed on **Railway** with GitHub auto-deploy:

| Service | Production URL |
|---------|----------------|
| WWW | `https://glyph.you` |
| API | `https://api.glyph.you` |
| SDK | `https://sdk.glyph.you` |
| Dashboard | `https://dashboard.glyph.you` |
| Docs | `https://docs.glyph.you` |

Push to `main` to deploy automatically (Railway auto-deploy).

## Documentation

Visit [docs.glyph.you](https://docs.glyph.you)

## License

MIT
