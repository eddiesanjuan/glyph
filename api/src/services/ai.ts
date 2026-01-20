/**
 * AI Service - Claude Integration
 * REVOLUTIONARY Document Intelligence System
 *
 * Capabilities:
 * - Full schema awareness with intelligent field injection
 * - Structural document manipulation (layout, grouping, sections)
 * - Advanced Mustache syntax understanding (conditionals, loops, sections)
 * - Intelligent calculation display patterns
 * - Context-aware modifications based on document semantics
 */

import Anthropic from "@anthropic-ai/sdk";
import { canFastTransform, fastTransform } from "./fastTransform.js";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ModifyResult {
  html: string;
  changes: string[];
  tokensUsed: number;
}

/**
 * Complete schema definition - the AI's knowledge of available data
 * Note: This is exported for potential programmatic use but primarily
 * serves as documentation that's used to generate the AI's schema guide.
 * Can be used by clients to understand available fields.
 */
export const TEMPLATE_SCHEMA = {
  meta: {
    description: "Quote/document metadata",
    fields: {
      quoteNumber: { type: "string", description: "Unique identifier (e.g., Q-2024-001)", mustache: "{{meta.quoteNumber}}" },
      date: { type: "string", description: "Creation date", mustache: "{{meta.date}}" },
      validUntil: { type: "string", description: "Expiration date", mustache: "{{meta.validUntil}}" },
      notes: { type: "string", description: "Additional notes (optional)", mustache: "{{meta.notes}}", conditional: true },
      terms: { type: "string", description: "Terms and conditions (optional)", mustache: "{{meta.terms}}", conditional: true },
      showSignature: { type: "boolean", description: "Show signature lines", mustache: "{{meta.showSignature}}", conditional: true },
    }
  },
  client: {
    description: "Client/recipient information",
    fields: {
      name: { type: "string", description: "Client full name", mustache: "{{client.name}}" },
      company: { type: "string", description: "Client's company (optional)", mustache: "{{client.company}}", conditional: true },
      email: { type: "string", description: "Client email", mustache: "{{client.email}}", conditional: true },
      phone: { type: "string", description: "Client phone number", mustache: "{{client.phone}}", conditional: true },
      address: { type: "string", description: "Client address (multiline)", mustache: "{{client.address}}", conditional: true },
    }
  },
  branding: {
    description: "Company branding/identity",
    fields: {
      companyName: { type: "string", description: "Your company name", mustache: "{{branding.companyName}}" },
      logoUrl: { type: "string", description: "URL to company logo", mustache: "{{branding.logoUrl}}", conditional: true },
      companyAddress: { type: "string", description: "Your company address (multiline)", mustache: "{{branding.companyAddress}}", conditional: true },
    }
  },
  lineItems: {
    description: "Array of products/services - use {{#lineItems}}...{{/lineItems}} to loop",
    isArray: true,
    fields: {
      description: { type: "string", description: "Item name/description", mustache: "{{description}}" },
      details: { type: "string", description: "Additional details (optional)", mustache: "{{details}}", conditional: true },
      quantity: { type: "number|string", description: "Quantity (e.g., 5, '10 hours')", mustache: "{{quantity}}" },
      unitPrice: { type: "number|string", description: "Price per unit", mustache: "{{unitPrice}}" },
      total: { type: "number|string", description: "Line total (qty * price)", mustache: "{{total}}" },
    }
  },
  totals: {
    description: "Financial totals and calculations",
    fields: {
      subtotal: { type: "number|string", description: "Sum before adjustments", mustache: "{{totals.subtotal}}" },
      discount: { type: "number|string", description: "Discount amount", mustache: "{{totals.discount}}", conditional: true },
      discountPercent: { type: "number", description: "Discount percentage", mustache: "{{totals.discountPercent}}", conditional: true },
      tax: { type: "number|string", description: "Tax amount", mustache: "{{totals.tax}}", conditional: true },
      taxRate: { type: "number", description: "Tax percentage (e.g., 8.25)", mustache: "{{totals.taxRate}}", conditional: true },
      total: { type: "number|string", description: "Final total", mustache: "{{totals.total}}" },
    }
  },
  styles: {
    description: "Visual customization (CSS variables)",
    fields: {
      accentColor: { type: "string", description: "Primary brand color", mustache: "{{styles.accentColor}}" },
      fontFamily: { type: "string", description: "Font override", mustache: "{{styles.fontFamily}}", conditional: true },
      fontSize: { type: "string", description: "Base font size", mustache: "{{styles.fontSize}}", conditional: true },
    }
  }
};

/**
 * Available data fields that can be injected into templates
 * Maps common user terms to Mustache placeholder paths
 */
const FIELD_MAPPINGS: Record<string, string> = {
  // Client field aliases
  "phone": "client.phone",
  "phone number": "client.phone",
  "client phone": "client.phone",
  "customer phone": "client.phone",
  "email": "client.email",
  "client email": "client.email",
  "customer email": "client.email",
  "name": "client.name",
  "client name": "client.name",
  "customer name": "client.name",
  "address": "client.address",
  "client address": "client.address",
  "customer address": "client.address",
  "company": "client.company",
  "client company": "client.company",
  "customer company": "client.company",

  // Branding field aliases
  "logo": "branding.logoUrl",
  "company logo": "branding.logoUrl",
  "my logo": "branding.logoUrl",
  "company name": "branding.companyName",
  "business name": "branding.companyName",
  "my company name": "branding.companyName",
  "company address": "branding.companyAddress",
  "business address": "branding.companyAddress",
  "my address": "branding.companyAddress",

  // Quote info aliases
  "quote number": "meta.quoteNumber",
  "invoice number": "meta.quoteNumber",
  "reference number": "meta.quoteNumber",
  "po number": "meta.poNumber",
  "purchase order": "meta.poNumber",
  "date": "meta.date",
  "quote date": "meta.date",
  "invoice date": "meta.date",
  "valid until": "meta.validUntil",
  "expiry date": "meta.validUntil",
  "expiration": "meta.validUntil",
  "due date": "meta.validUntil",
  "notes": "meta.notes",
  "note": "meta.notes",
  "terms": "meta.terms",
  "terms and conditions": "meta.terms",
  "payment terms": "meta.terms",

  // Totals aliases
  "subtotal": "totals.subtotal",
  "sub total": "totals.subtotal",
  "discount": "totals.discount",
  "discount amount": "totals.discount",
  "discount percent": "totals.discountPercent",
  "discount percentage": "totals.discountPercent",
  "tax": "totals.tax",
  "tax amount": "totals.tax",
  "sales tax": "totals.tax",
  "vat": "totals.tax",
  "tax rate": "totals.taxRate",
  "tax percentage": "totals.taxRate",
  "total": "totals.total",
  "grand total": "totals.total",
  "final total": "totals.total",
  "amount due": "totals.total",

  // Line item aliases (for inside the loop)
  "item description": "description",
  "service name": "description",
  "product name": "description",
  "item details": "details",
  "item quantity": "quantity",
  "qty": "quantity",
  "unit price": "unitPrice",
  "price": "unitPrice",
  "rate": "unitPrice",
  "line total": "total",
  "item total": "total",
};

/**
 * Generate the comprehensive schema documentation for the AI
 */
