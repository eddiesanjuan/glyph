/**
 * Fast Transform Service
 * Handles common document modifications WITHOUT calling AI
 *
 * This service provides sub-second response times for predictable transformations
 * like adding QR codes, watermarks, and color changes.
 */

export interface FastTransformResult {
  html: string;
  changes: string[];
  transformed: boolean;  // true if we handled it, false if AI is needed
}

/**
 * Pre-defined SVG QR code (decorative placeholder)
 * In production, this could be replaced with actual QR generation
 */
const QR_CODE_SVG = `<div class="glyph-qr-code" style="position:absolute;top:20px;right:20px;width:80px;height:80px;background:white;border:1px solid #e5e5e5;border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
  <svg viewBox="0 0 100 100" width="50" height="50">
    <rect x="10" y="10" width="25" height="25" fill="#1a1a1a"/>
    <rect x="15" y="15" width="15" height="15" fill="white"/>
    <rect x="18" y="18" width="9" height="9" fill="#1a1a1a"/>
    <rect x="65" y="10" width="25" height="25" fill="#1a1a1a"/>
    <rect x="70" y="15" width="15" height="15" fill="white"/>
    <rect x="73" y="18" width="9" height="9" fill="#1a1a1a"/>
    <rect x="10" y="65" width="25" height="25" fill="#1a1a1a"/>
    <rect x="15" y="70" width="15" height="15" fill="white"/>
    <rect x="18" y="73" width="9" height="9" fill="#1a1a1a"/>
    <rect x="40" y="40" width="20" height="20" fill="#1a1a1a"/>
    <rect x="65" y="65" width="8" height="8" fill="#1a1a1a"/>
    <rect x="77" y="65" width="8" height="8" fill="#1a1a1a"/>
    <rect x="65" y="77" width="8" height="8" fill="#1a1a1a"/>
    <rect x="77" y="77" width="8" height="8" fill="#1a1a1a"/>
    <rect x="40" y="10" width="8" height="8" fill="#1a1a1a"/>
    <rect x="10" y="40" width="8" height="8" fill="#1a1a1a"/>
    <rect x="52" y="40" width="8" height="8" fill="#1a1a1a"/>
    <rect x="40" y="52" width="8" height="8" fill="#1a1a1a"/>
  </svg>
  <span style="font-size:7px;color:#666;margin-top:4px;">Scan to pay</span>
</div>`;

/**
 * Color name to hex mapping
 */
const COLOR_MAP: Record<string, string> = {
  blue: '#3b82f6',
  red: '#ef4444',
  green: '#22c55e',
  purple: '#a855f7',
  orange: '#f97316',
  teal: '#14b8a6',
  pink: '#ec4899',
  yellow: '#eab308',
  indigo: '#6366f1',
  cyan: '#06b6d4',
  navy: '#1e3a5f',
  black: '#1a1a1a',
  white: '#ffffff',
  gray: '#6b7280',
  grey: '#6b7280',
};

/**
 * Check if the prompt can be handled by fast transform
 */
export function canFastTransform(prompt: string): boolean {
  const lower = prompt.toLowerCase();

  // QR code additions
  if (/add\s*(a\s+)?qr\s*code/i.test(lower)) return true;

  // Watermark additions - flexible patterns
  // Match "add [any words] watermark" with draft/paid/etc anywhere in prompt
  if (/add\s+.*?watermark/i.test(lower) && /(draft|paid|sample|confidential|void|approved)/i.test(lower)) return true;
  // Match just "add watermark" or "add a watermark" or "add a diagonal watermark" (default to DRAFT)
  if (/add\s+(a\s+)?(diagonal\s+)?watermark/i.test(lower)) return true;

  // Payment terms additions
  if (/add\s+.*?(terms|payment\s*terms)/i.test(lower)) return true;
  if (/(payment\s*)?terms.*?(net\s*\d+|due|discount)/i.test(lower)) return true;

  // Simple color changes for header/accent
  if (/make\s*(the\s+)?(header|accent|title)\s*(color\s+)?(blue|red|green|purple|orange|teal|pink|navy)/i.test(lower)) return true;
  if (/change\s*(the\s+)?(header|accent|title)\s*(color\s+)?(to\s+)?(blue|red|green|purple|orange|teal|pink|navy)/i.test(lower)) return true;

  // Background color for header
  if (/(header|title)\s*background\s*(color\s+)?(to\s+)?(blue|red|green|purple|orange|teal|pink|navy)/i.test(lower)) return true;

  return false;
}

