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
  lightgray: '#f3f4f6',
  lightgrey: '#f3f4f6',
};

/**
 * Check if prompt contains compound requests (multiple items)
 * Compound requests should go to AI for proper handling
 */
function isCompoundRequest(prompt: string): boolean {
  const lower = prompt.toLowerCase();

  // Check for common conjunctions that indicate multiple items
  if (/\band\b/.test(lower)) {
    // Count distinct request types mentioned
    const requestTypes = [
      /thank\s*you/i.test(lower),
      /signature/i.test(lower),
      /qr\s*code/i.test(lower),
      /watermark/i.test(lower),
      /logo/i.test(lower),
      /phone/i.test(lower),
      /email/i.test(lower),
      /terms/i.test(lower),
      /header/i.test(lower),
      /footer/i.test(lower),
      /message/i.test(lower),
      /note/i.test(lower),
    ].filter(Boolean).length;

    // If 2+ distinct types mentioned with "and", it's compound
    if (requestTypes >= 2) return true;
  }

  return false;
}

/**
 * Check if the prompt can be handled by fast transform
 */
export function canFastTransform(prompt: string): boolean {
  const lower = prompt.toLowerCase();

  // CRITICAL: Compound requests go to AI (e.g., "add thank you AND signature")
  if (isCompoundRequest(prompt)) {
    return false;
  }

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

  // Document/page background color changes
  if (/(change|make|set)\s*(the\s+)?(document|page|body)?\s*background\s*(color\s+)?(to\s+)?(blue|red|green|purple|orange|teal|pink|navy|gray|grey|white|black|light\s*gray|light\s*grey)/i.test(lower)) return true;

  // Logo additions (fast-path to prevent AI regeneration)
  // Only match simple "add logo" requests, not complex ones like "add company logo with text"
  if (/^add\s+(a\s+)?logo\s*(placeholder)?$/i.test(lower)) return true;

  // Phone additions (fast-path to prevent AI regeneration)
  // Only match simple "add phone" or "add phone field", NOT "add client phone number"
  if (/^add\s+(a\s+)?phone\s*(field)?$/i.test(lower)) return true;

  // Email additions (fast-path to prevent AI regeneration)
  // Only match simple "add email" or "add email field"
  if (/^add\s+(a\s+)?email\s*(field)?$/i.test(lower)) return true;

  // Signature additions - only simple signature requests (fast-path to prevent AI regeneration)
  // Patterns like "add signature" or "add a signature line" but NOT "add thank you and signature"
  if (/^add\s+(a\s+)?signature\s*(line|block|section)?$/i.test(lower)) return true;

  // Thank you message additions
  if (/add\s+(a\s+)?thank\s*you(\s+message|\s+note)?/i.test(lower)) return true;

  // Zebra stripes / alternating row colors
  if (/zebra\s*stripe/i.test(lower) || /striped\s*table/i.test(lower) || /alternate\s*(row\s*)?(color|colour)/i.test(lower)) return true;

  // Table border additions
  if (/add\s+(a\s+)?(table\s*)?border/i.test(lower)) return true;

  return false;
}

/**
 * Perform fast transformation without AI
 */
