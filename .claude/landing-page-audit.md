# Glyph Landing Page Audit Report

**Date:** 2026-01-19
**Auditor:** Fresh-Eyes Review Agent
**URL:** http://localhost:8765 (local build of www/index.html)
**Scope:** Feature coverage, competitor analysis, UX recommendations

---

## Executive Summary

The Glyph landing page has a solid foundation with clean design, working playground demo, and clear value proposition. However, **it significantly undersells the new feature set**. The massive MCP Server, CLI, Universal Schema Detection, and Claude Code Skill capabilities are mentioned only briefly or not at all. The page reads like "PDF generation tool" when it should read like "AI-native document infrastructure that works with your IDE."

**Top 3 Priorities:**
1. Add a dedicated "AI IDE Integration" hero section with Claude Code/Cursor/Windsurf setup instructions
2. Create a "12 Document Types" showcase gallery with schema detection demo
3. Add social proof / "Built by developers" section (missing entirely)

---

## Current State Screenshots

Screenshots saved to: `/Users/eddiesanjuan/Personal_Assistant/Eddie_Personal_Assistant/.playwright-mcp/`

| Section | Screenshot | Notes |
|---------|------------|-------|
| Hero | `glyph-audit-01-hero.png` | Good headline, but undersells MCP/CLI |
| Workflows | `glyph-audit-02-workflows.png` | Shows 3 integration paths - good start |
| Playground | `glyph-audit-03-playground.png` | Working demo, impressive |
| Features | `glyph-audit-04-features.png` | Generic feature cards |
| Airtable | `glyph-audit-05-airtable.png` | Good section but niche use case |
| Frameworks | `glyph-audit-06-frameworks.png` | Basic code examples |
| Pricing/Footer | `glyph-audit-07-pricing.png` | Standard SaaS pricing |
| Full Page | `glyph-audit-fullpage.png` | Complete overview |

---

## Feature Coverage Matrix

### Features SHOWN on Landing Page

| Feature | Coverage Level | Location | Quality |
|---------|---------------|----------|---------|
| Natural Language PDF Editing | Excellent | Hero, Playground | Live demo works |
| MCP Server | Basic | Workflows section | Just shows `npx` command |
| CLI Tool | Basic | Workflows section | Just shows `npx` command |
| SDK/Web Component | Good | Workflows, Framework section | Code examples |
| Professional Templates | Mentioned | Features section | No gallery |
| Airtable Integration | Good | Dedicated section | Step-by-step flow |
| Real-time Preview | Good | Playground | Live demo |
| Framework Support | Good | Dedicated section | React/Vue/HTML tabs |
| Pricing | Good | Dedicated section | 4 tiers |

### Features MISSING from Landing Page (Critical Gaps)

| Feature | Importance | Status | Impact |
|---------|-----------|--------|--------|
| **Claude Code Skill** | Critical | NOT SHOWN | Killer feature for AI developers, completely hidden |
| **12 Document Types** | Critical | NOT SHOWN | Only shows Quote in demo, mentions 3 templates |
| **Universal Schema Detection** | Critical | NOT SHOWN | Auto-detect is major differentiator |
| **Interactive CLI Mode** | High | NOT SHOWN | `glyph interactive` is amazing, not mentioned |
| **Smart Autocomplete** | High | NOT SHOWN | Intent detection, fuzzy matching - invisible |
| **GitHub Stars/Social Proof** | High | NOT SHOWN | No trust indicators at all |
| **Testimonials/Use Cases** | High | NOT SHOWN | No social proof section |
| **"Getting Started" Guide** | Medium | Links to /docs | Should have embedded quickstart |
| **Video Demo** | Medium | NOT SHOWN | Would explain product faster |
| **Changelog/What's New** | Medium | Link in footer | Should highlight recent updates |
| **Template:Generate Command** | Medium | NOT SHOWN | AI-generated custom templates from JSON |
| **MCP Session Workflow** | Medium | NOT SHOWN | Preview -> Modify -> Generate flow |

---

## Competitor Analysis

### What Stripe Does Well (stripe.com)
- **Animated product visualization** - Interactive payment flow demo in hero
- **Social proof immediately visible** - "OpenAI, Amazon, Google, Anthropic" logos below fold
- **"5 sales reps available" chat widget** - Shows human support availability
- **Email capture in hero** - "Start now" with inline email field
- **Color gradient background** - Warm, inviting, premium feel
- **Specific metrics** - "Join the millions of companies..."

