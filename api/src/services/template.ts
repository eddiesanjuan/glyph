/**
 * Template Engine Service
 * Handles HTML template rendering with Mustache
 */

import Mustache from "mustache";
import { existsSync, readdirSync, promises as fsPromises } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { QuoteData } from "../lib/types.js";

// Get directory of current module for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Templates are stored relative to the api folder
const TEMPLATES_DIR = join(__dirname, "../../../templates");

interface TemplateResult {
  html: string;
  templateHtml: string;
  templateName: string;
  renderData: Record<string, unknown>;
}

export class TemplateEngine {
  private templateCache: Map<string, string> = new Map();

  /**
   * Render a template with the provided data
   */
  async render(templateName: string, data: QuoteData): Promise<TemplateResult> {
    const templateHtml = await this.loadTemplate(templateName);

    // Prepare data for Mustache rendering
    // Mustache needs flat access or proper nested objects
    const renderData = this.prepareData(data);

    // Render Mustache template
    const html = Mustache.render(templateHtml, renderData);

    return { html, templateHtml, templateName, renderData };
  }

  /**
   * Render a raw template string with data
   * Used for re-rendering after AI modifications
   */
  renderRaw(templateHtml: string, renderData: Record<string, unknown>): string {
    return Mustache.render(templateHtml, renderData);
  }

  /**
   * Get raw template HTML (with Mustache placeholders)
   */
  async getTemplateHtml(templateName: string): Promise<string> {
    return this.loadTemplate(templateName);
  }

  /**
   * Prepare data for Mustache template
   * Handles currency formatting and default values
   */
  private prepareData(data: QuoteData): Record<string, unknown> {
    return {
      client: {
        name: data.client.name,
        email: data.client.email || null,
        address: data.client.address || null,
        company: data.client.company || null,
      },
      lineItems: data.lineItems.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: this.formatNumber(item.unitPrice),
        total: this.formatNumber(item.total),
      })),
      totals: {
        subtotal: this.formatNumber(data.totals.subtotal),
        tax: data.totals.tax ? this.formatNumber(data.totals.tax) : null,
        discount: data.totals.discount
          ? this.formatNumber(data.totals.discount)
          : null,
        total: this.formatNumber(data.totals.total),
        taxRate: data.totals.tax
          ? Math.round((data.totals.tax / data.totals.subtotal) * 100)
          : null,
      },
      meta: {
        quoteNumber: data.meta?.quoteNumber || "001",
        date: data.meta?.date || new Date().toLocaleDateString(),
        validUntil: data.meta?.validUntil || "",
        notes: data.meta?.notes || null,
        terms: data.meta?.terms || null,
        showSignature: false, // Can be enabled via data
      },
      branding: {
        logoUrl: data.branding?.logoUrl || null,
        companyName: data.branding?.companyName || "Your Company",
        companyAddress: data.branding?.companyAddress || null,
      },
      styles: {
        accentColor: data.styles?.accentColor || "#14B8A6", // Teal brand color
      },
    };
  }

  /**
   * Format number as string without currency symbol (template adds $)
   */
  private formatNumber(amount: number): string {
    return amount.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  /**
   * Load a template from the filesystem
   */
  private async loadTemplate(name: string): Promise<string> {
    // Check cache first
    if (this.templateCache.has(name)) {
      return this.templateCache.get(name)!;
    }

    const templatePath = join(TEMPLATES_DIR, name, "template.html");

    if (!existsSync(templatePath)) {
      throw new Error(`Template not found: ${name}`);
    }

    const template = await fsPromises.readFile(templatePath, "utf-8");
    this.templateCache.set(name, template);

    return template;
  }

  /**
   * Get list of available templates by scanning templates directory
   */
  getAvailableTemplates(): string[] {
    if (!existsSync(TEMPLATES_DIR)) {
      console.warn(`Templates directory not found: ${TEMPLATES_DIR}`);
      return [];
    }

    try {
      const entries = readdirSync(TEMPLATES_DIR, { withFileTypes: true });
      return entries
        .filter((entry) => {
          // Only directories that contain a template.html
          if (!entry.isDirectory()) return false;
          if (entry.name.startsWith("_")) return false; // Skip _shared etc
          const templatePath = join(TEMPLATES_DIR, entry.name, "template.html");
          return existsSync(templatePath);
        })
        .map((entry) => entry.name);
    } catch (error) {
      console.error("Error reading templates directory:", error);
      return [];
    }
  }

  /**
   * Pre-load all available templates into the cache.
   * Call at startup to avoid first-request latency.
   */
  async warmCache(): Promise<void> {
    const templates = this.getAvailableTemplates();
    for (const name of templates) {
      if (!this.templateCache.has(name)) {
        const templatePath = join(TEMPLATES_DIR, name, "template.html");
        try {
          const template = await fsPromises.readFile(templatePath, "utf-8");
          this.templateCache.set(name, template);
        } catch (error) {
          console.warn(`Failed to warm cache for template "${name}":`, error);
        }
      }
    }
    console.log(`[Glyph] Template cache warmed: ${this.templateCache.size} templates loaded`);
  }

  /**
   * Clear the template cache (useful for development)
   */
  clearCache(): void {
    this.templateCache.clear();
  }
}

