# Glyph Landing Page Design Brief

**Date:** January 19, 2026
**Based on:** Analysis of 8 premium developer tool landing pages
**Goal:** Transform Glyph from "generic AI app" to premium developer SDK

---

## Executive Summary

The current Glyph landing page suffers from the "AI Purple Problem" - an over-reliance on purple gradients, cramped typography, and design patterns that signal "AI-generated" rather than "premium developer tool." This brief provides specific, actionable design recommendations based on analysis of Stripe, Vercel, Supabase, Clerk, Resend, Linear, Raycast, and PlanetScale.

---

## 1. Color Palette (NO PURPLE)

### Primary Recommendation: "Midnight Engineering" (Dark Theme)

Based on Linear and Resend's approach - professional, high-contrast dark themes that developers prefer.

```css
:root {
  /* Backgrounds - Near-black with slight warmth */
  --bg-primary: #0A0A0B;      /* Main background (Linear-inspired) */
  --bg-secondary: #111113;    /* Elevated surfaces */
  --bg-tertiary: #18181B;     /* Cards, inputs */
  --bg-elevated: #1F1F23;     /* Popovers, modals */
  --bg-hover: #27272A;        /* Hover states */

  /* Accent - Electric Teal (NOT purple) */
  --accent-primary: #14B8A6;  /* Teal-500 - Primary accent */
  --accent-light: #2DD4BF;    /* Teal-400 - Hover/active */
  --accent-dark: #0D9488;     /* Teal-600 - Pressed states */
  --accent-glow: rgba(20, 184, 166, 0.15);  /* Glow effects */
  --accent-subtle: rgba(20, 184, 166, 0.08); /* Backgrounds */

  /* Alternative Accent - Warm Amber (for highlights) */
  --highlight: #F59E0B;       /* Amber-500 - Secondary accent */
  --highlight-glow: rgba(245, 158, 11, 0.15);

  /* Text - Zinc scale for warmth */
  --text-primary: #FAFAFA;    /* Zinc-50 - Headlines */
  --text-secondary: #A1A1AA;  /* Zinc-400 - Body text */
  --text-tertiary: #71717A;   /* Zinc-500 - Muted */
  --text-muted: #52525B;      /* Zinc-600 - Disabled */

  /* Borders */
  --border-subtle: #27272A;   /* Zinc-800 */
  --border-default: #3F3F46;  /* Zinc-700 */
  --border-accent: rgba(20, 184, 166, 0.3);

  /* Semantic */
  --success: #22C55E;         /* Green-500 */
  --warning: #F59E0B;         /* Amber-500 */
  --error: #EF4444;           /* Red-500 */
}
```

### Why This Palette Works

1. **Teal accent** differentiates from the sea of purple AI tools (Supabase uses this successfully)
2. **Near-black backgrounds** match developer environments and reduce eye strain
3. **High contrast** ensures accessibility (WCAG AA minimum)
4. **Warm grays** (Zinc) feel more premium than pure cool grays

### Alternative: "Clean Engineering" (Light Theme)

If a light theme is preferred (like Stripe), use:

```css
:root {
  /* Backgrounds */
  --bg-primary: #FFFFFF;
  --bg-secondary: #F9FAFB;    /* Gray-50 */
  --bg-tertiary: #F3F4F6;     /* Gray-100 */

  /* Primary Text */
  --text-primary: #0A2540;    /* Stripe's signature navy */
  --text-secondary: #475569;  /* Slate-600 */
  --text-tertiary: #94A3B8;   /* Slate-400 */

  /* Accent */
  --accent-primary: #0891B2;  /* Cyan-600 */
  --accent-light: #06B6D4;    /* Cyan-500 */
}
```

---

## 2. Typography Recommendations

### Font Stack

```css
:root {
  /* Primary - Geist or Inter */
  --font-sans: 'Geist', 'Inter', -apple-system, BlinkMacSystemFont,
               'Segoe UI', Roboto, sans-serif;

  /* Monospace - For code */
  --font-mono: 'Geist Mono', 'JetBrains Mono', 'Fira Code',
               'SF Mono', monospace;
}
```

