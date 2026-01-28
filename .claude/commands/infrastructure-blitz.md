# Infrastructure Blitz Orchestrator

**Make Glyph The Default -- Build The Distribution Layer That Makes Every AI Agent Reach For Glyph**

This orchestrator transforms Glyph from "amazing product" to "the thing every AI uses to make PDFs." It runs in Ralph loops. Each cycle is self-contained: read state, measure, prioritize, implement, verify, deploy, learn.

**This is NOT /performance-sprint.** Performance-sprint polishes the product. Infrastructure-blitz builds the distribution layer that makes the product EVERYWHERE.

---

## Quick Start

```bash
/infrastructure-blitz                    # Run one improvement cycle
/infrastructure-blitz --status           # Check current pillar scores
/infrastructure-blitz --verify-only      # Just verify production state
/infrastructure-blitz --pillar=<name>    # Focus on one pillar
```

---

## The Strategic Gap

Glyph has a great product. The gap to "every AI uses it" is DISTRIBUTION and SIMPLICITY.

| HAVE | NEED |
|------|------|
| Multi-step session API | Single-call `/v1/create` as THE headline API |
| MCP server exists | MCP discoverable everywhere (registries, directories) |
| Web component SDK | `npm install glyph` / `pip install glyph` -- one function call |
| 11 hand-built templates | Community registry + raw HTML/URL support |
| Binary PDF response | Hosted CDN URLs with TTL |
| Good docs site | Being THE search result for "AI PDF generation" |

---

## The 6 Infrastructure Pillars

Each pillar is scored 0-100 by independent auditors. Composite = weighted average.

| Pillar | Weight | What 100 Means |
|--------|--------|-----------------|
| **One-Call API** | 30% | An AI agent generates any PDF with ONE request and gets back a shareable URL |
| **SDK Distribution** | 20% | A developer installs ONE package and generates a PDF in 3 lines of code |
| **Agent Framework Integrations** | 20% | Any AI agent framework has a ready-made Glyph tool |
| **Template Network Effects** | 15% | Agents can always find or create the template they need |
| **Hosted Output** | 10% | AI agents generate a PDF and immediately share the URL |
| **SEO and Discoverability** | 5% | Developers searching for PDF generation find Glyph first |

### Composite Formula

```
COMPOSITE = (OneCallAPI * 0.30) + (SDKDistribution * 0.20) + (AgentFrameworks * 0.20) +
            (TemplateNetwork * 0.15) + (HostedOutput * 0.10) + (SEODiscoverability * 0.05)
```

---

## Pillar Scoring Definitions

### Pillar 1: One-Call API (30% weight)

**Target:** `POST /v1/create` -- data in, hosted PDF URL out. One request. No sessions.

| Criterion | Points | How to Verify |
|-----------|--------|---------------|
| `/v1/create` exists and accepts templateId + data | 20 | `curl -X POST /v1/create -d '{"templateId":"invoice-clean","data":{...}}'` |
| Returns `{ url, id, expiresAt }` (not binary PDF) | 15 | Check response JSON structure |
| PDFs hosted at URLs accessible without auth | 10 | Open returned URL in browser |
| Configurable TTL (default 24h) | 5 | Pass `ttl` param, verify `expiresAt` changes |
| Accepts raw HTML as template (`html` param) | 10 | `curl -X POST /v1/create -d '{"html":"<h1>Test</h1>"}'` |
| Accepts URL as template source (`url` param) | 10 | `curl -X POST /v1/create -d '{"url":"https://example.com"}'` |
| Error responses have structured codes + suggestions | 10 | Send malformed request, check error shape |
| Stateless -- no session required | 10 | Confirm no `/v1/preview` call needed |
| Works with demo API key | 5 | Test with `gk_demo_playground_2024` |
| Documented in docs site with examples | 5 | Navigate to docs, find /v1/create page |

**Score 100 = An AI agent can generate any PDF with ONE API call and get back a URL it can share.**

### Pillar 2: SDK Distribution (20% weight)

| Criterion | Points | How to Verify |
|-----------|--------|---------------|
| npm package exists with `glyph.create()` function | 20 | Check `packages/node/` or similar directory |
| TypeScript types for all templates | 10 | Check `.d.ts` files or type exports |
| Works in 3 lines: import, configure, create | 15 | Read README, count lines to first PDF |
| Python package exists with `glyph.create()` | 15 | Check `packages/python/` or similar |
| Both packages are thin wrappers (< 100 lines core) | 5 | Count lines of core logic |
| README with copy-paste examples | 10 | Read package README |
| package.json / setup.py properly configured | 10 | Check package metadata |
| Publishing instructions or published | 15 | Check npm/PyPI or instructions doc |

