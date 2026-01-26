/**
 * Layout Generator Service
 * AI-powered HTML generation for professional, accessible PDF documents
 *
 * Transforms data analysis into beautiful, print-ready HTML layouts
 * with style presets and natural language customization support.
 */

import Anthropic from "@anthropic-ai/sdk";
import { DataAnalysis, FieldInfo, FieldType, DocumentType } from "./dataAnalyzer.js";

// ============================================================================
// Types
// ============================================================================

export interface LayoutOptions {
  style: "stripe-clean" | "bold" | "minimal" | "corporate";
  pageSize: "A4" | "letter" | "legal";
  orientation: "portrait" | "landscape";
  userInstructions?: string; // Natural language customization
}

export interface GeneratedLayout {
  html: string;
  css: string;
  metadata: {
    generatedAt: string;
    style: string;
    documentType: string;
  };
}

interface StylePreset {
  fontFamily: string;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  borderRadius: string;
  tableStyle: "minimal-borders" | "strong-borders" | "no-borders" | "full-borders";
  fontWeight: {
    heading: string;
    body: string;
  };
  spacing: {
    section: string;
    element: string;
  };
}

// ============================================================================
// Style Presets
// ============================================================================

const STYLE_PRESETS: Record<LayoutOptions["style"], StylePreset> = {
  "stripe-clean": {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    primaryColor: "#0a2540",
    accentColor: "#635bff",
    backgroundColor: "#ffffff",
    borderRadius: "4px",
    tableStyle: "minimal-borders",
    fontWeight: {
      heading: "600",
      body: "400",
    },
    spacing: {
      section: "2rem",
      element: "1rem",
    },
  },
  bold: {
    fontFamily: '"Helvetica Neue", Arial, sans-serif',
    primaryColor: "#1a1a1a",
    accentColor: "#ff5500",
    backgroundColor: "#ffffff",
    borderRadius: "0",
    tableStyle: "strong-borders",
    fontWeight: {
      heading: "800",
      body: "400",
    },
    spacing: {
      section: "2.5rem",
      element: "1.25rem",
    },
  },
  minimal: {
    fontFamily: "Georgia, serif",
    primaryColor: "#333333",
    accentColor: "#333333",
    backgroundColor: "#ffffff",
    borderRadius: "0",
    tableStyle: "no-borders",
    fontWeight: {
      heading: "400",
      body: "400",
    },
    spacing: {
      section: "1.5rem",
      element: "0.75rem",
    },
  },
  corporate: {
    fontFamily: '"Times New Roman", Times, serif',
    primaryColor: "#003366",
    accentColor: "#003366",
    backgroundColor: "#ffffff",
    borderRadius: "2px",
    tableStyle: "full-borders",
    fontWeight: {
      heading: "700",
      body: "400",
    },
    spacing: {
      section: "1.75rem",
      element: "1rem",
    },
  },
};

// ============================================================================
// Page Size Configurations
// ============================================================================

const PAGE_SIZES: Record<LayoutOptions["pageSize"], { width: string; height: string }> = {
  A4: { width: "210mm", height: "297mm" },
  letter: { width: "8.5in", height: "11in" },
  legal: { width: "8.5in", height: "14in" },
};

// ============================================================================
// Value Formatters
// ============================================================================

/**
 * Format a value based on its field type
 */
export function formatValue(value: unknown, fieldType: FieldType): string {
  if (value === null || value === undefined) {
    return "";
  }

  switch (fieldType) {
    case "currency":
      return formatCurrency(value);
    case "date":
      return formatDate(value);
    case "phone":
      return formatPhone(value);
    case "email":
      return String(value);
    case "url":
      return String(value);
    case "number":
      return formatNumber(value);
    default:
      return String(value);
  }
}

/**
 * Format as currency: $X,XXX.XX
 */
function formatCurrency(value: unknown): string {
  const num = typeof value === "number" ? value : parseFloat(String(value));
  if (isNaN(num)) return String(value);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Format as date: "Jan 15, 2024"
 */
function formatDate(value: unknown): string {
  const strValue = String(value);

  // Try parsing various date formats
  let date: Date | null = null;

  // ISO format: 2024-01-15
  if (/^\d{4}-\d{2}-\d{2}/.test(strValue)) {
    date = new Date(strValue);
  }
  // US format: 01/15/2024 or 1/15/24
  else if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(strValue)) {
    const parts = strValue.split("/");
    const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
    date = new Date(`${year}-${parts[0].padStart(2, "0")}-${parts[1].padStart(2, "0")}`);
  }
  // Already formatted text
  else if (/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(strValue)) {
    return strValue; // Already in readable format
  }

  if (date && !isNaN(date.getTime())) {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  }

  return strValue;
}

