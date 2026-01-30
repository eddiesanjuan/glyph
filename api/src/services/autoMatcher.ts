/**
 * Auto-Matcher Service
 * Intelligently matches data sources to templates based on schema analysis
 *
 * When a user creates a new data source, this service suggests the best
 * matching templates from both built-in and user-saved templates.
 */

import { getSupabase, supabase } from '../lib/supabase.js';

// =============================================================================
// Types
// =============================================================================

interface DiscoveredSchema {
  fields: Array<{
    name: string;
    path: string;
    type: string;
    sample_value?: unknown;
  }>;
  record_count?: number;
}

interface MatchResult {
  templateId: string;
  templateName: string;
  isBuiltIn: boolean;
  confidence: number;
  fieldCoverage: number;
  reasoning: string;
  suggestedMappings: Array<{
    templateField: string;
    sourceField: string;
  }>;
}

interface AutoMatcherOptions {
  includeBuiltIn?: boolean;
  minConfidence?: number;
  maxResults?: number;
}

interface TemplateInfo {
  id: string;
  name: string;
  category: string;
  fields: string[];
}

// =============================================================================
// Built-in Template Catalog
// =============================================================================

/**
 * Get list of built-in templates with their expected fields
 * This should match the TEMPLATE_CATALOG in templates.ts
 */
function getBuiltInTemplateList(): TemplateInfo[] {
  return [
    {
      id: 'quote-modern',
      name: 'Modern Quote',
      category: 'quote',
      fields: ['company_name', 'customer_name', 'quote_number', 'date', 'valid_until', 'line_items', 'subtotal', 'tax', 'total', 'terms'],
    },
    {
      id: 'quote-bold',
      name: 'Bold Quote',
      category: 'quote',
      fields: ['company_name', 'customer_name', 'quote_number', 'date', 'valid_until', 'line_items', 'subtotal', 'total', 'branding'],
    },
    {
      id: 'quote-professional',
      name: 'Professional Quote',
      category: 'quote',
      fields: ['company_name', 'customer_name', 'quote_number', 'date', 'valid_until', 'line_items', 'subtotal', 'total'],
    },
    {
      id: 'invoice-clean',
      name: 'Clean Invoice',
      category: 'invoice',
      fields: ['company_name', 'customer_name', 'invoice_number', 'date', 'due_date', 'line_items', 'subtotal', 'tax', 'total', 'payment_terms'],
    },
    {
      id: 'receipt-minimal',
      name: 'Minimal Receipt',
      category: 'receipt',
      fields: ['business_name', 'date', 'items', 'subtotal', 'tax', 'total', 'payment_method'],
    },
    {
      id: 'contract-simple',
      name: 'Simple Contract',
      category: 'contract',
      fields: ['title', 'party_a', 'party_b', 'effective_date', 'terms', 'signatures'],
    },
    {
      id: 'certificate-modern',
      name: 'Modern Certificate',
      category: 'certificate',
      fields: ['recipient_name', 'achievement', 'date', 'issuer', 'signature', 'organization'],
    },
    {
      id: 'shipping-label',
      name: 'Shipping Label',
      category: 'shipping',
      fields: ['sender', 'recipient', 'tracking_number', 'carrier', 'weight', 'service_type'],
    },
    {
      id: 'report-cover',
      name: 'Report Cover Page',
      category: 'report',
      fields: ['title', 'subtitle', 'author', 'date', 'organization'],
    },
    {
      id: 'work-order',
      name: 'Work Order',
      category: 'service',
      fields: ['work_order_number', 'customer_name', 'description', 'materials', 'labor_hours', 'scheduled_date', 'technician_name', 'priority'],
    },
    {
      id: 'purchase-order',
      name: 'Purchase Order',
      category: 'purchase-order',
      fields: ['po_number', 'date', 'vendor', 'buyer', 'items', 'subtotal', 'shipping', 'tax', 'total'],
    },
    {
      id: 'letter-business',
      name: 'Business Letter',
      category: 'letter',
      fields: ['sender_name', 'sender_company', 'recipient_name', 'recipient_company', 'date', 'subject', 'body'],
    },
    {
      id: 'proposal-basic',
      name: 'Basic Proposal',
      category: 'proposal',
      fields: ['title', 'client', 'deliverables', 'timeline', 'pricing', 'terms'],
    },
    {
      id: 'resume',
      name: 'Professional Resume',
      category: 'other',
      fields: ['name', 'title', 'email', 'phone', 'summary', 'experience', 'education', 'skills'],
    },
    {
      id: 'statement-of-work',
      name: 'Statement of Work',
      category: 'legal',
      fields: ['project_name', 'client_name', 'contractor_name', 'scope_of_work', 'deliverables', 'timeline_start', 'timeline_end', 'payment_terms', 'total_amount'],
    },
    {
      id: 'nda',
      name: 'Non-Disclosure Agreement',
      category: 'legal',
      fields: ['party_a_name', 'party_b_name', 'effective_date', 'confidential_info_description', 'term_years', 'governing_law'],
    },
    {
      id: 'packing-slip',
      name: 'Packing Slip',
      category: 'shipping',
      fields: ['order_number', 'order_date', 'ship_to', 'ship_from', 'items', 'tracking_number'],
    },
    {
      id: 'menu',
      name: 'Restaurant Menu',
      category: 'other',
      fields: ['restaurant_name', 'sections', 'items'],
    },
    {
      id: 'event-ticket',
      name: 'Event Ticket',
      category: 'other',
      fields: ['event_name', 'date', 'time', 'venue', 'seat_section', 'seat_row', 'seat_number', 'ticket_holder_name'],
    },
  ];
}

