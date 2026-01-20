/**
 * Glyph AI Guardrails
 * Prevents AI from tampering with data values while allowing style changes.
 *
 * Security layers:
 * 1. Prompt validation - blocks injection attempts before AI call
 * 2. Output validation - ensures AI didn't break critical elements
 * 3. HTML sanitization - removes dangerous elements as fallback
 */

export interface GuardrailResult {
  valid: boolean;
  violations: string[];
  sanitizedHtml?: string;
}

export interface PromptValidationResult {
  valid: boolean;
  reason?: string;
  category?: "injection" | "data_modification" | "safe";
}

/**
 * Extract all Mustache placeholders from HTML
 * Handles both simple {{variable}} and nested {{object.property}} patterns
 */
function extractPlaceholders(html: string): Set<string> {
  const placeholders = new Set<string>();
  const regex = /\{\{([^}]+)\}\}/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const content = match[1].trim();
    // Skip section markers ({{#...}}, {{/...}}, {{^...}})
    if (
      !content.startsWith("#") &&
      !content.startsWith("/") &&
      !content.startsWith("^")
    ) {
      placeholders.add(match[0]);
    }
  }
  return placeholders;
}

/**
 * Extract all section markers from HTML
 * Sections are {{#section}}...{{/section}} blocks
 */