/**
 * Format as phone: (XXX) XXX-XXXX
 */
function formatPhone(value: unknown): string {
  const strValue = String(value).replace(/\D/g, "");

  // Handle 10-digit US phone numbers
  if (strValue.length === 10) {
    return `(${strValue.slice(0, 3)}) ${strValue.slice(3, 6)}-${strValue.slice(6)}`;
  }

  // Handle 11-digit with country code
  if (strValue.length === 11 && strValue.startsWith("1")) {
    return `+1 (${strValue.slice(1, 4)}) ${strValue.slice(4, 7)}-${strValue.slice(7)}`;
  }

  // Return original if format doesn't match
  return String(value);
}

/**
 * Format as number with commas
 */
function formatNumber(value: unknown): string {
  const num = typeof value === "number" ? value : parseFloat(String(value));
  if (isNaN(num)) return String(value);

  return new Intl.NumberFormat("en-US").format(num);
}

// ============================================================================
// CSS Generation
// ============================================================================

/**
 * Generate CSS for the specified style and page configuration
 */
function generateCSS(style: StylePreset, pageSize: LayoutOptions["pageSize"], orientation: LayoutOptions["orientation"]): string {
  const page = PAGE_SIZES[pageSize];
  const width = orientation === "portrait" ? page.width : page.height;
  const height = orientation === "portrait" ? page.height : page.width;

  const tableStyles = {
    "minimal-borders": `
      border-collapse: collapse;

      th, td {
        border-bottom: 1px solid var(--border-color);
        padding: 0.75rem 1rem;
      }

      thead th {
        border-bottom: 2px solid var(--accent-color);
        background: transparent;
        color: var(--text-primary);
      }
    `,
    "strong-borders": `
      border-collapse: collapse;
      border: 2px solid var(--primary-color);

      th, td {
        border: 1px solid var(--primary-color);
        padding: 0.75rem 1rem;
      }

      thead th {
        background: var(--primary-color);
        color: white;
        font-weight: ${style.fontWeight.heading};
      }
    `,
    "no-borders": `
      border-collapse: collapse;

      th, td {
        border: none;
        padding: 0.5rem 0;
        text-align: left;
      }

      thead th {
        border-bottom: 1px solid var(--text-secondary);
        padding-bottom: 0.75rem;
        font-weight: normal;
        text-transform: uppercase;
        font-size: 0.75rem;
        letter-spacing: 0.1em;
        color: var(--text-secondary);
      }

      tbody tr {
        border-bottom: 1px solid var(--border-color);
      }
    `,
    "full-borders": `
      border-collapse: collapse;
      border: 1px solid var(--border-color);

      th, td {
        border: 1px solid var(--border-color);
        padding: 0.625rem 0.875rem;
      }

      thead th {
        background: var(--bg-light);
        font-weight: ${style.fontWeight.heading};
      }
    `,
  };

  return `
/* Reset & Base */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:root {
  --primary-color: ${style.primaryColor};
  --accent-color: ${style.accentColor};
  --background-color: ${style.backgroundColor};
  --text-primary: ${style.primaryColor};
  --text-secondary: #666666;
  --border-color: #e5e5e5;
  --bg-light: #f9fafb;
  --border-radius: ${style.borderRadius};
  --section-spacing: ${style.spacing.section};
  --element-spacing: ${style.spacing.element};
}

html {
  font-size: 14px;
  line-height: 1.6;
}

body {
  font-family: ${style.fontFamily};
  color: var(--text-primary);
  background: var(--background-color);
  font-weight: ${style.fontWeight.body};
}

/* Document Container */
.document {
  width: ${width};
  min-height: ${height};
  margin: 0 auto;
  padding: 0.75in;
  background: white;
}

/* Typography */
h1, h2, h3, h4, h5, h6 {
  font-weight: ${style.fontWeight.heading};
  color: var(--primary-color);
  margin-bottom: var(--element-spacing);
}

h1 { font-size: 1.75rem; }
h2 { font-size: 1.25rem; }
h3 { font-size: 1rem; text-transform: uppercase; letter-spacing: 0.05em; }

p {
  margin-bottom: var(--element-spacing);
}

/* Sections */
section, [data-glyph-region] {
  margin-bottom: var(--section-spacing);
}

/* Header */
.document-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding-bottom: var(--section-spacing);
  border-bottom: 2px solid var(--accent-color);
  margin-bottom: var(--section-spacing);
}

.document-header.centered {
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.document-header.logo-left {
  flex-direction: row;
}

.logo {
  max-height: 60px;
  max-width: 180px;
  object-fit: contain;
}

.company-info h1 {
  color: var(--accent-color);
  margin-bottom: 0.25rem;
}

.company-info p {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-bottom: 0;
  white-space: pre-line;
}

.document-title {
  font-size: 2rem;
  font-weight: ${style.fontWeight.heading};
  color: var(--accent-color);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Meta Information Grid */
.meta-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--element-spacing);
  background: var(--bg-light);
  padding: var(--element-spacing) calc(var(--element-spacing) * 1.5);
  border-radius: var(--border-radius);
  margin-bottom: var(--section-spacing);
}

.meta-item {
  text-align: center;
}

.meta-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  margin-bottom: 0.25rem;
}

.meta-value {
  font-size: 1rem;
  font-weight: 600;
}

/* Recipient Section */
.recipient-section h2 {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-secondary);
  margin-bottom: 0.75rem;
}

.recipient-name {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.recipient-detail {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-bottom: 0.125rem;
}

/* Tables */
table {
  width: 100%;
  margin-bottom: var(--section-spacing);
  ${tableStyles[style.tableStyle]}
}

th {
  text-align: left;
}

th.text-right, td.text-right {
  text-align: right;
}

th.text-center, td.text-center {
  text-align: center;
}

/* Totals */
.totals-section {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  margin-bottom: var(--section-spacing);
}

.totals-section.centered {
  align-items: center;
}

.totals-section.inline {
  flex-direction: row;
  justify-content: flex-end;
  gap: var(--section-spacing);
}

.totals-table {
  width: 280px;
}

.totals-row {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--border-color);
}

.totals-row.grand-total {
  border-top: 2px solid var(--accent-color);
  border-bottom: none;
  padding-top: 0.75rem;
  margin-top: 0.25rem;
  font-weight: ${style.fontWeight.heading};
  font-size: 1.125rem;
  color: var(--accent-color);
}

.totals-label {
  color: var(--text-secondary);
}

.discount-value {
  color: #059669;
}

/* Notes Section */
.notes-section {
  background: var(--bg-light);
  padding: var(--element-spacing) calc(var(--element-spacing) * 1.5);
  border-radius: var(--border-radius);
  margin-bottom: var(--section-spacing);
}

.notes-section h3 {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}

.notes-section p {
  font-size: 0.875rem;
  margin-bottom: 0;
  white-space: pre-wrap;
}

/* Footer */
.document-footer {
  margin-top: auto;
  padding-top: var(--element-spacing);
  border-top: 1px solid var(--border-color);
}

.terms-text {
  font-size: 0.75rem;
  color: var(--text-secondary);
  white-space: pre-wrap;
  line-height: 1.6;
}

/* Signature Section */
.signature-section {
  display: flex;
  justify-content: space-between;
  gap: var(--section-spacing);
  margin-top: var(--section-spacing);
}

.signature-block {
  flex: 1;
}

.signature-line {
  border-top: 1px solid var(--text-primary);
  margin-top: 3rem;
  padding-top: 0.5rem;
}

.signature-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

/* Lists */
.item-list {
  list-style: none;
  padding: 0;
}

.item-list li {
  padding: var(--element-spacing) 0;
  border-bottom: 1px solid var(--border-color);
}

.item-list li:last-child {
  border-bottom: none;
}

/* Cards Layout */
.cards-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: var(--element-spacing);
}

.card {
  background: var(--bg-light);
  padding: var(--element-spacing);
  border-radius: var(--border-radius);
  border: 1px solid var(--border-color);
}

/* Utility Classes */
.text-muted {
  color: var(--text-secondary);
}

.text-accent {
  color: var(--accent-color);
}

.font-weight-bold {
  font-weight: ${style.fontWeight.heading};
}

.mb-0 { margin-bottom: 0; }
.mb-1 { margin-bottom: 0.25rem; }
.mb-2 { margin-bottom: 0.5rem; }
.mb-3 { margin-bottom: 1rem; }

/* Print Styles */
@media print {
  body {
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }

  .document {
    padding: 0;
    max-width: none;
    min-height: auto;
  }

  thead th {
    background: var(--accent-color) !important;
    color: white !important;
  }

  .no-print {
    display: none !important;
  }
}

@page {
  size: ${orientation === "portrait" ? `${page.width} ${page.height}` : `${page.height} ${page.width}`};
  margin: 0.5in;
}

/* Accessibility */
@media (prefers-reduced-motion: reduce) {
  * {
    animation: none !important;
    transition: none !important;
  }
}

/* High Contrast Mode Support */
@media (prefers-contrast: high) {
  :root {
    --border-color: #000000;
    --text-secondary: #000000;
  }
}
`.trim();
}

