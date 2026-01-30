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
  category: 'quote' | 'invoice' | 'proposal' | 'contract' | 'report' | 'purchase-order' | 'legal' | 'service';
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
  'purchase-order': {
    id: 'purchase-order',
    name: 'Purchase Order',
    description: 'Professional purchase order with vendor info, buyer info, line items, shipping details, and totals.',
    category: 'purchase-order',
    regions: ['header', 'parties', 'shipping', 'line-items', 'totals', 'footer'],
    schemaUrl: '/templates/purchase-order/schema.json',
  },
  'statement-of-work': {
    id: 'statement-of-work',
    name: 'Statement of Work',
    description: 'Formal SOW document defining project scope, deliverables, timeline, and payment terms between client and contractor.',
    category: 'contract',
    regions: ['header', 'parties', 'scope', 'timeline', 'deliverables', 'payment', 'signatures'],
    schemaUrl: '/templates/statement-of-work/schema.json',
  },
  'nda': {
    id: 'nda',
    name: 'Non-Disclosure Agreement',
    description: 'Mutual confidentiality agreement protecting sensitive information shared between parties.',
    category: 'legal',
    regions: ['header', 'parties', 'key-terms', 'terms', 'jurisdiction', 'signatures'],
    schemaUrl: '/templates/nda/schema.json',
  },
  'work-order': {
    id: 'work-order',
    name: 'Work Order',
    description: 'Field service work order with customer info, work description, materials, labor, and pricing.',
    category: 'service',
    regions: ['header', 'customer', 'description', 'materials', 'totals', 'assignment', 'signatures'],
    schemaUrl: '/templates/work-order/schema.json',
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
  'statement-of-work': async (): Promise<Template> => {
    const [htmlModule, cssModule, schemaModule] = await Promise.all([
      import('./statement-of-work/template.html?raw'),
      import('./statement-of-work/styles.css?raw'),
      import('./statement-of-work/schema.json'),
    ]);

    return {
      html: htmlModule.default,
      css: cssModule.default,
      schema: schemaModule.default,
      metadata: templateMetadata['statement-of-work'],
    };
  },
  'nda': async (): Promise<Template> => {
    const [htmlModule, cssModule, schemaModule] = await Promise.all([
      import('./nda/template.html?raw'),
      import('./nda/styles.css?raw'),
      import('./nda/schema.json'),
    ]);

    return {
      html: htmlModule.default,
      css: cssModule.default,
      schema: schemaModule.default,
      metadata: templateMetadata['nda'],
    };
  },
  'work-order': async (): Promise<Template> => {
    const [htmlModule, cssModule, schemaModule] = await Promise.all([
      import('./work-order/template.html?raw'),
      import('./work-order/styles.css?raw'),
      import('./work-order/schema.json'),
    ]);

    return {
      html: htmlModule.default,
      css: cssModule.default,
      schema: schemaModule.default,
      metadata: templateMetadata['work-order'],
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
  parties: {
    label: 'Parties',
    description: 'Contracting parties, client and contractor information',
  },
  scope: {
    label: 'Scope of Work',
    description: 'Detailed description of work to be performed',
  },
  timeline: {
    label: 'Timeline',
    description: 'Project start date, end date, and milestones',
  },
  deliverables: {
    label: 'Deliverables',
    description: 'List of deliverables with due dates',
  },
  payment: {
    label: 'Payment',
    description: 'Payment terms, amounts, and schedule',
  },
  signatures: {
    label: 'Signatures',
    description: 'Signature blocks for all parties',
  },
  'key-terms': {
    label: 'Key Terms',
    description: 'Summary of key agreement terms and conditions',
  },
  terms: {
    label: 'Terms & Conditions',
    description: 'Legal terms, obligations, and clauses',
  },
  jurisdiction: {
    label: 'Jurisdiction',
    description: 'Governing law and jurisdiction clause',
  },
  customer: {
    label: 'Customer Info',
    description: 'Customer name, address, and contact details',
  },
  description: {
    label: 'Work Description',
    description: 'Detailed description of work to be performed',
  },
  materials: {
    label: 'Materials',
    description: 'Parts, materials, and supplies with pricing',
  },
  assignment: {
    label: 'Assignment',
    description: 'Technician assignment and scheduling information',
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
