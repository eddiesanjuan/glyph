/**
 * Glyph Self-Checking AI Validator
 *
 * This service validates AI modifications AFTER they're made, running in the background
 * to provide a "QA agent" that checks every edit without slowing down the UX.
 *
 * Validation checks:
 * 1. QR code covering important content
 * 2. Watermark obscuring text
 * 3. Content being wiped/missing
 * 4. Elements overlapping incorrectly
 * 5. Layout broken
 * 6. Missing required fields/regions
 *
 * Auto-fix capabilities:
 * - QR covering content → move QR to different corner
 * - Watermark too opaque → reduce opacity
 * - Missing regions → restore from before state
 */

import Anthropic from "@anthropic-ai/sdk";
import { logger } from "./logger.js";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ============================================================================
// Types
// ============================================================================

export type IssueSeverity = 'critical' | 'warning';
export type IssueType =
  | 'overlap'
  | 'missing_content'
  | 'broken_layout'
  | 'obscured_text'
  | 'missing_region'
  | 'missing_placeholder'
  | 'z_index_conflict';

export interface ValidationIssue {
  type: IssueType;
  severity: IssueSeverity;
  description: string;
  autoFixable: boolean;
  suggestedFix?: string;
  location?: string; // CSS selector or description of where the issue is
}

export interface ValidationResult {
  passed: boolean;
  issues: ValidationIssue[];
  fixedHtml?: string; // If auto-fix was applied
  validationTime: number; // ms
}

export interface VisualAnalysis {
  hasQrCode: boolean;
  qrCodePosition?: { corner: string; overlapsContent: boolean };
  hasWatermark: boolean;
  watermarkOpacity?: number;
  hasPositionedElements: boolean;
  positionedElements: Array<{
    type: string;
    position: string;
    potentialOverlap: boolean;
  }>;
}

// ============================================================================
// DOM Structure Analysis
// ============================================================================

/**
 * Extract all data-glyph-region markers from HTML
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
 * Style-related placeholder prefixes that are ALLOWED to be replaced
 * when AI applies styling (e.g., "Make this look like Stripe")
 * These should NOT trigger "missing placeholder" errors
 */
const STYLE_PLACEHOLDER_PREFIXES = [
  'styles.',
  'branding.accentColor',
  'branding.primaryColor',
  'branding.secondaryColor',
  'branding.backgroundColor',
  'branding.textColor',
];

/**
 * Check if a placeholder is a style-related placeholder that can be replaced
 */
function isStylePlaceholder(placeholder: string): boolean {
  // Extract the content between {{ and }}
  const content = placeholder.replace(/^\{\{|\}\}$/g, '').trim();
  return STYLE_PLACEHOLDER_PREFIXES.some(prefix => content.startsWith(prefix));
}

/**
 * Extract all Mustache placeholders from HTML
 * Includes both simple {{variable}} and nested {{object.property}} patterns
 *
 * @param html - The HTML to extract placeholders from
 * @param excludeStylePlaceholders - If true, excludes style-related placeholders
 */