// ============================================================================
// AI HTML Generation
// ============================================================================

let anthropic: Anthropic | null = null;

function getAnthropic(): Anthropic {
  if (!anthropic) {
    anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return anthropic;
}

/**
 * Generate a human-readable description of the style preset
 */
function describeStylePreset(style: LayoutOptions["style"]): string {
  const descriptions: Record<LayoutOptions["style"], string> = {
    "stripe-clean":
      "Clean, modern design inspired by Stripe. Uses system fonts, subtle purple accent color, minimal borders on tables, rounded corners. Professional and trustworthy aesthetic.",
    bold:
      "Bold, impactful design with strong visual hierarchy. Uses Helvetica, orange accent color, thick black borders, no rounded corners. High-contrast and attention-grabbing.",
    minimal:
      "Elegant, understated design focusing on typography. Uses Georgia serif font, monochromatic palette, no borders on tables, generous whitespace. Sophisticated and timeless.",
    corporate:
      "Traditional business document style. Uses Times New Roman, navy blue accent, full borders on tables, conservative spacing. Formal and established.",
  };
  return descriptions[style];
}

/**
 * Prepare data with formatted values for the AI prompt
 */
function prepareFormattedData(data: Record<string, unknown>, analysis: DataAnalysis): string {
  const allFields = [
    ...analysis.fields.header,
    ...analysis.fields.recipient,
    ...analysis.fields.lineItems,
    ...analysis.fields.summary,
    ...analysis.fields.metadata,
    ...analysis.fields.footer,
  ];

  const formatField = (field: FieldInfo, value: unknown): string => {
    const formatted = formatValue(value, field.type);
    return `  ${field.name}: ${formatted}`;
  };

  // Build a description of the data
  const sections: string[] = [];

  // Header fields
  if (analysis.fields.header.length > 0) {
    const headerData = analysis.fields.header
      .map((f) => {
        const value = getNestedValue(data, f.path);
        return formatField(f, value);
      })
      .join("\n");
    sections.push(`HEADER:\n${headerData}`);
  }

  // Recipient fields
  if (analysis.fields.recipient.length > 0) {
    const recipientData = analysis.fields.recipient
      .map((f) => {
        const value = getNestedValue(data, f.path);
        return formatField(f, value);
      })
      .join("\n");
    sections.push(`RECIPIENT:\n${recipientData}`);
  }

  // Metadata fields
  if (analysis.fields.metadata.length > 0) {
    const metaData = analysis.fields.metadata
      .map((f) => {
        const value = getNestedValue(data, f.path);
        return formatField(f, value);
      })
      .join("\n");
    sections.push(`DOCUMENT INFO:\n${metaData}`);
  }

  // Line items (special handling for arrays)
  const lineItemArrayField = analysis.fields.lineItems.find((f) => f.type === "array");
  if (lineItemArrayField) {
    const items = getNestedValue(data, lineItemArrayField.path) as unknown[];
    if (Array.isArray(items) && items.length > 0) {
      const itemFields = analysis.fields.lineItems.filter((f) => f.path.includes("[]"));
      const itemsData = items
        .map((item, i) => {
          if (typeof item !== "object" || item === null) return `  Item ${i + 1}: ${item}`;
          const itemObj = item as Record<string, unknown>;
          const fields = Object.entries(itemObj)
            .map(([k, v]) => {
              const fieldInfo = itemFields.find((f) => f.path.endsWith(k));
              const fieldType = fieldInfo?.type || "string";
              return `${k}: ${formatValue(v, fieldType)}`;
            })
            .join(", ");
          return `  Item ${i + 1}: { ${fields} }`;
        })
        .join("\n");
      sections.push(`LINE ITEMS:\n${itemsData}`);
    }
  }

  // Summary fields
  if (analysis.fields.summary.length > 0) {
    const summaryData = analysis.fields.summary
      .map((f) => {
        const value = getNestedValue(data, f.path);
        return formatField(f, value);
      })
      .join("\n");
    sections.push(`SUMMARY/TOTALS:\n${summaryData}`);
  }

  // Footer fields
  if (analysis.fields.footer.length > 0) {
    const footerData = analysis.fields.footer
      .map((f) => {
        const value = getNestedValue(data, f.path);
        return formatField(f, value);
      })
      .join("\n");
    sections.push(`FOOTER:\n${footerData}`);
  }

  return sections.join("\n\n");
}

/**
 * Get a nested value from an object using dot notation
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  // Handle array notation like "items[].name"
  const cleanPath = path.replace(/\[\]/g, "");
  const parts = cleanPath.split(".");

  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Generate HTML using Claude AI
 */
async function generateHTMLWithAI(
  data: Record<string, unknown>,
  analysis: DataAnalysis,
  options: LayoutOptions,
  stylePreset: StylePreset
): Promise<string> {
  const formattedData = prepareFormattedData(data, analysis);
  const styleDescription = describeStylePreset(options.style);

  const prompt = `Generate semantic, accessible HTML for a ${analysis.documentType.toUpperCase()} document.

DATA TO DISPLAY:
${formattedData}

LAYOUT DECISIONS (from analysis):
- Header style: ${analysis.layout.headerStyle}
- Content style: ${analysis.layout.contentStyle}
- Summary style: ${analysis.layout.summaryStyle}
- Has logo: ${analysis.layout.hasLogo}
- Has signature: ${analysis.layout.hasSignature}

STYLE PRESET: ${options.style}
${styleDescription}

PAGE SETUP:
- Size: ${options.pageSize}
- Orientation: ${options.orientation}

${options.userInstructions ? `USER INSTRUCTIONS:\n${options.userInstructions}\n` : ""}

REQUIREMENTS:
1. Output ONLY the HTML body content (no DOCTYPE, html, head, or body tags)
2. Wrap everything in a <div class="document"> container
3. Use semantic HTML5 elements (header, main, section, footer, article)
4. Add data-glyph-region attributes to major sections for editability
5. Use the CSS classes defined in the stylesheet (document-header, meta-grid, totals-section, etc.)
6. Ensure all text content is properly escaped
7. Add appropriate ARIA labels for accessibility
8. Use proper heading hierarchy (h1 > h2 > h3)
9. Format all values appropriately (currency with $, dates readable)
10. Include alt text for any images

CSS CLASSES AVAILABLE:
- Layout: document, document-header, document-header.centered, document-header.logo-left
- Typography: document-title, meta-label, meta-value, recipient-name, recipient-detail
- Components: meta-grid, meta-item, totals-section, totals-table, totals-row, totals-row.grand-total
- Content: notes-section, signature-section, signature-block, signature-line
- Tables: Use standard table elements with .text-right, .text-center for alignment
- Lists: item-list for list layout, cards-container and card for card layout
- Utilities: text-muted, text-accent, font-weight-bold, mb-0 through mb-3

Generate clean, professional HTML that matches the ${options.style} aesthetic.`;

  try {
    const message = await getAnthropic().messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: `You are an expert HTML generator for professional business documents. You create semantic, accessible, print-ready HTML that follows best practices. Always output clean HTML without markdown code blocks or explanations - just the raw HTML.`,
      messages: [{ role: "user", content: prompt }],
    });

    const responseText = message.content[0].type === "text" ? message.content[0].text : "";

    // Clean up the response - remove any markdown code blocks if present
    let html = responseText.trim();
    if (html.startsWith("```html")) {
      html = html.slice(7);
    }
    if (html.startsWith("```")) {
      html = html.slice(3);
    }
    if (html.endsWith("```")) {
      html = html.slice(0, -3);
    }

    return html.trim();
  } catch (error) {
    console.error("[LayoutGenerator] AI generation failed:", error);
    // Fall back to template-based generation
    return generateFallbackHTML(data, analysis, options);
  }
}

