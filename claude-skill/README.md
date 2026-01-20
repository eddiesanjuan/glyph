# Glyph Claude Code Skill

This skill gives Claude Code instant knowledge of how to integrate Glyph PDF generation into any project.

## What is this?

Claude Code skills are markdown files that provide Claude with domain-specific knowledge. When you install this skill, Claude will automatically know how to:

- Install and configure the Glyph SDK
- Generate invoices, quotes, receipts, and other PDFs
- Integrate Glyph with Next.js, Express, Fastify, React, and Vue
- Use natural language to customize documents
- Handle errors and troubleshoot common issues

## Installation

### Option 1: Copy manually

```bash
mkdir -p ~/.claude/skills
cp glyph.md ~/.claude/skills/glyph.md
```

### Option 2: Download directly

```bash
mkdir -p ~/.claude/skills
curl -o ~/.claude/skills/glyph.md \
  https://raw.githubusercontent.com/eddiesanjuan/glyph/main/claude-skill/glyph.md
```

### Option 3: Project-local installation

For project-specific installation, place the skill in your project:

```bash
mkdir -p .claude/skills
curl -o .claude/skills/glyph.md \
  https://raw.githubusercontent.com/eddiesanjuan/glyph/main/claude-skill/glyph.md
```

## Usage

Once installed, Claude Code will automatically use this skill when you mention:

- PDF generation
- Invoice generation
- Quote generation
- Document generation
- Glyph

### Example Prompts

**Adding PDF generation to an existing project:**
```
Add PDF invoice generation to my Next.js app
```

**Creating a new endpoint:**
```
Create an API endpoint that generates receipts using Glyph
```

**Integrating the editor:**
```
Add an embeddable invoice editor to my React dashboard
```

**Customizing documents:**
```
Show me how to customize a Glyph invoice with natural language
```

## Verification

To verify the skill is installed correctly, ask Claude:

```
What templates does Glyph support?
```

Claude should respond with information about invoice, quote, receipt, contract, and resume templates.

## Updating

To get the latest version of the skill:

```bash
curl -o ~/.claude/skills/glyph.md \
  https://raw.githubusercontent.com/eddiesanjuan/glyph/main/claude-skill/glyph.md
```

## Related Resources

- [Glyph Documentation](https://docs.glyph.you)
- [Glyph Dashboard](https://glyph.you/dashboard)
- [SDK on npm](https://www.npmjs.com/package/@glyph-pdf/core)
- [Claude Code Skills Documentation](https://docs.anthropic.com/claude-code/skills)
