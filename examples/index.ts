/**
 * Glyph Document Examples
 *
 * This module exports TypeScript interfaces for all supported document types.
 * Each document type has a corresponding folder with:
 *   - schema.ts: TypeScript interface definition
 *   - example-data.json: Complete realistic example data
 *   - README.md: Usage documentation and customization guide
 *   - sample-output.md: Description of rendered output
 */

// Schema exports
export * from './invoice/schema';
export * from './quote/schema';
export * from './receipt/schema';
export * from './contract/schema';
export * from './resume/schema';
export * from './report/schema';
export * from './letter/schema';
export * from './proposal/schema';
export * from './work-order/schema';
export * from './packing-slip/schema';
export * from './statement/schema';
export * from './certificate/schema';

/**
 * All supported document types
 */
export const DOCUMENT_TYPES = [
  'invoice',
  'quote',
  'receipt',
  'contract',
  'resume',
  'report',
  'letter',
  'proposal',
  'work-order',
  'packing-slip',
  'statement',
  'certificate',
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

/**
 * Document type metadata
 */
export const DOCUMENT_TYPE_INFO: Record<
  DocumentType,
  {
    name: string;
    description: string;
    useCases: string[];
  }
> = {
  invoice: {
    name: 'Invoice',
    description: 'Service invoices for billing clients for completed work',
    useCases: [
      'Freelance billing',
      'Consulting fees',
      'Product sales',
      'Recurring subscriptions',
    ],
  },
  quote: {
    name: 'Quote/Estimate',
    description: 'Pre-work proposals outlining scope and pricing',
    useCases: [
      'Service estimates',
      'Project proposals',
      'Price quotes',
      'Repair estimates',
    ],
  },
  receipt: {
    name: 'Receipt',
    description: 'Transaction confirmations for completed purchases',
    useCases: [
      'Retail sales',
      'Service payments',
      'Donation acknowledgments',
      'Refund documentation',
    ],
  },
  contract: {
    name: 'Contract',
    description: 'Service agreements and legally-binding contracts',
    useCases: [
      'Contractor agreements',
      'Service contracts',
      'NDAs',
      'Employment agreements',
    ],
  },
  resume: {
    name: 'Resume/CV',
    description: 'Professional profiles for career presentations',
    useCases: [
      'Job applications',
      'Portfolio websites',
      'Conference bios',
      'Consulting profiles',
    ],
  },
  report: {
    name: 'Report',
    description: 'Business or project reports with structured content',
    useCases: [
      'Quarterly reviews',
      'Project status',
      'Financial summaries',
      'Technical analysis',
    ],
  },
  letter: {
    name: 'Letter',
    description: 'Formal business letters for professional correspondence',
    useCases: [
      'Offer letters',
      'Cover letters',
      'Recommendations',
      'Official notices',
    ],
  },
  proposal: {
    name: 'Proposal',
    description: 'Business proposals for pitching services or partnerships',
    useCases: [
      'Consulting proposals',
      'Project bids',
      'RFP responses',
      'Partnership proposals',
    ],
  },
  'work-order': {
    name: 'Work Order',
    description: 'Service or repair orders documenting work performed',
    useCases: [
      'Field service',
      'Maintenance',
      'Repairs',
      'Installations',
    ],
  },
  'packing-slip': {
    name: 'Packing Slip',
    description: 'Shipping documents listing package contents',
    useCases: [
      'E-commerce shipments',
      'Wholesale orders',
      'Warehouse operations',
      'Inventory transfers',
    ],
  },
  statement: {
    name: 'Statement',
    description: 'Account statements showing transactions and balances',
    useCases: [
      'Customer statements',
      'Billing statements',
      'Activity summaries',
      'AR aging',
    ],
  },
  certificate: {
    name: 'Certificate',
    description: 'Completion certificates and recognition documents',
    useCases: [
      'Course completion',
      'Professional certifications',
      'Awards',
      'Achievements',
    ],
  },
};

/**
 * Get document type info
 */
export function getDocumentTypeInfo(type: DocumentType) {
  return DOCUMENT_TYPE_INFO[type];
}

/**
 * Check if a string is a valid document type
 */
export function isValidDocumentType(type: string): type is DocumentType {
  return DOCUMENT_TYPES.includes(type as DocumentType);
}