### What Vercel Does Well (vercel.com)
- **Hero shows the product** - Triangle logo surrounded by animated rays
- **Use case tabs** - AI Apps / Web Apps / Ecommerce / Marketing
- **Customer quotes with metrics** - "build times went from 7m to 40s"
- **"Top models" leaderboard** - Shows real-time usage data
- **Template gallery CTAs** - Next.js Templates, React Templates, etc.
- **Dark theme with light accents** - Similar to Glyph, done well

### What Supabase Does Well (supabase.com)
- **"Build in a weekend, Scale to millions"** - Perfect tagline
- **GitHub star count in nav** - Shows 96.4K stars as social proof
- **Company logos** - submagic, mozilla, GitHub, 1Password, PWC
- **Feature carousel** - Each feature gets its own visual section
- **Year in Review banner** - Shows momentum and activity

### What Glyph is Missing vs Competitors
1. **No social proof** - No logos, no testimonials, no GitHub stars
2. **No customer metrics** - "PDFs generated" counter would be powerful
3. **No video demo** - Complex product needs explanation
4. **Playground is buried** - Should be more prominent or in hero
5. **No "Getting Started in 30 seconds"** - Competitors show time-to-value
6. **No comparison to alternatives** - Why Glyph vs manual PDF libs?

---

## Specific Recommendations

### Priority 1: CRITICAL (Add This Week)

#### Finding: Missing "AI IDE Integration" Section

**Severity:** Critical
**Type:** Feature
**Effort:** Medium (2-4hr)

**Current State:**
The MCP Server and Claude Code Skill are Glyph's most differentiated features, but they're buried in a small card with just an `npx` command.

**Problem:**
AI coding tool users (Claude Code, Cursor, Windsurf) are the primary target audience. They'll see "PDF generation" and bounce. They need to see "works with your IDE in 30 seconds."

**Recommended Fix:**
Create a new section after the hero called "Works With Your AI IDE":

```html
<section id="ai-ide" class="ai-ide-section">
  <h2>Works With Your AI IDE</h2>
  <p>Claude Code, Cursor, or Windsurf. One config file. Infinite documents.</p>

  <div class="ide-tabs">
    <button data-ide="claude">Claude Code</button>
    <button data-ide="cursor">Cursor</button>
    <button data-ide="windsurf">Windsurf</button>
  </div>

  <div class="ide-content">
    <pre><code>{
  "mcpServers": {
    "glyph": {
      "command": "npx",
      "args": ["@glyph-pdf/mcp-server"],
      "env": { "GLYPH_API_KEY": "your-key" }
    }
  }
}</code></pre>
    <p>Then just ask: "Generate an invoice for $3,500 for John Doe"</p>
  </div>
</section>
```

**Acceptance Criteria:**
- [ ] Section shows setup for Claude Code, Cursor, and Windsurf
- [ ] Tabs switch between IDE-specific config examples
- [ ] Includes a "copy" button for the config
- [ ] Shows an example prompt and output

---

#### Finding: No Document Type Gallery

**Severity:** Critical
**Type:** Feature
**Effort:** Medium (2-4hr)

**Current State:**
The page says "All 3 templates" in free tier and mentions "12 doc types" in CLI tags, but there's no visual showcase.

**Problem:**
Users need to see the document types to understand value. "Invoice, Quote, Receipt, Contract, Resume, Report, Letter, Proposal, Work Order, Packing Slip, Statement, Certificate" is impressive but invisible.

**Recommended Fix:**
Add a "Document Types" gallery section:

```html
<section id="documents">
  <h2>12 Document Types, One API</h2>
  <p>Universal schema detection automatically chooses the right format</p>

  <div class="doc-gallery">
    <div class="doc-card" data-type="invoice">
      <img src="/previews/invoice.svg" alt="Invoice">
      <span>Invoice</span>
    </div>
    <div class="doc-card" data-type="quote">
      <img src="/previews/quote.svg" alt="Quote">
      <span>Quote</span>
    </div>
    <!-- ... all 12 types -->
  </div>

  <div class="schema-demo">
    <p>Just pass your data - we detect the type:</p>
    <code>glyph.generate({ template: "auto", data: yourData })</code>
  </div>
</section>
```

**Acceptance Criteria:**
- [ ] All 12 document types are shown with preview images
- [ ] Clicking a type shows example output
- [ ] "auto" template detection is highlighted
- [ ] Mobile responsive (grid collapses to 2-3 columns)

---

#### Finding: No Social Proof Section

**Severity:** Critical
**Type:** UX
**Effort:** Small (1-2hr)