/**
 * Perform fast transformation without AI
 */
export function fastTransform(html: string, prompt: string): FastTransformResult {
  const lower = prompt.toLowerCase();

  // === QR CODE ===
  if (/add\s*(a\s+)?qr\s*code/i.test(lower)) {
    return addQrCode(html);
  }

  // === WATERMARK ===
  // Flexible matching: "add [any words] watermark" with text extracted from anywhere in prompt
  if (/add\s+.*?watermark/i.test(lower) || /add\s+(a\s+)?(diagonal\s+)?watermark/i.test(lower)) {
    // Extract watermark text from anywhere in the prompt
    const textMatch = lower.match(/(draft|paid|sample|confidential|void|approved)/i);
    const watermarkText = textMatch ? textMatch[1].toUpperCase() : 'DRAFT';
    return addWatermark(html, watermarkText);
  }

  // === PAYMENT TERMS ===
  if (/add\s+.*?(terms|payment\s*terms)/i.test(lower) || /(payment\s*)?terms.*?(net\s*\d+|due|discount)/i.test(lower)) {
    // Extract terms details from the prompt
    const termsText = extractTermsFromPrompt(prompt);
    return addPaymentTerms(html, termsText);
  }

  // === COLOR CHANGES ===
  const colorMatch = lower.match(/(make|change)\s*(the\s+)?(header|accent|title)\s*(color\s+)?(to\s+)?(blue|red|green|purple|orange|teal|pink|navy)/i);
  if (colorMatch) {
    const target = colorMatch[3] || 'header';
    const color = colorMatch[6];
    return changeColor(html, target, color);
  }

  // Not a fast-transformable request
  return { html, changes: [], transformed: false };
}

/**
 * Add QR code to document
 */
function addQrCode(html: string): FastTransformResult {
  // Check if QR code already exists
  if (html.includes('glyph-qr-code')) {
    return {
      html,
      changes: ['QR code already present'],
      transformed: true,
    };
  }

  // Ensure body has position: relative
  let modifiedHtml = html;

  // Add position: relative to body if not present
  if (!/<body[^>]*style="[^"]*position:\s*relative/i.test(html)) {
    if (/<body[^>]*style="/i.test(html)) {
      // Body has style, append position: relative
      modifiedHtml = modifiedHtml.replace(
        /(<body[^>]*style=")([^"]*)/i,
        '$1position:relative;$2'
      );
    } else if (/<body([^>]*)>/i.test(html)) {
      // Body exists but no style
      modifiedHtml = modifiedHtml.replace(
        /<body([^>]*)>/i,
        '<body$1 style="position:relative;">'
      );
    }
  }

  // Insert QR code right after <body...>
  modifiedHtml = modifiedHtml.replace(
    /(<body[^>]*>)/i,
    `$1\n${QR_CODE_SVG}`
  );

  return {
    html: modifiedHtml,
    changes: ['Added QR code in top-right corner', 'Added position:relative to body'],
    transformed: true,
  };
}

/**
 * Add watermark overlay
 */
function addWatermark(html: string, text: string): FastTransformResult {
  // Check if watermark already exists
  if (html.includes('glyph-watermark')) {
    return {
      html,
      changes: ['Watermark already present'],
      transformed: true,
    };
  }

  const watermarkHtml = `<div class="glyph-watermark" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-45deg);font-size:80px;font-weight:900;color:rgba(0,0,0,0.06);pointer-events:none;white-space:nowrap;z-index:1;user-select:none;">${text}</div>`;

  let modifiedHtml = html;

  // Add position: relative to body if not present
  if (!/<body[^>]*style="[^"]*position:\s*relative/i.test(html)) {
    if (/<body[^>]*style="/i.test(html)) {
      modifiedHtml = modifiedHtml.replace(
        /(<body[^>]*style=")([^"]*)/i,
        '$1position:relative;$2'
      );
    } else if (/<body([^>]*)>/i.test(html)) {
      modifiedHtml = modifiedHtml.replace(
        /<body([^>]*)>/i,
        '<body$1 style="position:relative;">'
      );
    }
  }

  // Insert watermark right after <body...>
  modifiedHtml = modifiedHtml.replace(
    /(<body[^>]*>)/i,
    `$1\n${watermarkHtml}`
  );

  return {
    html: modifiedHtml,
    changes: [`Added ${text} watermark`, 'Added position:relative to body'],
    transformed: true,
  };
}