**Score 100 = A developer installs ONE package and generates a PDF in 3 lines of code.**

### Pillar 3: Agent Framework Integrations (20% weight)

| Criterion | Points | How to Verify |
|-----------|--------|---------------|
| OpenAI function calling schema (tools array) | 15 | Check docs or integration files |
| LangChain tool wrapper (GlyphPDFTool class) | 15 | Check integration files |
| Vercel AI SDK tool definition | 15 | Check integration files |
| Anthropic tool_use definition | 10 | Check integration files |
| Each tool definition is copy-paste ready in docs | 15 | Navigate docs, find integration page |
| MCP server listed on mcp.so / smithery.ai | 10 | Visit directories, search for Glyph |
| MCP server README has clear install instructions | 10 | Read mcp-server/README.md |
| At least one end-to-end example per framework | 10 | Find working examples in docs/repo |

**Score 100 = Any AI agent framework has a ready-made Glyph tool.**

### Pillar 4: Template Network Effects (15% weight)

| Criterion | Points | How to Verify |
|-----------|--------|---------------|
| `POST /v1/templates` creates custom templates | 15 | `curl -X POST /v1/templates -d '{"html":"...","schema":{...}}'` |
| `/v1/create` with `html` param (no template needed) | 15 | Test raw HTML to PDF |
| `/v1/create` with `url` param (any URL to PDF) | 10 | Test URL to PDF |
| 15+ high-quality built-in templates | 15 | `curl /v1/templates` and count |
| Templates discoverable via `/v1/templates?category=X` | 10 | Test with category/tag filters |
| Template schemas are agent-friendly (clear field names, types, descriptions) | 15 | Read schema.json files |
| Common use cases covered (invoice, contract, proposal, certificate, receipt, report, letter, label) | 10 | Map templates to use cases |
| Template creation documented | 10 | Find docs page for custom templates |

**Score 100 = Agents can always find or create the template they need.**

### Pillar 5: Hosted Output (10% weight)

| Criterion | Points | How to Verify |
|-----------|--------|---------------|
| Generated PDFs stored with unique IDs | 20 | Check /v1/create response has ID |
| `GET /v1/documents/:id` returns PDF file | 20 | Open URL in browser |
| `GET /v1/documents/:id/metadata` returns info | 15 | `curl /v1/documents/:id/metadata` |
| URLs work without authentication (signed/obscure) | 15 | Open URL in incognito browser |
| Configurable TTL (default 24h, max 7d) | 15 | Pass TTL param, check metadata |
| Expired documents return proper 404/410 | 15 | Test with expired ID |

**Score 100 = AI agents can generate a PDF and immediately share the URL.**

### Pillar 6: SEO and Discoverability (5% weight)

| Criterion | Points | How to Verify |
|-----------|--------|---------------|
| npm package description optimized for search | 15 | Read package.json description |
| PyPI package description optimized | 15 | Read setup.py/pyproject.toml |
| GitHub repo description and topics set | 15 | Visit GitHub repo page |
| README ranks for "AI PDF generation" keywords | 15 | Read README, check keywords |
| Docs site has SEO meta tags | 10 | Inspect docs page source |
| sitemap.xml exists and is valid | 10 | `curl /sitemap.xml` on docs |
| Blog post or guide targeting key queries | 10 | Check docs/guides section |
| MCP directories list Glyph | 10 | Search mcp.so, smithery.ai |

**Score 100 = Developers searching for PDF generation find Glyph first.**

---

## Phase Structure

```
CONTEXT --> MEASURE --> PRIORITIZE --> IMPLEMENT --> VERIFY --> DEPLOY --> LEARN
    ^                                                                      |
    '---------------------- Loop until 100 or max cycles -----------------'
```

---

## IDENTITY LOCK (SURVIVES COMPACT)

**READ THIS AFTER EVERY CONTEXT COMPACT.**

You are the INFRASTRUCTURE BLITZ ORCHESTRATOR. You ORCHESTRATE. You do NOT:
- Write application code
- Implement features
- Fix bugs
- Run tests
- Audit applications
- Do ANY work that belongs to @developer, @qa-agent, @auditor

**BEFORE EVERY ACTION:** "Am I about to do work myself?"
If YES --> STOP --> Deploy the appropriate agent.

