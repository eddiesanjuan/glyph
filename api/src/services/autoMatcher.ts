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
export function detectDocumentType(schema: DiscoveredSchema): { type: string; confidence: number } {
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
  _template: TemplateInfo,
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

// =============================================================================
// Domain-Specific Synonym Groups for Field Matching
// =============================================================================

/**
 * Expanded synonym groups for domain-specific field matching.
 * These cover common variations found in business documents, especially
 * for service businesses like E.F. San Juan (HVAC, plumbing, etc.)
 */
const DOMAIN_SYNONYMS: Record<string, string[]> = {
  // Work order / Job specific
  workOrderNumber: [
    'work_order_number', 'wo_number', 'job_number', 'job', 'job_no', 'job_#', 'wo',
    'work_order', 'order_number', 'ticket', 'ticket_number', 'service_order',
    'service_ticket', 'job_id', 'wo_id', 'work_order_id', 'order_no', 'order_id',
    'fwo', 'fwo_#', 'fwo_number', 'field_work_order'  // E.F. San Juan specific
  ],

  // Customer/Client
  customerName: [
    'customer_name', 'customer', 'client', 'client_name', 'account', 'account_name',
    'buyer', 'purchaser', 'contact', 'contact_name', 'bill_to', 'bill_to_name',
    'customer_contact', 'client_contact', 'account_holder'
  ],

  // Address variations
  address: [
    'address', 'customer_address', 'site_address', 'service_address', 'location',
    'street', 'street_address', 'site', 'job_site', 'work_location', 'job_location',
    'service_location', 'property_address', 'shipping_address', 'billing_address',
    'ship_to', 'bill_to_address', 'delivery_address', 'install_address',
    'site_location'  // E.F. San Juan specific
  ],

  // Phone variations
  phone: [
    'phone', 'contact_phone', 'phone_number', 'tel', 'telephone', 'mobile', 'cell',
    'cell_phone', 'mobile_phone', 'contact_number', 'primary_phone', 'main_phone',
    'work_phone', 'home_phone', 'phone_no', 'phone_#'
  ],

  // Email variations
  email: [
    'email', 'e_mail', 'email_address', 'contact_email', 'customer_email',
    'client_email', 'mail', 'e-mail'
  ],

  // Description/Scope of work
  description: [
    'description', 'work_description', 'scope', 'details', 'notes', 'job_description',
    'work_details', 'summary', 'scope_of_work', 'job_notes', 'service_description',
    'task_description', 'work_summary', 'project_description', 'job_details',
    'service_notes', 'work_notes', 'comments', 'remarks',
    'scope_of_work'  // Ensure exact match
  ],

  // People/Assignment - Technicians
  technician: [
    'technician', 'technician_name', 'tech', 'assigned_tech', 'assigned_to',
    'worker', 'employee', 'staff', 'installer', 'service_tech', 'field_tech',
    'tech_name', 'assigned_technician', 'service_technician', 'crew', 'crew_member',
    'installer_name', 'mechanic', 'specialist', 'engineer', 'rep', 'representative'
  ],

  // Date variations
  scheduledDate: [
    'scheduled_date', 'date', 'job_date', 'service_date', 'appointment',
    'appointment_date', 'scheduled', 'due_date', 'target_date', 'work_date',
    'schedule_date', 'planned_date', 'start_date', 'completion_date', 'install_date'
  ],

  // Date - created/issued
  createdDate: [
    'date', 'created', 'timestamp', 'created_at', 'created_date', 'issued_date',
    'issue_date', 'document_date', 'order_date', 'invoice_date', 'quote_date'
  ],

  // Priority/Status
  priority: [
    'priority', 'urgency', 'importance', 'level', 'priority_level', 'job_priority',
    'service_priority', 'rush', 'urgent'
  ],

  status: [
    'status', 'job_status', 'work_status', 'order_status', 'state', 'current_status',
    'completion_status', 'progress', 'stage'
  ],

  // Materials/Items/Parts
  materials: [
    'materials', 'parts', 'items', 'line_items', 'products', 'materials_needed',
    'parts_list', 'inventory', 'equipment', 'supplies', 'components', 'material_list',
    'parts_needed', 'materials_list', 'bill_of_materials', 'bom'
  ],

  // Money - Total
  total: [
    'total', 'grand_total', 'amount', 'total_amount', 'sum', 'price', 'cost',
    'value', 'total_cost', 'total_price', 'invoice_total', 'order_total',
    'final_total', 'amount_due', 'balance_due', 'net_total'
  ],

  // Money - Subtotal
  subtotal: [
    'subtotal', 'sub_total', 'materials_subtotal', 'parts_subtotal', 'subtotal_amount',
    'net_amount', 'pre_tax_total', 'before_tax'
  ],

  // Labor costs
  laborTotal: [
    'labor_total', 'labor_cost', 'labor', 'labor_amount', 'service_charge',
    'labor_charge', 'service_cost', 'labor_fee', 'installation_cost', 'install_cost'
  ],

  // Labor hours
  laborHours: [
    'labor_hours', 'hours', 'time', 'duration', 'work_hours', 'estimated_hours',
    'actual_hours', 'total_hours', 'service_hours', 'billable_hours', 'time_spent'
  ],

  // Labor rate
  laborRate: [
    'labor_rate', 'rate', 'hourly_rate', 'rate_per_hour', 'hour_rate',
    'billing_rate', 'service_rate', 'rate_hour'
  ],

  // Proposal/Quote specific
  proposalNumber: [
    'proposal_number', 'proposal_#', 'proposal', 'quote_number', 'estimate_number',
    'bid_number', 'quotation_number', 'quote_#', 'estimate_#', 'quote_no',
    'proposal_no', 'estimate_no', 'bid_no', 'rfq_number'
  ],

  projectTitle: [
    'project_title', 'project', 'title', 'project_name', 'job_title', 'job_name',
    'work_title', 'service_title', 'project_description'
  ],

  validUntil: [
    'valid_until', 'expires', 'expiration', 'expiry_date', 'offer_expires',
    'quote_valid', 'valid_through', 'expiration_date', 'good_until',
    'quote_expiry', 'validity', 'valid_date', 'expires_on'
  ],

  preparedBy: [
    'prepared_by', 'author', 'created_by', 'salesperson', 'rep', 'sales_rep',
    'account_rep', 'representative', 'estimator', 'issued_by', 'quoted_by',
    'account_manager', 'contact_person'
  ],

  // Company/Business
  company: [
    'company', 'company_name', 'business', 'business_name', 'organization',
    'firm', 'enterprise', 'vendor', 'seller', 'supplier', 'merchant'
  ],

  // Invoice specific
  invoiceNumber: [
    'invoice_number', 'invoice_no', 'invoice_#', 'inv_number', 'inv_no',
    'invoice_id', 'bill_number', 'bill_no', 'statement_number'
  ],

  dueDate: [
    'due_date', 'payment_due', 'due', 'pay_by', 'payment_date', 'due_by'
  ],

  // Tax
  tax: [
    'tax', 'tax_amount', 'sales_tax', 'vat', 'gst', 'hst', 'tax_total',
    'tax_rate', 'taxes'
  ],

  // Quantity
  quantity: [
    'quantity', 'qty', 'count', 'amount', 'units', 'num', 'number_of', 'qty_ordered'
  ],

  // Unit price
  unitPrice: [
    'unit_price', 'price', 'rate', 'cost', 'unit_cost', 'price_each',
    'each', 'per_unit', 'item_price'
  ],

  // Terms
  terms: [
    'terms', 'payment_terms', 'conditions', 'terms_conditions', 'terms_and_conditions',
    'notes', 'fine_print', 'disclaimer'
  ],

  // Purchase Order
  poNumber: [
    'po_number', 'purchase_order', 'purchase_order_number', 'po', 'po_#', 'po_no',
    'purchase_order_#', 'customer_po', 'po_reference'
  ],

  // Tracking/Reference
  trackingNumber: [
    'tracking_number', 'tracking', 'tracking_no', 'tracking_#', 'shipment_tracking',
    'carrier_tracking', 'reference', 'ref_number', 'reference_number'
  ],
};

/**
 * Normalize a field name for comparison
 * Removes separators, converts to lowercase, handles common variations
 */
function normalizeFieldName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[_\-\s#.]+/g, '')  // Remove separators: underscores, hyphens, spaces, #, dots
    .replace(/s$/, '');           // Remove trailing 's' for simple plural handling
}

/**
 * Check if a substring match is meaningful (not just coincidental)
 * Requires the matched portion to be at least 40% of the longer string
 * to avoid false positives like "sitelocation" matching "tel"
 */
function isSignificantMatch(container: string, substring: string): boolean {
  if (!container.includes(substring)) return false;
  // Require the substring to be at least 40% of the container's length
  return substring.length >= container.length * 0.4;
}

/**
 * Get the confidence score for matching two field names
 * Returns a value between 0 and 1 indicating match confidence
 */
export function getFieldMatchConfidence(sourceField: string, templateField: string): number {
  const normalizedSource = normalizeFieldName(sourceField);
  const normalizedTemplate = normalizeFieldName(templateField);

  // FIRST: Explicit negative matches - prevent known wrong associations
  // These must be checked before any other matching to avoid false positives
  // "Site Location" should NOT match "contact_phone" or similar phone fields
  if ((normalizedSource.includes('site') || normalizedSource.includes('location')) &&
      !normalizedSource.includes('phone')) {
    if (normalizedTemplate.includes('phone') ||
        normalizedTemplate.includes('tel') ||
        normalizedTemplate.includes('mobile') ||
        normalizedTemplate.includes('cell')) {
      return 0; // Explicit no match - location fields don't map to phone fields
    }
  }

  // "Client" should NOT match "contact_phone" - it should match "customer_name"
  if (normalizedSource === 'client' &&
      (normalizedTemplate.includes('phone') || normalizedTemplate.includes('tel'))) {
    return 0; // Client is a person/company, not a phone number
  }

  // Exact match after normalization - very high confidence
  if (normalizedSource === normalizedTemplate) {
    return 0.98;
  }

  // Check domain-specific synonym groups
  for (const [groupName, synonyms] of Object.entries(DOMAIN_SYNONYMS)) {
    const normalizedSynonyms = synonyms.map(s => normalizeFieldName(s));

    // Check if source field matches this synonym group
    // Use strict matching: exact match, or SIGNIFICANT substring overlap
    const sourceInGroup = normalizedSynonyms.some(s =>
      normalizedSource === s ||
      isSignificantMatch(normalizedSource, s) ||
      isSignificantMatch(s, normalizedSource)
    );

    // Check if template field matches this synonym group
    const templateInGroup = normalizedSynonyms.some(s =>
      normalizedTemplate === s ||
      isSignificantMatch(normalizedTemplate, s) ||
      isSignificantMatch(s, normalizedTemplate)
    );

    if (sourceInGroup && templateInGroup) {
      return 0.85; // High confidence - same semantic concept
    }

    // Special handling for common field patterns
    // e.g., "customer_address" template should match "address" synonym group
    // even when source is "Site Location"
    // Special handling for address fields
    if (groupName === 'address') {
      const sourceHasAddress = normalizedSource.includes('location') ||
                               normalizedSource.includes('site') ||
                               normalizedSource.includes('address');
      const templateHasAddress = normalizedTemplate.includes('address') ||
                                 normalizedTemplate.includes('location');
      if (sourceHasAddress && templateHasAddress) {
        return 0.82;
      }
    }

    // Special handling for description fields
    if (groupName === 'description') {
      const sourceHasDesc = normalizedSource.includes('scope') ||
                            normalizedSource.includes('description') ||
                            normalizedSource.includes('work') ||
                            normalizedSource.includes('detail');
      const templateHasDesc = normalizedTemplate.includes('description') ||
                              normalizedTemplate.includes('scope') ||
                              normalizedTemplate.includes('detail');
      if (sourceHasDesc && templateHasDesc) {
        return 0.82;
      }
    }

    // Special handling for phone fields
    // Note: 'tel' must match at start/end to avoid false positives like "sitelocation"
    if (groupName === 'phone') {
      const sourceHasPhone = normalizedSource.includes('phone') ||
                             normalizedSource.startsWith('tel') ||
                             normalizedSource.endsWith('tel') ||
                             normalizedSource === 'tel' ||
                             normalizedSource.includes('telephone') ||
                             normalizedSource.includes('mobile') ||
                             normalizedSource.includes('cell');
      const templateHasPhone = normalizedTemplate.includes('phone') ||
                               normalizedTemplate.startsWith('tel') ||
                               normalizedTemplate.endsWith('tel') ||
                               normalizedTemplate === 'tel' ||
                               normalizedTemplate.includes('telephone') ||
                               normalizedTemplate.includes('contact');
      if (sourceHasPhone && templateHasPhone) {
        return 0.82;
      }
    }
  }

  // Contains match - one field name contains the other (must be significant overlap)
  if (isSignificantMatch(normalizedSource, normalizedTemplate) ||
      isSignificantMatch(normalizedTemplate, normalizedSource)) {
    // Scale by how much overlap there is
    const overlap = Math.min(normalizedSource.length, normalizedTemplate.length) /
                   Math.max(normalizedSource.length, normalizedTemplate.length);
    return Math.max(0.6, overlap * 0.75);
  }

  // Levenshtein similarity for typos/variations
  const similarity = levenshteinSimilarity(normalizedSource, normalizedTemplate);
  if (similarity > 0.7) {
    return similarity * 0.8; // Scale down slightly to prefer exact/semantic matches
  }

  // No match
  return 0;
}

/**
 * Check if two field names are semantically related (legacy boolean version)
 * Now delegates to getFieldMatchConfidence for consistency
 */
function areFieldsSemanticallyRelated(field1: string, field2: string): boolean {
  return getFieldMatchConfidence(field1, field2) >= 0.6;
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

/**
 * Generate suggested field mappings between template and source fields
 * Uses domain-specific synonyms, semantic analysis, and fuzzy matching
 * to find the best matches with confidence scores.
 *
 * IMPORTANT: Each source field can only be mapped to ONE template field.
 * Uses a greedy algorithm: highest confidence matches are assigned first.
 */
export function generateSuggestedMappings(
  templateFields: string[],
  sourceFields: string[]
): Array<{ templateField: string; sourceField: string; confidence: number }> {
  // Build a matrix of all possible matches with confidence scores
  const allMatches: Array<{
    templateField: string;
    sourceField: string;
    confidence: number;
  }> = [];

  for (const tField of templateFields) {
    for (const sField of sourceFields) {
      const confidence = getFieldMatchConfidence(sField, tField);
      if (confidence > 0.3) {  // Only consider matches above threshold
        allMatches.push({ templateField: tField, sourceField: sField, confidence });
      }
    }
  }

  // Sort by confidence (highest first)
  allMatches.sort((a, b) => b.confidence - a.confidence);

  // Greedy assignment: assign highest confidence matches first
  // Each source field and template field can only be used once
  const usedSourceFields = new Set<string>();
  const usedTemplateFields = new Set<string>();
  const finalMappings: Array<{ templateField: string; sourceField: string; confidence: number }> = [];

  for (const match of allMatches) {
    if (!usedSourceFields.has(match.sourceField) && !usedTemplateFields.has(match.templateField)) {
      finalMappings.push(match);
      usedSourceFields.add(match.sourceField);
      usedTemplateFields.add(match.templateField);
    }
  }

  // Add unmapped template fields with empty source
  for (const tField of templateFields) {
    if (!usedTemplateFields.has(tField)) {
      finalMappings.push({ templateField: tField, sourceField: '', confidence: 0 });
    }
  }

  return finalMappings;
}

/**
 * Get list of built-in templates with their expected fields
 * Exposed for use by auto-generate endpoint
 */
export function getBuiltInTemplates(): TemplateInfo[] {
  return getBuiltInTemplateList();
}

export type { MatchResult, AutoMatcherOptions, DiscoveredSchema, TemplateInfo };
