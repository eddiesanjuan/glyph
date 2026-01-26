/**
 * Data Analyzer Service
 * AI-powered data structure analysis for intelligent PDF generation
 *
 * Uses heuristic detection first (fast, no AI cost), then falls back to
 * Claude AI for ambiguous cases when confidence is low.
 */

import Anthropic from "@anthropic-ai/sdk";

// ============================================================================
// Types
// ============================================================================

export type DocumentType =
  | "invoice"
  | "receipt"
  | "quote"
  | "report"
  | "certificate"
  | "letter"
  | "generic";

export type FieldType =
  | "string"
  | "number"
  | "currency"
  | "date"
  | "array"
  | "object"
  | "email"
  | "phone"
  | "url";

export interface FieldInfo {
  path: string; // JSON path in data (e.g., "customer.name")
  name: string; // Human-readable name (e.g., "Customer Name")
  type: FieldType;
  role: string; // Semantic role (e.g., "total", "customer_name", "line_item_description")
  displayFormat?: string; // How to format for display (e.g., "currency", "date")
}

export interface DataAnalysis {
  // Document type detection
  documentType: DocumentType;
  confidence: number; // 0-1

  // Field role identification grouped by document section
  fields: {
    header: FieldInfo[]; // Company info, logos, dates
    recipient: FieldInfo[]; // Customer/client info
    lineItems: FieldInfo[]; // Items, services, rows
    summary: FieldInfo[]; // Totals, subtotals, tax
    metadata: FieldInfo[]; // Notes, terms, references
    footer: FieldInfo[]; // Contact, signatures
  };

  // Layout decisions
  layout: {
    headerStyle: "centered" | "split" | "logo-left";
    contentStyle: "table" | "list" | "cards" | "sections";
    summaryStyle: "right-aligned" | "centered" | "inline";
    hasSignature: boolean;
    hasLogo: boolean;
  };

  // Inferred styling hints
  styling: {
    suggestedStyle: "stripe-clean" | "bold" | "minimal" | "corporate";
    accentColor?: string;
    fontSuggestion?: string;
  };
}

// ============================================================================
// Detection Patterns
// ============================================================================

/**
 * Patterns that indicate specific document types
 * More specific patterns score higher
 */
const DOCUMENT_PATTERNS: Record<DocumentType, string[]> = {
  invoice: [
    "invoice",
    "bill",
    "dueDate",
    "paymentDue",
    "invoiceNumber",
    "invoiceId",
    "invoice_number",
    "invoice_id",
    "bill_to",
    "billTo",
    "amountDue",
    "amount_due",
    "paymentTerms",
    "payment_terms",
  ],
  receipt: [
    "receipt",
    "paid",
    "transactionId",
    "transaction_id",
    "paymentMethod",
    "payment_method",
    "cardLast4",
    "card_last_4",
    "paidAt",
    "paid_at",
    "receiptNumber",
    "receipt_number",
  ],
  quote: [
    "quote",
    "proposal",
    "estimate",
    "validUntil",
    "valid_until",
    "quoteNumber",
    "quote_number",
    "proposalId",
    "proposal_id",
    "expires",
    "expiresAt",
    "expires_at",
  ],
  report: [
    "report",
    "summary",
    "metrics",
    "analysis",
    "period",
    "reportDate",
    "report_date",
    "findings",
    "conclusions",
    "recommendations",
    "executive_summary",
    "executiveSummary",
  ],
  certificate: [
    "certificate",
    "awarded",
    "completion",
    "achievement",
    "certifiedTo",
    "certified_to",
    "issuedTo",
    "issued_to",
    "completionDate",
    "completion_date",
    "credential",
  ],
  letter: [
    "dear",
    "sincerely",
    "regards",
    "subject",
    "letterDate",
    "letter_date",
    "salutation",
    "closing",
    "body",
    "recipient",
    "sender",
  ],
  generic: [],
};

/**
 * Patterns for identifying semantic roles of fields
 */
