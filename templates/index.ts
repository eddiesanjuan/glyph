/**
 * Glyph Template Registry
 *
 * Central registry for all available PDF templates.
 * Templates are loaded dynamically to minimize bundle size.
 */

export interface TemplateMetadata {
  id: string;
  name: string;
  description: string;
  category: 'quote' | 'invoice' | 'proposal' | 'contract' | 'report' | 'receipt' | 'certificate' | 'letter' | 'purchase-order';
  regions: string[];
  schemaUrl: string;
  previewUrl?: string;
}

export interface Template {
  html: string;
  css: string;
  schema: Record<string, unknown>;
  metadata: TemplateMetadata;
}

/**
 * Template metadata registry
 */
export const templateMetadata: Record<string, TemplateMetadata> = {
  'quote-modern': {
    id: 'quote-modern',
    name: 'Modern Quote',
    description: 'Clean, minimal quote template with generous whitespace and professional typography.',
    category: 'quote',
    regions: ['header', 'meta', 'client-info', 'line-items', 'totals', 'notes', 'footer'],
    schemaUrl: '/templates/quote-modern/schema.json',
  },
  'quote-professional': {
    id: 'quote-professional',
    name: 'Professional Quote',
    description: 'Traditional business style with formal serif typography, structured grid layout, and professional footer.',
    category: 'quote',
    regions: ['header', 'meta', 'client-info', 'line-items', 'totals', 'notes', 'footer'],
    schemaUrl: '/templates/quote-professional/schema.json',
  },
  'quote-bold': {
    id: 'quote-bold',
    name: 'Bold Quote',
    description: 'High-impact modern design with dark header, bold typography, and strong visual hierarchy.',
    category: 'quote',
    regions: ['header', 'meta', 'client-info', 'line-items', 'totals', 'notes', 'footer'],
    schemaUrl: '/templates/quote-bold/schema.json',
  },
  'certificate-modern': {
    id: 'certificate-modern',
    name: 'Modern Certificate',
    description: 'Contemporary certificate design with clean layout for awards, completion, and recognition.',
    category: 'certificate',
    regions: ['header', 'recipient', 'description', 'footer'],
    schemaUrl: '/templates/certificate-modern/schema.json',
  },
  'contract-simple': {
    id: 'contract-simple',
    name: 'Simple Contract',
    description: 'Straightforward contract template with parties, sections, jurisdiction, and signature blocks.',
    category: 'contract',
    regions: ['header', 'parties', 'sections', 'jurisdiction', 'signatures'],
    schemaUrl: '/templates/contract-simple/schema.json',
  },
  'invoice-clean': {
    id: 'invoice-clean',
    name: 'Clean Invoice',
    description: 'Minimal invoice layout with billing details, itemized line items, and totals summary.',
    category: 'invoice',
    regions: ['header', 'bill-to', 'line-items', 'totals', 'footer'],
    schemaUrl: '/templates/invoice-clean/schema.json',
  },
  'letter-business': {
    id: 'letter-business',
    name: 'Business Letter',
    description: 'Formal business letter with sender, recipient, subject line, body, and closing.',
    category: 'letter',
    regions: ['sender', 'date', 'recipient', 'subject', 'body', 'closing'],
    schemaUrl: '/templates/letter-business/schema.json',
  },
  'proposal-basic': {
    id: 'proposal-basic',
    name: 'Basic Proposal',
    description: 'Project proposal with deliverables, timeline, pricing, and terms sections.',
    category: 'proposal',
    regions: ['header', 'title', 'client', 'description', 'deliverables', 'timeline', 'pricing', 'terms'],
    schemaUrl: '/templates/proposal-basic/schema.json',
  },
  'receipt-minimal': {
    id: 'receipt-minimal',
    name: 'Minimal Receipt',
    description: 'Compact receipt template with items, totals, and payment confirmation.',
    category: 'receipt',
    regions: ['header', 'items', 'totals', 'footer'],
    schemaUrl: '/templates/receipt-minimal/schema.json',
  },
  'report-cover': {
    id: 'report-cover',
    name: 'Report Cover Page',
    description: 'Professional report cover with title block, metadata, and abstract summary.',
    category: 'report',
    regions: ['header', 'title-block', 'meta', 'abstract'],
    schemaUrl: '/templates/report-cover/schema.json',
  },
  'purchase-order': {
    id: 'purchase-order',
    name: 'Purchase Order',
    description: 'Professional purchase order with vendor info, buyer info, line items, shipping details, and totals.',
    category: 'purchase-order',
    regions: ['header', 'parties', 'shipping', 'line-items', 'totals', 'footer'],
    schemaUrl: '/templates/purchase-order/schema.json',
  },
};