function extractSections(html: string): Set<string> {
  const sections = new Set<string>();
  const openRegex = /\{\{#([^}]+)\}\}/g;
  let match;
  while ((match = openRegex.exec(html)) !== null) {
    sections.add(match[1].trim());
  }
  return sections;
}

/**
 * Known valid Mustache sections that are allowed in templates
 * Any section NOT in this list that gets created by AI is suspicious
 */
const ALLOWED_SECTIONS = new Set([
  // Core data loops
  "lineItems",
  // Conditional field wrappers (optional fields)
  "client.phone",
  "client.email",
  "client.company",
  "client.address",
  "branding.logoUrl",
  "branding.companyAddress",
  "meta.notes",
  "meta.terms",
  "meta.showSignature",
  "meta.poNumber",
  "meta.paymentInstructions",
  "meta.deliveryNotes",
  "totals.discount",
  "totals.discountPercent",
  "totals.tax",
  "totals.taxRate",
  "totals.shipping",
  "totals.deposit",
  "totals.balance",
]);

/**
 * Check for unauthorized new loop structures that would break the template
 * This catches AI attempts to create {{#categories}}, {{#items}}, etc.
 */
function findUnauthorizedSections(originalHtml: string, modifiedHtml: string): string[] {
  const violations: string[] = [];

  const originalSections = extractSections(originalHtml);
  const modifiedSections = extractSections(modifiedHtml);

  // Check for new sections that weren't in the original and aren't in the allowed list
  for (const section of modifiedSections) {
    if (!originalSections.has(section) && !ALLOWED_SECTIONS.has(section)) {
      // This is a NEW section that AI created - likely breaks data bindings
      violations.push(`Unauthorized new Mustache section: {{#${section}}} - this data structure does not exist`);
    }
  }

  return violations;
}

/**
 * Check for unmatched/broken Mustache syntax
 * Detects cases where opening tags don't have closing tags or vice versa
 */
function findBrokenMustacheSyntax(html: string): string[] {
  const violations: string[] = [];

  // Extract all opening sections {{#...}}
  const openingSections: string[] = [];
  const openRegex = /\{\{#([^}]+)\}\}/g;
  let match;
  while ((match = openRegex.exec(html)) !== null) {
    openingSections.push(match[1].trim());
  }

  // Extract all closing sections {{/...}}
  const closingSections: string[] = [];
  const closeRegex = /\{\{\/([^}]+)\}\}/g;
  while ((match = closeRegex.exec(html)) !== null) {
    closingSections.push(match[1].trim());
  }

  // Count occurrences
  const openingCounts = new Map<string, number>();
  const closingCounts = new Map<string, number>();

  for (const section of openingSections) {
    openingCounts.set(section, (openingCounts.get(section) || 0) + 1);
  }

  for (const section of closingSections) {
    closingCounts.set(section, (closingCounts.get(section) || 0) + 1);
  }

  // Check for mismatches
  const allSections = new Set([...openingCounts.keys(), ...closingCounts.keys()]);

  for (const section of allSections) {
    const openCount = openingCounts.get(section) || 0;
    const closeCount = closingCounts.get(section) || 0;

    if (openCount !== closeCount) {
      if (openCount > closeCount) {
        violations.push(`Unclosed Mustache section: {{#${section}}} has ${openCount} opening tags but only ${closeCount} closing tags`);
      } else {
        violations.push(`Orphan closing tag: {{/${section}}} has ${closeCount} closing tags but only ${openCount} opening tags`);
      }
    }
  }

  // Check for malformed Mustache syntax (unclosed braces)
  const malformedOpening = html.match(/\{\{[^}]*$/gm);
  if (malformedOpening) {
    violations.push("Malformed Mustache syntax: unclosed {{ brace detected");
  }

  return violations;
}

/**
 * Extract all data-glyph-region markers
 */
function extractRegions(html: string): Set<string> {
  const regions = new Set<string>();
  const regex = /data-glyph-region="([^"]+)"/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    regions.add(match[1]);
  }
  return regions;
}

/**
 * Check for dangerous external URLs
 * Allows only known safe domains for fonts/CDNs
 */
function findExternalUrls(html: string): string[] {
  const dangerous: string[] = [];
  const urlRegex = /(src|href)=["']?(https?:\/\/[^"'\s>]+)/gi;
  let match;

  // Safe domains for external resources
  const safeDomains = [
    "glyph.you",
    "glyph.so",
    "glyph.dev",
    "fonts.googleapis.com",
    "fonts.gstatic.com",
    "cdnjs.cloudflare.com",
    "unpkg.com",
    "cdn.jsdelivr.net",
  ];

  while ((match = urlRegex.exec(html)) !== null) {
    const url = match[2].toLowerCase();
    // Skip template placeholders in URLs
    if (url.includes("{{")) continue;

    const isSafe = safeDomains.some((domain) => url.includes(domain));
    if (!isSafe) {
      dangerous.push(url);
    }
  }
  return dangerous;
}

/**
 * Check for script injection attempts
 */
function findScriptInjection(html: string): string[] {
  const violations: string[] = [];

  // Check for script tags (including variations)
  if (/<script[\s>]/i.test(html)) {
    violations.push("Script tag detected");
  }

  // Check for event handlers (onclick, onerror, onload, etc.)
  const eventHandlers = /\s+on\w+\s*=/gi;
  if (eventHandlers.test(html)) {
    violations.push("Event handler attribute detected (onclick, onerror, etc.)");
  }

  // Check for javascript: URLs
  if (/javascript:/i.test(html)) {
    violations.push("JavaScript URL detected");
  }

  // Check for data: URLs that could contain executable content
  if (/data:text\/html/i.test(html)) {
    violations.push("Suspicious data:text/html URL detected");
  }

  // Check for base64 encoded potentially malicious content
  if (/data:[^,]*;base64,/i.test(html) && !/data:image\//i.test(html)) {
    violations.push("Non-image base64 data URL detected");
  }

  // Check for vbscript (IE-specific but still a concern)
  if (/vbscript:/i.test(html)) {
    violations.push("VBScript URL detected");
  }

  // Check for expression() CSS (IE-specific XSS vector)
  if (/expression\s*\(/i.test(html)) {
    violations.push("CSS expression() detected");
  }

  // Check for -moz-binding (Firefox XSS vector)
  if (/-moz-binding/i.test(html)) {
    violations.push("CSS -moz-binding detected");
  }

  return violations;
}

/**
 * Validate that AI modification didn't break critical elements
 */
export function validateModification(
  originalHtml: string,
  modifiedHtml: string
): GuardrailResult {
  const violations: string[] = [];

  // 0. CRITICAL: Check for broken Mustache syntax first
  const brokenSyntax = findBrokenMustacheSyntax(modifiedHtml);
  violations.push(...brokenSyntax);

  // 0.5. CRITICAL: Check for unauthorized new loop structures
  const unauthorizedSections = findUnauthorizedSections(originalHtml, modifiedHtml);
  violations.push(...unauthorizedSections);

  // 1. Check all data placeholders are preserved
  const originalPlaceholders = extractPlaceholders(originalHtml);
  const modifiedPlaceholders = extractPlaceholders(modifiedHtml);

  Array.from(originalPlaceholders).forEach((placeholder) => {
    if (!modifiedPlaceholders.has(placeholder)) {
      violations.push(`Missing data placeholder: ${placeholder}`);
    }
  });

  // 2. Check all critical sections are preserved
  const originalSections = extractSections(originalHtml);
  const modifiedSections = extractSections(modifiedHtml);

  Array.from(originalSections).forEach((section) => {
    if (!modifiedSections.has(section)) {
      violations.push(`Missing section block: {{#${section}}}`);
    }
  });

  // 3. Check all regions are preserved
  const originalRegions = extractRegions(originalHtml);
  const modifiedRegions = extractRegions(modifiedHtml);

  Array.from(originalRegions).forEach((region) => {
    if (!modifiedRegions.has(region)) {
      violations.push(`Missing region: data-glyph-region="${region}"`);
    }
  });

  // 4. Check for external URLs
  const externalUrls = findExternalUrls(modifiedHtml);
  if (externalUrls.length > 0) {
    violations.push(
      `Unauthorized external URLs: ${externalUrls.slice(0, 3).join(", ")}${externalUrls.length > 3 ? ` (+${externalUrls.length - 3} more)` : ""}`
    );
  }

  // 5. Check for script injection
  const scriptViolations = findScriptInjection(modifiedHtml);
  violations.push(...scriptViolations);

  // 6. Check HTML structure basics (only for full documents)
  if (
    originalHtml.includes("<!DOCTYPE html>") ||
    originalHtml.includes("<html")
  ) {
    if (
      !modifiedHtml.includes("<!DOCTYPE html>") &&
      !modifiedHtml.includes("<html")
    ) {
      violations.push("Missing HTML document structure");
    }
  }

  // 7. Check for suspicious content additions
  if (modifiedHtml.includes("<iframe")) {
    violations.push("Iframe element detected");
  }
  if (modifiedHtml.includes("<embed")) {
    violations.push("Embed element detected");
  }
  if (modifiedHtml.includes("<object")) {
    violations.push("Object element detected");
  }
  if (modifiedHtml.includes("<form") && !originalHtml.includes("<form")) {
    violations.push("New form element added");
  }

  return {
    valid: violations.length === 0,
    violations,
    sanitizedHtml: violations.length === 0 ? modifiedHtml : undefined,
  };
}

/**
 * Sanitize HTML by removing dangerous elements
 * Used as fallback when validation fails
 */
export function sanitizeHtml(html: string): string {
  let sanitized = html;

  // Remove script tags and their contents
  sanitized = sanitized.replace(
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    ""
  );

  // Remove event handler attributes
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, "");
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*[^\s>]+/gi, "");

  // Remove javascript: URLs
  sanitized = sanitized.replace(
    /href\s*=\s*["']javascript:[^"']*["']/gi,
    'href="#"'
  );
  sanitized = sanitized.replace(
    /src\s*=\s*["']javascript:[^"']*["']/gi,
    'src=""'
  );

  // Remove dangerous data: URLs
  sanitized = sanitized.replace(
    /href\s*=\s*["']data:text\/html[^"']*["']/gi,
    'href="#"'
  );

  // Remove iframes, embeds, objects
  sanitized = sanitized.replace(
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    ""
  );
  sanitized = sanitized.replace(/<embed\b[^>]*>/gi, "");
  sanitized = sanitized.replace(
    /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
    ""
  );

  // Remove CSS expressions
  sanitized = sanitized.replace(/expression\s*\([^)]*\)/gi, "none");

  // Remove -moz-binding
  sanitized = sanitized.replace(/-moz-binding\s*:[^;]+;?/gi, "");

  return sanitized;
}