const FIELD_ROLE_PATTERNS: Record<string, string[]> = {
  // Financial
  total: ["total", "amount", "sum", "grandTotal", "grand_total", "finalTotal", "final_total"],
  subtotal: ["subtotal", "sub_total", "subTotal", "netTotal", "net_total"],
  tax: ["tax", "vat", "gst", "salesTax", "sales_tax", "taxAmount", "tax_amount"],
  discount: ["discount", "reduction", "savings", "deduction"],
  price: ["price", "unitPrice", "unit_price", "rate", "cost", "amount"],
  quantity: ["quantity", "qty", "count", "units", "amount"],

  // Line items
  lineItem: ["items", "lineItems", "line_items", "products", "services", "rows", "entries"],
  itemDescription: ["description", "name", "title", "item", "product", "service"],
  itemDetails: ["details", "notes", "specification", "spec"],

  // People/Organizations
  customer: ["customer", "client", "buyer", "recipient", "to", "billTo", "bill_to"],
  company: ["company", "business", "from", "seller", "vendor", "supplier"],
  contact: ["contact", "contactPerson", "contact_person", "attention", "attn"],

  // Contact info
  email: ["email", "emailAddress", "email_address", "mail"],
  phone: ["phone", "telephone", "tel", "mobile", "cell", "phoneNumber", "phone_number"],
  address: ["address", "street", "location", "addr"],

  // Dates
  date: ["date", "createdAt", "created_at", "issuedAt", "issued_at", "dateCreated"],
  dueDate: ["dueDate", "due_date", "paymentDue", "payment_due", "dueBy", "due_by"],
  validUntil: ["validUntil", "valid_until", "expiresAt", "expires_at", "expiry"],

  // References
  reference: ["number", "ref", "id", "reference", "orderId", "order_id"],
  invoiceNumber: ["invoiceNumber", "invoice_number", "invoiceId", "invoice_id"],
  quoteNumber: ["quoteNumber", "quote_number", "quoteId", "quote_id"],

  // Content
  notes: ["notes", "note", "comments", "remarks", "memo", "message"],
  terms: ["terms", "conditions", "termsAndConditions", "terms_and_conditions"],
  signature: ["signature", "signedBy", "signed_by", "approvedBy", "approved_by"],

  // Branding
  logo: ["logo", "logoUrl", "logo_url", "brandImage", "brand_image"],
  companyName: ["companyName", "company_name", "businessName", "business_name", "organization"],
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Flatten a nested object into dot-notation paths
 */
function flattenObject(
  obj: Record<string, unknown>,
  prefix = ""
): Record<string, { value: unknown; path: string }> {
  const result: Record<string, { value: unknown; path: string }> = {};

  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value as Record<string, unknown>, path));
    } else {
      result[path] = { value, path };
    }
  }

  return result;
}

/**
 * Normalize a field name for comparison (lowercase, no separators)
 */
function normalizeFieldName(name: string): string {
  return name.toLowerCase().replace(/[_-]/g, "");
}

/**
 * Convert a path like "customer.billing_address" to "Customer Billing Address"
 */
function pathToHumanName(path: string): string {
  const lastPart = path.split(".").pop() || path;
  return lastPart
    .replace(/([A-Z])/g, " $1") // camelCase to spaces
    .replace(/[_-]/g, " ") // snake_case/kebab-case to spaces
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ")
    .trim();
}

/**
 * Detect the type of a value
 */
function detectFieldType(value: unknown, fieldName: string): FieldType {
  if (Array.isArray(value)) return "array";
  if (value === null || value === undefined) return "string";
  if (typeof value === "object") return "object";

  const strValue = String(value);
  const normalizedName = normalizeFieldName(fieldName);

  // Check for email
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strValue)) return "email";

  // Check for phone (various formats)
  if (/^[\d\s\-\(\)\+\.]{7,20}$/.test(strValue) && /\d{3,}/.test(strValue)) {
    if (["phone", "tel", "mobile", "cell", "fax"].some((p) => normalizedName.includes(p))) {
      return "phone";
    }
  }

  // Check for URL
  if (/^https?:\/\//.test(strValue)) return "url";

  // Check for currency (number with common currency indicators)
  if (typeof value === "number") {
    if (
      ["price", "amount", "total", "cost", "tax", "discount", "subtotal", "fee"].some((p) =>
        normalizedName.includes(p)
      )
    ) {
      return "currency";
    }
    return "number";
  }

  // Check for date patterns
  if (
    /^\d{4}-\d{2}-\d{2}/.test(strValue) ||
    /^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(strValue) ||
    /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(strValue)
  ) {
    return "date";
  }

  return "string";
}