function generateSchemaDocumentation(): string {
  return `
═══════════════════════════════════════════════════════════════════════════════
                     DOCUMENT SCHEMA - AVAILABLE DATA FIELDS
═══════════════════════════════════════════════════════════════════════════════

You have access to the following data fields. Use the exact Mustache syntax shown.

┌─────────────────────────────────────────────────────────────────────────────┐
│ BRANDING (Company Identity)                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ {{branding.companyName}}     → Company/business name (REQUIRED)             │
│ {{branding.logoUrl}}         → URL to logo image (optional)                 │
│ {{branding.companyAddress}}  → Company address, supports \\n for newlines   │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ CLIENT (Recipient Information)                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ {{client.name}}              → Client full name (REQUIRED)                  │
│ {{client.company}}           → Client's company name (optional)             │
│ {{client.email}}             → Client email address (optional)              │
│ {{client.phone}}             → Client phone number (optional)               │
│ {{client.address}}           → Client address, supports \\n for newlines    │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ QUOTE METADATA                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ {{meta.quoteNumber}}         → Unique identifier (e.g., Q-2024-001)         │
│ {{meta.date}}                → Quote creation date                          │
│ {{meta.validUntil}}          → Expiration date                              │
│ {{meta.notes}}               → Additional notes (optional)                  │
│ {{meta.terms}}               → Terms and conditions (optional)              │
│ {{meta.showSignature}}       → Boolean - whether to show signature lines    │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ FINANCIAL TOTALS                                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│ {{totals.subtotal}}          → Sum of line items before adjustments         │
│ {{totals.discount}}          → Discount amount (optional)                   │
│ {{totals.discountPercent}}   → Discount percentage for display (optional)   │
│ {{totals.tax}}               → Tax amount (optional)                        │
│ {{totals.taxRate}}           → Tax percentage number, e.g., 8.25 (optional) │
│ {{totals.total}}             → Final total after all adjustments            │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ LINE ITEMS (Array - use inside {{#lineItems}}...{{/lineItems}} loop)        │
├─────────────────────────────────────────────────────────────────────────────┤
│ {{description}}              → Item/service name                            │
│ {{details}}                  → Additional details (optional)                │
│ {{quantity}}                 → Quantity (number or string like "10 hours")  │
│ {{unitPrice}}                → Price per unit                               │
│ {{total}}                    → Line total (quantity × unitPrice)            │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ STYLE VARIABLES (CSS)                                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│ {{styles.accentColor}}       → Primary brand color (default: #1e3a5f)       │
│ var(--accent-color)          → Use in CSS after it's set in :root           │
│ var(--text-primary)          → Dark text color (#1a1a1a)                    │
│ var(--text-secondary)        → Muted text color (#666666)                   │
│ var(--border-color)          → Border color (#e5e5e5)                       │
│ var(--bg-light)              → Light background (#f9fafb)                   │
└─────────────────────────────────────────────────────────────────────────────┘
`;
}

/**
 * Comprehensive Mustache syntax guide
 */
const MUSTACHE_SYNTAX_GUIDE = `
═══════════════════════════════════════════════════════════════════════════════
                          MUSTACHE TEMPLATE SYNTAX GUIDE
═══════════════════════════════════════════════════════════════════════════════

BASIC OUTPUT:
  {{variable}}                    → Output the value, HTML-escaped
  {{{variable}}}                  → Output raw HTML (use sparingly)

SECTIONS (Conditionals & Loops):
  {{#section}}...{{/section}}     → Show content IF section is truthy/non-empty
  {{^section}}...{{/section}}     → Show content IF section is falsy/empty (inverted)

ARRAY ITERATION:
  {{#lineItems}}                  → Start loop over lineItems array
    <tr>
      <td>{{description}}</td>    → Access item properties directly
      <td>{{quantity}}</td>
      <td>{{total}}</td>
    </tr>
  {{/lineItems}}                  → End loop

CONDITIONAL DISPLAY:
  {{#totals.discount}}            → Only show if discount exists and is truthy
    <div class="discount">-\${{totals.discount}}</div>
  {{/totals.discount}}

  {{^totals.discount}}            → Show if discount does NOT exist (inverted)
    <div class="no-discount">No discount applied</div>
  {{/totals.discount}}

NESTED CONDITIONALS:
  {{#client.company}}             → Only if client has a company
    <p class="company">{{client.company}}</p>
  {{/client.company}}
  {{#client.email}}               → Only if client has email
    <p class="email">{{client.email}}</p>
  {{/client.email}}

BOOLEAN FLAGS:
  {{#meta.showSignature}}         → Only if showSignature is true
    <div class="signature-block">...</div>
  {{/meta.showSignature}}

═══════════════════════════════════════════════════════════════════════════════
                              PATTERN EXAMPLES
═══════════════════════════════════════════════════════════════════════════════

ADDING A NEW FIELD (e.g., "Add client phone"):
  <p class="client-phone">{{client.phone}}</p>

  With conditional wrapper (shows only if phone exists):
  {{#client.phone}}
  <p class="client-phone">{{client.phone}}</p>
  {{/client.phone}}

ADDING A TAX LINE TO TOTALS:
  {{#totals.tax}}
  <div class="totals-row tax">
    <span class="totals-label">Tax ({{totals.taxRate}}%)</span>
    <span class="totals-value">\${{totals.tax}}</span>
  </div>
  {{/totals.tax}}

ADDING A CUSTOM FIELD (e.g., PO Number):
  Note: If the field doesn't exist in the schema, use a logical path:
  {{#meta.poNumber}}
  <div class="meta-item">
    <div class="meta-label">PO Number</div>
    <div class="meta-value">{{meta.poNumber}}</div>
  </div>
  {{/meta.poNumber}}

⚠️  FORBIDDEN - DO NOT CREATE NEW LOOP STRUCTURES:
  NEVER create {{#categories}}, {{#items}}, {{#groups}} or any NEW section loops.
  These data structures DO NOT EXIST and will break the template.

  The ONLY array loop available is: {{#lineItems}}...{{/lineItems}}

  For visual grouping requests, use CSS styling on the existing structure:
  {{#lineItems}}
    <tr style="border-bottom: 2px solid #ccc;">
      <td>{{description}}</td>
      <td>{{quantity}}</td>
      <td>\${{unitPrice}}</td>
      <td>\${{total}}</td>
    </tr>
  {{/lineItems}}
`;

/**
 * Layout manipulation patterns
 */
const LAYOUT_PATTERNS = `
═══════════════════════════════════════════════════════════════════════════════
                          LAYOUT MANIPULATION PATTERNS
═══════════════════════════════════════════════════════════════════════════════

TWO-COLUMN HEADER LAYOUT:
  <header data-glyph-region="header" style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
    <div class="header-left">
      <!-- Logo and company info -->
    </div>
    <div class="header-right" style="text-align: right;">
      <!-- Quote title and meta -->
    </div>
  </header>

THREE-COLUMN META BAR:
  <section data-glyph-region="meta" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;">
    <div class="meta-item">...</div>
    <div class="meta-item">...</div>
    <div class="meta-item">...</div>
  </section>

SIDE-BY-SIDE CLIENT AND TOTALS:
  <div style="display: flex; justify-content: space-between; align-items: flex-start;">
    <section data-glyph-region="client-info" style="flex: 1;">
      <!-- Client info on left -->
    </section>
    <section data-glyph-region="totals" style="width: 300px;">
      <!-- Totals on right -->
    </section>
  </div>

MOVE TOTALS TO LEFT:
  <section data-glyph-region="totals" style="display: flex; flex-direction: column; align-items: flex-start;">
    <!-- Totals now left-aligned -->
  </section>

FULL-WIDTH LINE ITEMS WITH ZEBRA STRIPING:
  [data-glyph-region="line-items"] tbody tr:nth-child(even) {
    background-color: var(--bg-light);
  }

COMPACT SINGLE-PAGE LAYOUT:
  .quote-document {
    padding: 0.5in;
    font-size: 12px;
  }
  [data-glyph-region="line-items"] td {
    padding: 0.5rem;
  }

CENTERED DOCUMENT TITLE:
  .header-right {
    text-align: center;
    width: 100%;
  }

CARD-STYLE SECTIONS:
  [data-glyph-region="client-info"],
  [data-glyph-region="notes"] {
    background: var(--bg-light);
    border-radius: 8px;
    padding: 1.5rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }
`;

/**
 * Region-specific guidance for targeted edits
 */