// Export singleton instance
export const templateEngine = new TemplateEngine();

// Legacy export for backwards compatibility
export async function renderTemplate(data: QuoteData, templateId?: string): Promise<string> {
  const templateName = templateId || "quote-modern";

  // Synchronous version for legacy compatibility
  const TEMPLATES_DIR_LEGACY = join(__dirname, "../../../templates");
  const templatePath = join(TEMPLATES_DIR_LEGACY, templateName, "template.html");

  let template: string;
  if (existsSync(templatePath)) {
    template = await fsPromises.readFile(templatePath, "utf-8");
  } else {
    // Fallback to default inline template if file not found
    template = getDefaultTemplate();
  }

  // Prepare data
  const renderData = {
    client: {
      name: data.client.name,
      email: data.client.email || null,
      address: data.client.address || null,
      company: data.client.company || null,
    },
    lineItems: data.lineItems.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      total: item.total.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    })),
    totals: {
      subtotal: data.totals.subtotal.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      tax: data.totals.tax
        ? data.totals.tax.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        : null,
      discount: data.totals.discount
        ? data.totals.discount.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        : null,
      total: data.totals.total.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      taxRate: data.totals.tax
        ? Math.round((data.totals.tax / data.totals.subtotal) * 100)
        : null,
    },
    meta: {
      quoteNumber: data.meta?.quoteNumber || "001",
      date: data.meta?.date || new Date().toLocaleDateString(),
      validUntil: data.meta?.validUntil || "",
      notes: data.meta?.notes || null,
      terms: data.meta?.terms || null,
      showSignature: false,
    },
    branding: {
      logoUrl: data.branding?.logoUrl || null,
      companyName: data.branding?.companyName || "Your Company",
      companyAddress: data.branding?.companyAddress || null,
    },
    styles: {
      accentColor: data.styles?.accentColor || "#14B8A6", // Teal brand color
    },
  };

  return Mustache.render(template, renderData);
}

function getDefaultTemplate(): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Quote - {{meta.quoteNumber}}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
    .company { font-size: 24px; font-weight: bold; }
    .quote-info { text-align: right; color: #666; }
    .client { margin-bottom: 30px; padding: 20px; background: #f9f9f9; border-radius: 8px; }
    .client h3 { margin-bottom: 10px; color: #333; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    th { background: #333; color: white; padding: 12px; text-align: left; }
    td { padding: 12px; border-bottom: 1px solid #eee; }
    .totals { text-align: right; }
    .totals .row { display: flex; justify-content: flex-end; gap: 40px; padding: 8px 0; }
    .totals .total { font-size: 20px; font-weight: bold; border-top: 2px solid #333; padding-top: 12px; }
    .notes { margin-top: 40px; padding: 20px; background: #fff8e1; border-radius: 8px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="company">{{branding.companyName}}</div>
    <div class="quote-info">
      <div>Quote #{{meta.quoteNumber}}</div>
      <div>Date: {{meta.date}}</div>
      {{#meta.validUntil}}<div>Valid Until: {{meta.validUntil}}</div>{{/meta.validUntil}}
    </div>
  </div>

  <div class="client">
    <h3>Bill To:</h3>
    <div>{{client.name}}</div>
    {{#client.company}}<div>{{client.company}}</div>{{/client.company}}
    {{#client.address}}<div>{{client.address}}</div>{{/client.address}}
    {{#client.email}}<div>{{client.email}}</div>{{/client.email}}
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th>Qty</th>
        <th>Unit Price</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      {{#lineItems}}
      <tr>
        <td>{{description}}</td>
        <td>{{quantity}}</td>
        <td>\${{unitPrice}}</td>
        <td>\${{total}}</td>
      </tr>
      {{/lineItems}}
    </tbody>
  </table>

  <div class="totals">
    <div class="row"><span>Subtotal:</span> <span>\${{totals.subtotal}}</span></div>
    {{#totals.tax}}<div class="row"><span>Tax:</span> <span>\${{totals.tax}}</span></div>{{/totals.tax}}
    {{#totals.discount}}<div class="row"><span>Discount:</span> <span>-\${{totals.discount}}</span></div>{{/totals.discount}}
    <div class="row total"><span>Total:</span> <span>\${{totals.total}}</span></div>
  </div>

  {{#meta.notes}}
  <div class="notes">
    <strong>Notes:</strong>
    <p>{{meta.notes}}</p>
  </div>
  {{/meta.notes}}
</body>
</html>
`;
}
