/**
 * Template Generator Service
 *
 * Generates a branded HTML template from extracted brand attributes.
 * Takes existing base templates and applies brand colors, fonts, and styling.
 */

import { existsSync, promises as fsPromises } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { BrandAttributes } from "./brandExtraction.js";
import { logger } from "./logger.js";

// Get directory of current module for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Templates are stored relative to the api folder
const TEMPLATES_DIR = join(__dirname, "../../../templates");

/**
 * Generated template result
 */
export interface GeneratedTemplate {
  html: string;           // Complete HTML template with Mustache placeholders
  css: string;            // Extracted CSS (for reference)
  schema: object;         // JSON Schema for template data
  brandApplied: BrandAttributes;
}

/**
 * Template type to base template mapping
 */
const TEMPLATE_MAP: Record<string, string> = {
  'invoice': 'invoice-clean',
  'quote': 'quote-modern',
  'receipt': 'receipt-minimal',
  'letter': 'letter-business',
  'report': 'report-cover',
};

/**
 * Default CSS variables used in templates
 */
type CSSVariables = Record<string, string>;

/**
 * Web-safe font stacks for different font categories
 */
const FONT_STACKS: Record<string, string> = {
  'sans-serif': "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  'serif': "Georgia, 'Times New Roman', Times, serif",
  'monospace': "'SF Mono', 'Monaco', 'Inconsolata', 'Fira Mono', 'Droid Sans Mono', monospace",
  'modern': "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  'traditional': "Georgia, 'Times New Roman', Times, serif",
  'minimal': "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  'bold': "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  'corporate': "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};

/**
 * Load base template HTML from filesystem
 */
async function loadBaseTemplate(templateId: string): Promise<string> {
  const templatePath = join(TEMPLATES_DIR, templateId, "template.html");

  if (!existsSync(templatePath)) {
    throw new Error(`Template not found: ${templateId}`);
  }

  return fsPromises.readFile(templatePath, "utf-8");
}

/**
 * Load schema from filesystem
 */
async function loadTemplateSchema(templateId: string): Promise<object> {
  const schemaPath = join(TEMPLATES_DIR, templateId, "schema.json");

  if (!existsSync(schemaPath)) {
    // Return a minimal schema if no schema file exists
    return {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "type": "object",
      "properties": {}
    };
  }

  const schemaContent = await fsPromises.readFile(schemaPath, "utf-8");
  return JSON.parse(schemaContent);
}

/**
 * Extract CSS from HTML template
 */
function extractCSS(html: string): string {
  const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  return styleMatch ? styleMatch[1].trim() : '';
}

/**
 * Calculate relative luminance of a color
 * Used for determining contrast
 */
function getLuminance(hex: string): number {
  // Remove # if present
  const color = hex.replace('#', '');

  const r = parseInt(color.substr(0, 2), 16) / 255;
  const g = parseInt(color.substr(2, 2), 16) / 255;
  const b = parseInt(color.substr(4, 2), 16) / 255;

  const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Determine contrasting text color for a background
 */
function getContrastingTextColor(bgColor: string): string {
  const luminance = getLuminance(bgColor);
  // Use light text on dark backgrounds, dark text on light backgrounds
  return luminance > 0.5 ? '#1a1a1a' : '#ffffff';
}

/**
 * Derive a lighter shade of a color for backgrounds
 */
function getLighterShade(hex: string, factor: number = 0.95): string {
  const color = hex.replace('#', '');

  const r = parseInt(color.substr(0, 2), 16);
  const g = parseInt(color.substr(2, 2), 16);
  const b = parseInt(color.substr(4, 2), 16);

  // Blend with white
  const newR = Math.round(r + (255 - r) * factor);
  const newG = Math.round(g + (255 - g) * factor);
  const newB = Math.round(b + (255 - b) * factor);

  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
}

/**
 * Derive a darker shade of a color for borders
 */
function getDarkerShade(hex: string, factor: number = 0.2): string {
  const color = hex.replace('#', '');

  const r = parseInt(color.substr(0, 2), 16);
  const g = parseInt(color.substr(2, 2), 16);
  const b = parseInt(color.substr(4, 2), 16);

  // Blend with black
  const newR = Math.round(r * (1 - factor));
  const newG = Math.round(g * (1 - factor));
  const newB = Math.round(b * (1 - factor));

  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
}

/**
 * Build CSS variable values from brand attributes
 */
function buildCSSVariables(brand: BrandAttributes): CSSVariables {
  const primary = brand.colors.primary;

  return {
    '--accent-color': primary,
    '--text-primary': brand.colors.text || '#1a1a1a',
    '--text-secondary': brand.colors.secondary || '#666666',
    '--border-color': getDarkerShade(brand.colors.background || '#ffffff', 0.1),
    '--bg-light': brand.colors.background || getLighterShade(primary, 0.95),
  };
}

/**
 * Replace CSS variable values in HTML string
 * Handles both Mustache placeholders (e.g., {{styles.accentColor}}) and static values
 */
function applyCSSVariables(html: string, variables: Record<string, string>): string {
  let result = html;

  // Find the :root block - need to handle Mustache {{ }} inside the block
  // Use a more careful approach: find ":root {" and then match to closing "}"
  // accounting for the fact that Mustache placeholders contain braces
  const rootStartIndex = result.indexOf(':root');
  if (rootStartIndex === -1) return result;

  const openBraceIndex = result.indexOf('{', rootStartIndex);
  if (openBraceIndex === -1) return result;

  // Find the matching closing brace (skip Mustache {{ }})
  let braceCount = 1;
  let i = openBraceIndex + 1;
  while (i < result.length && braceCount > 0) {
    if (result[i] === '{') {
      // Check if this is a Mustache opening {{
      if (result[i + 1] === '{') {
        // Skip to after the closing }}
        const closeIdx = result.indexOf('}}', i);
        if (closeIdx !== -1) {
          i = closeIdx + 2;
          continue;
        }
      }
      braceCount++;
    } else if (result[i] === '}') {
      braceCount--;
    }
    i++;
  }

  if (braceCount !== 0) return result;

  const closeBraceIndex = i - 1;
  let rootContent = result.substring(openBraceIndex + 1, closeBraceIndex);

  // Replace each CSS variable
  for (const [varName, value] of Object.entries(variables)) {
    // Escape special regex characters in variable name
    const escapedVarName = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Match the variable declaration and replace its value
    // Handles Mustache {{...}} and regular values
    const varRegex = new RegExp(
      `(${escapedVarName}\\s*:\\s*)` +     // Variable name with colon
      `(\\{\\{[^}]*\\}\\}|[^;]+)` +        // Mustache placeholder OR any value before ;
      `(;)`,                                // Semicolon
      'g'
    );
    rootContent = rootContent.replace(varRegex, `$1${value}$3`);
  }

  // Reconstruct the HTML with updated :root block
  result = result.substring(0, openBraceIndex + 1) +
           rootContent +
           result.substring(closeBraceIndex);

  return result;
}

/**
 * Apply font family override to HTML
 */
function applyFontOverride(html: string, brand: BrandAttributes): string {
  let result = html;

  // Determine font stack based on layout style or detected fonts
  let fontStack = FONT_STACKS[brand.layout.style] || FONT_STACKS['modern'];

  if (brand.fonts?.body) {
    // If a specific font was detected, prepend it to the stack
    fontStack = `'${brand.fonts.body}', ${fontStack}`;
  }

  // Add a CSS variable for brand font family
  const fontVarCSS = `--brand-font-family: ${fontStack};`;

  // Insert the font variable into :root
  const rootRegex = /:root\s*\{/;
  if (rootRegex.test(result)) {
    result = result.replace(rootRegex, `:root {\n      ${fontVarCSS}`);
  }

  return result;
}

/**
 * Apply page size configuration
 */
function applyPageSize(html: string, pageSize: 'letter' | 'a4'): string {
  // Replace @page size
  const pageSizeRegex = /@page\s*\{[^}]*size:\s*[^;]+;/g;
  return html.replace(pageSizeRegex, `@page {\n      size: ${pageSize};`);
}

/**
 * Add logo placeholder section if requested
 */
function addLogoPlaceholder(html: string, brand: BrandAttributes): string {
  // If the template already has logo support ({{#branding.logoUrl}}), return as-is
  if (html.includes('branding.logoUrl') || html.includes('logoUrl')) {
    return html;
  }

  // For templates without logo support, we could inject it
  // But for safety, we'll just log and return unchanged
  logger.info('[TemplateGenerator] Template does not have logo placeholder, skipping logo injection');
  return html;
}

/**
 * Generate a branded HTML template from extracted brand attributes
 *
 * @param brand - Extracted brand attributes from brandExtraction service
 * @param baseTemplate - Type of template to generate
 * @param options - Additional options for template generation
 * @returns Generated template with applied branding
 */
export async function generateBrandedTemplate(
  brand: BrandAttributes,
  baseTemplate: 'invoice' | 'quote' | 'receipt' | 'letter' | 'report',
  options?: {
    includeLogoPlaceholder?: boolean;
    pageSize?: 'letter' | 'a4';
  }
): Promise<GeneratedTemplate> {
  const startTime = Date.now();

  // Resolve template ID from the template type
  const templateId = TEMPLATE_MAP[baseTemplate];
  if (!templateId) {
    throw new Error(`Unknown template type: ${baseTemplate}`);
  }

  logger.info('[TemplateGenerator] Generating branded template', {
    baseTemplate,
    templateId,
    brandPrimaryColor: brand.colors.primary,
    layoutStyle: brand.layout.style,
  });

  try {
    // Load base template and schema
    const [templateHtml, schema] = await Promise.all([
      loadBaseTemplate(templateId),
      loadTemplateSchema(templateId),
    ]);

    // Build CSS variables from brand
    const cssVariables = buildCSSVariables(brand);

    // Apply transformations
    let html = templateHtml;

    // 1. Apply CSS variables (colors)
    html = applyCSSVariables(html, cssVariables);

    // 2. Apply font overrides
    html = applyFontOverride(html, brand);

    // 3. Apply page size if specified
    if (options?.pageSize) {
      html = applyPageSize(html, options.pageSize);
    }

    // 4. Handle logo placeholder if requested
    if (options?.includeLogoPlaceholder) {
      html = addLogoPlaceholder(html, brand);
    }

    // Extract final CSS for reference
    const css = extractCSS(html);

    const durationMs = Date.now() - startTime;

    logger.info('[TemplateGenerator] Template generated successfully', {
      templateId,
      durationMs,
      htmlLength: html.length,
      cssLength: css.length,
    });

    return {
      html,
      css,
      schema,
      brandApplied: brand,
    };
  } catch (error) {
    logger.error('[TemplateGenerator] Failed to generate template', {
      baseTemplate,
      templateId,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
    });
    throw error;
  }
}

/**
 * Get list of available base template types
 */
export function getAvailableTemplateTypes(): string[] {
  return Object.keys(TEMPLATE_MAP);
}

/**
 * Check if a template type is valid
 */
export function isValidTemplateType(type: string): type is keyof typeof TEMPLATE_MAP {
  return type in TEMPLATE_MAP;
}