/**
 * Check if prompt requests structural data changes that would break templates
 * These requests are allowed to proceed but with enhanced AI instructions
 */
export function detectStructuralRequest(prompt: string): {
  isStructural: boolean;
  warningMessage?: string;
} {
  const lowerPrompt = prompt.toLowerCase();

  // Patterns that indicate requests to restructure data (not just style)
  const structuralPatterns = [
    {
      pattern: /group\s*(the\s+)?(items?|line\s*items?|data).*by/i,
      message: "Grouping requires data structure changes. Visual grouping will be applied instead."
    },
    {
      pattern: /sort\s*(the\s+)?(items?|line\s*items?|data)/i,
      message: "Sorting requires backend changes. Visual styling will be applied instead."
    },
    {
      pattern: /organize\s*(the\s+)?(items?|line\s*items?|data)/i,
      message: "Organizing requires data restructuring. Visual enhancements will be applied instead."
    },
    {
      pattern: /reorder\s*(the\s+)?(items?|line\s*items?|rows?)/i,
      message: "Reordering requires backend changes. Visual styling will be applied instead."
    },
    {
      pattern: /split\s*(the\s+)?(items?|line\s*items?).*into/i,
      message: "Splitting items requires data structure changes. Visual separation will be applied instead."
    },
    {
      pattern: /create\s*(new\s+)?(categories|sections|groups)\s*(for|from)/i,
      message: "Creating new categories requires backend changes. Visual styling will be applied instead."
    },
    {
      pattern: /add\s*(new\s+)?(loop|iteration|array)/i,
      message: "Adding new data loops is not supported. Visual enhancements will be applied instead."
    },
  ];

  for (const { pattern, message } of structuralPatterns) {
    if (pattern.test(lowerPrompt)) {
      return { isStructural: true, warningMessage: message };
    }
  }

  return { isStructural: false };
}

/**
 * Pre-validate user prompt for injection attempts
 * Called BEFORE sending to AI
 */