/**
 * Find the semantic role of a field based on its name
 */
function findFieldRole(fieldName: string): string {
  const normalized = normalizeFieldName(fieldName);

  for (const [role, patterns] of Object.entries(FIELD_ROLE_PATTERNS)) {
    for (const pattern of patterns) {
      if (normalized.includes(normalizeFieldName(pattern))) {
        return role;
      }
    }
  }

  return "unknown";
}

/**
 * Categorize a field into a document section
 */
function categorizeField(field: FieldInfo): keyof DataAnalysis["fields"] {
  const headerRoles = ["logo", "companyName", "company", "date"];
  const recipientRoles = ["customer", "contact", "email", "phone", "address"];
  const lineItemRoles = ["lineItem", "itemDescription", "itemDetails", "price", "quantity"];
  const summaryRoles = ["total", "subtotal", "tax", "discount"];
  const metadataRoles = ["reference", "invoiceNumber", "quoteNumber", "dueDate", "validUntil", "notes", "terms"];
  const footerRoles = ["signature", "terms"];

  if (headerRoles.includes(field.role)) return "header";
  if (recipientRoles.includes(field.role)) return "recipient";
  if (lineItemRoles.includes(field.role)) return "lineItems";
  if (summaryRoles.includes(field.role)) return "summary";
  if (footerRoles.includes(field.role)) return "footer";
  if (metadataRoles.includes(field.role)) return "metadata";

  // Default categorization based on field type
  if (field.type === "array") return "lineItems";
  if (field.type === "currency" || field.type === "number") return "summary";

  return "metadata";
}

// ============================================================================
// Heuristic Detection
// ============================================================================

/**
 * Score data against document type patterns
 */
function scoreDocumentType(data: Record<string, unknown>): {
  type: DocumentType;
  score: number;
  indicators: string[];
} {
  const flattened = flattenObject(data);
  const allPaths = Object.keys(flattened);
  const allKeys = allPaths.map((p) => p.split(".").pop()?.toLowerCase() || "");

  const scores: Map<DocumentType, { score: number; indicators: string[] }> = new Map();

  for (const [docType, patterns] of Object.entries(DOCUMENT_PATTERNS)) {
    if (docType === "generic") continue;

    let score = 0;
    const indicators: string[] = [];

    for (const pattern of patterns) {
      const normalizedPattern = normalizeFieldName(pattern);

      // Check if any key matches the pattern
      for (const key of allKeys) {
        if (normalizeFieldName(key).includes(normalizedPattern)) {
          score += 1;
          indicators.push(key);
          break;
        }
      }

      // Also check for the pattern in values (for text-based detection)
      for (const { value } of Object.values(flattened)) {
        if (typeof value === "string" && value.toLowerCase().includes(pattern.toLowerCase())) {
          score += 0.5;
          if (!indicators.includes(`value:${pattern}`)) {
            indicators.push(`value:${pattern}`);
          }
          break;
        }
      }
    }

    scores.set(docType as DocumentType, { score, indicators });
  }

  // Find the highest scoring type
  let bestType: DocumentType = "generic";
  let bestScore = 0;
  let bestIndicators: string[] = [];

  for (const [type, { score, indicators }] of scores) {
    if (score > bestScore) {
      bestType = type;
      bestScore = score;
      bestIndicators = indicators;
    }
  }

  // Normalize score to 0-1 range (max possible is ~15 for the best case)
  const normalizedScore = Math.min(bestScore / 5, 1);

  return {
    type: bestType,
    score: normalizedScore,
    indicators: bestIndicators,
  };
}

/**
 * Extract and categorize all fields from data
 */
