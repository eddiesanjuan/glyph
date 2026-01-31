/**
 * Mustache Utilities
 * Helper functions for working with Mustache templates
 */

/**
 * Extract Mustache placeholder names from HTML template.
 * Finds all {{variable}}, {{object.property}}, etc. patterns.
 * Ignores section tags ({{#...}}, {{/...}}, {{^...}}) and comments ({{!...}}).
 *
 * @param html The HTML template with Mustache placeholders
 * @returns Array of unique placeholder names (root field names)
 *
 * @example
 * extractMustachePlaceholders("Hello {{name}}, your total is {{order.total}}")
 * // Returns: ["name", "order"]
 */
export function extractMustachePlaceholders(html: string): string[] {
  // Match Mustache placeholders that are NOT section/block tags
  // Pattern breakdown:
  //   \{\{         - Opening double braces
  //   ([^#/^!>{\s] - First char: NOT a section marker (#, /, ^), comment (!), partial (>), or whitespace
  //   [^}]*)       - Rest of placeholder: anything except closing brace
  //   \}\}         - Closing double braces
  const regex = /\{\{([^#/^!>{\s][^}]*)\}\}/g;
  const placeholders = new Set<string>();
  let match;

  while ((match = regex.exec(html)) !== null) {
    // Clean up the placeholder (trim whitespace)
    const placeholder = match[1].trim();

    if (placeholder) {
      // Get root field name (e.g., "invoice" from "invoice.number")
      const rootField = placeholder.split(".")[0];
      placeholders.add(rootField);
    }
  }

  return Array.from(placeholders);
}

/**
 * Extract all Mustache placeholders with their full paths.
 * Unlike extractMustachePlaceholders, this returns the full path (e.g., "invoice.number")
 * not just the root field.
 *
 * @param html The HTML template with Mustache placeholders
 * @returns Array of unique full placeholder paths
 *
 * @example
 * extractMustachePlaceholdersFull("Hello {{name}}, total: {{order.total}}")
 * // Returns: ["name", "order.total"]
 */
export function extractMustachePlaceholdersFull(html: string): string[] {
  const regex = /\{\{([^#/^!>{\s][^}]*)\}\}/g;
  const placeholders = new Set<string>();
  let match;

  while ((match = regex.exec(html)) !== null) {
    const placeholder = match[1].trim();
    if (placeholder) {
      placeholders.add(placeholder);
    }
  }

  return Array.from(placeholders);
}

/**
 * Validate that a template contains valid Mustache syntax.
 * Checks for balanced section tags and valid placeholder patterns.
 *
 * @param html The HTML template to validate
 * @returns Validation result with details about any issues
 */
export function validateMustacheSyntax(html: string): {
  valid: boolean;
  errors: string[];
  placeholderCount: number;
} {
  const errors: string[] = [];
  const placeholders = extractMustachePlaceholdersFull(html);

  // Check for unbalanced section tags
  const sectionOpenRegex = /\{\{#([^}]+)\}\}/g;
  const sectionCloseRegex = /\{\{\/([^}]+)\}\}/g;

  const openSections: string[] = [];
  let openMatch;

  // Find all opening section tags
  while ((openMatch = sectionOpenRegex.exec(html)) !== null) {
    openSections.push(openMatch[1].trim());
  }

  const closeSections: string[] = [];
  let closeMatch;

  // Find all closing section tags
  while ((closeMatch = sectionCloseRegex.exec(html)) !== null) {
    closeSections.push(closeMatch[1].trim());
  }

  // Check for unmatched sections
  for (const section of openSections) {
    if (!closeSections.includes(section)) {
      errors.push(`Unclosed section tag: {{#${section}}}`);
    }
  }

  for (const section of closeSections) {
    if (!openSections.includes(section)) {
      errors.push(`Orphan closing tag: {{/${section}}}`);
    }
  }

  // Check for empty placeholders
  if (html.includes("{{}}")) {
    errors.push("Empty placeholder found: {{}}");
  }

  // Check for malformed placeholders (unclosed)
  const unclosedMatch = html.match(/\{\{[^}]*$/m);
  if (unclosedMatch) {
    errors.push("Unclosed placeholder found");
  }

  return {
    valid: errors.length === 0,
    errors,
    placeholderCount: placeholders.length,
  };
}

/**
 * Check if HTML contains Mustache placeholders.
 * Quick check without extracting all placeholders.
 *
 * @param html The HTML to check
 * @returns True if template contains Mustache syntax
 */
export function hasMustachePlaceholders(html: string): boolean {
  // Look for any Mustache-like pattern
  return /\{\{[^}]+\}\}/.test(html);
}