---

## Phase 0: Context Intelligence (MANDATORY -- CANNOT SKIP)

**Deployment: INTERNAL**

**HARD GATE: You MUST read ALL of these before proceeding. If any file read fails, stop and report.**

### Step 1: Read Eddie's Feedback FIRST
```bash
cat /Users/eddiesanjuan/Projects/glyph/.claude/CYCLE_FEEDBACK.md
```
**If there is ANY unaddressed feedback, list it explicitly and plan to address it this cycle.**
**P0 items MUST be addressed before any other work.**

### Step 2: Load State and Constraints
```bash
cat /Users/eddiesanjuan/Projects/glyph/.claude/infrastructure-blitz-state.md
cat /Users/eddiesanjuan/Projects/glyph/.claude/USER_DECISIONS.md
```
If state file does not exist, this is Cycle 1. Create it (see State File Template below).

### Step 3: Verify Production is Alive
```bash
curl -s https://glyph-api-production-b8ea.up.railway.app/health
```

### Step 4: Check Git State
```bash
git status --short
git log --oneline -5
```

### Extract Key Info
- **Eddie's feedback** (HIGHEST PRIORITY -- list every item and whether it's addressed)
- Current composite score and per-pillar scores
- Previous cycle's improvements and blockers
- Forbidden items (confetti, stripe styling, dishonest estimates, visual editor, design tools)
- What infrastructure already exists vs. what needs building

---

## Phase 1: MEASURE (Independent Audit -- No Self-Grading)

**Deployment: PARALLEL WAVE -- auditors MUST use Playwright MCP browser tools**

**CRITICAL: Auditor agents are INDEPENDENT. They receive NO score history. They score from scratch based on what they observe via API testing, browser testing, and codebase reading. Previous scores are irrelevant.**

### Wave 1: Parallel Audits

Deploy 2-3 @auditor agents simultaneously. Each prompt MUST include the Playwright MCP block AND these instructions.

**Auditor A: One-Call API + Hosted Output**

```
Score the One-Call API and Hosted Output pillars for Glyph from scratch. You have NO prior scores.

Working Directory: /Users/eddiesanjuan/Projects/glyph

## One-Call API (0-100)

Test the actual API. This is the most important pillar.

1. Does POST /v1/create exist?
   curl -s -X POST https://glyph-api-production-b8ea.up.railway.app/v1/create \
     -H "Authorization: Bearer gk_demo_playground_2024" \
     -H "Content-Type: application/json" \
     -d '{"templateId":"invoice-clean","data":{"company_name":"Test Corp","invoice_number":"INV-001"}}'

   Expected: JSON response with { url, id, expiresAt }
   If 404/not found: score starts at 0 for this criterion.

2. Does it return a hosted URL (not binary PDF)?
   Check response Content-Type and body structure.

3. Can you access the returned URL without auth?
   Open the URL. Does it serve a PDF?

4. Does it accept raw HTML?
   curl -s -X POST /v1/create -d '{"html":"<h1>Hello World</h1>"}'

5. Does it accept a URL source?
   curl -s -X POST /v1/create -d '{"url":"https://example.com"}'

6. What do error responses look like?
   Send malformed request. Check for structured error codes.

7. Is it documented?
   Navigate to https://docs.glyph.you and look for /v1/create documentation.

8. Is it stateless? (No session creation needed first)

Read api/src/routes/ to understand what endpoints exist.
Read api/src/index.ts to see route mounting.

Score each criterion per the scoring table. For every point below 100, cite the specific gap.

## Hosted Output (0-100)

1. After /v1/create, is the PDF stored with a unique ID?
2. Does GET /v1/documents/:id return the PDF?
3. Does GET /v1/documents/:id/metadata return info?
4. Do URLs work without authentication?
5. Is TTL configurable?
6. Do expired documents return 404/410?

Test each with curl. If endpoints don't exist, score 0 for those criteria.

## Browser Testing (MANDATORY - Playwright MCP)

You MUST use Playwright MCP tools for all browser-based verification.

### Tools Available (Playwright MCP)
- mcp__plugin_playwright_playwright__browser_navigate       -- Load URL
- mcp__plugin_playwright_playwright__browser_snapshot        -- Get accessibility tree
- mcp__plugin_playwright_playwright__browser_click           -- Click element by ref
- mcp__plugin_playwright_playwright__browser_take_screenshot -- Capture visual evidence (REQUIRED)
- mcp__plugin_playwright_playwright__browser_resize          -- Change viewport
- mcp__plugin_playwright_playwright__browser_console_messages -- Check for errors
- mcp__plugin_playwright_playwright__browser_evaluate        -- Run JS on page
- mcp__plugin_playwright_playwright__browser_close           -- Close browser

Production URL: https://glyph.you
API: https://glyph-api-production-b8ea.up.railway.app
Docs: https://docs.glyph.you

Navigate to docs site to verify /v1/create is documented. Take screenshots.

Return your scores as:
- One-Call API: X/100 with line-item deductions
- Hosted Output: X/100 with line-item deductions
- List of specific gaps that prevent 100
```