/**
 * Generate fallback HTML without AI (template-based)
 */
function generateFallbackHTML(
  data: Record<string, unknown>,
  analysis: DataAnalysis,
  options: LayoutOptions
): string {
  const docType = analysis.documentType.charAt(0).toUpperCase() + analysis.documentType.slice(1);

  // Extract some basic values
  const companyName = getNestedValue(data, "company.name") || getNestedValue(data, "branding.companyName") || "Company";
  const documentNumber =
    getNestedValue(data, "invoiceNumber") ||
    getNestedValue(data, "quoteNumber") ||
    getNestedValue(data, "meta.quoteNumber") ||
    getNestedValue(data, "number") ||
    "";

  return `
<div class="document">
  <header class="document-header ${analysis.layout.headerStyle}" data-glyph-region="header" aria-label="Document header">
    <div class="company-info">
      <h1>${escapeHTML(String(companyName))}</h1>
    </div>
    <div class="header-right">
      <span class="document-title">${escapeHTML(docType)}</span>
    </div>
  </header>

  <main role="main">
    ${documentNumber ? `
    <section class="meta-grid" data-glyph-region="meta" aria-label="Document information">
      <div class="meta-item">
        <div class="meta-label">${docType} Number</div>
        <div class="meta-value">${escapeHTML(String(documentNumber))}</div>
      </div>
    </section>
    ` : ""}

    <section data-glyph-region="content" aria-label="Document content">
      <p class="text-muted">Document content will be generated based on your data.</p>
    </section>
  </main>

  <footer class="document-footer" data-glyph-region="footer" aria-label="Document footer">
    <p class="terms-text text-muted">Generated with Glyph</p>
  </footer>
</div>
`.trim();
}