function extractPlaceholders(html: string, excludeStylePlaceholders: boolean = false): Set<string> {
  const placeholders = new Set<string>();
  const regex = /\{\{([^#/^][^}]*)\}\}/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const content = match[1].trim();
    // Skip if it starts with section markers that we might have partially matched
    if (!content.startsWith('#') && !content.startsWith('/') && !content.startsWith('^')) {
      // Skip style placeholders if requested
      if (excludeStylePlaceholders && isStylePlaceholder(match[0])) {
        continue;
      }
      placeholders.add(match[0]);
    }
  }
  return placeholders;
}

/**
 * Detect positioned elements that could cause overlaps
 */
function detectPositionedElements(html: string): VisualAnalysis {
  const analysis: VisualAnalysis = {
    hasQrCode: false,
    hasWatermark: false,
    hasPositionedElements: false,
    positionedElements: []
  };

  // Check for QR code patterns
  const qrPatterns = [
    /position:\s*absolute[^}]*(?:top|right|bottom|left):[^}]*(?:qr|scan|pay)/gi,
    /<svg[^>]*viewBox="0 0 100 100"[^>]*>[\s\S]*?<rect[^>]*fill="#1a1a1a"[\s\S]*?<\/svg>/gi,
    /class="[^"]*qr[^"]*"/gi,
    /scan\s*to\s*pay/gi
  ];

  for (const pattern of qrPatterns) {
    if (pattern.test(html)) {
      analysis.hasQrCode = true;
      break;
    }
  }

  // Detect QR code position
  const qrPositionMatch = html.match(/position:\s*absolute[^}]*?(top|bottom):\s*(\d+)px[^}]*?(left|right):\s*(\d+)px/i);
  if (qrPositionMatch) {
    const vertPos = qrPositionMatch[1].toLowerCase();
    const horizPos = qrPositionMatch[3].toLowerCase();
    analysis.qrCodePosition = {
      corner: `${vertPos}-${horizPos}`,
      overlapsContent: false // Will be determined by AI analysis
    };
  }

  // Check for watermark patterns
  const watermarkPatterns = [
    /transform:[^}]*rotate\([^)]*\)[^}]*(?:font-size:\s*\d{2,}px|font-weight:\s*(?:bold|[6-9]00))/gi,
    /position:\s*absolute[^}]*(?:top:\s*50%|left:\s*50%)[^}]*transform:[^}]*translate/gi,
    /(?:DRAFT|PAID|VOID|CANCELLED|SAMPLE|CONFIDENTIAL)/g,
    /pointer-events:\s*none[^}]*(?:opacity|color:\s*rgba)/gi
  ];

  for (const pattern of watermarkPatterns) {
    if (pattern.test(html)) {
      analysis.hasWatermark = true;
      break;
    }
  }

  // Detect watermark opacity
  const opacityMatch = html.match(/(?:color:\s*rgba\([^)]+,\s*([\d.]+)\)|opacity:\s*([\d.]+))[^}]*(?:DRAFT|PAID|VOID|pointer-events:\s*none)/i);
  if (opacityMatch) {
    analysis.watermarkOpacity = parseFloat(opacityMatch[1] || opacityMatch[2] || '1');
  }

  // Find all positioned elements
  const positionedRegex = /position:\s*(absolute|fixed)[^}]*/gi;
  let match;
  while ((match = positionedRegex.exec(html)) !== null) {
    analysis.hasPositionedElements = true;
    const context = html.slice(Math.max(0, match.index - 100), match.index + match[0].length + 100);

    // Try to identify what type of element this is
    let type = 'unknown';
    if (/qr|scan|pay/i.test(context)) type = 'qr_code';
    else if (/draft|paid|void|watermark/i.test(context)) type = 'watermark';
    else if (/logo/i.test(context)) type = 'logo';
    else if (/badge|status/i.test(context)) type = 'badge';

    analysis.positionedElements.push({
      type,
      position: match[1],
      potentialOverlap: /z-index/i.test(context)
    });
  }

  return analysis;
}

/**
 * Compare DOM structure before and after modification
 */
function compareStructure(beforeHtml: string, afterHtml: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Check regions
  const beforeRegions = extractRegions(beforeHtml);
  const afterRegions = extractRegions(afterHtml);

  for (const region of beforeRegions) {
    if (!afterRegions.has(region)) {
      issues.push({
        type: 'missing_region',
        severity: 'critical',
        description: `Missing required region: data-glyph-region="${region}"`,
        autoFixable: true,
        suggestedFix: `Restore the ${region} region from the original template`,
        location: `data-glyph-region="${region}"`
      });
    }
  }

  // Check placeholders - EXCLUDE style placeholders as they can legitimately be replaced
  // when AI applies brand styling (e.g., "Make this look like Stripe")
  const beforePlaceholders = extractPlaceholders(beforeHtml, true); // Exclude style placeholders
  const afterPlaceholders = extractPlaceholders(afterHtml, true);   // Exclude style placeholders

  for (const placeholder of beforePlaceholders) {
    if (!afterPlaceholders.has(placeholder)) {
      issues.push({
        type: 'missing_placeholder',
        severity: 'critical',
        description: `Missing Mustache placeholder: ${placeholder}`,
        autoFixable: false, // Can't auto-fix without knowing where it should go
        suggestedFix: `Restore the ${placeholder} placeholder in its original location`
      });
    }
  }

  // Check if HTML structure is fundamentally broken
  if (beforeHtml.includes('<!DOCTYPE html>') && !afterHtml.includes('<!DOCTYPE html>')) {
    issues.push({
      type: 'broken_layout',
      severity: 'critical',
      description: 'Missing DOCTYPE declaration',
      autoFixable: true,
      suggestedFix: 'Add <!DOCTYPE html> at the beginning of the document'
    });
  }

  if (beforeHtml.includes('</html>') && !afterHtml.includes('</html>')) {
    issues.push({
      type: 'broken_layout',
      severity: 'critical',
      description: 'Missing closing </html> tag',
      autoFixable: true,
      suggestedFix: 'Add </html> at the end of the document'
    });
  }

  return issues;
}

