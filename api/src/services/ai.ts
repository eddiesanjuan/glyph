/**
 * AI Service - Claude Integration
 * Handles HTML modifications via natural language
 * Enhanced with schema-awareness and field injection detection
 */

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ModifyResult {
  html: string;
  changes: string[];
  tokensUsed: number;
}

/**
 * Available data fields that can be injected into templates
 * Maps common user terms to Mustache placeholder paths
 */
const FIELD_MAPPINGS: Record<string, string> = {
  // Client field aliases
  "phone": "client.phone",
  "phone number": "client.phone",
  "client phone": "client.phone",
  "email": "client.email",
  "client email": "client.email",
  "customer email": "client.email",
  "name": "client.name",
  "client name": "client.name",
  "customer name": "client.name",
  "address": "client.address",
  "client address": "client.address",
  "company": "client.company",
  "client company": "client.company",

  // Branding field aliases
  "logo": "branding.logoUrl",
  "company logo": "branding.logoUrl",
  "company name": "branding.companyName",
  "business name": "branding.companyName",
  "company address": "branding.companyAddress",
  "business address": "branding.companyAddress",

  // Quote info aliases
  "quote number": "meta.quoteNumber",
  "invoice number": "meta.quoteNumber",
  "date": "meta.date",
  "quote date": "meta.date",
  "valid until": "meta.validUntil",
  "expiry date": "meta.validUntil",
  "expiration": "meta.validUntil",
  "notes": "meta.notes",
  "terms": "meta.terms",
  "terms and conditions": "meta.terms",

  // Totals aliases
  "subtotal": "totals.subtotal",
  "discount": "totals.discount",
  "tax": "totals.tax",
  "tax rate": "totals.taxRate",
  "total": "totals.total",
  "grand total": "totals.total",
};

/**
 * Schema documentation for the AI to understand available fields
 */
const AVAILABLE_FIELDS_DOC = `
AVAILABLE DATA FIELDS (Mustache placeholders you can ADD to the document):

BRANDING:
- {{branding.companyName}} - Company/business name
- {{branding.logoUrl}} - URL to company logo (use in <img src="...">)
- {{branding.companyAddress}} - Company address (may include newlines)

CLIENT:
- {{client.name}} - Client/customer full name
- {{client.company}} - Client's company name
- {{client.email}} - Client email address
- {{client.phone}} - Client phone number
- {{client.address}} - Client address (may include newlines)

QUOTE METADATA:
- {{meta.quoteNumber}} - Unique quote/invoice identifier
- {{meta.date}} - Quote creation date
- {{meta.validUntil}} - Quote expiration date
- {{meta.notes}} - Additional notes
- {{meta.terms}} - Terms and conditions

TOTALS:
- {{totals.subtotal}} - Sum before adjustments
- {{totals.discount}} - Discount amount (if applicable)
- {{totals.tax}} - Tax amount
- {{totals.taxRate}} - Tax percentage (number)
- {{totals.total}} - Final total after all adjustments

LINE ITEMS (inside {{#lineItems}}...{{/lineItems}} loop):
- {{description}} - Item/service description
- {{details}} - Additional item details
- {{quantity}} - Item quantity
- {{unitPrice}} - Price per unit
- {{total}} - Line item total
`;

/**
 * Layout and styling best practices for the AI
 */
const LAYOUT_GUIDELINES = `
LAYOUT & STYLING GUIDELINES:

CSS VARIABLES (use these for consistency):
- var(--font-family) or system font stack for typography
- var(--accent-color) for brand colors (usually #1e3a5f)
- var(--spacing-sm), var(--spacing-md), var(--spacing-lg) for consistent spacing

LAYOUT BEST PRACTICES:
- The document uses CSS Grid and Flexbox for layout
- Maintain consistent spacing between sections
- Use proper heading hierarchy (h1 > h2 > h3)
- Tables should have clear borders and proper cell padding
- Keep totals right-aligned for financial documents

TYPOGRAPHY:
- Use relative units (rem, em) for font sizes
- Maintain readable line heights (1.4-1.6)
- Headers should be visually distinct from body text
- Use font-weight: 600 or 700 for emphasis

COLORS:
- Ensure sufficient contrast for readability
- Use the accent color sparingly for emphasis
- Keep body text in dark colors (#1f2937 or similar)
- Use subtle backgrounds (#f8fafc) for section differentiation
`;