**Auditor B: SDK Distribution + Agent Framework Integrations**

```
Score the SDK Distribution and Agent Framework Integrations pillars for Glyph from scratch. You have NO prior scores.

Working Directory: /Users/eddiesanjuan/Projects/glyph

## SDK Distribution (0-100)

Check if distributable SDK packages exist:

1. Look for npm package source:
   - Check packages/ directory, sdk/ directory, or any directory with a standalone package.json
     intended for `npm install glyph` usage
   - Look for a thin wrapper that exposes glyph.create(templateId, data) -> URL
   - NOT the web component SDK (sdk/src/components/GlyphEditor.ts) -- that's the embed SDK,
     not the server-side "generate a PDF" SDK

2. Look for Python package source:
   - Check for setup.py, pyproject.toml, or packages/python/
   - Look for a thin wrapper around the REST API

3. For each package found:
   - Does it have a README with copy-paste examples?
   - Does it export TypeScript types?
   - Is the core logic < 100 lines?
   - Is package.json / setup.py properly configured?
   - Are there publishing instructions?

4. If packages DON'T exist yet:
   - Score 0 for their criteria
   - Note this as the primary gap

Read the codebase to find any existing package code. Check:
- ls /Users/eddiesanjuan/Projects/glyph/packages/
- ls /Users/eddiesanjuan/Projects/glyph/sdk/
- Find any package.json files that suggest an npm-publishable package

## Agent Framework Integrations (0-100)

Check if framework-specific tool definitions exist:

1. OpenAI function calling schema:
   - Look for a JSON tools array definition for GPT function calling
   - Check docs/, integrations/, or similar directories

2. LangChain tool wrapper:
   - Look for a GlyphPDFTool class or similar
   - Check for langchain integration code

3. Vercel AI SDK tool definition:
   - Look for Vercel AI SDK compatible tool export

4. Anthropic tool_use definition:
   - Look for Claude tool definition (separate from MCP)

5. MCP server:
   - Read mcp-server/ directory
   - Is README clear with install instructions?
   - Is it listed on mcp.so or smithery.ai? (you can note this but cannot verify externally)

6. Check docs for integration guides:
   - Navigate to https://docs.glyph.you
   - Look for AI agent integration pages
   - Are there copy-paste tool definitions?

## Browser Testing (MANDATORY - Playwright MCP)

You MUST use Playwright MCP tools for all browser-based verification.

### Tools Available (Playwright MCP)
- mcp__plugin_playwright_playwright__browser_navigate
- mcp__plugin_playwright_playwright__browser_snapshot
- mcp__plugin_playwright_playwright__browser_take_screenshot
- mcp__plugin_playwright_playwright__browser_console_messages
- mcp__plugin_playwright_playwright__browser_close

Navigate to https://docs.glyph.you to check for SDK and integration documentation.
Take screenshots of any relevant pages found.

Return your scores as:
- SDK Distribution: X/100 with line-item deductions
- Agent Framework Integrations: X/100 with line-item deductions
- List of specific gaps that prevent 100
```

**Auditor C: Template Network Effects + SEO and Discoverability**