**Recommended Primary Font:** Geist (Vercel's font) or Inter
**Why:** Clean, highly legible, designed for interfaces, free, excellent variable font support

**DO NOT USE:**
- Instrument Serif (current) - Too decorative for a developer tool
- Outfit (current) - Acceptable but not optimal for technical content

### Typography Scale (Fix "Cramped" Feeling)

```css
:root {
  /* Headlines - Generous tracking */
  --text-hero: clamp(48px, 6vw, 72px);
  --text-h1: 48px;
  --text-h2: 36px;
  --text-h3: 24px;
  --text-h4: 20px;

  /* Body */
  --text-lg: 18px;
  --text-base: 16px;
  --text-sm: 14px;
  --text-xs: 12px;

  /* Line Heights - MORE GENEROUS */
  --leading-tight: 1.1;       /* Headlines only */
  --leading-snug: 1.3;        /* Subheadings */
  --leading-normal: 1.6;      /* Body text */
  --leading-relaxed: 1.75;    /* Long-form content */

  /* Letter Spacing - CRITICAL FOR "CRAMPED" FIX */
  --tracking-tighter: -0.03em;  /* Large headlines only */
  --tracking-tight: -0.02em;    /* H1-H2 */
  --tracking-normal: 0;         /* Body text */
  --tracking-wide: 0.02em;      /* Buttons, labels */
  --tracking-wider: 0.05em;     /* All-caps labels */

  /* Font Weights */
  --font-normal: 400;
  --font-medium: 500;
  --font-semibold: 600;
  --font-bold: 700;
}
```

### Typography Rules

1. **Headlines:** Semi-bold (600), tight tracking (-0.02em), tight line-height (1.1-1.2)
2. **Body Text:** Normal weight (400), normal tracking, generous line-height (1.6+)
3. **Code/Technical:** Mono font, slightly smaller (0.9em), background highlight
4. **Labels/Buttons:** Medium weight (500), wide tracking (0.02em), all-caps for labels

### Example Implementation

```css
h1 {
  font-family: var(--font-sans);
  font-size: var(--text-h1);
  font-weight: var(--font-semibold);
  letter-spacing: var(--tracking-tight);
  line-height: var(--leading-tight);
}

p {
  font-family: var(--font-sans);
  font-size: var(--text-base);
  font-weight: var(--font-normal);
  letter-spacing: var(--tracking-normal);
  line-height: var(--leading-normal);
}

.label {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  letter-spacing: var(--tracking-wider);
  text-transform: uppercase;
  color: var(--text-tertiary);
}
```

---

## 3. Layout Patterns to Adopt

### Hero Section (Based on Linear + Stripe)

**Pattern: Centered headline with asymmetric demo**

```
[Nav with minimal links + single CTA]

[Generous top padding - 140px+]

     [Small badge: "Now available" with subtle animation]

     [Large headline - centered or left-aligned]
     [Subheadline - max-width: 640px, text-secondary]

     [Two CTAs: Primary "Get Started" + Secondary "Docs"]

[Demo/Code preview to the right or below]

[Trusted by logos - grayscale, subtle]
```

**Key Measurements:**
- Hero padding: 140px top, 80px bottom minimum
- Headline max-width: 800px
- Subheadline max-width: 640px
- CTAs: 16px gap, generous padding (16px 28px)

### Feature Sections (Based on Vercel + Supabase)

**Pattern: Tabbed Feature Blocks**

```
[Section headline - centered]

[Tab bar: Feature 1 | Feature 2 | Feature 3]

[Content area with code preview + description]
```

**Or: Chess Layout (alternating)**

```
[Image/Demo]  |  [Text]
--------------------------
[Text]        |  [Image/Demo]
```

### Code Presentation (Based on Stripe + Resend)

```css
.code-block {
  background: #0D0D0D;           /* Slightly darker than bg */
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  padding: 24px;
  font-family: var(--font-mono);
  font-size: 14px;
  line-height: 1.6;
  overflow-x: auto;
}

/* Syntax highlighting - subtle, not rainbow */
.token-keyword { color: #F472B6; }   /* Pink - reserved words */
.token-string { color: #34D399; }    /* Green - strings */
.token-function { color: #60A5FA; }  /* Blue - functions */
.token-comment { color: #6B7280; }   /* Gray - comments */
```

### Spacing System

```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
  --space-20: 80px;
  --space-24: 96px;
}
```

**Use generously.** Premium = breathing room.

---

## 4. Anti-Patterns to AVOID

### The "AI Purple Problem"

Current Glyph issues that scream "generic AI app":

1. **Purple everywhere** - The #7C3AED primary color is the exact Tailwind indigo default
2. **Gradient orbs** - The floating colored blur orbs are AI-generated aesthetic cliche
3. **Too many accent colors** - Purple + cyan + pink = visual chaos
4. **Decorative serif font** - Instrument Serif looks like a magazine, not a dev tool

### Design Cliches to Remove

| Anti-Pattern | Current Use | Replace With |
|--------------|-------------|--------------|
| Purple gradients | Primary buttons, headers | Single teal accent |
| Floating blur orbs | Background decoration | Subtle grid or nothing |
| Rainbow gradients | Text highlights | Single-color accent |
| Serif headlines | "Glyph" logo, hero | Clean sans-serif |
| Excessive glow | Buttons, cards | Subtle shadows only |
| Noise overlay | Background texture | Clean solid colors |
| Multiple accent colors | Purple + cyan + pink | One accent + one highlight |

### What Makes Sites Look "AI-Generated"

1. **Default Tailwind purple** - Instantly recognizable as v0/Cursor output
2. **Glassmorphism overuse** - Frosted glass on everything
3. **Too many gradients** - Every element has a gradient
4. **Cookie-cutter layouts** - Three-column icon grids
5. **Inter font everywhere** - Safe but generic (Geist is better)
6. **Excessive micro-animations** - Everything pulses and floats

### Premium Developer Tool Signals

1. **Restraint** - One accent color, generous whitespace
2. **Clarity** - Clear hierarchy, scannable content
3. **Technical credibility** - Real code examples, accurate syntax
4. **Functional animations** - Only animate what matters
5. **Dark mode done right** - Not just inverted colors

---

## 5. Specific Implementation Recommendations

### Immediate Changes (High Impact)

1. **Replace all purple (#7C3AED) with teal (#14B8A6)**
2. **Remove gradient background orbs entirely**
3. **Switch from Instrument Serif + Outfit to Geist or Inter**
4. **Increase line-height from 1.6 to 1.7 for body text**
5. **Add letter-spacing: -0.02em to headlines**

### Hero Section Rewrite

```html
<!-- BEFORE: Too busy -->
<div class="gradient-mesh">
  <div class="gradient-orb gradient-orb--1"></div>
  <div class="gradient-orb gradient-orb--2"></div>
  <div class="gradient-orb gradient-orb--3"></div>
</div>

<!-- AFTER: Clean -->
<section class="hero">
  <div class="container">
    <span class="badge">Ship PDF customization in minutes</span>
    <h1>Documents that <span class="accent">adapt</span></h1>
    <p>Let customers personalize PDFs with natural language. Two lines of code.</p>
    <div class="cta-group">
      <a href="/dashboard" class="btn btn-primary">Get API Key</a>
      <a href="/docs" class="btn btn-secondary">Documentation</a>
    </div>
  </div>
</section>
```

### Button Styles (Simplified)

```css
/* BEFORE: Over-designed */
.btn--primary {
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-bright) 100%);
  box-shadow: 0 4px 20px var(--color-primary-glow);
}

/* AFTER: Clean and confident */
.btn-primary {
  background: var(--accent-primary);
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 500;
  transition: background 0.15s ease;
}

.btn-primary:hover {
  background: var(--accent-light);
}
```

### Code Demo Component

```css
.code-demo {
  background: #0A0A0B;
  border: 1px solid var(--border-subtle);
  border-radius: 16px;
  overflow: hidden;
}

.code-demo-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-secondary);
}

.code-demo-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.code-demo-content {
  padding: 24px;
  font-family: var(--font-mono);
  font-size: 14px;
  line-height: 1.6;
}
```

---

## 6. Reference Links

### Sites Analyzed
- [Stripe](https://stripe.com) - Navy + light, professional hierarchy
- [Vercel](https://vercel.com) - Geist font, dark theme, high contrast
- [Supabase](https://supabase.com) - Teal accent, dark mode, clear
- [Linear](https://linear.app) - Inter font, minimalist dark, restraint
- [Resend](https://resend.com) - Black + cyan, bold typography
- [Clerk](https://clerk.com) - Component previews, clean layout
- [Raycast](https://raycast.com) - Dark + neon, glassmorphism done right
- [PlanetScale](https://planetscale.com) - Minimalist, performance-focused

### Research Sources
- [Evil Martians: 100 Dev Tool Landing Pages](https://evilmartians.com/chronicles/we-studied-100-devtool-landing-pages-here-is-what-actually-works-in-2025)
- [The AI Purple Problem](https://dev.to/jaainil/ai-purple-problem-make-your-ui-unmistakable-3ono)
- [Linear UI Redesign](https://linear.app/now/how-we-redesigned-the-linear-ui)
- [Stripe Accessible Color Systems](https://stripe.com/blog/accessible-color-systems)

---

## 7. Final Checklist Before Implementation

- [ ] All purple (#7C3AED) replaced with teal (#14B8A6)
- [ ] Gradient orbs removed from background
- [ ] Font changed to Geist or Inter
- [ ] Line-height increased to 1.6+ for body text
- [ ] Letter-spacing added to headlines (-0.02em)
- [ ] Only ONE accent color used throughout
- [ ] Code blocks use proper syntax highlighting
- [ ] Buttons simplified (no gradients)
- [ ] Generous whitespace between sections (64px+)
- [ ] Mobile responsive with proper typography scaling

---

**This design brief should be treated as the source of truth for the Glyph landing page redesign. Any deviation should be intentional and documented.**
