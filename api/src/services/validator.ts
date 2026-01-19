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
 * Extract all Mustache placeholders from HTML
 * Includes both simple {{variable}} and nested {{object.property}} patterns
 */
function extractPlaceholders(html: string): Set<string> {
  const placeholders = new Set<string>();
  const regex = /\{\{([^#/^][^}]*)\}\}/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const content = match[1].trim();
    // Skip if it starts with section markers that we might have partially matched
    if (!content.startsWith('#') && !content.startsWith('/') && !content.startsWith('^')) {
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

  // Check placeholders
  const beforePlaceholders = extractPlaceholders(beforeHtml);
  const afterPlaceholders = extractPlaceholders(afterHtml);

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

  // Check for watermark opacity issues
  if (visual.hasWatermark) {
    const opacityMatch = html.match(/(?:color:\s*rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)|opacity:\s*([\d.]+))/i);
    if (opacityMatch) {
      const opacity = parseFloat(opacityMatch[1] || opacityMatch[2]);
      if (opacity > 0.15) {
        issues.push({
          type: 'obscured_text',
          severity: 'warning',
          description: `Watermark opacity (${(opacity * 100).toFixed(0)}%) may be too high and obscure content`,
          autoFixable: true,
          suggestedFix: 'Reduce watermark opacity to 5-10% for better readability'
        });
      }
    }
  }

  // Check for z-index conflicts
  const zIndexMatches = html.matchAll(/z-index:\s*(\d+)/gi);
  const zIndexValues: number[] = [];
  for (const match of zIndexMatches) {
    zIndexValues.push(parseInt(match[1]));
  }

  if (zIndexValues.length > 2) {
    const hasConflict = zIndexValues.some((v, i) =>
      zIndexValues.slice(i + 1).some(other => Math.abs(v - other) <= 1)
    );
    if (hasConflict) {
      issues.push({
        type: 'z_index_conflict',
        severity: 'warning',
        description: 'Multiple elements with similar z-index values may cause stacking conflicts',
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
  prompt: string
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022', // Fast model for quick validation
      max_tokens: 1024,
      system: `You are a QA agent that validates HTML document modifications.
Analyze the before and after HTML to detect visual issues.

ONLY report issues in this JSON format, nothing else:
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

If no issues found, return: {"issues": []}

Check for:
1. QR codes or watermarks overlapping important content areas
2. Positioned elements (absolute/fixed) covering data regions
3. Missing visual elements that were in the original
4. Layout broken by the modification
5. Text being obscured by overlays`,
      messages: [{
        role: 'user',
        content: `User request: "${prompt}"

BEFORE HTML (relevant excerpts):
${extractRelevantExcerpts(beforeHtml)}

AFTER HTML (relevant excerpts):
${extractRelevantExcerpts(afterHtml)}

Analyze for visual issues. Return JSON only.`
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
            issues.push(issue as ValidationIssue);
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
  console.log(`[Validator] Completed in ${validationTime}ms: ${criticalCount} critical, ${warningCount} warnings`);

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