```
Score the Template Network Effects and SEO/Discoverability pillars for Glyph from scratch. You have NO prior scores.

Working Directory: /Users/eddiesanjuan/Projects/glyph

## Template Network Effects (0-100)

1. Count built-in templates:
   ls /Users/eddiesanjuan/Projects/glyph/templates/
   curl -s https://glyph-api-production-b8ea.up.railway.app/v1/templates \
     -H "Authorization: Bearer gk_demo_playground_2024"

2. Check template quality:
   - For each template, read schema.json
   - Are field names clear and descriptive?
   - Are types specified?
   - Are descriptions included?
   - Could an AI agent fill this schema with zero ambiguity?

3. Check for custom template creation:
   - Does POST /v1/templates exist?
   curl -s -X POST https://glyph-api-production-b8ea.up.railway.app/v1/templates \
     -H "Authorization: Bearer gk_demo_playground_2024" \
     -H "Content-Type: application/json" \
     -d '{"name":"test","html":"<h1>{{title}}</h1>","schema":{"title":{"type":"string"}}}'

4. Check for raw HTML support on /v1/create (or equivalent endpoint)

5. Check for URL-to-PDF support

6. Template discoverability:
   curl -s '/v1/templates?category=invoice'
   Do filters work?

7. Use case coverage -- map templates to common document types:
   - Invoice, Contract, Proposal, Certificate, Receipt, Report, Letter, Shipping Label
   - Which are covered? Which are missing?

8. Is template creation documented?
   Navigate to https://docs.glyph.you and find custom template docs.

## SEO and Discoverability (0-100)

1. Check GitHub repo:
   - Read the top-level README.md
   - Does it mention "AI PDF generation" prominently?
   - Are there relevant keywords?

2. Check docs site SEO:
   - Navigate to https://docs.glyph.you
   - Use Playwright to inspect meta tags (evaluate JS to read document.head)
   - Check for sitemap.xml: curl https://docs.glyph.you/sitemap.xml
   - Check for robots.txt

3. Check package descriptions:
   - If npm package exists, read its package.json description
   - If Python package exists, read its metadata

4. Check for content marketing:
   - Are there guides/tutorials in docs that target search queries?
   - "How to generate PDF with AI"
   - "AI PDF API"
   - "Generate PDF from code"

5. MCP directory listings:
   - Note whether MCP server has been submitted to directories (cannot verify externally, but check README for instructions)

## Browser Testing (MANDATORY - Playwright MCP)

You MUST use Playwright MCP tools for all browser-based verification.

### Tools Available (Playwright MCP)
- mcp__plugin_playwright_playwright__browser_navigate
- mcp__plugin_playwright_playwright__browser_snapshot
- mcp__plugin_playwright_playwright__browser_take_screenshot
- mcp__plugin_playwright_playwright__browser_evaluate
- mcp__plugin_playwright_playwright__browser_console_messages
- mcp__plugin_playwright_playwright__browser_close

Production URL: https://glyph.you
API: https://glyph-api-production-b8ea.up.railway.app
Docs: https://docs.glyph.you

Return your scores as:
- Template Network Effects: X/100 with line-item deductions
- SEO and Discoverability: X/100 with line-item deductions
- List of specific gaps that prevent 100
```

### Synthesis

Collect scores from all auditors. Calculate composite:
```
COMPOSITE = (OneCallAPI * 0.30) + (SDKDistribution * 0.20) + (AgentFrameworks * 0.20) +
            (TemplateNetwork * 0.15) + (HostedOutput * 0.10) + (SEODiscoverability * 0.05)
```

**If any auditor returned scores without browser screenshots or API test evidence, REJECT and re-run.**
**If composite differs from previous cycle by >10 points, investigate which was wrong.**

---

## Phase 2: PRIORITIZE

**Deployment: INTERNAL**

Score each potential improvement:
```
PRIORITY = (IMPACT * 3) + (EFFORT_INVERSE * 2) + (RISK_INVERSE * 1)

Where:
- IMPACT: 1-5 (how many composite points does this add?)
- EFFORT_INVERSE: 5 - EFFORT (1-5, lower effort = higher score)
- RISK_INVERSE: 5 - RISK (1-5, lower risk = higher score)
```

### Selection Rules

1. Select 3-5 improvements for this cycle
2. At least ONE improvement MUST target the lowest-scoring pillar
3. Prefer improvements that unlock other improvements (e.g., /v1/create enables hosted output, SDK, etc.)
4. High-weight pillars get priority when scores are tied
5. Never select something that risks breaking existing features

### Output Format

```markdown
## Selected Improvements for Cycle [N]

| # | Improvement | Pillar | Impact | Effort | Risk | Priority Score |
|---|-------------|--------|--------|--------|------|----------------|
| 1 | [description] | One-Call API | 5 | 2 | 1 | 18 |
| 2 | [description] | SDK Distribution | 4 | 1 | 1 | 19 |
| 3 | [description] | Templates | 3 | 1 | 1 | 16 |

### Deferred (for future cycles)
- [improvement]: [reason for deferral]
```

### Dependency Awareness