// =============================================================================
// Core Matching Logic
// =============================================================================

/**
 * Find best matching templates for a data source schema
 */
export async function findMatchingTemplates(
  sourceSchema: DiscoveredSchema,
  apiKeyId: string | null,
  options: AutoMatcherOptions = {}
): Promise<MatchResult[]> {
  const {
    includeBuiltIn = true,
    minConfidence = 0.3,
    maxResults = 5,
  } = options;

  const results: MatchResult[] = [];

  // 1. Detect document type from field names
  const docType = detectDocumentType(sourceSchema);

  // 2. Score built-in templates
  if (includeBuiltIn) {
    const builtInTemplates = getBuiltInTemplateList();

    for (const template of builtInTemplates) {
      const score = scoreTemplate(template, sourceSchema, docType);
      if (score.confidence >= minConfidence) {
        results.push({
          templateId: template.id,
          templateName: template.name,
          isBuiltIn: true,
          confidence: score.confidence,
          fieldCoverage: score.fieldCoverage,
          reasoning: score.reasoning,
          suggestedMappings: score.mappings,
        });
      }
    }
  }

  // 3. Score user's saved templates (if apiKeyId provided and database is available)
  if (apiKeyId && supabase) {
    try {
      const { data: savedTemplates } = await getSupabase()
        .from('templates')
        .select('id, name, schema')
        .eq('api_key_id', apiKeyId)
        .is('deleted_at', null);

      if (savedTemplates) {
        for (const template of savedTemplates) {
          const score = scoreTemplate(
            {
              id: template.id,
              name: template.name,
              category: 'custom',
              fields: extractFieldsFromSchema(template.schema),
            },
            sourceSchema,
            docType
          );
          if (score.confidence >= minConfidence) {
            results.push({
              templateId: template.id,
              templateName: template.name,
              isBuiltIn: false,
              confidence: score.confidence,
              fieldCoverage: score.fieldCoverage,
              reasoning: score.reasoning,
              suggestedMappings: score.mappings,
            });
          }
        }
      }
    } catch (err) {
      console.warn('[AutoMatcher] Failed to fetch saved templates:', err);
      // Non-fatal, continue with built-in templates only
    }
  }

  // 4. Sort by confidence and return top N
  return results
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, maxResults);
}

/**
 * Detect document type from schema field names
 */