function extractFields(data: Record<string, unknown>): DataAnalysis["fields"] {
  const fields: DataAnalysis["fields"] = {
    header: [],
    recipient: [],
    lineItems: [],
    summary: [],
    metadata: [],
    footer: [],
  };

  const flattened = flattenObject(data);

  for (const [path, { value }] of Object.entries(flattened)) {
    const fieldName = path.split(".").pop() || path;
    const fieldType = detectFieldType(value, fieldName);
    const role = findFieldRole(fieldName);

    const fieldInfo: FieldInfo = {
      path,
      name: pathToHumanName(path),
      type: fieldType,
      role,
      displayFormat:
        fieldType === "currency"
          ? "currency"
          : fieldType === "date"
            ? "date"
            : undefined,
    };

    const category = categorizeField(fieldInfo);
    fields[category].push(fieldInfo);
  }

  // Handle array fields specially (look for line items patterns)
  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value) && value.length > 0 && typeof value[0] === "object") {
      const role = findFieldRole(key);
      const fieldInfo: FieldInfo = {
        path: key,
        name: pathToHumanName(key),
        type: "array",
        role: role === "unknown" ? "lineItem" : role,
      };

      // Add to lineItems if it looks like items
      if (!fields.lineItems.some((f) => f.path === key)) {
        fields.lineItems.push(fieldInfo);
      }

      // Also extract fields from array items
      const firstItem = value[0] as Record<string, unknown>;
      for (const [itemKey, itemValue] of Object.entries(firstItem)) {
        const itemPath = `${key}[].${itemKey}`;
        const itemFieldType = detectFieldType(itemValue, itemKey);
        const itemRole = findFieldRole(itemKey);

        fields.lineItems.push({
          path: itemPath,
          name: pathToHumanName(itemKey),
          type: itemFieldType,
          role: itemRole === "unknown" ? "itemDescription" : itemRole,
          displayFormat:
            itemFieldType === "currency"
              ? "currency"
              : itemFieldType === "date"
                ? "date"
                : undefined,
        });
      }
    }
  }

  return fields;
}

/**
 * Infer layout decisions based on data structure
 */
function inferLayout(
  data: Record<string, unknown>,
  fields: DataAnalysis["fields"]
): DataAnalysis["layout"] {
  const flattened = flattenObject(data);
  const allPaths = Object.keys(flattened);

  // Check for logo
  const hasLogo = allPaths.some(
    (p) => normalizeFieldName(p).includes("logo") || normalizeFieldName(p).includes("image")
  );

  // Check for signature
  const hasSignature = allPaths.some(
    (p) =>
      normalizeFieldName(p).includes("signature") || normalizeFieldName(p).includes("signed")
  );

  // Determine header style
  let headerStyle: DataAnalysis["layout"]["headerStyle"] = "split";
  if (hasLogo) {
    headerStyle = "logo-left";
  } else if (fields.header.length <= 2) {
    headerStyle = "centered";
  }

  // Determine content style based on line items
  let contentStyle: DataAnalysis["layout"]["contentStyle"] = "table";
  if (fields.lineItems.length === 0) {
    contentStyle = "sections";
  } else if (fields.lineItems.length <= 3) {
    contentStyle = "list";
  }

  // Summary style
  const summaryStyle: DataAnalysis["layout"]["summaryStyle"] =
    fields.summary.length > 3 ? "right-aligned" : "inline";

  return {
    headerStyle,
    contentStyle,
    summaryStyle,
    hasSignature,
    hasLogo,
  };
}

/**
 * Infer styling hints based on document type and data
 */
function inferStyling(
  documentType: DocumentType,
  _data: Record<string, unknown>
): DataAnalysis["styling"] {
  // Map document types to suggested styles
  const styleMap: Record<DocumentType, DataAnalysis["styling"]["suggestedStyle"]> = {
    invoice: "stripe-clean",
    receipt: "minimal",
    quote: "stripe-clean",
    report: "corporate",
    certificate: "bold",
    letter: "minimal",
    generic: "stripe-clean",
  };

  return {
    suggestedStyle: styleMap[documentType],
    // Could extract colors from logo or branding fields in the future
    accentColor: undefined,
    fontSuggestion: undefined,
  };
}

// ============================================================================
// AI-Powered Analysis
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
 * Use Claude to analyze ambiguous data structures
 */