/**
 * Region-specific guidance for targeted edits
 */
const REGION_GUIDELINES: Record<string, string> = {
  header: `
HEADER REGION GUIDANCE:
- Contains company branding (logo, name, address)
- Should be visually prominent but not overwhelming
- Logo should be appropriately sized (typically 100-150px wide)
- Company name can use larger font and accent color
- Contact info should be readable but secondary
`,
  "client-info": `
CLIENT INFO REGION GUIDANCE:
- Displays recipient/customer details
- Keep formatting consistent with header
- "Bill To" or similar label should be clear
- Client name is most important, followed by company
- Contact details (email, phone) are supplementary
`,
  "line-items": `
LINE ITEMS REGION GUIDANCE:
- Table format for products/services
- Clear column headers (Description, Qty, Price, Total)
- Alternating row colors improve readability
- Description column typically wider than numeric columns
- Numbers should be right-aligned
- Consider zebra striping for many rows
`,
  totals: `
TOTALS REGION GUIDANCE:
- Financial summary at bottom of document
- Right-aligned for traditional invoice/quote look
- Final total should be most prominent
- Use horizontal lines to separate subtotal, adjustments, total
- Consider a highlight background for the grand total
`,
  footer: `
FOOTER REGION GUIDANCE:
- Terms, conditions, payment instructions
- Smaller font size is acceptable
- Often includes legal disclaimers
- May include signature lines if showSignature is true
- Keep it unobtrusive but readable
`,
};

const SYSTEM_PROMPT = `You are an expert HTML/CSS developer modifying a PDF document template.

CRITICAL RULES:
1. NEVER change data values (prices, quantities, names, dates, etc.) - these use Mustache syntax like {{client.name}}
2. NEVER remove required sections (header, line-items, totals, footer)
3. Keep all data-glyph-region attributes intact
4. Output ONLY the complete modified HTML document, nothing else
5. Preserve all existing Mustache placeholders exactly as they appear
6. When asked to ADD a field, use the exact Mustache placeholder syntax from the available fields

You may:
- Change colors, backgrounds, borders
- Modify fonts, sizes, weights
- Adjust spacing, margins, padding
- Rearrange layout within sections
- Add visual elements (borders, shadows, gradients)
- Modify table styling
- Add or change CSS classes
- ADD new Mustache placeholders when the user requests a field to be added

${AVAILABLE_FIELDS_DOC}

${LAYOUT_GUIDELINES}`;

/**
 * Detect if the user is trying to add a field and enhance the prompt
 */
function detectAndEnhanceFieldRequest(userPrompt: string): string {
  const lowerPrompt = userPrompt.toLowerCase();

  // Check if user is asking to "add" something
  const addPatterns = [
    /add\s+(the\s+)?(\w+[\w\s]*)/i,
    /include\s+(the\s+)?(\w+[\w\s]*)/i,
    /insert\s+(the\s+)?(\w+[\w\s]*)/i,
    /put\s+(the\s+)?(\w+[\w\s]*)/i,
    /show\s+(the\s+)?(\w+[\w\s]*)/i,
  ];

  for (const pattern of addPatterns) {
    const match = lowerPrompt.match(pattern);
    if (match) {
      const fieldName = match[2].trim().toLowerCase();

      // Check if this maps to a known field
      for (const [alias, path] of Object.entries(FIELD_MAPPINGS)) {
        if (fieldName.includes(alias) || alias.includes(fieldName)) {
          // User is asking to add a known field - enhance the prompt
          return `${userPrompt}. Use the Mustache placeholder {{${path}}} for this field.`;
        }
      }
    }
  }

  // Check if user already included a Mustache placeholder
  if (userPrompt.includes("{{") && userPrompt.includes("}}")) {
    return userPrompt; // Already has placeholder, use as-is
  }

  return userPrompt;
}

/**
 * Get region-specific context for the AI
 */