/**
 * Detect potential visual issues without using AI
 * This is a fast, heuristic-based check
 */
function detectVisualIssues(html: string, beforeHtml: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const visual = detectPositionedElements(html);

  // Check for QR code potentially overlapping content regions
  if (visual.hasQrCode && visual.qrCodePosition) {
    // Check if QR is in top-right and there's content there
    if (visual.qrCodePosition.corner === 'top-right') {
      // Look for header content that might be under the QR
      if (html.match(/data-glyph-region="header"[^>]*>[^<]*<[^>]*style="[^"]*text-align:\s*right/i)) {
        issues.push({
          type: 'overlap',
          severity: 'warning',
          description: 'QR code may be overlapping right-aligned header content',
          autoFixable: true,
          suggestedFix: 'Move QR code to bottom-right corner to avoid header overlap',
          location: 'header region, top-right'
        });
      }
    }
  }

  // Check for watermark opacity issues - only warn if opacity is very high
  // Most professional watermarks are 5-20% opacity, so we only flag >25%
  if (visual.hasWatermark) {
    const opacityMatch = html.match(/(?:color:\s*rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)|opacity:\s*([\d.]+))/i);
    if (opacityMatch) {
      const opacity = parseFloat(opacityMatch[1] || opacityMatch[2]);
      // Only warn if opacity is very high (>25%) - standard watermarks are 5-20%
      if (opacity > 0.25) {
        issues.push({
          type: 'obscured_text',
          severity: 'warning',
          description: `Watermark opacity (${(opacity * 100).toFixed(0)}%) may be too high and obscure content`,
          autoFixable: true,
          suggestedFix: 'Reduce watermark opacity to 5-15% for better readability'
        });
      }
    }
  }

  // Check for z-index conflicts - only flag if there are MANY identical values
  // which suggests the AI may have made a mistake. Adjacent z-index values (1, 2, 3)
  // are often intentional for layering and shouldn't trigger warnings.
  const zIndexMatches = html.matchAll(/z-index:\s*(\d+)/gi);
  const zIndexValues: number[] = [];
  for (const match of zIndexMatches) {
    zIndexValues.push(parseInt(match[1]));
  }

  // Only warn if there are 4+ identical z-index values (suggests copy-paste error)
  // or if critical elements have the same z-index as overlays
  if (zIndexValues.length > 3) {
    const valueCounts = new Map<number, number>();
    for (const v of zIndexValues) {
      valueCounts.set(v, (valueCounts.get(v) || 0) + 1);
    }
    const hasDuplicates = Array.from(valueCounts.values()).some(count => count >= 4);
    if (hasDuplicates) {
      issues.push({
        type: 'z_index_conflict',
        severity: 'warning',
        description: 'Multiple elements share the same z-index value, which may cause unexpected stacking',
        autoFixable: false,
        suggestedFix: 'Review z-index values to ensure proper element stacking'
      });
    }
  }

  // Check for content wipe (significant reduction in content)
  const beforeLength = beforeHtml.replace(/<[^>]*>/g, '').length;
  const afterLength = html.replace(/<[^>]*>/g, '').length;

  if (beforeLength > 0 && afterLength / beforeLength < 0.5) {
    issues.push({
      type: 'missing_content',
      severity: 'critical',
      description: `Significant content reduction detected (${Math.round((1 - afterLength/beforeLength) * 100)}% of text content removed)`,
      autoFixable: false,
      suggestedFix: 'Review the modification to ensure important content was not accidentally removed'
    });
  }

  return issues;
}

// ============================================================================
// AI-Powered Visual Validation
// ============================================================================

/**
 * Use Claude to analyze the HTML for visual issues
 * This is called in the background after the modification is returned to the user
 */
