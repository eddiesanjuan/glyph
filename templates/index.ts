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
  category: 'quote' | 'invoice' | 'proposal' | 'contract' | 'report';
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
  // Future templates:
  // 'quote-classic': { ... },
  // 'invoice-modern': { ... },
  // 'proposal-executive': { ... },
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