function getRegionContext(region?: string): string {
  if (!region) return "";

  const guidance = REGION_GUIDELINES[region];
  if (guidance) {
    return `\n\nTARGETED REGION: "${region}"\n${guidance}`;
  }

  return `\n\nThe user selected the "${region}" region for editing.`;
}

export async function modifyTemplate(
  currentHtml: string,
  userPrompt: string,
  region?: string
): Promise<ModifyResult> {
  // Enhance the prompt if user is requesting a field addition
  const enhancedPrompt = detectAndEnhanceFieldRequest(userPrompt);

  // Build context with region-specific guidance
  const regionContext = getRegionContext(region);
  const contextPrompt = region
    ? `The user selected the "${region}" section and wants: ${enhancedPrompt}${regionContext}`
    : enhancedPrompt;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Current HTML document:

\`\`\`html
${currentHtml}
\`\`\`

Modification request: ${contextPrompt}

Output the complete modified HTML document. After the HTML, on a new line, write "CHANGES:" followed by a brief bullet list of what you changed.`,
      },
    ],
  });

  const responseText =
    message.content[0].type === "text" ? message.content[0].text : "";

  // Parse response - extract HTML and changes
  const htmlMatch = responseText.match(/```html\n([\s\S]*?)\n```/);
  let html = htmlMatch ? htmlMatch[1] : responseText;

  // If no code block, try to extract HTML directly
  if (!htmlMatch) {
    const docStart =
      responseText.indexOf("<!DOCTYPE html>") !== -1
        ? responseText.indexOf("<!DOCTYPE html>")
        : responseText.indexOf("<html");
    const docEnd = responseText.lastIndexOf("</html>") + 7;
    if (docStart !== -1 && docEnd > docStart) {
      html = responseText.slice(docStart, docEnd);
    }
  }

  // Extract changes list
  const changesMatch = responseText.match(/CHANGES:\s*([\s\S]*?)(?:$|```)/);
  const changes: string[] = [];
  if (changesMatch) {
    const changeLines = changesMatch[1].trim().split("\n");
    for (const line of changeLines) {
      const cleanLine = line.replace(/^[-*•]\s*/, "").trim();
      if (cleanLine) changes.push(cleanLine);
    }
  }

  return {
    html,
    changes: changes.length > 0 ? changes : ["Template modified as requested"],
    tokensUsed: message.usage.input_tokens + message.usage.output_tokens,
  };
}

// Validate that modification didn't break critical elements
export function validateModification(
  originalHtml: string,
  modifiedHtml: string
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  // Check all data-glyph-region attributes are preserved
  const originalRegions: string[] =
    originalHtml.match(/data-glyph-region="[^"]+"/g) || [];
  const modifiedRegions: string[] =
    modifiedHtml.match(/data-glyph-region="[^"]+"/g) || [];

  for (const region of originalRegions) {
    if (!modifiedRegions.includes(region)) {
      issues.push(`Missing region: ${region}`);
    }
  }

  // Check Mustache placeholders are preserved
  const originalPlaceholders = originalHtml.match(/\{\{[^}]+\}\}/g) || [];
  const modifiedPlaceholders = modifiedHtml.match(/\{\{[^}]+\}\}/g) || [];

  const originalSet = new Set(originalPlaceholders);
  const modifiedSet = new Set(modifiedPlaceholders);

  for (const placeholder of originalSet) {
    if (!modifiedSet.has(placeholder)) {
      // Allow removal of conditional blocks but not data placeholders
      if (!placeholder.startsWith("{{#") && !placeholder.startsWith("{{/")) {
        issues.push(`Missing placeholder: ${placeholder}`);
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

// Legacy function for backwards compatibility
export async function modifyHtml(request: {
  html: string;
  instruction: string;
  context?: unknown;
}): Promise<{ html: string; changes: string[] }> {
  const result = await modifyTemplate(request.html, request.instruction);
  return {
    html: result.html,
    changes: result.changes,
  };
}

export async function generateHtmlFromPrompt(prompt: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8192,
    system: `You are an expert HTML/CSS designer. Generate beautiful, professional HTML documents.
Use modern CSS with flexbox/grid. Include all styles inline or in a <style> block.
Return only the HTML document, no explanations.`,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const textContent = response.content.find((block) => block.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error("No text response from Claude");
  }

  return textContent.text;
}