async function aiAnalyzeModification(
  beforeHtml: string,
  afterHtml: string,
  _prompt: string // Not used - we intentionally don't check if user request was fulfilled
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022', // Fast model for quick validation
      max_tokens: 1024,
      system: `You are a QA agent that validates HTML documents for SEVERE VISUAL ISSUES ONLY.

CRITICAL: Be VERY conservative. Only report issues that would genuinely break the document.
Most HTML modifications are fine - only flag truly problematic cases.

Return ONLY this JSON format:
{
  "issues": [
    {
      "type": "overlap|missing_content|broken_layout|obscured_text",
      "severity": "critical|warning",
      "description": "Brief description",
      "autoFixable": true|false,
      "suggestedFix": "How to fix (if autoFixable)"
    }
  ]
}

If the document looks okay, return: {"issues": []}
WHEN IN DOUBT, return {"issues": []} - false negatives are better than false positives.

ONLY report issues if you are CERTAIN:
1. QR codes or watermarks DIRECTLY overlapping important text (making it unreadable)
2. A large section of content is COMPLETELY MISSING (not just styled differently)
3. Critical structural breakage (document won't render at all)

DO NOT report:
- "Incomplete HTML" - the document is complete if it renders
- "Request not fulfilled" - that's not your job
- Styling preferences or design quality
- Minor inconsistencies
- Anything about colors, fonts, or aesthetics
- Anything about Mustache template syntax
- Potential or possible issues - only DEFINITE problems
- Added elements like watermarks, QR codes, or signatures - these are intentional additions
- "Some content may have been affected" - this is too vague to be useful
- Any issue you are not 100% certain about`,
      messages: [{
        role: 'user',
        content: `BEFORE HTML (relevant excerpts):
${extractRelevantExcerpts(beforeHtml)}

AFTER HTML (relevant excerpts):
${extractRelevantExcerpts(afterHtml)}

Check for TECHNICAL visual issues only (overlaps, broken structure, missing content). Return JSON only.`
      }]
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    // Parse the JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed.issues)) {
        for (const issue of parsed.issues) {
          if (isValidIssue(issue)) {
            const validatedIssue = issue as ValidationIssue;
            // Filter out "request not fulfilled" type issues - these are false positives
            // where the AI incorrectly reports that a user's request wasn't applied
            if (isRequestFulfillmentIssue(validatedIssue)) {
              logger.debug(`[Validator] Filtered out request-fulfillment issue`, { description: validatedIssue.description });
              continue;
            }
            issues.push(validatedIssue);
          }
        }
      }
    }
  } catch (error) {
    console.error('[Validator] AI analysis error:', error);
    // Don't fail the whole validation on AI error
  }

  return issues;
}

/**
 * Extract relevant portions of HTML for AI analysis
 * This reduces tokens and focuses on important parts
 */
function extractRelevantExcerpts(html: string): string {
  const excerpts: string[] = [];

  // Extract positioned elements and their context
  const positionedRegex = /[^{]*\{[^}]*position:\s*(?:absolute|fixed)[^}]*\}[^{]*/gi;
  let match;
  while ((match = positionedRegex.exec(html)) !== null) {
    excerpts.push(match[0].slice(0, 500));
  }

  // Extract data-glyph-region elements
  const regionRegex = /<[^>]*data-glyph-region="[^"]*"[^>]*>[\s\S]{0,200}/gi;
  while ((match = regionRegex.exec(html)) !== null) {
    excerpts.push(match[0]);
  }

  // If no excerpts, return a truncated version of the full HTML
  if (excerpts.length === 0) {
    return html.slice(0, 2000);
  }

  return excerpts.join('\n\n---\n\n').slice(0, 3000);
}

/**
 * Filter out AI-generated issues that are false positives
 * These include:
 * 1. "Request not fulfilled" - AI incorrectly reports user's styling wasn't applied
 * 2. "Incomplete HTML/tags" - AI incorrectly flags valid HTML structure
 * 3. "Incomplete conditional" - AI incorrectly flags valid Mustache conditionals
 * 4. "Minor cosmetic issues" - Issues that don't affect document functionality
 *
 * We only want to report actual TECHNICAL issues (broken layout, overlaps, etc.)
 * that genuinely affect the user's document.
 */
