/**
 * Schema Detection Service
 * Analyzes arbitrary data structures and maps them to document templates
 *
 * Enables Glyph to "mold to anyone's system instantly and magically"
 */

// ============================================================================
// Types
// ============================================================================

export type DocumentType =
  | 'invoice'
  | 'quote'
  | 'receipt'
  | 'contract'
  | 'resume'
  | 'report'
  | 'letter'
  | 'unknown';

export interface FieldMapping {
  detected: string;      // Field path in source data (e.g., "customer.name")
  mappedTo: string;      // Template field it maps to (e.g., "client.name")
  example: unknown;      // Example value from source
  required: boolean;     // Whether this is a required field
  confidence: number;    // 0-1 confidence in this mapping
}

export interface MissingField {
  field: string;         // Expected template field
  reason: string;        // Why this field is recommended
}

export interface DataAnalysis {
  documentType: DocumentType;
  confidence: number;    // 0-1 overall confidence
  fields: FieldMapping[];
  suggestedTemplate: string;
  missingFields: MissingField[];
  warnings: string[];    // Any issues detected
}

// ============================================================================
// Field Mapping Definitions
// ============================================================================

/**
 * Maps canonical field names to common variations found in user data
 * Key = our template field, Value = array of alternative names
 */
const FIELD_MAPPINGS: Record<string, string[]> = {
  // Client/Customer
  'client': ['customer', 'buyer', 'recipient', 'bill_to', 'client_info', 'billTo', 'customerInfo'],
  'client.name': ['customer_name', 'buyer_name', 'recipient_name', 'name', 'clientName', 'customerName', 'client_name', 'full_name', 'fullName'],
  'client.email': ['customer_email', 'email', 'contact_email', 'customerEmail', 'client_email', 'emailAddress', 'email_address'],
  'client.phone': ['customer_phone', 'phone', 'tel', 'telephone', 'customerPhone', 'client_phone', 'phoneNumber', 'phone_number'],
  'client.address': ['billing_address', 'address', 'street', 'customerAddress', 'client_address', 'billingAddress', 'street_address', 'streetAddress'],
  'client.company': ['customer_company', 'company', 'organization', 'org', 'business', 'companyName', 'company_name'],

  // Line items
  'lineItems': ['items', 'line_items', 'products', 'services', 'entries', 'orderItems', 'order_items', 'details', 'rows'],
  'lineItems.description': ['item_name', 'product_name', 'service', 'desc', 'description', 'name', 'title', 'productName', 'itemName'],
  'lineItems.quantity': ['qty', 'amount', 'count', 'units', 'quantity'],
  'lineItems.price': ['unit_price', 'rate', 'cost', 'price_each', 'unitPrice', 'priceEach', 'price', 'unitCost'],
  'lineItems.total': ['line_total', 'item_total', 'lineTotal', 'itemTotal', 'extended_price', 'extendedPrice'],

  // Totals
  'totals': ['summary', 'total_section', 'amounts', 'pricing', 'calculations'],
  'totals.subtotal': ['sub_total', 'subtotal', 'net_total', 'netTotal', 'subTotal', 'itemsTotal', 'items_total'],
  'totals.tax': ['tax_amount', 'vat', 'gst', 'sales_tax', 'taxAmount', 'salesTax', 'tax'],
  'totals.discount': ['discount_amount', 'savings', 'discountAmount', 'discount'],
  'totals.total': ['grand_total', 'total_amount', 'amount_due', 'balance', 'grandTotal', 'totalAmount', 'amountDue', 'total', 'finalTotal'],

  // Meta information
  'meta': ['info', 'details', 'metadata', 'document_info', 'documentInfo'],
  'meta.number': ['invoice_number', 'quote_number', 'receipt_number', 'id', 'invoiceNumber', 'quoteNumber', 'receiptNumber', 'number', 'documentNumber', 'doc_number', 'reference'],
  'meta.date': ['invoice_date', 'created_at', 'date', 'timestamp', 'invoiceDate', 'createdAt', 'issueDate', 'issue_date', 'documentDate'],
  'meta.dueDate': ['payment_due', 'due_by', 'valid_until', 'dueDate', 'paymentDue', 'validUntil', 'expiresAt', 'expires_at', 'due_date'],
  'meta.terms': ['payment_terms', 'conditions', 'notes', 'paymentTerms', 'terms'],
  'meta.notes': ['notes', 'comments', 'remarks', 'memo', 'description'],

  // Company/Branding
  'branding': ['company', 'seller', 'from', 'vendor', 'business', 'companyInfo', 'company_info'],
  'branding.companyName': ['company', 'business_name', 'seller', 'from', 'companyName', 'businessName', 'seller_name', 'sellerName', 'vendor_name'],
  'branding.logoUrl': ['logo', 'logo_url', 'company_logo', 'logoUrl', 'companyLogo', 'logoImage', 'logo_image'],
  'branding.companyAddress': ['company_address', 'seller_address', 'from_address', 'companyAddress', 'sellerAddress', 'businessAddress'],
  'branding.companyEmail': ['company_email', 'seller_email', 'business_email', 'companyEmail', 'sellerEmail'],
  'branding.companyPhone': ['company_phone', 'seller_phone', 'business_phone', 'companyPhone', 'sellerPhone'],

  // Resume-specific
  'experience': ['work_experience', 'employment', 'jobs', 'workHistory', 'work_history', 'positions'],
  'experience.company': ['employer', 'organization', 'company_name', 'companyName'],
  'experience.title': ['position', 'role', 'job_title', 'jobTitle', 'designation'],
  'experience.dates': ['duration', 'period', 'date_range', 'dateRange', 'from_to', 'startEnd'],
  'education': ['education_history', 'schooling', 'academic', 'qualifications'],
  'skills': ['abilities', 'competencies', 'expertise', 'technologies', 'tech_stack', 'techStack'],
  'contact': ['personal_info', 'personalInfo', 'contact_info', 'contactInfo'],

  // Contract-specific
  'parties': ['signatories', 'participants', 'contractors', 'entities'],
  'effectiveDate': ['start_date', 'effective_from', 'commencement_date', 'startDate'],
  'signatures': ['signature_fields', 'signing', 'signatureBlocks'],

  // Report-specific
  'sections': ['chapters', 'parts', 'content_blocks', 'contentBlocks'],
  'summary': ['abstract', 'executive_summary', 'executiveSummary', 'overview'],
  'author': ['writer', 'prepared_by', 'preparedBy', 'createdBy', 'created_by'],
};