/**
 * Escape HTML special characters
 */
function escapeHTML(str: string): string {
  const escapeMap: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return str.replace(/[&<>"']/g, (char) => escapeMap[char]);
}

// ============================================================================
// Main Export
// ============================================================================

/**
 * Generate a complete HTML layout from data and analysis
 *
 * @param data - The raw data object to render
 * @param analysis - The data analysis from analyzeData()
 * @param options - Layout options including style, page size, and orientation
 * @returns Generated HTML, CSS, and metadata
 */
export async function generateLayout(
  data: Record<string, unknown>,
  analysis: DataAnalysis,
  options: LayoutOptions
): Promise<GeneratedLayout> {
  // Get style preset
  const stylePreset = STYLE_PRESETS[options.style];

  // Generate CSS
  const css = generateCSS(stylePreset, options.pageSize, options.orientation);

  // Generate HTML
  const html = await generateHTMLWithAI(data, analysis, options, stylePreset);

  return {
    html,
    css,
    metadata: {
      generatedAt: new Date().toISOString(),
      style: options.style,
      documentType: analysis.documentType,
    },
  };
}

/**
 * Generate a complete HTML document (with DOCTYPE, head, styles)
 */
export async function generateFullDocument(
  data: Record<string, unknown>,
  analysis: DataAnalysis,
  options: LayoutOptions
): Promise<string> {
  const { html, css, metadata } = await generateLayout(data, analysis, options);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="generator" content="Glyph Layout Generator">
  <meta name="generated-at" content="${metadata.generatedAt}">
  <title>${metadata.documentType.charAt(0).toUpperCase() + metadata.documentType.slice(1)} Document</title>
  <style>
${css}
  </style>
</head>
<body>
${html}
</body>
</html>`;
}

/**
 * Get available style presets
 */
export function getStylePresets(): Record<LayoutOptions["style"], StylePreset> {
  return { ...STYLE_PRESETS };
}

/**
 * Get available page sizes
 */
export function getPageSizes(): Record<LayoutOptions["pageSize"], { width: string; height: string }> {
  return { ...PAGE_SIZES };
}

export default {
  generateLayout,
  generateFullDocument,
  formatValue,
  getStylePresets,
  getPageSizes,
};