const REGION_GUIDELINES: Record<string, string> = {
  header: `
HEADER REGION - data-glyph-region="header"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Contains: Company branding (logo, name, address) + document title
Layout: Typically flexbox with logo/info left, title right
Key elements:
  - .header-left: Logo and company info container
  - .logo: Company logo image
  - .company-info: Company name and address
  - .header-right: Document title area
  - .document-title: "Quote" or "Invoice" text

Common modifications:
  - "Make header two columns" → Use CSS grid
  - "Move logo to right" → Swap flex order or grid positions
  - "Add company phone" → Add {{branding.companyPhone}} if available
  - "Make title bigger" → Increase .document-title font-size
`,

  meta: `
META REGION - data-glyph-region="meta"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Contains: Quote number, date, valid until, and similar metadata
Layout: Grid with 3 equal columns by default
Key elements:
  - .meta-item: Individual metadata entry
  - .meta-label: Small uppercase label
  - .meta-value: The actual value

Common modifications:
  - "Add PO number" → Add new .meta-item with {{meta.poNumber}}
  - "Add project name" → Add new .meta-item with {{meta.projectName}}
  - "Make 4 columns" → Change grid-template-columns
  - "Stack vertically" → Change to flex-direction: column
`,

  "client-info": `
CLIENT INFO REGION - data-glyph-region="client-info"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Contains: Client/customer details (name, company, address, contact)
Layout: Stacked/vertical by default
Key elements:
  - h2: "Prepared For" or "Bill To" label
  - .client-name: Client's full name
  - .client-company: Client's company (conditional)
  - .client-address: Multi-line address (conditional)
  - .client-email: Email address (conditional)
  - .client-phone: Phone number (conditional)

Common modifications:
  - "Add phone number" → Add {{#client.phone}}<p class="client-phone">{{client.phone}}</p>{{/client.phone}}
  - "Add fax number" → Add similar pattern with {{client.fax}} if available
  - "Make two columns" → Split into grid with ship-to/bill-to
  - "Add contact person" → Add {{client.contactPerson}} field
`,

  "line-items": `
LINE ITEMS REGION - data-glyph-region="line-items"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Contains: Table of products/services being quoted
Structure: <table> with thead and tbody
Key elements:
  - thead: Column headers (Description, Qty, Unit Price, Total)
  - {{#lineItems}}...{{/lineItems}}: Loop over items
  - .item-description: Item name
  - .item-details: Optional additional info

Common modifications:
  - "Add SKU column" → Add <th>SKU</th> and <td>{{sku}}</td>
  - "Add category header" → Group items with {{#categories}} sections
  - "Add row numbers" → Use CSS counter or manual numbering
  - "Zebra striping" → Add tr:nth-child(even) background
  - "Hide unit price column" → Remove from thead and tbody
`,

  totals: `
TOTALS REGION - data-glyph-region="totals"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Contains: Financial summary (subtotal, tax, discount, total)
Layout: Flexbox aligned right by default
Key elements:
  - .totals-table: Container for totals rows
  - .totals-row: Individual line (subtotal, discount, tax, total)
  - .totals-row.subtotal: Sum before adjustments
  - .totals-row.discount: Discount line (conditional)
  - .totals-row.tax: Tax line (conditional)
  - .totals-row.total: Final total (prominent styling)

Common modifications:
  - "Add 15% tax" → Add conditional tax row with {{totals.taxRate}}%
  - "Add shipping" → Add .totals-row for {{totals.shipping}}
  - "Add deposit/balance" → Add rows for {{totals.deposit}} and {{totals.balance}}
  - "Move to left" → Change align-items to flex-start
  - "Make total more prominent" → Increase font-size, add background
`,

  notes: `
NOTES REGION - data-glyph-region="notes"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Contains: Additional notes or comments
Layout: Card-style with background
Key elements:
  - h3: "Notes" heading
  - p: Note content from {{meta.notes}}

Common modifications:
  - "Add special instructions section" → Create new section
  - "Add delivery notes" → Add {{meta.deliveryNotes}} field
  - "Make notes collapsible" → Not recommended for PDF
`,

  footer: `
FOOTER REGION - data-glyph-region="footer"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Contains: Terms, conditions, signature lines
Layout: Stacked with optional signature blocks
Key elements:
  - .terms: Terms and conditions text
  - .footer-signature: Signature line container (conditional)
  - .signature-block: Individual signature area
  - .signature-line: The line for signing

Common modifications:
  - "Add payment instructions" → Add {{meta.paymentInstructions}}
  - "Add bank details" → Add banking information section
  - "Add QR code placeholder" → Add image placeholder
  - "Remove signature lines" → Remove {{#meta.showSignature}} block
`,
};

/**
 * The revolutionary system prompt that makes the AI a true document architect
 */
const DOCUMENT_ARCHITECT_PROMPT = `You are GLYPH DOCUMENT ARCHITECT - an expert system for intelligent document modification.

You don't just change colors - you understand document STRUCTURE, DATA FLOW, and SEMANTIC MEANING.

═══════════════════════════════════════════════════════════════════════════════
                              CORE UNDERSTANDING
═══════════════════════════════════════════════════════════════════════════════

1. TEMPLATE NATURE: The document uses Mustache templating. Placeholders like
   {{client.name}} will be replaced with real data. You modify the TEMPLATE,
   not the final output.

2. DATA SCHEMA: You have full knowledge of available data fields (listed below).
   When users ask to "add phone number", you know to use {{client.phone}}.

3. STRUCTURAL AWARENESS: Documents have semantic regions (header, client-info,
   line-items, totals, footer). Each region has a purpose and typical layout.

4. CONDITIONAL LOGIC: Use {{#field}}...{{/field}} to show content only when
   data exists. Use {{^field}}...{{/field}} for fallbacks.

═══════════════════════════════════════════════════════════════════════════════
                              ABSOLUTE RULES
═══════════════════════════════════════════════════════════════════════════════

1. PRESERVE ALL EXISTING MUSTACHE SYNTAX - Never modify, remove, or break any
   {{...}} placeholders that already exist in the document.

2. PRESERVE ALL data-glyph-region ATTRIBUTES - These define editable regions.

3. PRESERVE DOCUMENT STRUCTURE - Don't remove required sections.

4. OUTPUT COMPLETE HTML - Always return the full <!DOCTYPE html> document.

5. USE EXACT MUSTACHE SYNTAX - When adding fields, use the exact placeholder
   syntax from the schema (e.g., {{client.phone}}, not {{phone}}).

═══════════════════════════════════════════════════════════════════════════════
                    CRITICAL: TEMPLATE BINDING PROTECTION
═══════════════════════════════════════════════════════════════════════════════

**YOU MUST NEVER CREATE NEW MUSTACHE LOOP STRUCTURES**

The document template has specific data bindings that CANNOT be changed:
- {{#lineItems}}...{{/lineItems}} iterates over the lineItems array
- There is NO "categories" array, NO "items" array, NO "groups" array
- Creating {{#categories}}, {{#items}}, {{#groups}} etc. WILL BREAK THE TEMPLATE

**WHEN USERS ASK FOR STRUCTURAL DATA CHANGES:**

If the user asks to "group items by category", "sort line items", "organize by type",
or any request that would require changing the DATA STRUCTURE:

1. DO NOT create new Mustache loop structures ({{#newThing}}...{{/newThing}})
2. DO NOT remove or modify the {{#lineItems}}...{{/lineItems}} loop
3. INSTEAD: Apply VISUAL grouping using CSS (borders, spacing, backgrounds)
4. OR: Politely explain that data restructuring requires backend changes

**SAFE ALTERNATIVES FOR STRUCTURAL REQUESTS:**
- "Group by category" → Add visual separators, use alternating backgrounds
- "Sort line items" → Cannot be done in template (data comes pre-sorted)
- "Add category headers" → Add a visual styling to the description field
- "Organize by type" → Use CSS to visually distinguish different items

**EXAMPLE - WHAT NOT TO DO:**
User asks: "Group the line items by description"
WRONG (will break template):
  {{#categories}}
    <tr class="category-header"><td>{{categoryName}}</td></tr>
    {{#items}}
      <tr><td>{{description}}</td></tr>
    {{/items}}
  {{/categories}}

CORRECT (visual enhancement only):
  {{#lineItems}}
    <tr style="...styling..."><td>{{description}}</td>...</tr>
  {{/lineItems}}
  (Keep the EXACT same loop structure, only modify HTML/CSS around it)

═══════════════════════════════════════════════════════════════════════════════
                              YOUR CAPABILITIES
═══════════════════════════════════════════════════════════════════════════════

STYLING:
✓ Change colors, backgrounds, borders, shadows
✓ Modify fonts, sizes, weights, line-heights
✓ Adjust spacing, margins, padding
✓ Add visual elements (gradients, icons, separators)

LAYOUT:
✓ Rearrange elements within sections
✓ Change from flex to grid and vice versa
✓ Create multi-column layouts
✓ Reposition sections (move totals left, center header, etc.)

STRUCTURE:
✓ ADD new fields using the schema below
✓ ADD new sections with appropriate data bindings
✓ ADD conditional wrappers for optional fields
✓ ADD new table columns with matching data
✓ ADD calculation display rows (tax, shipping, deposits)

CONTENT:
✓ Change static labels ("Bill To" → "Invoice To")
✓ Add static text (disclaimers, instructions)
✓ Modify heading text

${generateSchemaDocumentation()}

${MUSTACHE_SYNTAX_GUIDE}

${LAYOUT_PATTERNS}

═══════════════════════════════════════════════════════════════════════════════
                          FIELD INJECTION EXAMPLES
═══════════════════════════════════════════════════════════════════════════════

USER: "Add the client's phone number below their email"
YOU: Add this after the email line in client-info section:
  {{#client.phone}}
  <p class="client-phone">{{client.phone}}</p>
  {{/client.phone}}

USER: "Add a PO number field to the meta section"
YOU: Add this as a new meta-item:
  {{#meta.poNumber}}
  <div class="meta-item">
    <div class="meta-label">PO Number</div>
    <div class="meta-value">{{meta.poNumber}}</div>
  </div>
  {{/meta.poNumber}}

USER: "Add 15% tax line"
YOU: Add this in the totals section (after subtotal, before total):
  {{#totals.tax}}
  <div class="totals-row tax">
    <span class="totals-label">Tax ({{totals.taxRate}}%)</span>
    <span class="totals-value">\${{totals.tax}}</span>
  </div>
  {{/totals.tax}}

USER: "Only show discount if there is one"
YOU: Wrap the discount row with conditional:
  {{#totals.discount}}
  <div class="totals-row discount">
    <span class="totals-label">Discount</span>
    <span class="totals-value">-\${{totals.discount}}</span>
  </div>
  {{/totals.discount}}

USER: "Add a shipping line to totals"
YOU: Add this in the totals section:
  {{#totals.shipping}}
  <div class="totals-row shipping">
    <span class="totals-label">Shipping</span>
    <span class="totals-value">\${{totals.shipping}}</span>
  </div>
  {{/totals.shipping}}

═══════════════════════════════════════════════════════════════════════════════
                          LAYOUT EXAMPLES
═══════════════════════════════════════════════════════════════════════════════

USER: "Make the header two columns with logo on left and company info on right"
YOU: Modify the header to use CSS grid:
  <header data-glyph-region="header" style="display: grid; grid-template-columns: auto 1fr; gap: 2rem; align-items: center;">
    <div class="header-logo">
      {{#branding.logoUrl}}
      <img src="{{branding.logoUrl}}" class="logo" alt="Logo" />
      {{/branding.logoUrl}}
    </div>
    <div class="header-info" style="text-align: right;">
      <h1>{{branding.companyName}}</h1>
      {{#branding.companyAddress}}
      <p class="company-address">{{branding.companyAddress}}</p>
      {{/branding.companyAddress}}
    </div>
  </header>

USER: "Move totals to the left side"
YOU: Change the totals section alignment:
  <section data-glyph-region="totals" class="totals" style="align-items: flex-start;">

USER: "Put client info and totals side by side"
YOU: Wrap both in a flex container:
  <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 2rem;">
    <section data-glyph-region="client-info" style="flex: 1;">...</section>
    <section data-glyph-region="totals" style="width: 280px;">...</section>
  </div>

═══════════════════════════════════════════════════════════════════════════════
                          ADVANCED PATTERNS
═══════════════════════════════════════════════════════════════════════════════

ADDING A SKU COLUMN TO LINE ITEMS:
  In thead: <th>SKU</th>
  In tbody row: <td>{{sku}}</td>

ZEBRA STRIPING FOR TABLES:
  Add to <style>:
  [data-glyph-region="line-items"] tbody tr:nth-child(even) {
    background-color: var(--bg-light);
  }

DEPOSIT AND BALANCE DUE:
  {{#totals.deposit}}
  <div class="totals-row deposit">
    <span class="totals-label">Deposit Paid</span>
    <span class="totals-value">-\${{totals.deposit}}</span>
  </div>
  {{/totals.deposit}}
  {{#totals.balance}}
  <div class="totals-row balance">
    <span class="totals-label">Balance Due</span>
    <span class="totals-value">\${{totals.balance}}</span>
  </div>
  {{/totals.balance}}

PAYMENT INSTRUCTIONS IN FOOTER:
  {{#meta.paymentInstructions}}
  <div class="payment-instructions" style="margin-top: 1rem; padding: 1rem; background: var(--bg-light); border-radius: 4px;">
    <h4 style="margin-bottom: 0.5rem; font-size: 0.875rem;">Payment Instructions</h4>
    <p style="font-size: 0.875rem; white-space: pre-wrap;">{{meta.paymentInstructions}}</p>
  </div>
  {{/meta.paymentInstructions}}
`;