// ============================================================================
// Document Type Detection Heuristics
// ============================================================================

interface DocumentTypeScore {
  type: DocumentType;
  score: number;
  indicators: string[];
}

/**
 * Indicators that suggest a specific document type
 * Each indicator has a weight contribution to the overall score
 */
const DOCUMENT_INDICATORS: Record<DocumentType, { field: string; weight: number; description: string }[]> = {
  invoice: [
    { field: 'lineItems', weight: 0.25, description: 'Has line items array' },
    { field: 'totals.total', weight: 0.2, description: 'Has total amount' },
    { field: 'totals.subtotal', weight: 0.15, description: 'Has subtotal' },
    { field: 'totals.tax', weight: 0.15, description: 'Has tax amount' },
    { field: 'client', weight: 0.15, description: 'Has client info' },
    { field: 'meta.number', weight: 0.1, description: 'Has document number' },
  ],
  quote: [
    { field: 'lineItems', weight: 0.2, description: 'Has line items array' },
    { field: 'totals.total', weight: 0.15, description: 'Has total amount' },
    { field: 'meta.dueDate', weight: 0.3, description: 'Has validity/expiry date' },
    { field: 'client', weight: 0.15, description: 'Has client info' },
    { field: 'totals.discount', weight: 0.1, description: 'Has discount' },
    { field: 'meta.terms', weight: 0.1, description: 'Has terms' },
  ],
  receipt: [
    { field: 'lineItems', weight: 0.15, description: 'Has items purchased' },
    { field: 'totals.total', weight: 0.15, description: 'Has total amount' },
    { field: 'meta.date', weight: 0.15, description: 'Has transaction date' },
    { field: 'meta.number', weight: 0.15, description: 'Has transaction ID' },
    { field: 'paymentMethod', weight: 0.4, description: 'Has payment method (key receipt indicator)' },
  ],
  contract: [
    { field: 'parties', weight: 0.3, description: 'Has parties array' },
    { field: 'effectiveDate', weight: 0.25, description: 'Has effective date' },
    { field: 'meta.terms', weight: 0.2, description: 'Has terms and conditions' },
    { field: 'signatures', weight: 0.25, description: 'Has signature fields' },
  ],
  resume: [
    { field: 'experience', weight: 0.3, description: 'Has work experience array' },
    { field: 'education', weight: 0.25, description: 'Has education array' },
    { field: 'skills', weight: 0.25, description: 'Has skills array' },
    { field: 'contact', weight: 0.2, description: 'Has contact info' },
  ],
  report: [
    { field: 'sections', weight: 0.3, description: 'Has sections array' },
    { field: 'summary', weight: 0.25, description: 'Has summary/abstract' },
    { field: 'author', weight: 0.2, description: 'Has author info' },
    { field: 'meta.date', weight: 0.15, description: 'Has date' },
    { field: 'meta.title', weight: 0.1, description: 'Has title' },
  ],
  letter: [
    { field: 'client', weight: 0.3, description: 'Has recipient info' },
    { field: 'branding', weight: 0.25, description: 'Has sender info' },
    { field: 'meta.date', weight: 0.2, description: 'Has date' },
    { field: 'body', weight: 0.15, description: 'Has body content' },
    { field: 'subject', weight: 0.1, description: 'Has subject line' },
  ],
  unknown: [],
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Flatten a nested object into dot-notation paths
 * Example: { client: { name: 'John' } } => { 'client.name': 'John' }
 */
function flattenObject(obj: Record<string, unknown>, prefix = ''): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      // Recursively flatten nested objects
      Object.assign(result, flattenObject(value as Record<string, unknown>, path));
    } else {
      result[path] = value;
    }
  }

  return result;
}