/**
 * Lazy template loaders
 * Uses Vite's ?raw import for HTML templates
 */
export const templateLoaders = {
  'quote-modern': async (): Promise<Template> => {
    const [htmlModule, cssModule, schemaModule] = await Promise.all([
      import('./quote-modern/template.html?raw'),
      import('./quote-modern/styles.css?raw'),
      import('./quote-modern/schema.json'),
    ]);

    return {
      html: htmlModule.default,
      css: cssModule.default,
      schema: schemaModule.default,
      metadata: templateMetadata['quote-modern'],
    };
  },
  'quote-professional': async (): Promise<Template> => {
    const [htmlModule, cssModule, schemaModule] = await Promise.all([
      import('./quote-professional/template.html?raw'),
      import('./quote-professional/styles.css?raw'),
      import('./quote-professional/schema.json'),
    ]);

    return {
      html: htmlModule.default,
      css: cssModule.default,
      schema: schemaModule.default,
      metadata: templateMetadata['quote-professional'],
    };
  },
  'quote-bold': async (): Promise<Template> => {
    const [htmlModule, cssModule, schemaModule] = await Promise.all([
      import('./quote-bold/template.html?raw'),
      import('./quote-bold/styles.css?raw'),
      import('./quote-bold/schema.json'),
    ]);

    return {
      html: htmlModule.default,
      css: cssModule.default,
      schema: schemaModule.default,
      metadata: templateMetadata['quote-bold'],
    };
  },
  'certificate-modern': async (): Promise<Template> => {
    const [htmlModule, cssModule, schemaModule] = await Promise.all([
      import('./certificate-modern/template.html?raw'),
      import('./certificate-modern/styles.css?raw'),
      import('./certificate-modern/schema.json'),
    ]);

    return {
      html: htmlModule.default,
      css: cssModule.default,
      schema: schemaModule.default,
      metadata: templateMetadata['certificate-modern'],
    };
  },
  'contract-simple': async (): Promise<Template> => {
    const [htmlModule, cssModule, schemaModule] = await Promise.all([
      import('./contract-simple/template.html?raw'),
      import('./contract-simple/styles.css?raw'),
      import('./contract-simple/schema.json'),
    ]);

    return {
      html: htmlModule.default,
      css: cssModule.default,
      schema: schemaModule.default,
      metadata: templateMetadata['contract-simple'],
    };
  },
  'invoice-clean': async (): Promise<Template> => {
    const [htmlModule, cssModule, schemaModule] = await Promise.all([
      import('./invoice-clean/template.html?raw'),
      import('./invoice-clean/styles.css?raw'),
      import('./invoice-clean/schema.json'),
    ]);

    return {
      html: htmlModule.default,
      css: cssModule.default,
      schema: schemaModule.default,
      metadata: templateMetadata['invoice-clean'],
    };
  },
  'letter-business': async (): Promise<Template> => {
    const [htmlModule, cssModule, schemaModule] = await Promise.all([
      import('./letter-business/template.html?raw'),
      import('./letter-business/styles.css?raw'),
      import('./letter-business/schema.json'),
    ]);

    return {
      html: htmlModule.default,
      css: cssModule.default,
      schema: schemaModule.default,
      metadata: templateMetadata['letter-business'],
    };
  },
  'proposal-basic': async (): Promise<Template> => {
    const [htmlModule, cssModule, schemaModule] = await Promise.all([
      import('./proposal-basic/template.html?raw'),
      import('./proposal-basic/styles.css?raw'),
      import('./proposal-basic/schema.json'),
    ]);

    return {
      html: htmlModule.default,
      css: cssModule.default,
      schema: schemaModule.default,
      metadata: templateMetadata['proposal-basic'],
    };
  },
  'receipt-minimal': async (): Promise<Template> => {
    const [htmlModule, cssModule, schemaModule] = await Promise.all([
      import('./receipt-minimal/template.html?raw'),
      import('./receipt-minimal/styles.css?raw'),
      import('./receipt-minimal/schema.json'),
    ]);

    return {
      html: htmlModule.default,
      css: cssModule.default,
      schema: schemaModule.default,
      metadata: templateMetadata['receipt-minimal'],
    };
  },
  'report-cover': async (): Promise<Template> => {
    const [htmlModule, cssModule, schemaModule] = await Promise.all([
      import('./report-cover/template.html?raw'),
      import('./report-cover/styles.css?raw'),
      import('./report-cover/schema.json'),
    ]);

    return {
      html: htmlModule.default,
      css: cssModule.default,
      schema: schemaModule.default,
      metadata: templateMetadata['report-cover'],
    };
  },
  'purchase-order': async (): Promise<Template> => {
    const [htmlModule, cssModule, schemaModule] = await Promise.all([
      import('./purchase-order/template.html?raw'),
      import('./purchase-order/styles.css?raw'),
      import('./purchase-order/schema.json'),
    ]);

    return {
      html: htmlModule.default,
      css: cssModule.default,
      schema: schemaModule.default,
      metadata: templateMetadata['purchase-order'],
    };
  },
};