/**
 * Detect user intent and enhance the prompt with specific guidance
 */
function detectAndEnhanceFieldRequest(userPrompt: string): { enhancedPrompt: string; detectedIntent: string | null } {
  const lowerPrompt = userPrompt.toLowerCase();

  // Intent patterns for different modification types
  const intentPatterns: Array<{ pattern: RegExp; intent: string; enhancement: string }> = [
    // Field addition patterns
    {
      pattern: /add\s+(the\s+)?(client'?s?\s+)?phone/i,
      intent: "add_client_phone",
      enhancement: "Add the client phone number using {{client.phone}}. Wrap it with {{#client.phone}}...{{/client.phone}} for conditional display."
    },
    {
      pattern: /add\s+(the\s+)?(client'?s?\s+)?email/i,
      intent: "add_client_email",
      enhancement: "Add the client email using {{client.email}}. Wrap it with {{#client.email}}...{{/client.email}} for conditional display."
    },
    {
      pattern: /add\s+(a\s+)?po\s*number|purchase\s*order/i,
      intent: "add_po_number",
      enhancement: "Add a PO number field using {{meta.poNumber}}. Wrap it with {{#meta.poNumber}}...{{/meta.poNumber}} for conditional display."
    },
    {
      pattern: /add\s+(a\s+)?tax\s*(line|row)?|add\s+\d+%?\s*tax/i,
      intent: "add_tax",
      enhancement: "Add a tax line in the totals section using {{totals.tax}} and {{totals.taxRate}}. Wrap with {{#totals.tax}}...{{/totals.tax}}."
    },
    {
      pattern: /add\s+(a\s+)?shipping|add\s+delivery\s*fee/i,
      intent: "add_shipping",
      enhancement: "Add a shipping line in the totals section using {{totals.shipping}}. Wrap with {{#totals.shipping}}...{{/totals.shipping}}."
    },
    {
      pattern: /add\s+(a\s+)?discount|show\s+discount/i,
      intent: "add_discount",
      enhancement: "Ensure the discount row uses {{totals.discount}} and is wrapped with {{#totals.discount}}...{{/totals.discount}}."
    },

    // QR Code pattern - CRITICAL for speed
    {
      pattern: /qr\s*code|add.*qr|qr.*payment|scan.*pay/i,
      intent: "add_qr_code",
      enhancement: `Add a QR code in the top-right corner. Use this EXACT HTML structure:
<div style="position:absolute;top:20px;right:20px;width:80px;height:80px;background:white;border:1px solid #e5e5e5;border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8px;">
  <svg viewBox="0 0 100 100" width="50" height="50">
    <rect x="10" y="10" width="25" height="25" fill="#1a1a1a"/>
    <rect x="15" y="15" width="15" height="15" fill="white"/>
    <rect x="18" y="18" width="9" height="9" fill="#1a1a1a"/>
    <rect x="65" y="10" width="25" height="25" fill="#1a1a1a"/>
    <rect x="70" y="15" width="15" height="15" fill="white"/>
    <rect x="73" y="18" width="9" height="9" fill="#1a1a1a"/>
    <rect x="10" y="65" width="25" height="25" fill="#1a1a1a"/>
    <rect x="15" y="70" width="15" height="15" fill="white"/>
    <rect x="18" y="73" width="9" height="9" fill="#1a1a1a"/>
    <rect x="40" y="40" width="20" height="20" fill="#1a1a1a"/>
    <rect x="65" y="65" width="8" height="8" fill="#1a1a1a"/>
    <rect x="77" y="65" width="8" height="8" fill="#1a1a1a"/>
    <rect x="65" y="77" width="8" height="8" fill="#1a1a1a"/>
    <rect x="77" y="77" width="8" height="8" fill="#1a1a1a"/>
  </svg>
  <span style="font-size:7px;color:#666;margin-top:4px;">Scan to pay</span>
</div>
IMPORTANT: Add position:relative to the body element if not already present.`
    },

    // Watermark pattern - CRITICAL for speed
    {
      pattern: /watermark|add.*draft|draft.*watermark/i,
      intent: "add_watermark",
      enhancement: `Add a diagonal watermark overlay. Use this EXACT HTML after <body>:
<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-45deg);font-size:80px;font-weight:900;color:rgba(0,0,0,0.06);pointer-events:none;white-space:nowrap;z-index:1;">DRAFT</div>
IMPORTANT: Add position:relative to the body element if not already present. Change "DRAFT" to "PAID" if the user mentions "paid".`
    },

    // Layout patterns
    {
      pattern: /two\s*columns?|split.*header|side\s*by\s*side.*header/i,
      intent: "two_column_header",
      enhancement: "Use CSS grid with grid-template-columns: 1fr 1fr or auto 1fr for a two-column header layout."
    },
    {
      pattern: /move\s+totals?\s+(to\s+(the\s+)?)?left/i,
      intent: "totals_left",
      enhancement: "Change the totals section's align-items from flex-end to flex-start."
    },
    {
      pattern: /center\s+(the\s+)?title|title.*center/i,
      intent: "center_title",
      enhancement: "Center the document title using text-align: center on the appropriate container."
    },
    {
      pattern: /zebra\s*strip|alternate\s*row|striped\s*table/i,
      intent: "zebra_stripes",
      enhancement: "Add zebra striping using CSS: [data-glyph-region=\"line-items\"] tbody tr:nth-child(even) { background-color: var(--bg-light); }"
    },

    // Conditional patterns
    {
      pattern: /only\s*(show|display).*if|hide.*if\s*(no|empty|not)/i,
      intent: "conditional",
      enhancement: "Use Mustache conditional syntax: {{#field}}...{{/field}} to show only when field exists, or {{^field}}...{{/field}} for the inverse."
    },

    // Grouping patterns - SAFELY REDIRECT to visual styling only
    {
      pattern: /group\s*(items?|line\s*items?|the\s+)?.*by\s*(category|type|description|name)/i,
      intent: "group_by_visual",
      enhancement: `CRITICAL: You CANNOT create new Mustache loop structures like {{#categories}} or {{#items}} - these do not exist in the data model and will break the template.

Instead, apply VISUAL grouping to the existing {{#lineItems}} loop:
- Add alternating row backgrounds
- Add visual separators (borders, spacing)
- Use CSS to highlight the first column (description)
- Add a subtle background pattern

Example of safe visual enhancement:
{{#lineItems}}
<tr style="border-bottom: 1px solid #e5e5e5;">
  <td style="font-weight: 500; background: #f9fafb; padding: 12px;">{{description}}</td>
  <td>{{quantity}}</td>
  <td>\${{unitPrice}}</td>
  <td>\${{total}}</td>
</tr>
{{/lineItems}}

DO NOT create {{#categories}}, {{#groups}}, {{#items}} or any new section loops.`
    },
    {
      pattern: /sort\s*(the\s+)?(items?|line\s*items?)/i,
      intent: "sort_items_safe",
      enhancement: `IMPORTANT: Sorting cannot be done in the template - line items come pre-sorted from the data source.
Instead, you can apply visual styling to make the table more readable (zebra stripes, borders, etc.).
DO NOT attempt to restructure the {{#lineItems}} loop.`
    },
    {
      pattern: /organize\s*(the\s+)?(items?|line\s*items?)/i,
      intent: "organize_items_safe",
      enhancement: `IMPORTANT: Data organization cannot be done in the template - it requires backend changes.
You can apply VISUAL organization using CSS (alternating colors, section borders, spacing).
DO NOT create new Mustache loop structures like {{#categories}} or {{#groups}}.`
    },

    // SIGNATURE AND THANK YOU PATTERNS - CRITICAL: Must preserve all document content
    {
      pattern: /add\s*(a\s+)?(thank\s*you|signature|sign.*line)|signature\s*(line|block|area)|thank\s*you\s*(message|note)/i,
      intent: "add_signature_block",
      enhancement: `Add a signature block and thank you message to the FOOTER region. Use this EXACT HTML structure, adding it INSIDE the existing footer:

<div style="margin-top: 32px; display: flex; justify-content: space-between; align-items: flex-end;">
  <div style="flex: 1;">
    <p style="font-size: 11px; color: #666; margin-bottom: 12px;">Thank you for your business!</p>
    <div style="display: flex; gap: 40px;">
      <div>
        <div style="border-bottom: 1px solid #1a1a1a; width: 180px; margin-bottom: 4px;"></div>
        <div style="font-size: 10px; color: #666;">Authorized Signature</div>
      </div>
      <div>
        <div style="border-bottom: 1px solid #1a1a1a; width: 120px; margin-bottom: 4px;"></div>
        <div style="font-size: 10px; color: #666;">Date</div>
      </div>
    </div>
  </div>
</div>

CRITICAL INSTRUCTIONS:
1. Add this INSIDE the existing footer region (data-glyph-region="footer")
2. DO NOT remove or replace ANY existing content in the document
3. Keep ALL data-glyph-region attributes intact (header, meta, client-info, line-items, totals, notes, footer)
4. Keep ALL existing Mustache placeholders exactly as they are
5. Simply INSERT this signature block at the end of the footer content, before the closing </footer> or </section> tag
6. The rest of the document (header, line items, totals, etc.) must remain COMPLETELY UNCHANGED`
    },

    // BRAND STYLING PATTERNS - for "Make this look like X" requests
    {
      pattern: /look\s*like\s*(a\s+)?stripe|stripe\s*(style|invoice|aesthetic|design)|stripe's?\s*(look|style|design)/i,
      intent: "brand_style_stripe",
      enhancement: `Apply Stripe's signature design aesthetic with these SPECIFIC CSS changes:
1. PRIMARY COLOR: Change all accent colors to Stripe's purple (#635bff or #6366f1)
2. HEADER: Clean white background with subtle bottom border, remove heavy colored headers
3. TYPOGRAPHY: Use system fonts (-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif)
4. SPACING: Increase whitespace - use padding: 24px-32px for sections
5. BORDERS: Use subtle gray borders (#e5e5e5), avoid dark/heavy borders
6. TOTALS: Right-aligned with larger font for final total
7. TABLE: Minimal borders, use background alternating rows or none
8. OVERALL: Clean, minimal, professional - less is more

CRITICAL: You MUST actually modify the <style> block to replace existing colors with #635bff (Stripe purple).
Replace any {{styles.accentColor}} with the actual color value #635bff.
Remove or lighten dark header backgrounds. Add more padding for breathing room.`
    },
    {
      pattern: /look\s*like\s*(a\s+)?apple|apple\s*(style|invoice|aesthetic|design)|apple's?\s*(look|style|design)/i,
      intent: "brand_style_apple",
      enhancement: `Apply Apple's signature design aesthetic:
1. PRIMARY COLOR: Use dark gray (#1d1d1f) for text, blue (#0071e3) for accents
2. TYPOGRAPHY: San Francisco font or -apple-system, clean and readable
3. SPACING: Generous whitespace, lots of breathing room
4. BORDERS: Minimal to none, use spacing instead
5. OVERALL: Ultra-minimal, typography-focused, premium feel

CRITICAL: You MUST modify the <style> block with these specific changes.`
    },
    {
      pattern: /look\s*like\s*(a\s+)?shopify|shopify\s*(style|invoice|aesthetic|design)|shopify's?\s*(look|style|design)/i,
      intent: "brand_style_shopify",
      enhancement: `Apply Shopify's design aesthetic:
1. PRIMARY COLOR: Shopify green (#96bf48 or #008060) for accents
2. TYPOGRAPHY: Clean sans-serif, good hierarchy
3. HEADER: Often includes green accent bar or elements
4. OVERALL: Friendly, approachable, e-commerce focused

CRITICAL: You MUST modify the <style> block with these specific changes.`
    },
    {
      pattern: /make\s*(it|this)?\s*(look\s*)?(modern|clean|minimal|professional|sleek)/i,
      intent: "style_modern",
      enhancement: `Apply modern professional styling:
1. Increase whitespace and padding
2. Use subtle shadows (box-shadow: 0 1px 3px rgba(0,0,0,0.1))
3. Rounded corners (border-radius: 8px)
4. Clean sans-serif typography
5. Muted color palette with one accent color

CRITICAL: You MUST actually modify the CSS in the <style> block to apply these changes.`
    },
  ];

  // Check each pattern
  for (const { pattern, intent, enhancement } of intentPatterns) {
    if (pattern.test(lowerPrompt)) {
      return {
        enhancedPrompt: `${userPrompt}\n\nIMPORTANT: ${enhancement}`,
        detectedIntent: intent
      };
    }
  }

  // Check for generic field addition
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
          return {
            enhancedPrompt: `${userPrompt}\n\nIMPORTANT: Use the Mustache placeholder {{${path}}} for this field. If it's optional data, wrap it with {{#${path}}}...{{/${path}}} for conditional display.`,
            detectedIntent: `add_field_${path}`
          };
        }
      }
    }
  }

  // Check if user already included a Mustache placeholder
  if (userPrompt.includes("{{") && userPrompt.includes("}}")) {
    return { enhancedPrompt: userPrompt, detectedIntent: "explicit_mustache" };
  }

  return { enhancedPrompt: userPrompt, detectedIntent: null };
}