/**
 * Get a nested value from an object using dot notation
 */
function getNestedValue(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Set a nested value in an object using dot notation
 */
function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current) || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }

  current[parts[parts.length - 1]] = value;
}

/**
 * Normalize a field name for comparison
 * Removes underscores, camelCase variations, etc.
 */
function normalizeFieldName(name: string): string {
  return name
    .toLowerCase()
    .replace(/_/g, '')
    .replace(/-/g, '');
}

/**
 * Check if a field name matches any of the variations
 */
function matchesField(fieldName: string, variations: string[]): boolean {
  const normalized = normalizeFieldName(fieldName);
  return variations.some(v => normalizeFieldName(v) === normalized);
}

/**
 * Find the canonical field name for a detected field
 */
function findCanonicalField(detectedField: string): { canonical: string; confidence: number } | null {
  const fieldParts = detectedField.split('.');
  const lastPart = fieldParts[fieldParts.length - 1];

  // Try to match the full path first, then just the last part
  for (const [canonical, variations] of Object.entries(FIELD_MAPPINGS)) {
    // Exact match on full path
    if (matchesField(detectedField, variations)) {
      return { canonical, confidence: 1.0 };
    }

    // Match on last part (with lower confidence)
    if (matchesField(lastPart, variations)) {
      return { canonical, confidence: 0.8 };
    }
  }

  return null;
}

/**
 * Check if a value looks like a specific type
 */