**Current State:**
No testimonials, no customer logos, no GitHub stars, no usage metrics.

**Problem:**
"Built by Eddie San Juan" is nice but doesn't build trust. Developers want to see other developers using it.

**Recommended Fix:**
Add social proof elements:

1. **GitHub stars in nav** (if available):
```html
<a href="https://github.com/glyph-so/glyph" class="nav__github">
  <svg><!-- GitHub icon --></svg>
  <span>2.4k</span>
</a>
```

2. **"Trusted by" section** after hero (even if just showing the types of users):
```html
<section class="social-proof">
  <p>Trusted by developers at</p>
  <div class="logos"><!-- startups, agencies, freelancers --></div>
  <p class="metric">50,000+ PDFs generated</p>
</section>
```

3. **Testimonial cards** in features section (can be placeholder initially)

**Acceptance Criteria:**
- [ ] At least one form of social proof visible above the fold
- [ ] Usage metric shown (even if approximated)
- [ ] "Built by" in footer replaced or supplemented with community indicators

---

### Priority 2: HIGH (Add This Month)

#### Finding: Claude Code Skill Not Mentioned

**Severity:** High
**Type:** Feature
**Effort:** Small (1hr)

**Current State:**
`/Users/eddiesanjuan/Projects/glyph/claude-skill/` exists with comprehensive skill documentation, but it's not mentioned on the landing page.

**Problem:**
The Claude Code Skill is a zero-config way to give Claude instant PDF knowledge. This is incredibly valuable for Claude Code users and not marketed at all.

**Recommended Fix:**
Add a callout in the "AI IDE" section:

```html
<div class="skill-callout">
  <h4>Claude Code Users</h4>
  <p>Install the Glyph skill for instant PDF knowledge:</p>
  <code>curl -o ~/.claude/skills/glyph.md https://raw.githubusercontent.com/.../glyph.md</code>
  <p>Claude will automatically know how to generate invoices, quotes, and more.</p>
</div>
```

**Acceptance Criteria:**
- [ ] Skill installation command is shown
- [ ] Brief explanation of what skills are
- [ ] Link to full skill documentation

---

#### Finding: Interactive CLI Mode Not Showcased

**Severity:** High
**Type:** Feature
**Effort:** Medium (2hr)

**Current State:**
`glyph interactive` command provides a live preview + terminal REPL experience. This is not mentioned.

**Problem:**
The interactive mode is the best way to iterate on documents. It's a major differentiator from typical PDF libraries.

**Recommended Fix:**
Add a terminal animation/GIF showing the interactive workflow:

```
$ glyph interactive --data invoice.json
  Starting interactive session...
  Preview opened at http://localhost:3847

> add QR code for payment
  + Added QR code (preview updated)

> make the header more prominent
  + Header style updated (preview updated)

> save
  Saved to invoice-1705123456.pdf
```

**Acceptance Criteria:**
- [ ] Interactive mode is demonstrated (GIF or animation)
- [ ] Shows the natural language -> preview -> save flow
- [ ] Links to CLI documentation

---

#### Finding: Hero Subtitle Undersells the Product

**Severity:** High
**Type:** UX
**Effort:** Small (<1hr)

**Current State:**
`www/index.html` line ~267:
```html
<p class="hero__subtitle">Describe what you want in plain English. Glyph handles the rest. Works with Claude Code, Cursor, Windsurf, or any MCP-compatible tool.</p>
```

**Problem:**
"Describe what you want in plain English" is generic. The subtitle should communicate the unique value.

**Recommended Fix:**
```html
<p class="hero__subtitle">
  Generate invoices, quotes, contracts, and 9 more document types with natural language.
  Works with Claude Code, Cursor, Windsurf, or any MCP-compatible AI coding tool.
</p>
```

Or more punchy:
```html
<p class="hero__subtitle">
  "Create an invoice for John Doe, $3,500 for web development."
  That's it. AI handles the rest.
</p>
```

**Acceptance Criteria:**
- [ ] Subtitle mentions document types or specific use case
- [ ] Either shows an example prompt or lists key capabilities

---

#### Finding: Pricing "All 3 templates" is Outdated

**Severity:** High
**Type:** Content
**Effort:** Small (<30min)

**Current State:**
Free tier says "All 3 templates" but there are now 12 document types.

**Problem:**
Inconsistent messaging confuses users and undersells the product.

**Recommended Fix:**
Update pricing section to reflect actual template count:
- Free: "5 core templates" or "Invoice, Quote, Receipt"
- Pro: "All 12 document types"
- Scale: "All templates + custom"