function isRequestFulfillmentIssue(issue: ValidationIssue): boolean {
  const description = issue.description.toLowerCase();

  // Patterns that indicate the AI is checking if the user's request was fulfilled
  // rather than checking for actual technical problems
  const fulfillmentPatterns = [
    /no\s+\w+\s+(styling|modifications?|changes?)\s+(were|was)\s+applied/i,
    /despite\s+(user\s+)?request/i,
    /(request|instruction)\s+(was\s+)?(not|wasn't)\s+(fulfilled|applied|completed)/i,
    /user\s+(asked|requested|wanted)\s+(to|for)/i,
    /should\s+(have\s+)?(been|be)\s+(applied|changed|modified)/i,
    /expected\s+\w+\s+(color|style|font|background)/i,
    /did\s+not\s+(apply|change|modify|update)/i,
    /fail(ed|ure)?\s+to\s+(apply|implement|make)/i,
    /color\s+(was\s+)?not\s+(changed|applied|updated)/i,
    /styling\s+(was\s+)?not\s+(applied|visible)/i,
    /modification\s+(was\s+)?not\s+(successful|applied)/i,
    /no\s+(visible\s+)?(color|style|font|background)\s+(change|modification)/i,
    // Additional fulfillment patterns
    /doesn't\s+(appear|seem)\s+to\s+(have|be)/i,
    /no\s+(evidence|indication)\s+of/i,
    /unchanged/i,
    /same\s+as\s+(before|original)/i,
  ];

  // Patterns for false positive "incomplete HTML/conditional" issues
  // The AI incorrectly identifies valid HTML and Mustache templates as "incomplete"
  const falsePositiveStructurePatterns = [
    /incomplete\s+(html|tags?)/i,
    /incomplete\s+(in\s+)?(multiple\s+)?sections?/i,
    /incomplete\s+conditional/i,
    /unfinished\s+conditional/i,
    /unfinished\s+\{\{/i,
    /potentially\s+incomplete/i,
    /\{\{#\w+(\.\w+)?\}\}\s*(block|section|conditional)/i,
    // Section names being flagged incorrectly
    /\b(header-left|meta-item|client-info|line-items|totals|footer)\b.*incomplete/i,
    /incomplete.*(header-left|meta-item|client-info|line-items|totals|footer)/i,
    // General "incomplete" with region/section context
    /incomplete\s+(rendering|structure)\s+(in|for)/i,
    // Truncated HTML patterns - these are handled by HTML repair now
    /truncated\s+(html|output|response|document)/i,
    /cut\s+off/i,
    /appears?\s+to\s+be\s+(truncated|incomplete)/i,
    /missing\s+closing\s+(tag|bracket|brace)/i,
    /unclosed\s+(tag|element)/i,
    // Generic "looks incomplete" type messages
    /output\s+(was\s+)?(not|wasn't)\s+complete/i,
    /document\s+(appears?|seems?)\s+incomplete/i,
    // Additional false positive patterns
    /may\s+(be|have)\s+(incomplete|missing)/i,
    /possible\s+(incomplete|truncat)/i,
    /partial\s+(html|output|content)/i,
    /html\s+(structure|element)s?\s+(appear|seem)/i,
    /not\s+(fully\s+)?(complete|formed)/i,
    // CSS/styling concerns that aren't actual breakages
    /inconsistent\s+(styling|css|color)/i,
    /style\s+(mismatch|inconsistenc)/i,
    /visual\s+inconsistenc/i,
    // Vague "content affected" statements without specifics
    /some\s+content\s+(may\s+)?(have\s+)?(been\s+)?affected/i,
    /content\s+(may\s+)?(be|have)\s+affected/i,
    // Generic "something might be wrong" without specifics
    /might\s+(be|have)\s+(an?\s+)?issue/i,
    /could\s+(be|have)\s+(affected|impacted)/i,
    /potential(ly)?\s+(affect|impact)/i,
  ];

  for (const pattern of fulfillmentPatterns) {
    if (pattern.test(description)) {
      return true;
    }
  }

  for (const pattern of falsePositiveStructurePatterns) {
    if (pattern.test(description)) {
      return true;
    }
  }

  return false;
}

/**
 * Type guard for ValidationIssue
 */
function isValidIssue(obj: unknown): obj is ValidationIssue {
  if (typeof obj !== 'object' || obj === null) return false;
  const issue = obj as Record<string, unknown>;
  return (
    typeof issue.type === 'string' &&
    typeof issue.severity === 'string' &&
    typeof issue.description === 'string' &&
    typeof issue.autoFixable === 'boolean'
  );
}

/**
 * Convert technical issue descriptions to user-friendly messages
 * This improves trust by not showing scary technical jargon
 */
export function getFriendlyIssueDescription(issue: ValidationIssue): string {
  const desc = issue.description.toLowerCase();

  // Missing placeholder - make it friendly
  if (issue.type === 'missing_placeholder') {
    if (desc.includes('{{')) {
      // Extract the placeholder name for context
      const match = issue.description.match(/\{\{([^}]+)\}\}/);
      if (match) {
        const fieldName = match[1].replace('fields.', '').replace(/([A-Z])/g, ' $1').trim();
        return `A data field (${fieldName}) was removed. The document may not display all your information.`;
      }
    }
    return 'Some data fields were affected. Your document information may be incomplete.';
  }

  // Missing region - make it friendly
  if (issue.type === 'missing_region') {
    const regionMatch = issue.description.match(/data-glyph-region="([^"]+)"/);
    if (regionMatch) {
      const regionName = regionMatch[1].replace(/-/g, ' ');
      return `The ${regionName} section was affected. Some content may not appear correctly.`;
    }
    return 'A document section was affected. Some content may not appear correctly.';
  }

  // Broken layout - make it friendly
  if (issue.type === 'broken_layout') {
    if (desc.includes('doctype')) {
      return 'Document structure was adjusted automatically.';
    }
    if (desc.includes('</html>') || desc.includes('closing')) {
      return 'Document formatting was corrected automatically.';
    }
    return 'Some layout adjustments were made automatically.';
  }

  // Missing content - make it friendly
  if (issue.type === 'missing_content') {
    if (desc.includes('content reduction') || desc.includes('% of text')) {
      return 'Some content may have been removed unexpectedly. Consider using Undo to restore.';
    }
    return 'Some content may have been affected.';
  }

  // Overlap issues - make it friendly
  if (issue.type === 'overlap') {
    if (desc.includes('qr code')) {
      return 'The QR code may be covering some text. We can move it if needed.';
    }
    if (desc.includes('watermark')) {
      return 'The watermark may be affecting readability.';
    }
    return 'Some elements may be overlapping.';
  }

  // Obscured text - make it friendly
  if (issue.type === 'obscured_text') {
    if (desc.includes('watermark') && desc.includes('opacity')) {
      return 'The watermark may be too dark. We can make it lighter.';
    }
    return 'Some text may be hard to read.';
  }

  // Z-index conflict - make it friendly
  if (issue.type === 'z_index_conflict') {
    return 'Some elements may appear in the wrong order.';
  }

  // For any other cases, return a generic friendly message
  // Only show the original if it's already reasonably friendly
  if (
    desc.includes('incomplete') ||
    desc.includes('truncated') ||
    desc.includes('malformed') ||
    desc.includes('broken')
  ) {
    return 'We made some adjustments to ensure your document displays correctly.';
  }

  // If it's already friendly enough, return original
  return issue.description;
}

// ============================================================================
// HTML Repair Engine
// ============================================================================

// Self-closing HTML tags that don't need repair (for reference in future improvements)
// 'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'

/**
 * Repair common HTML issues before validation
 * This handles truncated/incomplete HTML from AI responses
 *
 * @param html - The potentially malformed HTML
 * @returns Repaired HTML with proper structure
 */
export function repairHtml(html: string): { html: string; repairsApplied: string[] } {
  const repairsApplied: string[] = [];
  let repaired = html;

  // 1. Ensure DOCTYPE exists
  if (!repaired.includes('<!DOCTYPE html>') && !repaired.includes('<!doctype html>')) {
    if (repaired.includes('<html')) {
      repaired = '<!DOCTYPE html>\n' + repaired;
      repairsApplied.push('Added missing DOCTYPE');
    }
  }

  // 2. Ensure closing </html> tag
  if (repaired.includes('<html') && !repaired.includes('</html>')) {
    repaired = repaired + '\n</html>';
    repairsApplied.push('Added missing </html> tag');
  }

  // 3. Ensure closing </body> tag
  if (repaired.includes('<body') && !repaired.includes('</body>')) {
    // Insert before </html> if possible
    if (repaired.includes('</html>')) {
      repaired = repaired.replace('</html>', '</body>\n</html>');
    } else {
      repaired = repaired + '\n</body>';
    }
    repairsApplied.push('Added missing </body> tag');
  }

  // 4. Ensure closing </head> tag
  if (repaired.includes('<head') && !repaired.includes('</head>')) {
    const bodyMatch = repaired.match(/<body/i);
    if (bodyMatch && bodyMatch.index !== undefined) {
      repaired = repaired.slice(0, bodyMatch.index) + '</head>\n' + repaired.slice(bodyMatch.index);
      repairsApplied.push('Added missing </head> tag');
    }
  }

  // 5. Ensure closing </style> tag
  const styleOpenCount = (repaired.match(/<style/gi) || []).length;
  const styleCloseCount = (repaired.match(/<\/style>/gi) || []).length;
  if (styleOpenCount > styleCloseCount) {
    // Find the last unclosed <style> and close it before </head> or <body>
    const closePoint = repaired.indexOf('</head>') !== -1
      ? repaired.indexOf('</head>')
      : repaired.indexOf('<body');
    if (closePoint !== -1) {
      repaired = repaired.slice(0, closePoint) + '</style>\n' + repaired.slice(closePoint);
      repairsApplied.push('Added missing </style> tag');
    }
  }

  // 6. Balance common container tags (div, section, footer, header, main, article, aside, nav)
  const containerTags = ['div', 'section', 'footer', 'header', 'main', 'article', 'aside', 'nav', 'table', 'tbody', 'thead', 'tr'];
  for (const tag of containerTags) {
    const openRegex = new RegExp(`<${tag}(?:\\s|>)`, 'gi');
    const closeRegex = new RegExp(`</${tag}>`, 'gi');
    const openCount = (repaired.match(openRegex) || []).length;
    const closeCount = (repaired.match(closeRegex) || []).length;

    if (openCount > closeCount) {
      const diff = openCount - closeCount;
      // Add closing tags before </body> or at the end
      const closingTags = `</${tag}>`.repeat(diff);
      if (repaired.includes('</body>')) {
        repaired = repaired.replace('</body>', closingTags + '\n</body>');
      } else if (repaired.includes('</html>')) {
        repaired = repaired.replace('</html>', closingTags + '\n</html>');
      } else {
        repaired = repaired + closingTags;
      }
      if (diff > 0) {
        repairsApplied.push(`Added ${diff} missing </${tag}> tag(s)`);
      }
    }
  }

  // 7. Fix truncated Mustache conditionals - ensure matching {{/...}} for {{#...}}
  const mustacheOpenRegex = /\{\{#([^}]+)\}\}/g;
  const mustacheCloseRegex = /\{\{\/([^}]+)\}\}/g;
  const openSections: string[] = [];
  const closeSections: string[] = [];

  let match;
  while ((match = mustacheOpenRegex.exec(repaired)) !== null) {
    openSections.push(match[1].trim());
  }
  while ((match = mustacheCloseRegex.exec(repaired)) !== null) {
    closeSections.push(match[1].trim());
  }

  // Count occurrences of each section
  const openCounts = new Map<string, number>();
  const closeCounts = new Map<string, number>();
  for (const section of openSections) {
    openCounts.set(section, (openCounts.get(section) || 0) + 1);
  }
  for (const section of closeSections) {
    closeCounts.set(section, (closeCounts.get(section) || 0) + 1);
  }

  // Add missing closing tags for each section
  for (const [section, count] of openCounts) {
    const closeCount = closeCounts.get(section) || 0;
    if (count > closeCount) {
      const missingCount = count - closeCount;
      const closingTags = `{{/${section}}}`.repeat(missingCount);
      // Insert before </body> or </html> or at end
      if (repaired.includes('</body>')) {
        repaired = repaired.replace('</body>', closingTags + '</body>');
      } else if (repaired.includes('</html>')) {
        repaired = repaired.replace('</html>', closingTags + '</html>');
      } else {
        repaired = repaired + closingTags;
      }
      repairsApplied.push(`Added ${missingCount} missing {{/${section}}} closing tag(s)`);
    }
  }

  return { html: repaired, repairsApplied };
}

/**
 * Check if HTML appears truncated (AI cut off mid-generation)
 */
export function isHtmlTruncated(html: string): boolean {
  // Check for obvious signs of truncation
  const truncationIndicators = [
    // Missing closing tags for required elements
    /<html[^>]*>(?![\s\S]*<\/html>)/i,
    /<body[^>]*>(?![\s\S]*<\/body>)/i,
    // Unclosed style/script blocks
    /<style[^>]*>(?![\s\S]*<\/style>)/i,
    // Ends mid-tag
    /<[a-z]+[^>]*$/i,
    // Ends mid-attribute
    /\s[a-z-]+="[^"]*$/i,
    // Ends mid-Mustache
    /\{\{[^}]*$/,
    // Very short for a complete document
  ];

  for (const pattern of truncationIndicators) {
    if (pattern.test(html)) {
      return true;
    }
  }

  // Also check if document seems too short (less than 500 chars for a full HTML doc)
  if (html.includes('<html') && html.length < 500) {
    return true;
  }

  return false;
}

// ============================================================================
// Auto-Fix Engine
// ============================================================================

/**
 * Apply automatic fixes for common issues
 */
function applyAutoFixes(html: string, issues: ValidationIssue[]): string {
  let fixed = html;

  for (const issue of issues) {
    if (!issue.autoFixable) continue;

    switch (issue.type) {
      case 'overlap':
        // Move QR code from top-right to bottom-right
        if (issue.description.includes('QR code') && issue.description.includes('top')) {
          fixed = fixed.replace(
            /position:\s*absolute[^}]*top:\s*\d+px/gi,
            match => match.replace(/top:\s*\d+px/i, 'bottom: 20px')
          );
        }
        break;

      case 'obscured_text':
        // Reduce watermark opacity
        if (issue.description.includes('Watermark opacity')) {
          fixed = fixed.replace(
            /color:\s*rgba\(([^,]+),([^,]+),([^,]+),\s*([\d.]+)\)/gi,
            (_match, r, g, b, a) => {
              const newOpacity = Math.min(parseFloat(a), 0.06);
              return `color: rgba(${r},${g},${b}, ${newOpacity})`;
            }
          );
        }
        break;

      case 'broken_layout':
        // Add missing DOCTYPE
        if (issue.description.includes('DOCTYPE') && !fixed.includes('<!DOCTYPE')) {
          fixed = '<!DOCTYPE html>\n' + fixed;
        }
        // Add missing closing html tag
        if (issue.description.includes('</html>') && !fixed.includes('</html>')) {
          fixed = fixed + '\n</html>';
        }
        break;

      case 'missing_region':
        // This would require the original HTML to restore from
        // For now, we just log the issue
        console.warn(`[Validator] Cannot auto-fix missing region: ${issue.location}`);
        break;
    }
  }

  return fixed;
}

// ============================================================================
// Main Validation Function
// ============================================================================

/**
 * Validate a modification with full analysis
 *
 * @param beforeHtml - The HTML before modification
 * @param afterHtml - The HTML after modification
 * @param prompt - The user's modification prompt
 * @param options - Validation options
 * @returns ValidationResult with issues and optional auto-fixed HTML
 */
export async function validateModification(
  beforeHtml: string,
  afterHtml: string,
  prompt: string,
  options: {
    enableAiAnalysis?: boolean;
    enableAutoFix?: boolean;
  } = {}
): Promise<ValidationResult> {
  const startTime = Date.now();
  const { enableAiAnalysis = true, enableAutoFix = true } = options;

  const allIssues: ValidationIssue[] = [];

  // Step 1: Fast structural comparison
  const structuralIssues = compareStructure(beforeHtml, afterHtml);
  allIssues.push(...structuralIssues);

  // Step 2: Fast visual heuristics
  const visualIssues = detectVisualIssues(afterHtml, beforeHtml);
  allIssues.push(...visualIssues);

  // Step 3: AI-powered analysis (if enabled and no critical issues yet)
  if (enableAiAnalysis && !allIssues.some(i => i.severity === 'critical')) {
    const aiIssues = await aiAnalyzeModification(beforeHtml, afterHtml, prompt);

    // Deduplicate with existing issues
    for (const aiIssue of aiIssues) {
      const isDuplicate = allIssues.some(
        existing => existing.type === aiIssue.type &&
                   existing.description.toLowerCase().includes(aiIssue.description.toLowerCase().slice(0, 20))
      );
      if (!isDuplicate) {
        allIssues.push(aiIssue);
      }
    }
  }

  // Step 4: Apply auto-fixes if enabled
  let fixedHtml: string | undefined;
  if (enableAutoFix && allIssues.some(i => i.autoFixable)) {
    fixedHtml = applyAutoFixes(afterHtml, allIssues);

    // Only include fixedHtml if it actually changed
    if (fixedHtml === afterHtml) {
      fixedHtml = undefined;
    }
  }

  const validationTime = Date.now() - startTime;

  // Log validation summary
  const criticalCount = allIssues.filter(i => i.severity === 'critical').length;
  const warningCount = allIssues.filter(i => i.severity === 'warning').length;
  logger.info(`[Validator] Completed`, { validationTimeMs: validationTime, criticalCount, warningCount });

  return {
    passed: criticalCount === 0,
    issues: allIssues,
    fixedHtml,
    validationTime
  };
}

/**
 * Quick validation without AI (for synchronous checks)
 * Used when you need immediate validation without waiting for AI
 */
export function validateModificationSync(
  beforeHtml: string,
  afterHtml: string
): ValidationResult {
  const startTime = Date.now();

  const allIssues: ValidationIssue[] = [];

  // Structural comparison
  const structuralIssues = compareStructure(beforeHtml, afterHtml);
  allIssues.push(...structuralIssues);

  // Visual heuristics
  const visualIssues = detectVisualIssues(afterHtml, beforeHtml);
  allIssues.push(...visualIssues);

  // Apply auto-fixes
  let fixedHtml: string | undefined;
  if (allIssues.some(i => i.autoFixable)) {
    fixedHtml = applyAutoFixes(afterHtml, allIssues);
    if (fixedHtml === afterHtml) {
      fixedHtml = undefined;
    }
  }

  return {
    passed: !allIssues.some(i => i.severity === 'critical'),
    issues: allIssues,
    fixedHtml,
    validationTime: Date.now() - startTime
  };
}