export function fastTransform(html: string, prompt: string): FastTransformResult {
  const lower = prompt.toLowerCase();

  // CRITICAL: Compound requests should not be fast-transformed
  // This is defense-in-depth (canFastTransform should catch this first)
  if (isCompoundRequest(prompt)) {
    return { html, changes: [], transformed: false };
  }

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

  // === DOCUMENT BACKGROUND COLOR ===
  const bgColorMatch = lower.match(/(change|make|set)\s*(the\s+)?(document|page|body)?\s*background\s*(color\s+)?(to\s+)?(blue|red|green|purple|orange|teal|pink|navy|gray|grey|white|black|light\s*gray|light\s*grey)/i);
  if (bgColorMatch) {
    const color = bgColorMatch[6].replace(/\s+/g, ''); // Remove spaces from "light gray"
    return changeBackgroundColor(html, color);
  }

  // === LOGO ADDITIONS (Fast-path to prevent AI regeneration) ===
  // Only match simple "add logo" requests
  if (/^add\s+(a\s+)?logo\s*(placeholder)?$/i.test(lower)) {
    return addLogo(html);
  }

  // === PHONE ADDITIONS (Fast-path to prevent AI regeneration) ===
  // Only match simple "add phone" requests, not "add client phone number"
  if (/^add\s+(a\s+)?phone\s*(field)?$/i.test(lower)) {
    return addPhone(html);
  }

  // === EMAIL ADDITIONS (Fast-path to prevent AI regeneration) ===
  // Only match simple "add email" requests
  if (/^add\s+(a\s+)?email\s*(field)?$/i.test(lower)) {
    return addEmail(html);
  }

  // === SIGNATURE ADDITIONS (Fast-path to prevent AI regeneration) ===
  // Only match simple signature requests, not compound ones
  if (/^add\s+(a\s+)?signature\s*(line|block|section)?$/i.test(lower)) {
    return addSignature(html);
  }

  // === THANK YOU MESSAGE ===
  if (/add\s+(a\s+)?thank\s*you(\s+message|\s+note)?/i.test(lower)) {
    return addThankYouMessage(html);
  }

  // === ZEBRA STRIPES / ALTERNATING ROW COLORS ===
  if (/zebra\s*stripe/i.test(lower) || /striped\s*table/i.test(lower) || /alternate\s*(row\s*)?(color|colour)/i.test(lower)) {
    return addZebraStripes(html);
  }

  // === TABLE BORDER ===
  if (/add\s+(a\s+)?(table\s*)?border/i.test(lower)) {
    return addTableBorder(html);
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
 * Change document/page background color
 */
function changeBackgroundColor(html: string, colorName: string): FastTransformResult {
  const hexColor = COLOR_MAP[colorName.toLowerCase()] || colorName;
  let modifiedHtml = html;
  const changes: string[] = [];

  // Strategy 1: Update existing body background-color
  if (/<body[^>]*style="[^"]*background(-color)?:[^"]*"/i.test(modifiedHtml)) {
    modifiedHtml = modifiedHtml.replace(
      /(<body[^>]*style="[^"]*)(background(-color)?:\s*)([^;"]+)/gi,
      `$1$2${hexColor}`
    );
    changes.push(`Changed document background to ${colorName} (${hexColor})`);
  }
  // Strategy 2: Add background to existing body style attribute
  else if (/<body[^>]*style="/i.test(modifiedHtml)) {
    modifiedHtml = modifiedHtml.replace(
      /(<body[^>]*style=")([^"]*)/i,
      `$1background-color:${hexColor};$2`
    );
    changes.push(`Added document background color: ${colorName} (${hexColor})`);
  }
  // Strategy 3: Add style attribute to body
  else if (/<body([^>]*)>/i.test(modifiedHtml)) {
    modifiedHtml = modifiedHtml.replace(
      /<body([^>]*)>/i,
      `<body$1 style="background-color:${hexColor};">`
    );
    changes.push(`Added document background color: ${colorName} (${hexColor})`);
  }
  // Strategy 4: Add body style rule in CSS
  else if (/<style[^>]*>/i.test(modifiedHtml)) {
    modifiedHtml = modifiedHtml.replace(
      /(<style[^>]*>)/i,
      `$1\nbody { background-color: ${hexColor}; }`
    );
    changes.push(`Added document background color via CSS: ${colorName} (${hexColor})`);
  }

  if (changes.length === 0) {
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

/**
 * Add logo placeholder to document header - INJECTS without replacing content
 */
function addLogo(html: string): FastTransformResult {
  // Check if logo already exists
  if (html.includes('{{branding.logoUrl}}') || html.includes('{{#branding.logoUrl}}') || html.includes('class="logo"')) {
    return {
      html,
      changes: ['Logo placeholder already present'],
      transformed: true,
    };
  }

  const logoHtml = `{{#branding.logoUrl}}
  <img src="{{branding.logoUrl}}" alt="Company Logo" class="logo" style="max-height: 60px; max-width: 200px; object-fit: contain;" />
{{/branding.logoUrl}}`;

  let modifiedHtml = html;

  // Strategy 1: Insert into header-left div if it exists
  if (/class="header-left"/i.test(modifiedHtml)) {
    modifiedHtml = modifiedHtml.replace(
      /(<div[^>]*class="header-left"[^>]*>)/i,
      `$1\n${logoHtml}\n`
    );
    return {
      html: modifiedHtml,
      changes: ['Added logo placeholder in header-left'],
      transformed: true,
    };
  }

  // Strategy 2: Insert at start of header region if it exists
  if (/data-glyph-region="header"/i.test(modifiedHtml)) {
    modifiedHtml = modifiedHtml.replace(
      /(<[^>]+data-glyph-region="header"[^>]*>)/i,
      `$1\n${logoHtml}\n`
    );
    return {
      html: modifiedHtml,
      changes: ['Added logo placeholder in header region'],
      transformed: true,
    };
  }

  // Strategy 3: Insert after opening <header> tag
  if (/<header[^>]*>/i.test(modifiedHtml)) {
    modifiedHtml = modifiedHtml.replace(
      /(<header[^>]*>)/i,
      `$1\n${logoHtml}\n`
    );
    return {
      html: modifiedHtml,
      changes: ['Added logo placeholder in header'],
      transformed: true,
    };
  }

  // Strategy 4: Insert after <body> tag as fallback
  if (/<body[^>]*>/i.test(modifiedHtml)) {
    modifiedHtml = modifiedHtml.replace(
      /(<body[^>]*>)/i,
      `$1\n${logoHtml}\n`
    );
    return {
      html: modifiedHtml,
      changes: ['Added logo placeholder after body'],
      transformed: true,
    };
  }

  // Could not find a suitable location
  return { html, changes: [], transformed: false };
}

/**
 * Add phone field to client section - INJECTS without replacing content
 */
function addPhone(html: string): FastTransformResult {
  // Check if phone already exists
  if (html.includes('{{client.phone}}') || html.includes('{{#client.phone}}')) {
    return {
      html,
      changes: ['Phone field already present'],
      transformed: true,
    };
  }

  const phoneHtml = `{{#client.phone}}
  <p class="client-phone" style="margin: 4px 0; font-size: 14px;">{{client.phone}}</p>
{{/client.phone}}`;

  let modifiedHtml = html;

  // Strategy 1: Insert after client email if it exists
  if (/\{\{\/client\.email\}\}/i.test(modifiedHtml)) {
    modifiedHtml = modifiedHtml.replace(
      /(\{\{\/client\.email\}\})/i,
      `$1\n${phoneHtml}`
    );
    return {
      html: modifiedHtml,
      changes: ['Added phone field after email in client section'],
      transformed: true,
    };
  }

  // Strategy 2: Insert after client name if it exists
  if (/\{\{\/client\.name\}\}/i.test(modifiedHtml)) {
    modifiedHtml = modifiedHtml.replace(
      /(\{\{\/client\.name\}\})/i,
      `$1\n${phoneHtml}`
    );
    return {
      html: modifiedHtml,
      changes: ['Added phone field after client name'],
      transformed: true,
    };
  }

  // Strategy 3: Insert after client.name simple variable
  if (/\{\{client\.name\}\}/i.test(modifiedHtml)) {
    modifiedHtml = modifiedHtml.replace(
      /(\{\{client\.name\}\}[^<]*<\/[^>]+>)/i,
      `$1\n${phoneHtml}`
    );
    return {
      html: modifiedHtml,
      changes: ['Added phone field after client name'],
      transformed: true,
    };
  }

  // Strategy 4: Insert in client-info region
  if (/data-glyph-region="client-info"/i.test(modifiedHtml)) {
    modifiedHtml = modifiedHtml.replace(
      /(<[^>]+data-glyph-region="client-info"[^>]*>[\s\S]*?)(<\/[^>]+>\s*(?=<[^>]+data-glyph-region|<\/body|$))/i,
      `$1\n${phoneHtml}\n$2`
    );
    return {
      html: modifiedHtml,
      changes: ['Added phone field in client-info region'],
      transformed: true,
    };
  }

  // Could not find a suitable location
  return { html, changes: [], transformed: false };
}

/**
 * Add email field to client section - INJECTS without replacing content
 */
function addEmail(html: string): FastTransformResult {
  // Check if email already exists
  if (html.includes('{{client.email}}') || html.includes('{{#client.email}}')) {
    return {
      html,
      changes: ['Email field already present'],
      transformed: true,
    };
  }

  const emailHtml = `{{#client.email}}
  <p class="client-email" style="margin: 4px 0; font-size: 14px;"><a href="mailto:{{client.email}}" style="color: inherit; text-decoration: none;">{{client.email}}</a></p>
{{/client.email}}`;

  let modifiedHtml = html;

  // Strategy 1: Insert after client name if it exists
  if (/\{\{\/client\.name\}\}/i.test(modifiedHtml)) {
    modifiedHtml = modifiedHtml.replace(
      /(\{\{\/client\.name\}\})/i,
      `$1\n${emailHtml}`
    );
    return {
      html: modifiedHtml,
      changes: ['Added email field after client name'],
      transformed: true,
    };
  }

  // Strategy 2: Insert after client.name simple variable
  if (/\{\{client\.name\}\}/i.test(modifiedHtml)) {
    modifiedHtml = modifiedHtml.replace(
      /(\{\{client\.name\}\}[^<]*<\/[^>]+>)/i,
      `$1\n${emailHtml}`
    );
    return {
      html: modifiedHtml,
      changes: ['Added email field after client name'],
      transformed: true,
    };
  }

  // Strategy 3: Insert in client-info region
  if (/data-glyph-region="client-info"/i.test(modifiedHtml)) {
    modifiedHtml = modifiedHtml.replace(
      /(<[^>]+data-glyph-region="client-info"[^>]*>[\s\S]*?)(<\/[^>]+>\s*(?=<[^>]+data-glyph-region|<\/body|$))/i,
      `$1\n${emailHtml}\n$2`
    );
    return {
      html: modifiedHtml,
      changes: ['Added email field in client-info region'],
      transformed: true,
    };
  }

  // Could not find a suitable location
  return { html, changes: [], transformed: false };
}

/**
 * Add signature line to footer - INJECTS without replacing content
 */
function addSignature(html: string): FastTransformResult {
  // Check if signature already exists
  if (html.includes('class="signature') || html.includes('signature-line') || html.includes('{{#meta.showSignature}}')) {
    return {
      html,
      changes: ['Signature section already present'],
      transformed: true,
    };
  }

  const signatureHtml = `<div class="glyph-signature-section" style="margin-top: 40px; display: flex; justify-content: space-between; gap: 40px;">
  <div class="signature-block" style="flex: 1;">
    <div class="signature-line" style="border-top: 1px solid #333; padding-top: 8px; margin-top: 40px;">
      <span style="font-size: 12px; color: #666;">Client Signature</span>
    </div>
    <div style="font-size: 11px; color: #999; margin-top: 4px;">Date: _______________</div>
  </div>
  <div class="signature-block" style="flex: 1;">
    <div class="signature-line" style="border-top: 1px solid #333; padding-top: 8px; margin-top: 40px;">
      <span style="font-size: 12px; color: #666;">Company Representative</span>
    </div>
    <div style="font-size: 11px; color: #999; margin-top: 4px;">Date: _______________</div>
  </div>
</div>`;

  let modifiedHtml = html;

  // Strategy 1: Insert in footer region if it exists
  if (/data-glyph-region="footer"/i.test(modifiedHtml)) {
    modifiedHtml = modifiedHtml.replace(
      /(<[^>]+data-glyph-region="footer"[^>]*>[\s\S]*?)(<\/[^>]+>\s*(?=<[^>]+data-glyph-region|<\/body|$))/i,
      `$1\n${signatureHtml}\n$2`
    );
    return {
      html: modifiedHtml,
      changes: ['Added signature lines in footer region'],
      transformed: true,
    };
  }

  // Strategy 2: Insert before closing </body> tag
  if (/<\/body>/i.test(modifiedHtml)) {
    modifiedHtml = modifiedHtml.replace(
      /<\/body>/i,
      `\n${signatureHtml}\n</body>`
    );
    return {
      html: modifiedHtml,
      changes: ['Added signature lines before footer'],
      transformed: true,
    };
  }

  // Strategy 3: Append to end of document
  modifiedHtml = modifiedHtml + `\n${signatureHtml}`;
  return {
    html: modifiedHtml,
    changes: ['Added signature lines'],
    transformed: true,
  };
}

/**
 * Add thank you message to document - before footer or at end
 */
function addThankYouMessage(html: string): FastTransformResult {
  // Check if thank you message already exists
  if (html.includes('glyph-thank-you') || /thank\s*you\s*for\s*(your\s*)?business/i.test(html)) {
    return {
      html,
      changes: ['Thank you message already present'],
      transformed: true,
    };
  }

  const thankYouHtml = `<div class="glyph-thank-you" style="margin-top: 24px; padding: 16px; text-align: center; background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-radius: 8px; border: 1px solid #bae6fd;">
  <p style="margin: 0; font-size: 14px; color: #0369a1; font-weight: 500;">Thank you for your business!</p>
  <p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b;">We appreciate your trust and look forward to serving you again.</p>
</div>`;

  let modifiedHtml = html;

  // Strategy 1: Insert before footer region if it exists
  if (/data-glyph-region="footer"/i.test(modifiedHtml)) {
    modifiedHtml = modifiedHtml.replace(
      /(<[^>]+data-glyph-region="footer")/i,
      `${thankYouHtml}\n$1`
    );
    return {
      html: modifiedHtml,
      changes: ['Added thank you message before footer'],
      transformed: true,
    };
  }

  // Strategy 2: Insert before signature section if it exists
  if (/class="glyph-signature-section"/i.test(modifiedHtml) || /class="signature/i.test(modifiedHtml)) {
    modifiedHtml = modifiedHtml.replace(
      /(<div[^>]*class="[^"]*signature)/i,
      `${thankYouHtml}\n$1`
    );
    return {
      html: modifiedHtml,
      changes: ['Added thank you message before signature'],
      transformed: true,
    };
  }

  // Strategy 3: Insert before closing </body> tag
  if (/<\/body>/i.test(modifiedHtml)) {
    modifiedHtml = modifiedHtml.replace(
      /<\/body>/i,
      `\n${thankYouHtml}\n</body>`
    );
    return {
      html: modifiedHtml,
      changes: ['Added thank you message'],
      transformed: true,
    };
  }

  // Strategy 4: Append to end of document
  modifiedHtml = modifiedHtml + `\n${thankYouHtml}`;
  return {
    html: modifiedHtml,
    changes: ['Added thank you message'],
    transformed: true,
  };
}

/**
 * Add zebra stripes (alternating row colors) to tables
 */
function addZebraStripes(html: string): FastTransformResult {
  // Check if zebra stripes already exist
  if (/tr:nth-child\s*\(\s*(even|odd)\s*\)/i.test(html) || html.includes('glyph-zebra-stripes')) {
    return {
      html,
      changes: ['Zebra stripes already present'],
      transformed: true,
    };
  }

  const zebraStripesCSS = `
/* Glyph zebra stripes */
.glyph-zebra-stripes tr:nth-child(even),
table tr:nth-child(even) {
  background-color: #f9fafb;
}
table tr:nth-child(odd) {
  background-color: #ffffff;
}
table thead tr,
table tr:first-child {
  background-color: #f1f5f9 !important;
}`;

  let modifiedHtml = html;

  // Strategy 1: Add CSS to existing <style> tag
  if (/<style[^>]*>/i.test(modifiedHtml)) {
    modifiedHtml = modifiedHtml.replace(
      /(<style[^>]*>)/i,
      `$1${zebraStripesCSS}`
    );

    // Also add class to tables for specificity
    modifiedHtml = modifiedHtml.replace(
      /<table(?![^>]*glyph-zebra-stripes)/gi,
      '<table class="glyph-zebra-stripes"'
    );

    return {
      html: modifiedHtml,
      changes: ['Added zebra stripes (alternating row colors) to tables'],
      transformed: true,
    };
  }

  // Strategy 2: Add <style> tag with zebra stripes before </head>
  if (/<\/head>/i.test(modifiedHtml)) {
    modifiedHtml = modifiedHtml.replace(
      /<\/head>/i,
      `<style>${zebraStripesCSS}</style>\n</head>`
    );

    // Also add class to tables
    modifiedHtml = modifiedHtml.replace(
      /<table(?![^>]*glyph-zebra-stripes)/gi,
      '<table class="glyph-zebra-stripes"'
    );

    return {
      html: modifiedHtml,
      changes: ['Added zebra stripes (alternating row colors) to tables'],
      transformed: true,
    };
  }

  // Strategy 3: Add inline style tag at start of document
  modifiedHtml = `<style>${zebraStripesCSS}</style>\n` + modifiedHtml;

  // Also add class to tables
  modifiedHtml = modifiedHtml.replace(
    /<table(?![^>]*glyph-zebra-stripes)/gi,
    '<table class="glyph-zebra-stripes"'
  );

  return {
    html: modifiedHtml,
    changes: ['Added zebra stripes (alternating row colors) to tables'],
    transformed: true,
  };
}

/**
 * Add border styling to tables
 */
function addTableBorder(html: string): FastTransformResult {
  // Check if table borders already exist
  if (/table[^{]*\{[^}]*border/i.test(html) || html.includes('glyph-bordered-table')) {
    return {
      html,
      changes: ['Table borders already present'],
      transformed: true,
    };
  }

  const tableBorderCSS = `
/* Glyph table borders */
.glyph-bordered-table,
table {
  border-collapse: collapse;
  border: 1px solid #e5e7eb;
}
.glyph-bordered-table th,
.glyph-bordered-table td,
table th,
table td {
  border: 1px solid #e5e7eb;
  padding: 8px 12px;
}
.glyph-bordered-table thead,
table thead {
  background-color: #f9fafb;
}`;

  let modifiedHtml = html;

  // Strategy 1: Add CSS to existing <style> tag
  if (/<style[^>]*>/i.test(modifiedHtml)) {
    modifiedHtml = modifiedHtml.replace(
      /(<style[^>]*>)/i,
      `$1${tableBorderCSS}`
    );

    // Also add class to tables for specificity
    modifiedHtml = modifiedHtml.replace(
      /<table(?![^>]*glyph-bordered-table)/gi,
      '<table class="glyph-bordered-table"'
    );

    return {
      html: modifiedHtml,
      changes: ['Added borders to tables'],
      transformed: true,
    };
  }

  // Strategy 2: Add <style> tag with borders before </head>
  if (/<\/head>/i.test(modifiedHtml)) {
    modifiedHtml = modifiedHtml.replace(
      /<\/head>/i,
      `<style>${tableBorderCSS}</style>\n</head>`
    );

    // Also add class to tables
    modifiedHtml = modifiedHtml.replace(
      /<table(?![^>]*glyph-bordered-table)/gi,
      '<table class="glyph-bordered-table"'
    );

    return {
      html: modifiedHtml,
      changes: ['Added borders to tables'],
      transformed: true,
    };
  }

  // Strategy 3: Add inline style tag at start of document
  modifiedHtml = `<style>${tableBorderCSS}</style>\n` + modifiedHtml;

  // Also add class to tables
  modifiedHtml = modifiedHtml.replace(
    /<table(?![^>]*glyph-bordered-table)/gi,
    '<table class="glyph-bordered-table"'
  );

  return {
    html: modifiedHtml,
    changes: ['Added borders to tables'],
    transformed: true,
  };
}