/**
 * Get region-specific context for the AI
 */
function getRegionContext(region?: string): string {
  if (!region) return "";

  const guidance = REGION_GUIDELINES[region];
  if (guidance) {
    return `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TARGETED REGION: "${region}"
${guidance}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
  }

  return `\n\nThe user selected the "${region}" region for editing. Focus your modifications on that section while preserving the rest of the document.`;
}

/**
 * Fast system prompt for quick modifications (Haiku)
 * Much smaller than the full architect prompt - optimized for speed
 */
const FAST_MODIFY_PROMPT = `You modify HTML documents. Rules:
1. Return COMPLETE HTML (<!DOCTYPE html> to </html>)
2. CRITICAL: PRESERVE ALL existing content - INJECT new elements, never regenerate
3. Preserve ALL {{mustache}} placeholders exactly
4. Preserve ALL data-glyph-region attributes
5. End with "CHANGES:" and bullet list

CRITICAL: You are ADDING to an existing document, not creating a new one.
The user's existing customizations MUST be preserved.
When adding elements, INSERT them at appropriate locations - do NOT replace existing content.

SPECIAL PATTERNS:
- QR code: Add <div style="position:absolute;top:20px;right:20px;width:80px;height:80px;background:white;border:1px solid #e5e5e5;border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8px;"><svg viewBox="0 0 100 100" width="50" height="50"><rect x="10" y="10" width="25" height="25" fill="#1a1a1a"/><rect x="15" y="15" width="15" height="15" fill="white"/><rect x="18" y="18" width="9" height="9" fill="#1a1a1a"/><rect x="65" y="10" width="25" height="25" fill="#1a1a1a"/><rect x="70" y="15" width="15" height="15" fill="white"/><rect x="73" y="18" width="9" height="9" fill="#1a1a1a"/><rect x="10" y="65" width="25" height="25" fill="#1a1a1a"/><rect x="15" y="70" width="15" height="15" fill="white"/><rect x="18" y="73" width="9" height="9" fill="#1a1a1a"/><rect x="40" y="40" width="20" height="20" fill="#1a1a1a"/><rect x="65" y="65" width="8" height="8" fill="#1a1a1a"/><rect x="77" y="65" width="8" height="8" fill="#1a1a1a"/><rect x="65" y="77" width="8" height="8" fill="#1a1a1a"/><rect x="77" y="77" width="8" height="8" fill="#1a1a1a"/><rect x="40" y="10" width="8" height="8" fill="#1a1a1a"/><rect x="10" y="40" width="8" height="8" fill="#1a1a1a"/><rect x="52" y="40" width="8" height="8" fill="#1a1a1a"/><rect x="40" y="52" width="8" height="8" fill="#1a1a1a"/></svg><span style="font-size:7px;color:#666;margin-top:4px;">Scan to pay</span></div>
- Watermark: Add <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-45deg);font-size:80px;font-weight:900;color:rgba(0,0,0,0.06);pointer-events:none;white-space:nowrap;z-index:1;">TEXT</div>
- Make body position:relative if adding positioned elements`;

/**
 * Determine if a modification is "simple" and can use the fast model (Haiku)
 *
 * PERFORMANCE CRITICAL: Haiku is 2-5x faster than Sonnet
 * - Haiku: ~1-3 seconds
 * - Sonnet: ~4-10 seconds
 *
 * Be aggressive about using Haiku. Only use Sonnet for:
 * 1. Brand styling (Stripe, Apple, etc.) - needs deep CSS knowledge
 * 2. Complex layout restructuring
 * 3. Multi-part requests that need coordination
 */
function isSimpleModification(prompt: string): boolean {
  const lowPrompt = prompt.toLowerCase();

  // COMPLEX patterns that ALWAYS need full Sonnet AI (never Haiku)
  // These require deep understanding and comprehensive changes
  const complexPatterns = [
    // Brand styling - needs holistic CSS overhaul
    /look\s*like\s*(a\s+)?(stripe|apple|shopify|airbnb|notion)/i,
    /stripe\s*(style|look|aesthetic|design|invoice)/i,
    /apple\s*(style|look|aesthetic|design)/i,
    /shopify\s*(style|look|aesthetic|design)/i,
    /(brand|corporate)\s*styl/i,
    /complete\s*redesign/i,
    /overhaul/i,
    // Complex styling that needs understanding of the whole document
    /make\s*(it|this)?\s*(look\s*)?(modern|clean|minimal|professional|sleek)/i,
    // Layout restructuring
    /restructure/i,
    /reorganize.*layout/i,
    /complete.*makeover/i,
  ];

  // If it matches any complex pattern, use Sonnet
  if (complexPatterns.some(p => p.test(lowPrompt))) {
    return false;
  }

  // SIMPLE modifications - use fast Haiku model
  // These are well-defined, focused changes that don't need deep reasoning
  const simplePatterns = [
    // Visual additions (fast path handles many, but Haiku is backup)
    /add\s*(a\s+)?qr/i,
    /add\s*(a\s+)?watermark/i,
    /add\s*(a\s+)?logo/i,
    /add\s*(a\s+)?draft/i,

    // Color changes - straightforward CSS updates
    /change\s*(the\s+)?(.*\s+)?color/i,
    /make\s*(the\s+)?(header|accent|title|text|background)\s*(color\s+)?\w+/i,
    /(header|accent|title|background)\s*color/i,
    /color\s*to\s*(blue|red|green|purple|orange|teal|pink|navy|black|white|gray|grey)/i,

    // Field additions - inject content at known locations
    /add\s*(a\s+)?(the\s+)?(client'?s?\s+)?(phone|email|fax|address)/i,
    /add\s*(a\s+)?po\s*number/i,
    /add\s*(a\s+)?purchase\s*order/i,
    /add\s*(a\s+)?(payment\s*)?terms/i,
    /add\s*(a\s+)?notes?\s*(section|field)?/i,
    /add\s*(a\s+)?tax\s*(line|row|field)?/i,
    /add\s*(a\s+)?shipping/i,
    /add\s*(a\s+)?discount/i,
    /add\s*(a\s+)?due\s*date/i,
    /add\s*(a\s+)?project\s*name/i,

    // Simple text/label changes
    /change\s*(the\s+)?label/i,
    /rename\s*(the\s+)?/i,
    /change\s*"[^"]+"\s*to\s*"[^"]+"/i,
    /"[^"]+"\s*to\s*"[^"]+"/i,

    // Text formatting - simple CSS
    /make\s*(the\s+)?\w+\s*(bold|italic|underline|larger|smaller)/i,
    /bold\s*(the\s+)?/i,
    /increase\s*(the\s+)?(font|text)\s*size/i,
    /decrease\s*(the\s+)?(font|text)\s*size/i,

    // Spacing adjustments - simple CSS
    /add\s*(more\s+)?spacing/i,
    /add\s*(more\s+)?padding/i,
    /increase\s*(the\s+)?spacing/i,
    /increase\s*(the\s+)?padding/i,
    /reduce\s*(the\s+)?spacing/i,

    // Table styling - focused CSS changes
    /zebra\s*strip/i,
    /alternate\s*row/i,
    /striped\s*table/i,
    /add\s*row\s*borders?/i,
    /add\s*table\s*borders?/i,

    // Border/visual tweaks
    /add\s*(a\s+)?border/i,
    /remove\s*(the\s+)?border/i,
    /round\s*(the\s+)?corners/i,
    /add\s*(a\s+)?shadow/i,

    // Alignment - simple CSS
    /center\s*(the\s+)?(title|header|text|logo)/i,
    /align\s*(the\s+)?\w+\s*(left|right|center)/i,
    /left\s*align/i,
    /right\s*align/i,

    // Show/hide simple elements (not complex restructuring)
    /show\s*(the\s+)?(date|number|total|subtotal)/i,
    /hide\s*(the\s+)?(date|number)/i,

    // Signature - now safe with intent pattern guidance
    /add\s*(a\s+)?(thank\s*you|signature)/i,
  ];

  return simplePatterns.some(p => p.test(lowPrompt));
}

export async function modifyTemplate(
  currentHtml: string,
  userPrompt: string,
  region?: string
): Promise<ModifyResult> {
  // FAST PATH: Try deterministic transformations first (no AI needed)
  // This handles QR codes, watermarks, and simple color changes in <100ms
  // Note: Fast transforms work regardless of region selection since they don't depend on region context
  if (canFastTransform(userPrompt)) {
    const startTime = Date.now();
    const fastResult = fastTransform(currentHtml, userPrompt);

    if (fastResult.transformed) {
      console.log(`[FAST] Transformed in ${Date.now() - startTime}ms: "${userPrompt.substring(0, 50)}..."`);
      return {
        html: fastResult.html,
        changes: fastResult.changes,
        tokensUsed: 0,  // No AI tokens used
      };
    }
    // Fall through to AI if fast transform couldn't handle it
  }

  // Enhance the prompt with detected intent
  const { enhancedPrompt, detectedIntent } = detectAndEnhanceFieldRequest(userPrompt);

  // Build context with region-specific guidance
  const regionContext = getRegionContext(region);
  const contextPrompt = region
    ? `The user selected the "${region}" section and wants: ${enhancedPrompt}${regionContext}`
    : enhancedPrompt;

  // Log for debugging
  if (detectedIntent) {
    console.log(`[AI] Detected intent: ${detectedIntent}`);
  }

  // Use Haiku for speed on simple modifications, Sonnet for complex ones
  const useHaiku = isSimpleModification(userPrompt);
  const model = useHaiku ? "claude-3-5-haiku-20241022" : "claude-sonnet-4-20250514";
  const systemPrompt = useHaiku ? FAST_MODIFY_PROMPT : DOCUMENT_ARCHITECT_PROMPT;
  const maxTokens = useHaiku ? 8192 : 16384;

  console.log(`[AI] Using ${model} for: "${userPrompt.substring(0, 50)}..."`);
  const startTime = Date.now();

  const message = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `Current HTML document template:

\`\`\`html
${currentHtml}
\`\`\`

Modification request: ${contextPrompt}

INSTRUCTIONS:
1. Output the COMPLETE modified HTML document (including <!DOCTYPE html>)
2. Preserve ALL existing Mustache placeholders exactly as they appear
3. Preserve ALL data-glyph-region attributes
4. When adding new fields, use the exact Mustache syntax from the schema
5. After the HTML, write "CHANGES:" followed by a bullet list of modifications`,
      },
    ],
  });

  console.log(`[AI] Response in ${Date.now() - startTime}ms`);

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

  // Check Mustache placeholders are preserved (but allow additions)
  const originalPlaceholders = originalHtml.match(/\{\{[^}]+\}\}/g) || [];
  const modifiedPlaceholders = modifiedHtml.match(/\{\{[^}]+\}\}/g) || [];

  const originalSet = new Set(originalPlaceholders);
  const modifiedSet = new Set(modifiedPlaceholders);

  for (const placeholder of originalSet) {
    if (!modifiedSet.has(placeholder)) {
      // Allow removal of conditional blocks but not data placeholders
      if (!placeholder.startsWith("{{#") && !placeholder.startsWith("{{/") && !placeholder.startsWith("{{^")) {
        issues.push(`Missing placeholder: ${placeholder}`);
      }
    }
  }

  // Check for common structural issues
  if (!modifiedHtml.includes("<!DOCTYPE html>") && !modifiedHtml.includes("<html")) {
    issues.push("Missing DOCTYPE or html tag");
  }

  if (!modifiedHtml.includes("</html>")) {
    issues.push("Missing closing html tag");
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

// =============================================================================
// Template Generation from Airtable Schema
// =============================================================================

/**
 * Schema field definition for template generation
 */
export interface AirtableFieldForTemplate {
  name: string;
  type: string;
  glyphType: string;
  description: string;
  mustachePath: string;
  isArray: boolean;
  hasConditional: boolean;
}

/**
 * AI Schema format from Airtable service
 */
export interface AirtableAISchema {
  tableName: string;
  tableDescription: string;
  fields: AirtableFieldForTemplate[];
}

/**
 * Template generation result
 */
export interface GenerateTemplateResult {
  html: string;
  css: string;
  fullHtml: string;
  fields: string[];
  tokensUsed: number;
}

/**
 * Style presets for template generation
 */
const STYLE_PRESETS: Record<string, string> = {
  modern: `Clean, minimal design with lots of whitespace. Use a sans-serif font (Inter or system fonts).
    Colors: Dark navy (#1e3a5f) for headers, light gray (#f9fafb) backgrounds for sections.
    Subtle borders and rounded corners. Professional but approachable.`,

  classic: `Traditional business document style. Serif fonts for headings, sans-serif for body.
    Colors: Black text, blue (#2563eb) accents. Sharp corners. Formal and authoritative.`,

  vibrant: `Bold, colorful design with gradient accents. Modern sans-serif fonts.
    Use the brand's accent color prominently. Rounded corners, subtle shadows.
    Eye-catching but still professional.`,

  minimal: `Ultra-minimal design. Maximum whitespace. Single accent color.
    Typography-focused with clear hierarchy. No borders, just spacing and type weight.`,

  invoice: `Structured invoice/quote layout. Clear sections for company info, client info, line items, totals.
    Table for line items with proper alignment. Prominent total section.`,

  report: `Professional report layout. Cover page style header with title and date.
    Sections with clear headings. Good for data summaries and overviews.`,
};

/**
 * The system prompt for template generation from Airtable schema
 */
const TEMPLATE_GENERATOR_PROMPT = `You are GLYPH TEMPLATE ARCHITECT - an expert at creating beautiful HTML/CSS document templates from database schemas.

You take a user's natural language description and an Airtable schema, then produce a professional Mustache template.

═══════════════════════════════════════════════════════════════════════════════
                              MUSTACHE SYNTAX
═══════════════════════════════════════════════════════════════════════════════

VARIABLES:
  {{fields.FieldName}}     → Output field value, HTML-escaped
  {{{fields.FieldName}}}   → Output raw HTML (for rich text)

CONDITIONALS:
  {{#fields.FieldName}}...{{/fields.FieldName}}   → Show if field exists/truthy
  {{^fields.FieldName}}...{{/fields.FieldName}}   → Show if field is empty/falsy

ARRAYS (for attachment, multiselect, linked records):
  {{#fields.Images}}
    <img src="{{url}}" alt="{{filename}}" />
  {{/fields.Images}}

ATTACHMENTS (common pattern):
  {{#fields.Logo}}
    <img src="{{fields.Logo.0.url}}" alt="Logo" />
  {{/fields.Logo}}

═══════════════════════════════════════════════════════════════════════════════
                              REQUIREMENTS
═══════════════════════════════════════════════════════════════════════════════

1. OUTPUT COMPLETE HTML - Include <!DOCTYPE html>, <html>, <head>, <body>
2. ALL STYLES IN <style> BLOCK - No external stylesheets
3. USE EXACT FIELD PATHS - Reference fields as {{fields.FieldName}}
4. WRAP OPTIONAL FIELDS - Use {{#fields.X}}...{{/fields.X}} for any field that might be empty
5. PRINT-FRIENDLY - Include @media print rules, proper page breaks
6. RESPONSIVE - Works on screen and when printed
7. PROFESSIONAL - Clean typography, proper spacing, visual hierarchy

═══════════════════════════════════════════════════════════════════════════════
                              FIELD TYPE HANDLING
═══════════════════════════════════════════════════════════════════════════════

TEXT FIELDS:
  <p>{{fields.Description}}</p>
  {{#fields.Notes}}<div class="notes">{{{fields.Notes}}}</div>{{/fields.Notes}}

CURRENCY FIELDS:
  <span class="amount">\${{fields.Price}}</span>

DATE FIELDS:
  <span class="date">{{fields.DueDate}}</span>

ATTACHMENTS (images):
  {{#fields.Logo}}
  <img src="{{fields.Logo.0.url}}" class="logo" alt="Logo" />
  {{/fields.Logo}}

CHECKBOXES:
  {{#fields.IsPaid}}<span class="badge paid">Paid</span>{{/fields.IsPaid}}
  {{^fields.IsPaid}}<span class="badge unpaid">Unpaid</span>{{/fields.IsPaid}}

SELECT FIELDS:
  <span class="status">{{fields.Status}}</span>

MULTI-SELECT:
  {{#fields.Tags}}<span class="tag">{{.}}</span>{{/fields.Tags}}

LINKED RECORDS (when expanded):
  {{#fields.LineItems}}
  <tr>
    <td>{{fields.Description}}</td>
    <td>{{fields.Quantity}}</td>
    <td>\${{fields.Amount}}</td>
  </tr>
  {{/fields.LineItems}}

═══════════════════════════════════════════════════════════════════════════════
                              CSS BEST PRACTICES
═══════════════════════════════════════════════════════════════════════════════

- Use CSS variables for colors (--color-primary, --color-text, etc.)
- Use rem/em for sizing, not px
- Include print styles: @media print { ... }
- Use flexbox/grid for layout
- Add page-break-inside: avoid to important sections
- Set reasonable max-width for readability (800-900px)
`;

/**
 * Generate a complete HTML template from Airtable schema and user description
 */
export async function generateTemplateFromSchema(
  schema: AirtableAISchema,
  description: string,
  options: {
    style?: string;
    sampleData?: Record<string, unknown>;
  } = {}
): Promise<GenerateTemplateResult> {
  const stylePreset = options.style
    ? STYLE_PRESETS[options.style] || options.style
    : STYLE_PRESETS.modern;

  // Build field documentation for the AI
  const fieldDocs = schema.fields
    .map((f) => {
      const conditionalNote = f.hasConditional ? " (may be empty)" : "";
      const arrayNote = f.isArray ? " [array]" : "";
      return `- ${f.name} (${f.type}${arrayNote}${conditionalNote}): ${f.description}\n  Mustache: {{${f.mustachePath}}}`;
    })
    .join("\n");

  const userPrompt = `Create a professional HTML document template for: "${description}"

TABLE: ${schema.tableName}
${schema.tableDescription}

AVAILABLE FIELDS:
${fieldDocs}

STYLE GUIDANCE:
${stylePreset}

${options.sampleData ? `SAMPLE DATA FOR REFERENCE:\n${JSON.stringify(options.sampleData, null, 2)}` : ""}

INSTRUCTIONS:
1. Create a complete HTML document with embedded CSS
2. Use the exact Mustache paths shown above for each field
3. Make intelligent decisions about which fields to include based on the description
4. Wrap all optional fields with conditional blocks
5. If the description mentions "invoice" or "quote", include a line items table structure
6. If the description mentions "logo", use the attachment pattern for images
7. After the HTML, list "FIELDS_USED:" with each field name you included`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 16384,
    system: TEMPLATE_GENERATOR_PROMPT,
    messages: [
      {
        role: "user",
        content: userPrompt,
      },
    ],
  });

  const responseText =
    message.content[0].type === "text" ? message.content[0].text : "";

  // Parse response - extract HTML
  let fullHtml: string;
  const htmlMatch = responseText.match(/```html\n([\s\S]*?)\n```/);

  if (htmlMatch) {
    fullHtml = htmlMatch[1];
  } else {
    // Try to extract HTML directly
    const docStart =
      responseText.indexOf("<!DOCTYPE html>") !== -1
        ? responseText.indexOf("<!DOCTYPE html>")
        : responseText.indexOf("<html");
    const docEnd = responseText.lastIndexOf("</html>") + 7;

    if (docStart !== -1 && docEnd > docStart) {
      fullHtml = responseText.slice(docStart, docEnd);
    } else {
      fullHtml = responseText;
    }
  }

  // Extract CSS from the HTML
  const cssMatch = fullHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/);
  const css = cssMatch ? cssMatch[1].trim() : "";

  // Extract just the body HTML
  const bodyMatch = fullHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/);
  const html = bodyMatch ? bodyMatch[1].trim() : fullHtml;

  // Extract fields used
  const fieldsMatch = responseText.match(/FIELDS_USED:\s*([\s\S]*?)(?:$|```)/);
  const fields: string[] = [];
  if (fieldsMatch) {
    const fieldLines = fieldsMatch[1].trim().split("\n");
    for (const line of fieldLines) {
      const cleanLine = line.replace(/^[-*•]\s*/, "").trim();
      if (cleanLine) fields.push(cleanLine);
    }
  } else {
    // Extract fields from the template itself
    const fieldMatches = fullHtml.matchAll(/\{\{#?fields\.([^}]+)\}\}/g);
    const fieldSet = new Set<string>();
    for (const match of fieldMatches) {
      const fieldName = match[1].split(".")[0]; // Get first part before any dots
      fieldSet.add(fieldName);
    }
    fields.push(...fieldSet);
  }

  return {
    html,
    css,
    fullHtml,
    fields,
    tokensUsed: message.usage.input_tokens + message.usage.output_tokens,
  };
}

/**
 * Refine/modify an existing template based on user feedback
 */
export async function refineTemplate(
  currentHtml: string,
  schema: AirtableAISchema,
  instruction: string
): Promise<GenerateTemplateResult> {
  // Build field documentation for the AI
  const fieldDocs = schema.fields
    .map((f) => {
      const conditionalNote = f.hasConditional ? " (may be empty)" : "";
      const arrayNote = f.isArray ? " [array]" : "";
      return `- ${f.name} (${f.type}${arrayNote}${conditionalNote}): {{${f.mustachePath}}}`;
    })
    .join("\n");

  const userPrompt = `Current template:

\`\`\`html
${currentHtml}
\`\`\`

AVAILABLE FIELDS (use these exact Mustache paths):
${fieldDocs}

USER REQUEST: ${instruction}

INSTRUCTIONS:
1. Modify the template according to the user's request
2. When adding fields, use the exact Mustache paths shown above
3. Preserve existing structure unless explicitly asked to change it
4. Output the complete modified HTML document
5. After the HTML, list "CHANGES:" with what you modified`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 16384,
    system: TEMPLATE_GENERATOR_PROMPT,
    messages: [
      {
        role: "user",
        content: userPrompt,
      },
    ],
  });

  const responseText =
    message.content[0].type === "text" ? message.content[0].text : "";

  // Parse response - extract HTML
  let fullHtml: string;
  const htmlMatch = responseText.match(/```html\n([\s\S]*?)\n```/);

  if (htmlMatch) {
    fullHtml = htmlMatch[1];
  } else {
    const docStart =
      responseText.indexOf("<!DOCTYPE html>") !== -1
        ? responseText.indexOf("<!DOCTYPE html>")
        : responseText.indexOf("<html");
    const docEnd = responseText.lastIndexOf("</html>") + 7;

    if (docStart !== -1 && docEnd > docStart) {
      fullHtml = responseText.slice(docStart, docEnd);
    } else {
      fullHtml = responseText;
    }
  }

  // Extract CSS from the HTML
  const cssMatch = fullHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/);
  const css = cssMatch ? cssMatch[1].trim() : "";

  // Extract just the body HTML
  const bodyMatch = fullHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/);
  const html = bodyMatch ? bodyMatch[1].trim() : fullHtml;

  // Extract fields from the template
  const fieldMatches = fullHtml.matchAll(/\{\{#?fields\.([^}]+)\}\}/g);
  const fieldSet = new Set<string>();
  for (const match of fieldMatches) {
    const fieldName = match[1].split(".")[0];
    fieldSet.add(fieldName);
  }

  return {
    html,
    css,
    fullHtml,
    fields: [...fieldSet],
    tokensUsed: message.usage.input_tokens + message.usage.output_tokens,
  };
}