/**
 * Change header/accent color
 */
function changeColor(html: string, target: string, colorName: string): FastTransformResult {
  const hexColor = COLOR_MAP[colorName.toLowerCase()] || colorName;
  let modifiedHtml = html;
  const changes: string[] = [];

  if (target === 'header' || target === 'title') {
    // Try to find and update header background color in style

    // Pattern 1: header { background: ... }
    if (/header\s*\{[^}]*background(-color)?:\s*[^;]+/i.test(modifiedHtml)) {
      modifiedHtml = modifiedHtml.replace(
        /(header\s*\{[^}]*background(-color)?:\s*)([^;]+)/gi,
        `$1${hexColor}`
      );
      changes.push(`Changed header background to ${colorName} (${hexColor})`);
    }
    // Pattern 2: [data-glyph-region="header"] { background: ... }
    else if (/\[data-glyph-region="header"\]\s*\{[^}]*background(-color)?:\s*[^;]+/i.test(modifiedHtml)) {
      modifiedHtml = modifiedHtml.replace(
        /(\[data-glyph-region="header"\]\s*\{[^}]*background(-color)?:\s*)([^;]+)/gi,
        `$1${hexColor}`
      );
      changes.push(`Changed header background to ${colorName} (${hexColor})`);
    }
    // Pattern 3: inline style on header element
    else if (/<header[^>]*style="[^"]*background(-color)?:[^"]*"/i.test(modifiedHtml)) {
      modifiedHtml = modifiedHtml.replace(
        /(<header[^>]*style="[^"]*)(background(-color)?:\s*)([^;"]+)/gi,
        `$1$2${hexColor}`
      );
      changes.push(`Changed header background to ${colorName} (${hexColor})`);
    }
    // Pattern 4: Add background to existing header style rule
    else if (/<style[^>]*>[\s\S]*header\s*\{[^}]*\}/i.test(modifiedHtml)) {
      modifiedHtml = modifiedHtml.replace(
        /(header\s*\{)([^}]*)(})/i,
        `$1$2 background-color: ${hexColor}; color: white;$3`
      );
      changes.push(`Added header background color: ${colorName} (${hexColor})`);
    }
    // Pattern 5: No header style exists, add one
    else if (/<style[^>]*>/i.test(modifiedHtml)) {
      modifiedHtml = modifiedHtml.replace(
        /(<style[^>]*>)/i,
        `$1\nheader, [data-glyph-region="header"] { background-color: ${hexColor}; color: white; padding: 1rem; }`
      );
      changes.push(`Added header style with background: ${colorName} (${hexColor})`);
    }
  }

  if (target === 'accent') {
    // Update CSS variable --accent-color
    if (/--accent-color:\s*[^;]+/i.test(modifiedHtml)) {
      modifiedHtml = modifiedHtml.replace(
        /(--accent-color:\s*)([^;]+)/gi,
        `$1${hexColor}`
      );
      changes.push(`Changed accent color to ${colorName} (${hexColor})`);
    } else if (/:root\s*\{/i.test(modifiedHtml)) {
      modifiedHtml = modifiedHtml.replace(
        /(:root\s*\{)/i,
        `$1 --accent-color: ${hexColor};`
      );
      changes.push(`Added accent color variable: ${colorName} (${hexColor})`);
    }
  }

  if (changes.length === 0) {
    // Couldn't find a place to make the change, fall back to AI
    return { html, changes: [], transformed: false };
  }

  return {
    html: modifiedHtml,
    changes,
    transformed: true,
  };
}

/**
 * Extract payment terms text from prompt
 */
function extractTermsFromPrompt(prompt: string): string {
  const lower = prompt.toLowerCase();

  // Try to extract specific terms mentioned in the prompt
  // Pattern: "Net 30" or "Net 15" etc.
  const netMatch = prompt.match(/net\s*(\d+)/i);
  const netDays = netMatch ? netMatch[1] : '30';

  // Check for early payment discount
  const discountMatch = prompt.match(/(\d+)%\s*(early\s*)?(?:payment\s*)?discount/i);
  const discount = discountMatch ? discountMatch[1] : null;

  // Check for discount period
  const periodMatch = prompt.match(/(?:within|in)\s*(\d+)\s*days/i);
  const discountPeriod = periodMatch ? periodMatch[1] : '10';

  // Build terms text
  let termsText = `Net ${netDays} days`;

  if (discount) {
    termsText += `. ${discount}% early payment discount if paid within ${discountPeriod} days`;
  } else if (lower.includes('discount') || lower.includes('early')) {
    // Default discount if mentioned but not specified
    termsText += `. 2% early payment discount if paid within ${discountPeriod} days`;
  }

  // Add late fee if mentioned
  if (lower.includes('late') || lower.includes('penalty') || lower.includes('overdue')) {
    termsText += '. 1.5% monthly interest on overdue amounts';
  }

  return termsText;
}

/**
 * Pre-defined Payment Terms HTML block
 */
const PAYMENT_TERMS_HTML = (termsText: string) => `<div class="glyph-payment-terms" data-glyph-region="terms" style="margin-top: 24px; padding: 16px; background: #f9fafb; border-radius: 8px; border-left: 4px solid #1e3a5f;">
  <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #666; margin-bottom: 8px; font-weight: 600;">Payment Terms</div>
  <div style="font-size: 12px; color: #1a1a1a; line-height: 1.5;">${termsText}</div>
</div>`;

/**
 * Add payment terms to document - INJECTS without replacing content
 */
function addPaymentTerms(html: string, termsText: string): FastTransformResult {
  // Check if payment terms already exist
  if (html.includes('glyph-payment-terms') || html.includes('Payment Terms')) {
    return {
      html,
      changes: ['Payment terms already present'],
      transformed: true,
    };
  }

  let modifiedHtml = html;
  const termsHtml = PAYMENT_TERMS_HTML(termsText);

  // Strategy 1: Insert before closing </body> tag
  if (/<\/body>/i.test(modifiedHtml)) {
    modifiedHtml = modifiedHtml.replace(
      /<\/body>/i,
      `\n${termsHtml}\n</body>`
    );
    return {
      html: modifiedHtml,
      changes: [`Added payment terms: ${termsText}`],
      transformed: true,
    };
  }

  // Strategy 2: Insert after footer region if it exists
  if (/data-glyph-region="footer"/i.test(modifiedHtml)) {
    modifiedHtml = modifiedHtml.replace(
      /(<[^>]+data-glyph-region="footer"[^>]*>[\s\S]*?<\/[^>]+>)/i,
      `$1\n${termsHtml}`
    );
    return {
      html: modifiedHtml,
      changes: [`Added payment terms after footer: ${termsText}`],
      transformed: true,
    };
  }

  // Strategy 3: Insert after totals region if it exists
  if (/data-glyph-region="totals"/i.test(modifiedHtml)) {
    modifiedHtml = modifiedHtml.replace(
      /(<[^>]+data-glyph-region="totals"[^>]*>[\s\S]*?<\/[^>]+>)/i,
      `$1\n${termsHtml}`
    );
    return {
      html: modifiedHtml,
      changes: [`Added payment terms after totals: ${termsText}`],
      transformed: true,
    };
  }

  // Strategy 4: Insert after last div or section before </body> or at end
  if (/<\/div>\s*<\/body>/i.test(modifiedHtml)) {
    modifiedHtml = modifiedHtml.replace(
      /(<\/div>)(\s*<\/body>)/i,
      `$1\n${termsHtml}$2`
    );
    return {
      html: modifiedHtml,
      changes: [`Added payment terms: ${termsText}`],
      transformed: true,
    };
  }

  // Strategy 5: Append to end of HTML (fallback)
  modifiedHtml = modifiedHtml + `\n${termsHtml}`;

  return {
    html: modifiedHtml,
    changes: [`Added payment terms: ${termsText}`],
    transformed: true,
  };
}