Some pillars depend on others:
- **Hosted Output** requires **One-Call API** (need /v1/create to return URLs)
- **SDK Distribution** requires **One-Call API** (SDK wraps the create endpoint)
- **Agent Framework Integrations** requires **One-Call API** (tools call the create endpoint)

If One-Call API is missing, it MUST be Cycle 1's top priority. Everything else depends on it.

---

## Phase 3: IMPLEMENT

**Deployment: PARALLEL WAVE**

For each selected improvement, spawn @developer agents. Independent improvements run in parallel.

### Developer Prompt Template

```markdown
## Infrastructure Blitz: Implement [IMPROVEMENT NAME]

**Working Directory:** /Users/eddiesanjuan/Projects/glyph

**Improvement:** [detailed description]
**Pillar:** [which infrastructure pillar this targets]
**Expected Impact:** [+X points to pillar score]
**Context:** [what exists today, what needs to change]

### FORBIDDEN (ABSOLUTE -- NO EXCEPTIONS)
- Confetti animation -- NO CONFETTI EVER
- Stripe styling button -- Too slow
- Dishonest time estimates -- Trust > comfort
- Visual drag-and-drop editor -- We are NOT CraftMyPDF
- Design tools for designers -- Glyph is for developers and AI agents

### Architecture Constraints
- API runs on Bun with Hono framework
- All API code lives in api/src/
- Templates live in templates/ and api/templates/
- www/index.html is the landing page
- docs/ is an Astro site
- sdk/ is the web component (NOT the server-side SDK)
- mcp-server/ is the MCP server

### Implementation Requirements
1. Implement the improvement completely
2. Follow existing code patterns (look at nearby files for style)
3. Add proper TypeScript types
4. Include error handling
5. Do not touch unrelated code
6. Test locally if possible (cd api && bun run dev)

### DO NOT COMMIT
The orchestrator handles all git operations. Just implement and report what files you modified.

### Return Format
Report:
- Status: complete / partial / blocked
- Files modified: [list of absolute paths]
- Changes summary: [what changed]
- Test instructions: [how to verify]
- Risk assessment: [what could break]
```

### Parallel Execution Rules

1. **Independent improvements** run in parallel (e.g., npm package + Python package)
2. **Dependent improvements** run sequentially (e.g., /v1/create must exist before SDK wraps it)
3. **Same-file improvements** run sequentially (prevent merge conflicts)

---

## Phase 4: VERIFY

**Deployment: @qa-agent with Playwright MCP tools**

The QA agent MUST verify BOTH new implementations AND existing features.

### QA Agent Prompt

```markdown
## Infrastructure Blitz: Verification

**Working Directory:** /Users/eddiesanjuan/Projects/glyph

**Changes to verify:**
[list of improvements and files modified]

## Browser Testing (MANDATORY - Playwright MCP)

You MUST use Playwright MCP tools for all testing and verification.
Do NOT skip browser testing. Do NOT claim things work without screenshots.
If you cannot use browser tools, say so explicitly -- do NOT fake results.

### Tools Available (Playwright MCP)
- mcp__plugin_playwright_playwright__browser_navigate       -- Load URL
- mcp__plugin_playwright_playwright__browser_snapshot        -- Get accessibility tree with interactive refs
- mcp__plugin_playwright_playwright__browser_click           -- Click element by ref
- mcp__plugin_playwright_playwright__browser_type            -- Type into input by ref
- mcp__plugin_playwright_playwright__browser_take_screenshot -- Capture visual evidence (REQUIRED)
- mcp__plugin_playwright_playwright__browser_resize          -- Change viewport (mobile testing)
- mcp__plugin_playwright_playwright__browser_console_messages -- Check for errors
- mcp__plugin_playwright_playwright__browser_evaluate        -- Run JS on page
- mcp__plugin_playwright_playwright__browser_close           -- Close browser

### REQUIRED: Regression Check (every cycle)

These MUST still work. Each needs a screenshot.

1. Navigate to https://glyph.you -- screenshot -- check for visual issues
2. Take snapshot, get interactive refs
3. Check console for errors (level: "error")
4. Click watermark quick action -- screenshot -- must complete <1s
5. Click QR code quick action -- screenshot -- must complete <1s
6. Resize to 375x812 -- screenshot -- mobile hero
7. Navigate to https://docs.glyph.you -- screenshot -- docs load
8. Navigate to https://dashboard.glyph.you -- screenshot -- dashboard load
9. Close browser

### REQUIRED: New Implementation Verification

For each improvement implemented this cycle:
[list specific test steps per improvement]

### API Verification

```bash
# Health check
curl -s https://glyph-api-production-b8ea.up.railway.app/health