**Acceptance Criteria:**
- [ ] Template count is accurate across the page
- [ ] Free tier clearly states what's included
- [ ] Pro/Scale tiers show upgrade value

---

### Priority 3: MEDIUM (Nice to Have)

#### Finding: No Video Demo

**Severity:** Medium
**Type:** UX
**Effort:** Large (4hr+)

**Current State:**
No video content. Complex product with multiple integration paths.

**Problem:**
A 60-second video showing the product in action would increase conversion significantly.

**Recommended Fix:**
Create a "See it in action" video showing:
1. Claude Code MCP setup (15s)
2. Natural language PDF generation (20s)
3. Customization with `glyph modify` (15s)
4. Final PDF download (10s)

**Acceptance Criteria:**
- [ ] Video under 90 seconds
- [ ] Shows real product (not mockups)
- [ ] Embedded in hero or features section

---

#### Finding: Mobile Navigation Hidden

**Severity:** Medium
**Type:** UX
**Effort:** Small (<1hr)

**Current State:**
Navigation links are hidden on mobile (no hamburger menu visible).

**Problem:**
Mobile users can't navigate to Docs, Pricing, or Features.

**Recommended Fix:**
Add hamburger menu for mobile viewports:

```css
@media (max-width: 768px) {
  .nav__links {
    display: none;
  }
  .nav__hamburger {
    display: block;
  }
}
```

**Acceptance Criteria:**
- [ ] Hamburger menu visible at 768px and below
- [ ] All nav links accessible from mobile menu
- [ ] Smooth open/close animation

---

#### Finding: "Read the Docs" Button Goes to /docs (404 on Vercel)

**Severity:** Medium
**Type:** Bug
**Effort:** Small (<30min)

**Current State:**
Hero button "Read the Docs" links to `/docs` which may 404 on Vercel deployment.

**Problem:**
Broken link damages credibility.

**Recommended Fix:**
Either:
1. Deploy docs site at `/docs` path
2. Change link to `https://docs.glyph.dev` or wherever docs are hosted
3. Add a `/docs` redirect in vercel.json

**Acceptance Criteria:**
- [ ] /docs link resolves to working documentation
- [ ] All navigation links verified working

---

## Positive Observations

1. **Clean, modern design** - Dark theme with teal accents is on-trend
2. **Working playground demo** - Live AI customization actually works
3. **Three integration paths clear** - MCP/CLI/SDK distinction is helpful
4. **Airtable section is unique** - Good differentiation from generic PDF tools
5. **Framework code examples** - HTML/React/Vue tabs are practical
6. **Pricing is transparent** - Clear tiers with feature lists
7. **Fast loading** - Single HTML file, no framework overhead

---

## Implementation Priority Summary

| Priority | Finding | Effort | Impact |
|----------|---------|--------|--------|
| 1 | AI IDE Integration Section | Medium | Very High |
| 1 | Document Type Gallery | Medium | Very High |
| 1 | Social Proof Section | Small | High |
| 2 | Claude Code Skill Callout | Small | High |
| 2 | Interactive CLI Demo | Medium | High |
| 2 | Hero Subtitle Rewrite | Small | Medium |
| 2 | Pricing Template Count Fix | Small | Medium |
| 3 | Video Demo | Large | Medium |
| 3 | Mobile Navigation | Small | Medium |
| 3 | Docs Link Fix | Small | Low |

---

## Appendix: Screenshots Reference

All screenshots saved to:
```
/Users/eddiesanjuan/Personal_Assistant/Eddie_Personal_Assistant/.playwright-mcp/
```

| File | Description |
|------|-------------|
| `glyph-audit-01-hero.png` | Hero section with headline and demo |
| `glyph-audit-02-workflows.png` | MCP/CLI/SDK integration options |
| `glyph-audit-03-playground.png` | Live playground with preview |
| `glyph-audit-04-features.png` | Feature cards grid |
| `glyph-audit-05-airtable.png` | Airtable integration section |
| `glyph-audit-06-frameworks.png` | Framework support with code |
| `glyph-audit-07-pricing.png` | Pricing tiers and footer |
| `glyph-audit-fullpage.png` | Full page screenshot |
| `competitor-stripe-hero.png` | Stripe.com hero for reference |
| `competitor-vercel-hero.png` | Vercel.com hero for reference |
| `competitor-supabase-hero.png` | Supabase.com hero for reference |

---

*Report generated by Auditor Agent - Fresh Eyes Review*
*For questions or clarifications, review the screenshots in the .playwright-mcp directory*
