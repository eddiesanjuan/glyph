# CLAUDE.md - Glyph Project

This file provides guidance to Claude Code when working in this repository.

## Project Overview

Glyph is an AI-powered PDF SDK that enables natural language document customization. Users can modify PDF templates by clicking regions and describing changes in plain English.

**The Vision:** Every app that generates a PDF uses Glyph. Not because they have to, but because nothing else comes close.

**Core Value Props:**
- 2 lines of code to add PDF customization
- AI-powered natural language editing
- Click any section, describe changes, see magic happen
- MCP server for Claude Code / AI agent integration

## Architecture

```
glyph/
├── api/              # Hono REST API (Bun runtime)
│   ├── src/routes/   # Endpoints: preview, modify, generate, analyze
│   ├── src/services/ # AI, PDF generation, guardrails
│   └── src/middleware/ # Auth, rate limiting
├── sdk/              # Web component <glyph-editor>
│   ├── src/components/ # GlyphEditor.ts main component
│   └── src/lib/      # API client, types
├── www/              # Landing page with interactive demo
├── dashboard/        # API key management UI
├── cli/              # Command-line interface
├── mcp-server/       # Model Context Protocol server
├── docs/             # Documentation site
└── templates/        # PDF templates (quote-modern, etc.)
```

### Data Flow

```
User Action → SDK (GlyphEditor) → API (/v1/modify) → Claude AI → Updated HTML → Preview
                                       ↓
                              Guardrails Self-Check
                                       ↓
                              /v1/generate → PDF
```

### Session Management

1. `/v1/preview` - Creates session with rendered HTML from template + data
2. `/v1/modify` - AI modifies session HTML based on natural language
3. `/v1/generate` - Converts session HTML to PDF via Playwright
4. Sessions expire after 1 hour

## Deployment - CRITICAL

**ALL services deploy on Railway with GitHub auto-deploy. Push to main = deploy.**

| Service | Production URL | Railway Fallback |
|---------|----------------|------------------|
| WWW | `https://glyph.you` | `glyph-www-production-69d7.up.railway.app` |
| API | `https://api.glyph.you` | `glyph-api-production-b8ea.up.railway.app` |
| SDK | `https://sdk.glyph.you` | `glyph-sdk-production.up.railway.app` |
| Dashboard | `https://dashboard.glyph.you` | `glyph-dashboard-production.up.railway.app` |
| Docs | `https://docs.glyph.you` | `glyph-docs-production.up.railway.app` |

**Railway Project:** GlyphALL
**Environment:** production

**Deployment Flow:**
1. Make changes locally, test thoroughly
2. `git add . && git commit -m "feat: description"`
3. `git push origin main`
4. Railway auto-builds and deploys (~2-3 min)
5. Verify on production URL

**DO NOT reference Vercel anywhere.** Glyph does not use Vercel.

## API Keys

| Key | Purpose | Tier |
|-----|---------|------|
| `gk_demo_playground_2024` | Landing page demo | demo (in-memory sessions) |
| `gk_*` production keys | Real users | Validated against Supabase |

Demo tier uses in-memory "dev sessions" - no database entries needed. This lets the playground work without Supabase configuration.

## Working on Glyph

### Local Development

```bash
# API (runs on localhost:3000)
cd api && bun install && bun run dev

# SDK (builds web component)
cd sdk && bun install && bun run build

# Landing page (any static server)
cd www && python -m http.server 8000

# Test against local API (in browser console)
localStorage.setItem('USE_LOCAL_API', 'true')
# Remove to use production again
localStorage.removeItem('USE_LOCAL_API')
```

### Environment Variables (api/.env)

```
ANTHROPIC_API_KEY=sk-ant-...
SUPABASE_URL=https://...supabase.co
SUPABASE_SERVICE_KEY=...
GLYPH_API_KEY=gk_demo_playground_2024
```

## Agent Fleet Usage

When working on Glyph, delegate to specialized agents rather than doing everything inline.

### Agent Assignments

| Task | Agent | Why |
|------|-------|-----|
| Architecture exploration | @explorer | Maps codebase, finds broken code |
| UX/code/security audits | @auditor | Fresh-eyes review, competitive analysis |
| Feature implementation | @developer | Writes code, handles versioning |
| Testing & verification | @qa-agent | Browser testing, regression checks |
| Bug investigation | @developer with systematic-debugging | Root cause before fixes |

### Workflow Pattern

```
1. DISCOVER: @explorer maps what exists, what's broken
2. AUDIT: @auditor assesses quality, gaps, competitive position
3. PLAN: Write implementation plan before touching code
4. IMPLEMENT: @developer builds features
5. VERIFY: @qa-agent tests everything works
6. DEPLOY: Push to main, Railway auto-deploys
```

### Key Skills to Use