# Templates list
curl -s https://glyph-api-production-b8ea.up.railway.app/v1/templates \
  -H "Authorization: Bearer gk_demo_playground_2024"

# Test new endpoints (list specific curl commands per improvement)
```

### Pass/Fail Criteria
- ALL regression checks must pass with screenshot evidence
- ALL new implementations must work as specified
- Zero console errors on any page
- API endpoints respond correctly
- Any failure = FAIL (fix before proceeding)

### Return Format

{
  "regressionStatus": "PASS" | "FAIL",
  "newImplementations": [
    { "improvement": "...", "status": "PASS" | "FAIL", "evidence": "screenshot path" }
  ],
  "consoleErrors": [],
  "overallStatus": "PROCEED" | "FIX_REQUIRED" | "ABORT",
  "issues": [
    { "severity": "blocker" | "major" | "minor", "description": "..." }
  ]
}
```

### Decision Point

**If PROCEED:** Continue to Phase 5 (Deploy)
**If FIX_REQUIRED:** Spawn @developer to fix, then re-verify
**If ABORT:** Skip to Phase 6 (Learn) with failure logged

---

## Phase 5: DEPLOY

**Deployment: INTERNAL (orchestrator executes)**

### 5.1 Pre-Commit Checks

```bash
# Verify what changed
git status --short
git diff --stat

# Review for secrets
git diff | grep -i "api_key\|secret\|password\|sk-ant" && echo "ABORT: Secrets detected"
```

### 5.2 Commit and Push

```bash
# Stage specific files (NEVER git add .)
git add [specific files from implementations]

# Commit with infrastructure-blitz prefix
git commit -m "$(cat <<'EOF'
infra: Infrastructure Blitz Cycle [N] - [short summary]

Improvements:
- [improvement 1]
- [improvement 2]

Pillar Scores: [before] -> [after] (+[delta])
Composite: [before] -> [after] (+[delta])

Orchestrated by: /infrastructure-blitz
Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"

# Push to deploy
git push origin main
```

### 5.3 Production Verification (after ~2-3 min Railway deploy)

Deploy @qa-agent with Playwright MCP to run the full regression check against production URLs.

**Every verification MUST include screenshots as proof.**
**If QA cannot use Playwright MCP tools, it must say so -- never fake results.**

If regression detected:
```bash
git revert HEAD --no-edit
git push origin main
```
Log the failure and proceed to Phase 6 (Learn).

---

## Phase 6: LEARN

**Deployment: INTERNAL**

### 6.1 Update State File

Update `/Users/eddiesanjuan/Projects/glyph/.claude/infrastructure-blitz-state.md`:

```markdown
# Infrastructure Blitz State

## Current Cycle
- Cycle: [N]
- Status: [SUCCESS | PARTIAL | FAILED | ROLLED_BACK]
- Last Run: [ISO date]

## Pillar Scores

| Pillar | Score | Previous | Change | Weight | Weighted |
|--------|-------|----------|--------|--------|----------|
| One-Call API | [N] | [N] | [+/-N] | 30% | [N] |
| SDK Distribution | [N] | [N] | [+/-N] | 20% | [N] |
| Agent Frameworks | [N] | [N] | [+/-N] | 20% | [N] |
| Template Network | [N] | [N] | [+/-N] | 15% | [N] |
| Hosted Output | [N] | [N] | [+/-N] | 10% | [N] |
| SEO/Discoverability | [N] | [N] | [+/-N] | 5% | [N] |
| **COMPOSITE** | **[N]** | **[N]** | **[+/-N]** | | |

## What Was Built This Cycle
- [improvement 1]: [outcome]
- [improvement 2]: [outcome]

## What Blocked
- [blocker if any]

## What's Next (Prioritized)
1. [highest priority for next cycle]
2. [second priority]
3. [third priority]

## Dependencies Map
- One-Call API --> unlocks SDK, Agent Frameworks, Hosted Output
- SDK Distribution --> unlocks npm/PyPI publishing, SEO via package listings
- Templates --> unlocks network effects, more use cases

## Cycle History
### Cycle [N] - [date]
- Composite: [before] -> [after] (+[delta])
- Improvements: [list]
- Key Learning: [one sentence]
```

### 6.2 Loop Check