function looksLikeArray(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

function looksLikeLineItems(value: unknown): boolean {
  if (!looksLikeArray(value)) return false;
  const arr = value as unknown[];

  // Check if items have quantity/price-like fields
  return arr.some(item => {
    if (typeof item !== 'object' || item === null) return false;
    const keys = Object.keys(item).map(k => normalizeFieldName(k));
    return (
      keys.some(k => ['quantity', 'qty', 'amount', 'count'].includes(k)) ||
      keys.some(k => ['price', 'unitprice', 'rate', 'cost'].includes(k))
    );
  });
}

function looksLikeExperience(value: unknown): boolean {
  if (!looksLikeArray(value)) return false;
  const arr = value as unknown[];

  return arr.some(item => {
    if (typeof item !== 'object' || item === null) return false;
    const keys = Object.keys(item).map(k => normalizeFieldName(k));
    return (
      keys.some(k => ['company', 'employer', 'organization'].includes(k)) ||
      keys.some(k => ['title', 'position', 'role'].includes(k))
    );
  });
}

function looksLikeEducation(value: unknown): boolean {
  if (!looksLikeArray(value)) return false;
  const arr = value as unknown[];

  return arr.some(item => {
    if (typeof item !== 'object' || item === null) return false;
    const keys = Object.keys(item).map(k => normalizeFieldName(k));
    return (
      keys.some(k => ['school', 'university', 'institution', 'degree'].includes(k))
    );
  });
}

function looksLikeParties(value: unknown): boolean {
  if (!looksLikeArray(value)) return false;
  const arr = value as unknown[];

  return arr.some(item => {
    if (typeof item !== 'object' || item === null) return false;
    const keys = Object.keys(item).map(k => normalizeFieldName(k));
    return (
      keys.some(k => ['name', 'party', 'entity', 'organization'].includes(k)) &&
      keys.some(k => ['role', 'type', 'designation'].includes(k))
    );
  });
}

// ============================================================================
// Main Detection Logic
// ============================================================================

/**
 * Detect which template fields exist in the source data
 */
function detectFields(data: Record<string, unknown>): FieldMapping[] {
  const flattened = flattenObject(data);
  const mappings: FieldMapping[] = [];
  const mappedCanonicals = new Set<string>();

  // First pass: map all detected fields
  for (const [path, value] of Object.entries(flattened)) {
    const match = findCanonicalField(path);

    if (match && !mappedCanonicals.has(match.canonical)) {
      mappings.push({
        detected: path,
        mappedTo: match.canonical,
        example: value,
        required: isRequiredField(match.canonical),
        confidence: match.confidence,
      });
      mappedCanonicals.add(match.canonical);
    }
  }

  // Second pass: check for arrays that need special handling
  for (const [key, value] of Object.entries(data)) {
    // Check for line items array
    if (looksLikeLineItems(value) && !mappedCanonicals.has('lineItems')) {
      const arr = value as Record<string, unknown>[];
      mappings.push({
        detected: key,
        mappedTo: 'lineItems',
        example: arr.slice(0, 2),
        required: true,
        confidence: 0.9,
      });
      mappedCanonicals.add('lineItems');

      // Also map the item fields
      if (arr.length > 0) {
        const itemFields = flattenObject(arr[0]);
        for (const [itemPath, itemValue] of Object.entries(itemFields)) {
          const itemMatch = findCanonicalField(`lineItems.${itemPath}`);
          if (itemMatch && !mappedCanonicals.has(itemMatch.canonical)) {
            mappings.push({
              detected: `${key}[].${itemPath}`,
              mappedTo: itemMatch.canonical,
              example: itemValue,
              required: false,
              confidence: itemMatch.confidence * 0.9,
            });
          }
        }
      }
    }

    // Check for experience array (resume)
    if (looksLikeExperience(value) && !mappedCanonicals.has('experience')) {
      mappings.push({
        detected: key,
        mappedTo: 'experience',
        example: (value as unknown[]).slice(0, 2),
        required: true,
        confidence: 0.9,
      });
      mappedCanonicals.add('experience');
    }

    // Check for education array (resume)
    if (looksLikeEducation(value) && !mappedCanonicals.has('education')) {
      mappings.push({
        detected: key,
        mappedTo: 'education',
        example: (value as unknown[]).slice(0, 2),
        required: true,
        confidence: 0.9,
      });
      mappedCanonicals.add('education');
    }

    // Check for parties array (contract)
    if (looksLikeParties(value) && !mappedCanonicals.has('parties')) {
      mappings.push({
        detected: key,
        mappedTo: 'parties',
        example: (value as unknown[]).slice(0, 2),
        required: true,
        confidence: 0.9,
      });
      mappedCanonicals.add('parties');
    }
  }

  return mappings.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Check if a field is required for templates
 */
function isRequiredField(canonicalField: string): boolean {
  const required = [
    'client.name',
    'lineItems',
    'totals.total',
  ];
  return required.includes(canonicalField);
}

/**
 * Score data against document type indicators
 */
function scoreDocumentType(_data: Record<string, unknown>, mappings: FieldMapping[]): DocumentTypeScore[] {
  const scores: DocumentTypeScore[] = [];
  const mappedFields = new Set(mappings.map(m => m.mappedTo));

  for (const [type, indicators] of Object.entries(DOCUMENT_INDICATORS)) {
    if (type === 'unknown') continue;

    let score = 0;
    const matchedIndicators: string[] = [];

    for (const indicator of indicators) {
      // Check if we have a mapping for this field
      const hasField = mappedFields.has(indicator.field) ||
        Array.from(mappedFields).some(f => f.startsWith(indicator.field));

      if (hasField) {
        score += indicator.weight;
        matchedIndicators.push(indicator.description);
      }
    }

    scores.push({
      type: type as DocumentType,
      score,
      indicators: matchedIndicators,
    });
  }

  return scores.sort((a, b) => b.score - a.score);
}

/**
 * Get recommended fields that are missing
 */
function getMissingFields(documentType: DocumentType, mappings: FieldMapping[]): MissingField[] {
  const missing: MissingField[] = [];
  const mappedFields = new Set(mappings.map(m => m.mappedTo));

  // Required fields by document type
  const requiredByType: Record<DocumentType, { field: string; reason: string }[]> = {
    invoice: [
      { field: 'client.name', reason: 'Customer name is required for invoices' },
      { field: 'lineItems', reason: 'Line items are needed to show what was purchased' },
      { field: 'totals.total', reason: 'Total amount is essential for payment' },
      { field: 'meta.number', reason: 'Invoice number helps with tracking' },
      { field: 'meta.date', reason: 'Issue date is important for records' },
    ],
    quote: [
      { field: 'client.name', reason: 'Client name is needed for quotes' },
      { field: 'lineItems', reason: 'Line items show what is being quoted' },
      { field: 'totals.total', reason: 'Total amount is needed for the quote' },
      { field: 'meta.dueDate', reason: 'Quote validity date helps set expectations' },
    ],
    receipt: [
      { field: 'lineItems', reason: 'Items purchased should be listed' },
      { field: 'totals.total', reason: 'Total amount paid is required' },
      { field: 'meta.date', reason: 'Transaction date is important' },
    ],
    contract: [
      { field: 'parties', reason: 'Contract parties must be identified' },
      { field: 'effectiveDate', reason: 'Contract start date is required' },
      { field: 'meta.terms', reason: 'Terms and conditions are essential' },
    ],
    resume: [
      { field: 'contact', reason: 'Contact information is essential' },
      { field: 'experience', reason: 'Work experience is typically expected' },
    ],
    report: [
      { field: 'summary', reason: 'Executive summary is helpful' },
      { field: 'author', reason: 'Author attribution is recommended' },
    ],
    letter: [
      { field: 'client', reason: 'Recipient information is needed' },
      { field: 'branding', reason: 'Sender information is required' },
    ],
    unknown: [],
  };

  const required = requiredByType[documentType] || [];

  for (const req of required) {
    if (!mappedFields.has(req.field)) {
      missing.push(req);
    }
  }

  return missing;
}

/**
 * Map template name based on document type
 */
function suggestTemplate(documentType: DocumentType): string {
  const templateMap: Record<DocumentType, string> = {
    invoice: 'quote-modern',      // Use quote template for invoices too
    quote: 'quote-modern',
    receipt: 'quote-modern',      // Receipts can use same structure
    contract: 'quote-professional', // More formal style
    resume: 'quote-modern',       // Would need a resume template
    report: 'quote-modern',       // Would need a report template
    letter: 'quote-modern',       // Would need a letter template
    unknown: 'quote-modern',
  };

  return templateMap[documentType];
}

// ============================================================================
// Main Export: analyzeData
// ============================================================================

/**
 * Analyze arbitrary data and detect document type and field mappings
 */
export async function analyzeData(data: unknown): Promise<DataAnalysis> {
  // Validate input
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {
      documentType: 'unknown',
      confidence: 0,
      fields: [],
      suggestedTemplate: 'quote-modern',
      missingFields: [],
      warnings: ['Input must be a non-null object'],
    };
  }

  const dataObj = data as Record<string, unknown>;
  const warnings: string[] = [];

  // Step 1: Detect field mappings
  const fields = detectFields(dataObj);

  if (fields.length === 0) {
    warnings.push('No recognizable fields detected in the data');
  }

  // Step 2: Score against document types
  const typeScores = scoreDocumentType(dataObj, fields);
  const topScore = typeScores[0];

  // Determine document type and confidence
  let documentType: DocumentType = 'unknown';
  let confidence = 0;

  if (topScore && topScore.score >= 0.4) {
    documentType = topScore.type;
    confidence = Math.min(topScore.score, 1);
  } else if (topScore && topScore.score >= 0.2) {
    documentType = topScore.type;
    confidence = topScore.score;
    warnings.push(`Low confidence detection - only matched: ${topScore.indicators.join(', ')}`);
  } else {
    warnings.push('Could not determine document type with confidence');
  }

  // Step 3: Get missing fields
  const missingFields = getMissingFields(documentType, fields);

  // Step 4: Suggest template
  const suggestedTemplate = suggestTemplate(documentType);

  return {
    documentType,
    confidence,
    fields,
    suggestedTemplate,
    missingFields,
    warnings,
  };
}

// ============================================================================
// Transform Data to Template Schema
// ============================================================================

/**
 * Transform user's data structure to our template schema
 */
export function transformToSchema(
  data: Record<string, unknown>,
  mappings: FieldMapping[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const mapping of mappings) {
    // Handle array notations like "items[].description"
    let sourcePath = mapping.detected;
    if (sourcePath.includes('[]')) {
      // This is an array item field, handled separately
      continue;
    }

    const value = getNestedValue(data, sourcePath);
    if (value !== undefined) {
      setNestedValue(result, mapping.mappedTo, value);
    }
  }

  // Handle array transformations (lineItems, etc.)
  const arrayMappings = mappings.filter(m =>
    m.mappedTo === 'lineItems' ||
    m.mappedTo === 'experience' ||
    m.mappedTo === 'education' ||
    m.mappedTo === 'parties'
  );

  for (const arrayMapping of arrayMappings) {
    const sourceArray = getNestedValue(data, arrayMapping.detected);
    if (Array.isArray(sourceArray)) {
      // Find child mappings for this array
      const childMappings = mappings.filter(m =>
        m.detected.startsWith(`${arrayMapping.detected}[].`)
      );

      // Transform each item
      const transformedArray = sourceArray.map((item: unknown) => {
        if (typeof item !== 'object' || item === null) return item;

        const transformedItem: Record<string, unknown> = {};
        const itemObj = item as Record<string, unknown>;

        for (const childMapping of childMappings) {
          // Extract the child field name
          const childPath = childMapping.detected.replace(`${arrayMapping.detected}[].`, '');
          const targetPath = childMapping.mappedTo.replace(`${arrayMapping.mappedTo}.`, '');

          const value = getNestedValue(itemObj, childPath);
          if (value !== undefined) {
            transformedItem[targetPath] = value;
          }
        }

        // Also copy any unmapped fields
        for (const [key, value] of Object.entries(itemObj)) {
          if (!(key in transformedItem)) {
            transformedItem[key] = value;
          }
        }

        return transformedItem;
      });

      setNestedValue(result, arrayMapping.mappedTo, transformedArray);
    }
  }

  return result;
}

// ============================================================================
// Export singleton for convenience
// ============================================================================

export const schemaDetection = {
  analyzeData,
  transformToSchema,
  flattenObject,
  getNestedValue,
  setNestedValue,
};

export default schemaDetection;