function detectDocumentType(schema: DiscoveredSchema): { type: string; confidence: number } {
  const fieldNames = schema.fields.map((f) => f.name.toLowerCase()).join(' ');

  const patterns: Array<{ type: string; keywords: string[]; weight: number }> = [
    { type: 'invoice', keywords: ['invoice', 'bill', 'due_date', 'payment', 'subtotal', 'tax', 'total', 'line_items', 'amount_due'], weight: 1 },
    { type: 'quote', keywords: ['quote', 'estimate', 'proposal', 'valid_until', 'terms', 'line_items', 'total', 'quotation'], weight: 1 },
    { type: 'receipt', keywords: ['receipt', 'paid', 'payment_method', 'transaction', 'amount', 'purchase'], weight: 1 },
    { type: 'service', keywords: ['work_order', 'job', 'task', 'assigned', 'status', 'priority', 'due', 'technician', 'service'], weight: 1 },
    { type: 'contract', keywords: ['contract', 'agreement', 'party', 'terms', 'signature', 'effective_date', 'clause'], weight: 1 },
    { type: 'certificate', keywords: ['certificate', 'award', 'recipient', 'issued', 'achievement', 'completion'], weight: 1 },
    { type: 'shipping', keywords: ['shipping', 'tracking', 'carrier', 'destination', 'weight', 'package', 'sender', 'recipient', 'address'], weight: 1 },
    { type: 'report', keywords: ['report', 'summary', 'analysis', 'findings', 'metrics', 'data', 'results'], weight: 1 },
    { type: 'letter', keywords: ['letter', 'dear', 'sincerely', 'subject', 'body', 'salutation', 'closing'], weight: 1 },
    { type: 'proposal', keywords: ['proposal', 'deliverables', 'timeline', 'scope', 'pricing', 'objectives'], weight: 1 },
    { type: 'purchase-order', keywords: ['purchase', 'po_number', 'vendor', 'buyer', 'order', 'requisition'], weight: 1 },
    { type: 'legal', keywords: ['nda', 'disclosure', 'confidential', 'statement_of_work', 'sow', 'legal', 'jurisdiction'], weight: 1 },
  ];

  let bestMatch = { type: 'generic', confidence: 0 };

  for (const pattern of patterns) {
    let matchCount = 0;
    for (const keyword of pattern.keywords) {
      if (fieldNames.includes(keyword)) {
        matchCount++;
      }
    }
    const confidence = (matchCount / pattern.keywords.length) * pattern.weight;
    if (confidence > bestMatch.confidence) {
      bestMatch = { type: pattern.type, confidence };
    }
  }

  return bestMatch;
}

/**
 * Score a template against a source schema
 */
function scoreTemplate(
  template: TemplateInfo,
  sourceSchema: DiscoveredSchema,
  docType: { type: string; confidence: number }
): { confidence: number; fieldCoverage: number; reasoning: string; mappings: Array<{ templateField: string; sourceField: string }> } {
  const sourceFields = sourceSchema.fields.map((f) => f.name.toLowerCase());
  const templateFields = template.fields.map((f) => f.toLowerCase());

  // Field name matching (50% of score)
  let fieldMatches = 0;
  const mappings: Array<{ templateField: string; sourceField: string }> = [];

  for (const tf of templateFields) {
    // Exact match
    const exactMatch = sourceFields.find((sf) => sf === tf);
    if (exactMatch) {
      fieldMatches++;
      mappings.push({ templateField: tf, sourceField: exactMatch });
      continue;
    }

    // Fuzzy match (contains or similar)
    const fuzzyMatch = sourceFields.find(
      (sf) =>
        sf.includes(tf) ||
        tf.includes(sf) ||
        levenshteinSimilarity(sf, tf) > 0.7 ||
        areFieldsSemanticallyRelated(tf, sf)
    );
    if (fuzzyMatch) {
      fieldMatches += 0.7;
      mappings.push({ templateField: tf, sourceField: fuzzyMatch });
    }
  }

  const fieldCoverage = templateFields.length > 0 ? fieldMatches / templateFields.length : 0;

  // Category/type matching (30% of score)
  const categoryMatch =
    template.category === docType.type
      ? 1
      : template.category.includes(docType.type) || docType.type.includes(template.category)
        ? 0.5
        : 0;

  // Template quality bonus (20% of score) - built-in templates get slight bonus for reliability
  const qualityBonus = template.id.startsWith('tpl_') ? 0 : 0.1;

  const confidence = fieldCoverage * 0.5 + categoryMatch * 0.3 * docType.confidence + qualityBonus;

  const reasoning = buildReasoning(template, docType, fieldCoverage, categoryMatch, mappings.length);

  return {
    confidence: Math.min(confidence, 1),
    fieldCoverage,
    reasoning,
    mappings,
  };
}