/**
 * Load a template by ID
 */
export async function loadTemplate(templateId: string): Promise<Template> {
  const loader = templateLoaders[templateId as keyof typeof templateLoaders];

  if (!loader) {
    throw new Error(`Template not found: ${templateId}. Available templates: ${Object.keys(templateLoaders).join(', ')}`);
  }

  return loader();
}

/**
 * Get all available template IDs
 */
export function getTemplateIds(): string[] {
  return Object.keys(templateLoaders);
}

/**
 * Get metadata for all templates
 */
export function getAllTemplateMetadata(): TemplateMetadata[] {
  return Object.values(templateMetadata);
}

/**
 * Get metadata for templates in a specific category
 */
export function getTemplatesByCategory(category: TemplateMetadata['category']): TemplateMetadata[] {
  return Object.values(templateMetadata).filter((t) => t.category === category);
}

/**
 * Check if a template exists
 */
export function templateExists(templateId: string): boolean {
  return templateId in templateLoaders;
}

/**
 * Template region definitions for SDK spatial selection
 */
export const regionDefinitions: Record<string, { label: string; description: string }> = {
  header: {
    label: 'Header',
    description: 'Company branding, logo, and document title',
  },
  meta: {
    label: 'Document Info',
    description: 'Quote/invoice number, dates, and reference information',
  },
  'client-info': {
    label: 'Client Information',
    description: 'Recipient name, company, and contact details',
  },
  'line-items': {
    label: 'Line Items',
    description: 'Products, services, quantities, and prices',
  },
  totals: {
    label: 'Totals',
    description: 'Subtotal, discounts, taxes, and final total',
  },
  notes: {
    label: 'Notes',
    description: 'Additional notes, special instructions, or comments',
  },
  footer: {
    label: 'Footer',
    description: 'Terms, conditions, and signature areas',
  },
};

/**
 * Default export for convenience
 */
export default {
  load: loadTemplate,
  exists: templateExists,
  getIds: getTemplateIds,
  getAllMetadata: getAllTemplateMetadata,
  getByCategory: getTemplatesByCategory,
  metadata: templateMetadata,
  regions: regionDefinitions,
};