async function aiAnalyzeData(
  data: Record<string, unknown>,
  intent?: string
): Promise<Partial<DataAnalysis>> {
  const prompt = `Analyze this JSON data structure to determine:
1. What type of document it represents (invoice, receipt, quote, report, certificate, letter, or generic)
2. The semantic role of each field
3. Suggested layout approach

Data:
\`\`\`json
${JSON.stringify(data, null, 2)}
\`\`\`

${intent ? `User intent: "${intent}"` : ""}

Respond in JSON format:
{
  "documentType": "invoice|receipt|quote|report|certificate|letter|generic",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation",
  "fieldRoles": {
    "path.to.field": "semantic_role"
  },
  "layout": {
    "headerStyle": "centered|split|logo-left",
    "contentStyle": "table|list|cards|sections",
    "summaryStyle": "right-aligned|centered|inline"
  },
  "styling": {
    "suggestedStyle": "stripe-clean|bold|minimal|corporate",
    "accentColor": "#hex or null",
    "fontSuggestion": "font name or null"
  }
}`;

  try {
    const message = await getAnthropic().messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 1024,
      system:
        "You are a document structure analyst. Analyze JSON data and determine what type of business document it represents. Be precise and return valid JSON.",
      messages: [{ role: "user", content: prompt }],
    });

    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";

    // Extract JSON from response (handle potential markdown code blocks)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("[DataAnalyzer] Could not extract JSON from AI response");
      return {};
    }

    const aiResult = JSON.parse(jsonMatch[0]);
    return {
      documentType: aiResult.documentType as DocumentType,
      confidence: aiResult.confidence,
      layout: aiResult.layout,
      styling: aiResult.styling,
    };
  } catch (error) {
    console.error("[DataAnalyzer] AI analysis failed:", error);
    return {};
  }
}

// ============================================================================
// Main Export
// ============================================================================

/**
 * Analyze data structure to determine document type, field roles, and layout
 *
 * Uses fast heuristic detection first. If confidence is below threshold (0.7),
 * falls back to AI-powered analysis for more accurate results.
 */
export async function analyzeData(
  data: Record<string, unknown>,
  intent?: string
): Promise<DataAnalysis> {
  // Validate input
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return {
      documentType: "generic",
      confidence: 0,
      fields: {
        header: [],
        recipient: [],
        lineItems: [],
        summary: [],
        metadata: [],
        footer: [],
      },
      layout: {
        headerStyle: "split",
        contentStyle: "table",
        summaryStyle: "right-aligned",
        hasSignature: false,
        hasLogo: false,
      },
      styling: {
        suggestedStyle: "stripe-clean",
      },
    };
  }

  // Step 1: Fast heuristic detection
  const typeScore = scoreDocumentType(data);
  const fields = extractFields(data);
  const layout = inferLayout(data, fields);
  const styling = inferStyling(typeScore.type, data);

  console.log(
    `[DataAnalyzer] Heuristic result: ${typeScore.type} (confidence: ${typeScore.score.toFixed(2)})`
  );

  // Step 2: If confidence is low, use AI for deeper analysis
  const AI_THRESHOLD = 0.7;
  let finalResult: DataAnalysis = {
    documentType: typeScore.type,
    confidence: typeScore.score,
    fields,
    layout,
    styling,
  };

  if (typeScore.score < AI_THRESHOLD && process.env.ANTHROPIC_API_KEY) {
    console.log(
      `[DataAnalyzer] Low confidence (${typeScore.score.toFixed(2)}), using AI analysis...`
    );

    const aiResult = await aiAnalyzeData(data, intent);

    if (aiResult.documentType && aiResult.confidence) {
      // Merge AI results with heuristic results
      finalResult = {
        ...finalResult,
        documentType: aiResult.documentType,
        confidence: aiResult.confidence,
        layout: aiResult.layout || finalResult.layout,
        styling: aiResult.styling || finalResult.styling,
      };

      console.log(
        `[DataAnalyzer] AI result: ${aiResult.documentType} (confidence: ${aiResult.confidence})`
      );
    }
  }

  return finalResult;
}

/**
 * Quick document type check without full analysis
 * Useful for routing decisions
 */
export function quickDetectType(data: Record<string, unknown>): {
  type: DocumentType;
  confidence: number;
} {
  const result = scoreDocumentType(data);
  return {
    type: result.type,
    confidence: result.score,
  };
}

/**
 * Get display format recommendations for a field type
 */
export function getDisplayFormat(fieldType: FieldType): string | undefined {
  switch (fieldType) {
    case "currency":
      return "$0,0.00";
    case "date":
      return "MMM D, YYYY";
    case "phone":
      return "(###) ###-####";
    default:
      return undefined;
  }
}

export default {
  analyzeData,
  quickDetectType,
  getDisplayFormat,
};