/**
 * Build human-readable reasoning for a match
 */
function buildReasoning(
  template: TemplateInfo,
  docType: { type: string; confidence: number },
  fieldCoverage: number,
  categoryMatch: number,
  mappingCount: number
): string {
  const parts: string[] = [];

  if (categoryMatch > 0.5) {
    parts.push(`Document type "${docType.type}" matches template category`);
  }

  if (fieldCoverage > 0.7) {
    parts.push(`${Math.round(fieldCoverage * 100)}% of template fields found in source`);
  } else if (fieldCoverage > 0.4) {
    parts.push(`Partial field match (${Math.round(fieldCoverage * 100)}%)`);
  }

  if (mappingCount > 0) {
    parts.push(`${mappingCount} fields can be auto-mapped`);
  }

  return parts.length > 0 ? parts.join('. ') : 'Basic match based on template type';
}

/**
 * Check if two field names are semantically related
 */
function areFieldsSemanticallyRelated(field1: string, field2: string): boolean {
  const synonymGroups = [
    ['customer', 'client', 'buyer', 'purchaser'],
    ['vendor', 'seller', 'supplier', 'merchant'],
    ['total', 'amount', 'sum', 'grand_total'],
    ['date', 'created', 'timestamp', 'created_at', 'created_date'],
    ['name', 'full_name', 'title', 'label'],
    ['company', 'business', 'organization', 'firm'],
    ['address', 'location', 'street', 'addr'],
    ['phone', 'telephone', 'mobile', 'cell'],
    ['email', 'mail', 'e_mail'],
    ['items', 'line_items', 'products', 'services', 'entries'],
    ['description', 'desc', 'details', 'notes'],
    ['number', 'num', 'no', 'id', 'ref', 'reference'],
    ['price', 'rate', 'cost', 'unit_price'],
    ['quantity', 'qty', 'count', 'amount'],
  ];

  const f1 = field1.toLowerCase().replace(/[_\s-]/g, '');
  const f2 = field2.toLowerCase().replace(/[_\s-]/g, '');

  for (const group of synonymGroups) {
    const normalizedGroup = group.map((s) => s.replace(/[_\s-]/g, ''));
    if (normalizedGroup.some((s) => f1.includes(s) || s.includes(f1))) {
      if (normalizedGroup.some((s) => f2.includes(s) || s.includes(f2))) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Simple Levenshtein distance similarity
 */
function levenshteinSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
      }
    }
  }

  const maxLen = Math.max(a.length, b.length);
  return 1 - matrix[b.length][a.length] / maxLen;
}

/**
 * Extract field names from a JSON schema
 */
function extractFieldsFromSchema(schema: unknown): string[] {
  if (!schema) return [];

  try {
    const parsed = typeof schema === 'string' ? JSON.parse(schema) : schema;

    // Handle JSON Schema format
    if (parsed.properties) {
      return Object.keys(parsed.properties);
    }

    // Handle array of field definitions
    if (Array.isArray(parsed)) {
      return parsed
        .map((f: { name?: string; field?: string }) => f.name || f.field || '')
        .filter(Boolean);
    }

    // Handle object with fields array
    if (parsed.fields && Array.isArray(parsed.fields)) {
      return parsed.fields
        .map((f: { name?: string; path?: string }) => f.name || f.path || '')
        .filter(Boolean);
    }
  } catch {
    // Ignore parse errors
  }

  return [];
}

export type { MatchResult, AutoMatcherOptions, DiscoveredSchema };