export function validatePrompt(prompt: string): PromptValidationResult {
  const lowerPrompt = prompt.toLowerCase();

  // Check for prompt injection attempts
  const injectionPatterns = [
    "ignore previous",
    "ignore all previous",
    "ignore your previous",
    "disregard previous",
    "disregard your previous",
    "forget your instructions",
    "forget previous instructions",
    "new instructions:",
    "system:",
    "system prompt:",
    "you are now",
    "pretend you are",
    "act as if",
    "roleplay as",
    "from now on",
    "override",
    "bypass",
    "jailbreak",
    "developer mode",
    "dan mode",
    "ignore safety",
    "ignore guidelines",
  ];

  for (const pattern of injectionPatterns) {
    if (lowerPrompt.includes(pattern)) {
      return {
        valid: false,
        reason: "Prompt contains disallowed instruction patterns",
        category: "injection",
      };
    }
  }

  // Check for data modification attempts
  const dataModPatterns = [
    { pattern: "change the price", reason: "Cannot modify price data" },
    { pattern: "change the total", reason: "Cannot modify total data" },
    { pattern: "modify the amount", reason: "Cannot modify amount data" },
    { pattern: "update the quantity", reason: "Cannot modify quantity data" },
    { pattern: "change the date", reason: "Cannot modify date data" },
    { pattern: "alter the data", reason: "Cannot alter data values" },
    { pattern: "delete the line", reason: "Cannot delete line items" },
    { pattern: "remove all items", reason: "Cannot remove data items" },
    { pattern: "change the name to", reason: "Cannot modify name data" },
    { pattern: "set the value", reason: "Cannot set data values" },
    { pattern: "replace the text with", reason: "Cannot replace data text" },
    { pattern: "edit the number", reason: "Cannot edit number data" },
    { pattern: "change {{", reason: "Cannot modify template placeholders" },
    { pattern: "remove {{", reason: "Cannot remove template placeholders" },
    { pattern: "delete {{", reason: "Cannot delete template placeholders" },
  ];

  for (const { pattern, reason } of dataModPatterns) {
    if (lowerPrompt.includes(pattern)) {
      return {
        valid: false,
        reason: `${reason} - only styling changes are allowed`,
        category: "data_modification",
      };
    }
  }

  // Check for attempts to add executable content
  const executablePatterns = [
    { pattern: "add a script", reason: "Cannot add script elements" },
    { pattern: "insert javascript", reason: "Cannot add JavaScript" },
    { pattern: "add onclick", reason: "Cannot add event handlers" },
    { pattern: "add an iframe", reason: "Cannot add iframe elements" },
    { pattern: "embed a form", reason: "Cannot add form elements" },
    { pattern: "add a form", reason: "Cannot add form elements" },
    {
      pattern: "external link to",
      reason: "Cannot add arbitrary external links",
    },
  ];

  for (const { pattern, reason } of executablePatterns) {
    if (lowerPrompt.includes(pattern)) {
      return {
        valid: false,
        reason,
        category: "injection",
      };
    }
  }

  return { valid: true, category: "safe" };
}

/**
 * Combined validation pipeline
 * Validates both the prompt (before AI) and the result (after AI)
 */
export function runGuardrails(
  originalHtml: string,
  prompt: string,
  modifiedHtml?: string
): {
  promptValid: boolean;
  promptReason?: string;
  isStructuralRequest?: boolean;
  structuralWarning?: string;
  outputValid?: boolean;
  outputViolations?: string[];
  sanitizedHtml?: string;
} {
  // Step 1: Validate prompt
  const promptResult = validatePrompt(prompt);
  if (!promptResult.valid) {
    return {
      promptValid: false,
      promptReason: promptResult.reason,
    };
  }

  // Step 1.5: Detect structural requests (for logging/warning purposes)
  const structuralCheck = detectStructuralRequest(prompt);

  // Step 2: If we have modified HTML, validate it
  if (modifiedHtml) {
    const outputResult = validateModification(originalHtml, modifiedHtml);

    // If output validation failed and we detected a structural request,
    // the AI likely broke the template despite our warnings
    if (!outputResult.valid && structuralCheck.isStructural) {
      console.warn(`[Guardrails] Structural request likely broke template: "${prompt.substring(0, 100)}..."`);
      console.warn(`[Guardrails] Violations: ${outputResult.violations.join(', ')}`);
    }

    return {
      promptValid: true,
      isStructuralRequest: structuralCheck.isStructural,
      structuralWarning: structuralCheck.warningMessage,
      outputValid: outputResult.valid,
      outputViolations: outputResult.violations,
      sanitizedHtml: outputResult.valid
        ? modifiedHtml
        : sanitizeHtml(modifiedHtml),
    };
  }

  return {
    promptValid: true,
    isStructuralRequest: structuralCheck.isStructural,
    structuralWarning: structuralCheck.warningMessage,
  };
}