If composite < 100 AND this is a Ralph loop:
- Return to Phase 0
- Pass blockers and learnings to next cycle
- Adjust priorities based on what was learned

If composite >= 95:
- Celebrate (in state file, not with confetti)
- Focus remaining cycles on edge cases and polish

---

## Scoring Integrity Rules

These are non-negotiable.

1. **@developer NEVER assigns scores.** Implementation agents do not grade their own work.
2. **@auditor NEVER writes code.** Scoring agents do not implement.
3. **Score increase requires evidence.** API response JSON, browser screenshot, or curl output.
4. **Any broken existing feature = -3 points** from the relevant pillar.
5. **Any console error = -2 points.**
6. **Scores CAN go DOWN** between cycles if regressions are found.
7. **No self-grading.** The orchestrator records scores from auditors only.
8. **If an auditor returns scores without evidence, REJECT and re-run.**

---

## State File Template (Created on Cycle 1)

If `/Users/eddiesanjuan/Projects/glyph/.claude/infrastructure-blitz-state.md` does not exist, create it:

```markdown
# Infrastructure Blitz State

## Current Cycle
- Cycle: 1
- Status: IN PROGRESS
- Last Run: [date]

## Pillar Scores

| Pillar | Score | Target | Gap | Weight |
|--------|-------|--------|-----|--------|
| One-Call API | 0 | 100 | 100 | 30% |
| SDK Distribution | 0 | 100 | 100 | 20% |
| Agent Framework Integrations | 0 | 100 | 100 | 20% |
| Template Network Effects | 0 | 100 | 100 | 15% |
| Hosted Output | 0 | 100 | 100 | 10% |
| SEO and Discoverability | 0 | 100 | 100 | 5% |
| **COMPOSITE** | **0** | **100** | **100** | |

## Dependencies
- One-Call API is the foundation. Without it, SDK/Frameworks/Hosted Output cannot score above 0.
- Build from bottom up: API first, then SDKs, then frameworks, then network effects.

## Cycle History
(appended each cycle)
```

---

## What Makes This Different From /performance-sprint

| Aspect | /performance-sprint | /infrastructure-blitz |
|--------|--------------------|-----------------------|
| **Focus** | Product polish | Distribution layer |
| **Pillars** | API/MCP, Airtable, Templates, Docs, Performance, UX | One-Call API, SDK, Agent Frameworks, Templates, Hosted Output, SEO |
| **Target user** | Someone using Glyph | Someone discovering Glyph |
| **Success metric** | "Is the product flawless?" | "Can any AI agent use Glyph in one call?" |
| **Foundation** | Existing session-based API | New stateless /v1/create endpoint |
| **Output** | Polished product | npm/PyPI packages, framework tools, hosted URLs |
| **Endgame** | Product so good alternatives feel like punishment | Product so distributed that alternatives are invisible |

These orchestrators are COMPLEMENTARY. Performance-sprint makes the engine great. Infrastructure-blitz puts the engine in every car.

---

## FORBIDDEN Items (Inject Into Every Agent Prompt)

These come from `/Users/eddiesanjuan/Projects/glyph/.claude/USER_DECISIONS.md`:

- **Confetti animation** -- NO. Not "subtle." Not "100 particles." Not "first-win only." NO CONFETTI. PERIOD.
- **Stripe styling button** -- NO. Too slow (45-60s). Not as demo. Not as option.
- **Dishonest time estimates** -- NO. If it takes 55s, say 55s.
- **Visual drag-and-drop editor** -- NO. We are not CraftMyPDF.
- **Design tools for designers** -- NO. Glyph is for developers and AI agents.

**VIOLATION = IMMEDIATE REVERT + CYCLE FAILURE.**

---

## Agent Fleet

| Agent | Deploy For |
|-------|------------|
| @auditor | Fresh-eyes pillar scoring, browser/API evidence gathering |
| @developer | API endpoints, SDK packages, integration code, template creation |
| @qa-agent | Browser verification, regression checks, API testing |

---

## BEGIN

**Arguments:** $ARGUMENTS

**Default (no flags):** Run one complete infrastructure blitz cycle.

**Get current time with:** `TZ='America/Chicago' date '+%Y-%m-%d %H:%M CST'`

**Remember:** This is not about polish. This is about distribution. The goal is not "make Glyph better" -- it is "make Glyph THE DEFAULT." One API call. One npm install. One tool definition. Every AI agent. Every developer. Everywhere.