- `/brainstorming` - Before building new features
- `/systematic-debugging` - Before fixing bugs
- `/test-driven-development` - When implementing features
- `/verification-before-completion` - Before claiming work is done

### Rapid Development Commands

**These are the primary commands for iterating on Glyph:**

| Command | Purpose |
|---------|---------|
| `/rapid` | Batch feedback → parallel fixes → deploy → verify |
| `/self-improve` | Continuous quality audit and auto-improvement |

**`/rapid` Workflow:**
```
1. Paste batch feedback (bugs, UX issues, feature requests)
2. System parses into discrete issues
3. Spawns parallel agents to fix all issues
4. Commits all fixes in one commit
5. Pushes to main (Railway auto-deploys)
6. QA agent verifies production
7. Reports results
```

**`/self-improve` Workflow:**
```
1. Health check on production
2. UX audit (scores + friction points)
3. Code quality scan
4. Generate improvement backlog
5. Auto-fix safe issues (with --auto-fix)
6. Log learnings for future cycles
```

**No barriers. Ship fast. Verify on production.**

### Browser Testing

Use Agent Browser CLI for all browser automation:

```bash
agent-browser open https://glyph-www-production-69d7.up.railway.app
agent-browser snapshot -i          # Get interactive element refs
agent-browser click @ref           # Click element
agent-browser fill @ref "text"     # Fill input
agent-browser screenshot           # Capture state
agent-browser close
```

## Key Files Reference

### API
- `api/src/index.ts` - Entry point, route mounting, middleware chain
- `api/src/routes/preview.ts` - HTML preview from template + data
- `api/src/routes/modify.ts` - AI-powered modifications
- `api/src/routes/generate.ts` - PDF generation via Playwright
- `api/src/services/ai.ts` - Claude integration for modifications
- `api/src/services/guardrails.ts` - Self-checking validator
- `api/src/middleware/auth.ts` - API key validation
- `api/src/lib/devSessions.ts` - In-memory sessions for demo tier

### SDK
- `sdk/src/components/GlyphEditor.ts` - Main web component (the product)
- `sdk/src/lib/api.ts` - API client for SDK
- `sdk/src/styles/base.ts` - Component styling

### Landing Page
- `www/index.html` - Single-page landing with embedded demo
- Lines ~5725 and ~7412 have API URL variables (use production Railway URL)

### Templates
- `templates/quote-modern/` - Default quote template
- `templates/*/schema.json` - Data schema for template
- `templates/*/template.html` - Mustache HTML template

## Common Tasks

### Testing the Demo
1. Go to `https://glyph-www-production-69d7.up.railway.app`
2. Try quick actions: "Add watermark", "Add signature"
3. Check browser console - should see `[Glyph] Self-check passed`
4. No localhost:3000 errors should appear

### Adding a New Template
1. Create `templates/[name]/` directory
2. Add `template.html` with Mustache placeholders and `data-glyph-region` attributes
3. Add `schema.json` defining data structure
4. Add `styles.css` for template-specific styles
5. Register in template engine

### Debugging API Issues
1. Check Railway logs: `railway logs` or Railway dashboard
2. Test endpoint directly: `curl -H "Authorization: Bearer gk_demo_playground_2024" https://glyph-api-production-b8ea.up.railway.app/health`
3. For AI modifications, check `selfCheckPassed` in response

### Fixing Demo Bugs
1. Test locally first with `python -m http.server` in `/www`
2. Set `localStorage.setItem('USE_LOCAL_API', 'true')` to test against local API
3. Fix the issue
4. Remove localStorage flag, test against production
5. Commit and push - Railway auto-deploys

## Quality Standards

### The Demo Must Be Flawless
The landing page demo is the product. It must:
- Load without errors
- Show preview immediately
- Respond to quick actions visibly
- Pass self-check on every modification
- Feel magical, not glitchy

### Code Quality
- TypeScript strict mode
- Proper error handling with user-friendly messages
- No `any` types without justification
- Self-checking validator catches AI mistakes

### Security
- API keys hashed with SHA-256
- No client-side key exposure (except demo key)
- Input sanitization on all endpoints
- CORS configured for known origins

## Troubleshooting

### "localhost:3000 connection refused" in production
- Check `www/index.html` for hardcoded localhost references
- Both `API_URL` (~line 5725) and `GLYPH_API` (~line 7412) must use production URL
- localStorage `USE_LOCAL_API` flag should not be set

### Demo quick actions don't work
- Check browser console for errors
- Verify API responds: test `/health` endpoint
- Check `selfCheckPassed` in modify response
- Review `api/src/services/guardrails.ts` for validation logic

### Railway deployment fails
- Check Railway dashboard for build logs
- Verify `Dockerfile` is correct for the service
- Check environment variables are set in Railway
