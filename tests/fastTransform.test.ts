import { describe, it, expect } from 'vitest';
import { canFastTransform, fastTransform } from '../api/src/services/fastTransform';

/**
 * Comprehensive test suite for the fast transform service.
 *
 * Covers every major transform category, edge cases, duplication guards,
 * and return-format validation.
 */

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const baseHtml = `<!DOCTYPE html>
<html>
<head><style>header { background: red; }</style></head>
<body>
<header data-glyph-region="header"><h1>Quote</h1></header>
<table><thead><tr><th>Item</th><th>Price</th></tr></thead><tbody><tr><td>A</td><td>$10</td></tr><tr><td>B</td><td>$20</td></tr></tbody></table>
<div data-glyph-region="totals"><strong>Total: $30</strong></div>
<div data-glyph-region="footer"><p>Footer content</p></div>
</body>
</html>`;

const minimalHtml = `<body><p>Hello</p></body>`;

// Helper: assert the standard return shape
function assertTransformResult(result: { html: string; changes: string[]; transformed: boolean }, expectTransformed: boolean) {
  expect(result).toHaveProperty('html');
  expect(result).toHaveProperty('changes');
  expect(result).toHaveProperty('transformed');
  expect(typeof result.html).toBe('string');
  expect(Array.isArray(result.changes)).toBe(true);
  expect(result.transformed).toBe(expectTransformed);
  if (expectTransformed) {
    expect(result.changes.length).toBeGreaterThan(0);
  }
}

// ============================================================================
// canFastTransform detection
// ============================================================================

describe('canFastTransform', () => {
  // --- QR code ---
  it('detects QR code requests', () => {
    expect(canFastTransform('Add a QR code')).toBe(true);
    expect(canFastTransform('add qr code')).toBe(true);
    expect(canFastTransform('Add QR Code to the document')).toBe(true);
    expect(canFastTransform('add a qr code for https://example.com')).toBe(true);
  });

  // --- Watermark ---
  it('detects watermark requests', () => {
    expect(canFastTransform('Add a draft watermark')).toBe(true);
    expect(canFastTransform('add paid watermark')).toBe(true);
    expect(canFastTransform('Add watermark')).toBe(true);
    expect(canFastTransform('Add a diagonal watermark')).toBe(true);
    expect(canFastTransform('Add a large watermark saying paid')).toBe(true);
  });

  // --- Color changes ---
  it('detects header/accent/title color changes', () => {
    expect(canFastTransform('Make the header blue')).toBe(true);
    expect(canFastTransform('Change header color to red')).toBe(true);
    expect(canFastTransform('make title purple')).toBe(true);
    expect(canFastTransform('change the accent to teal')).toBe(true);
  });

  // --- Background color ---
  it('detects document background color changes', () => {
    expect(canFastTransform('Change background to gray')).toBe(true);
    expect(canFastTransform('Set the page background to white')).toBe(true);
    expect(canFastTransform('make document background light grey')).toBe(true);
  });

  // --- Font size ---
  it('detects font size changes', () => {
    expect(canFastTransform('make title bigger')).toBe(true);
    // "increase header size" doesn't match because regex requires "font" or "text" with increase/decrease
    expect(canFastTransform('increase header size')).toBe(false);
    expect(canFastTransform('smaller text')).toBe(true);
    expect(canFastTransform('decrease font size')).toBe(true);
    expect(canFastTransform('bigger header')).toBe(true);
    expect(canFastTransform('increase font size')).toBe(true);
  });

  // --- Alignment ---
  it('detects text alignment changes', () => {
    expect(canFastTransform('center the title')).toBe(true);
    expect(canFastTransform('right-align the total')).toBe(true);
    expect(canFastTransform('left align text')).toBe(true);
    expect(canFastTransform('align the header to the right')).toBe(true);
  });

  // --- Spacing ---
  it('detects spacing/padding/margin changes', () => {
    expect(canFastTransform('add more padding')).toBe(true);
    expect(canFastTransform('increase spacing')).toBe(true);
    expect(canFastTransform('reduce margin')).toBe(true);
    expect(canFastTransform('less padding')).toBe(true);
    expect(canFastTransform('more margin')).toBe(true);
  });

  // --- Bold / italic / underline ---
  it('detects bold/italic/underline requests', () => {
    expect(canFastTransform('make bold')).toBe(true);
    expect(canFastTransform('add italic')).toBe(true);
    expect(canFastTransform('underline the title')).toBe(true);
    expect(canFastTransform('bold the header')).toBe(true);
    expect(canFastTransform('make the heading italic')).toBe(true);
  });

  // --- Background (simple) ---
  it('detects simple background additions', () => {
    expect(canFastTransform('add light gray background')).toBe(true);
    expect(canFastTransform('set a white background')).toBe(true);
    expect(canFastTransform('add beige background')).toBe(true);
  });

  // --- Borders ---
  it('detects border addition and removal', () => {
    expect(canFastTransform('add a table border')).toBe(true);
    expect(canFastTransform('add border')).toBe(true);
    expect(canFastTransform('remove borders')).toBe(true);
    expect(canFastTransform('no border')).toBe(true);
    expect(canFastTransform('hide table borders')).toBe(true);
  });

  // --- Zebra stripes ---
  it('detects zebra stripe requests', () => {
    expect(canFastTransform('zebra stripe')).toBe(true);
    expect(canFastTransform('striped table')).toBe(true);
    expect(canFastTransform('alternate row colors')).toBe(true);
  });

  // --- Font family ---
  it('detects font family changes', () => {
    expect(canFastTransform('use sans-serif')).toBe(true);
    expect(canFastTransform('change font to arial')).toBe(true);
    expect(canFastTransform('use monospace font')).toBe(true);
    expect(canFastTransform('set the font to georgia')).toBe(true);
  });

  // --- Signature / logo / phone / email / thank you ---
  it('detects simple addition fast-paths', () => {
    expect(canFastTransform('Add signature')).toBe(true);
    expect(canFastTransform('add a signature line')).toBe(true);
    expect(canFastTransform('add logo')).toBe(true);
    expect(canFastTransform('add phone')).toBe(true);
    expect(canFastTransform('add email')).toBe(true);
    expect(canFastTransform('add a thank you message')).toBe(true);
    expect(canFastTransform('add thank you note')).toBe(true);
  });

  // --- Payment terms ---
  it('detects payment terms requests', () => {
    expect(canFastTransform('add payment terms')).toBe(true);
    expect(canFastTransform('add terms')).toBe(true);
    expect(canFastTransform('payment terms net 30')).toBe(true);
  });

  // --- Compound requests -> false ---
  it('rejects compound requests', () => {
    expect(canFastTransform('Add a thank you message and signature line at the bottom')).toBe(false);
    expect(canFastTransform('Add QR code and watermark')).toBe(false);
    expect(canFastTransform('Add logo and phone number')).toBe(false);
    expect(canFastTransform('Add email and phone fields')).toBe(false);
  });

  // --- Complex / unrecognized ---
  it('rejects complex or unrecognized requests', () => {
    expect(canFastTransform('Restructure the layout')).toBe(false);
    expect(canFastTransform('Add a new column for quantity')).toBe(false);
    expect(canFastTransform('Add client phone number')).toBe(false);
    expect(canFastTransform('translate everything to Spanish')).toBe(false);
    expect(canFastTransform('')).toBe(false);
  });
});

// ============================================================================
// fastTransform execution
// ============================================================================

describe('fastTransform', () => {

  // ---- Return format validation ----
  describe('return format', () => {
    it('returns {html, changes, transformed} for recognized prompt', async () => {
      const result = await fastTransform(baseHtml, 'Add watermark');
      assertTransformResult(result, true);
    });

    it('returns transformed=false for unrecognized prompt', async () => {
      const result = await fastTransform(baseHtml, 'translate to French');
      assertTransformResult(result, false);
      expect(result.html).toBe(baseHtml); // unchanged
    });
  });

  // ---- QR code ----
  describe('QR code', () => {
    it('adds QR code with default URL', async () => {
      const result = await fastTransform(baseHtml, 'Add a QR code');
      assertTransformResult(result, true);
      expect(result.html).toContain('glyph-qr-code');
      expect(result.html).toContain('position:relative');
    });

    it('adds QR code with custom URL', async () => {
      const result = await fastTransform(baseHtml, 'Add QR code for https://example.com/pay');
      assertTransformResult(result, true);
      expect(result.html).toContain('glyph-qr-code');
      expect(result.changes.some(c => c.includes('https://example.com/pay'))).toBe(true);
    });

    it('does not duplicate QR code', async () => {
      const withQr = baseHtml.replace('<body>', '<body><div class="glyph-qr-code"></div>');
      const result = await fastTransform(withQr, 'Add a QR code');
      assertTransformResult(result, true);
      expect(result.changes).toContain('QR code already present');
    });
  });

  // ---- Watermark ----
  describe('watermark', () => {
    it('adds DRAFT watermark by default', async () => {
      const result = await fastTransform(baseHtml, 'Add watermark');
      assertTransformResult(result, true);
      expect(result.html).toContain('glyph-watermark');
      expect(result.html).toContain('DRAFT');
    });

    it('adds PAID watermark', async () => {
      const result = await fastTransform(baseHtml, 'Add paid watermark');
      expect(result.html).toContain('PAID');
    });

    it('adds CONFIDENTIAL watermark', async () => {
      const result = await fastTransform(baseHtml, 'Add confidential watermark');
      expect(result.html).toContain('CONFIDENTIAL');
    });

    it('adds APPROVED watermark', async () => {
      const result = await fastTransform(baseHtml, 'Add approved watermark');
      expect(result.html).toContain('APPROVED');
    });

    it('adds SAMPLE watermark', async () => {
      const result = await fastTransform(baseHtml, 'Add sample watermark');
      expect(result.html).toContain('SAMPLE');
    });

    it('adds VOID watermark', async () => {
      const result = await fastTransform(baseHtml, 'Add void watermark');
      expect(result.html).toContain('VOID');
    });

    it('does not duplicate watermark', async () => {
      const withWm = baseHtml.replace('<body>', '<body><div class="glyph-watermark">DRAFT</div>');
      const result = await fastTransform(withWm, 'Add watermark');
      assertTransformResult(result, true);
      expect(result.changes).toContain('Watermark already present');
    });
  });

  // ---- Color changes ----
  describe('color changes', () => {
    it('changes header background to blue', async () => {
      const result = await fastTransform(baseHtml, 'Make the header blue');
      assertTransformResult(result, true);
      expect(result.html).toContain('#3b82f6');
    });

    it('changes header to purple', async () => {
      const result = await fastTransform(baseHtml, 'Change header color to purple');
      expect(result.html).toContain('#a855f7');
    });

    it('falls back to AI when no style tag and no header rule', async () => {
      const noStyleHtml = `<body><div>content</div></body>`;
      const result = await fastTransform(noStyleHtml, 'Make the header blue');
      // No header element to style -> falls through to not-transformed
      expect(result.transformed).toBe(false);
    });
  });

  // ---- Document background ----
  describe('document background color', () => {
    it('changes body background via inline style', async () => {
      const result = await fastTransform(baseHtml, 'Change background to gray');
      assertTransformResult(result, true);
      expect(result.html).toContain('#6b7280');
    });

    it('handles body with existing style attribute', async () => {
      const htmlWithStyle = `<html><body style="margin:0;"><p>Hi</p></body></html>`;
      const result = await fastTransform(htmlWithStyle, 'Set page background to navy');
      assertTransformResult(result, true);
      expect(result.html).toContain('#1e3a5f');
      expect(result.html).toContain('background-color');
    });
  });

  // ---- Font size ----
  describe('font size', () => {
    it('increases header font size', async () => {
      const result = await fastTransform(baseHtml, 'make title bigger');
      assertTransformResult(result, true);
      expect(result.html).toContain('font-size: 120%');
      expect(result.changes.some(c => /increased/i.test(c))).toBe(true);
    });

    it('decreases body font size', async () => {
      const result = await fastTransform(baseHtml, 'smaller text');
      assertTransformResult(result, true);
      expect(result.html).toContain('font-size: 90%');
      expect(result.changes.some(c => /decreased/i.test(c))).toBe(true);
    });

    it('increases generic font size', async () => {
      const result = await fastTransform(baseHtml, 'increase font size');
      assertTransformResult(result, true);
      expect(result.html).toContain('font-size');
    });
  });

  // ---- Text alignment ----
  describe('text alignment', () => {
    it('centers the title', async () => {
      const result = await fastTransform(baseHtml, 'center the title');
      assertTransformResult(result, true);
      expect(result.html).toContain('text-align: center');
    });

    it('right-aligns the total', async () => {
      const result = await fastTransform(baseHtml, 'right-align the total');
      assertTransformResult(result, true);
      expect(result.html).toContain('text-align: right');
    });

    it('left-aligns text', async () => {
      const result = await fastTransform(baseHtml, 'left-align the text');
      assertTransformResult(result, true);
      expect(result.html).toContain('text-align: left');
    });
  });

  // ---- Spacing ----
  describe('spacing', () => {
    it('increases padding', async () => {
      const result = await fastTransform(baseHtml, 'add more padding');
      assertTransformResult(result, true);
      expect(result.html).toContain('padding: 24px');
    });

    it('reduces margin', async () => {
      const result = await fastTransform(baseHtml, 'reduce margin');
      assertTransformResult(result, true);
      expect(result.html).toContain('margin: 8px');
    });

    it('increases spacing (maps to padding)', async () => {
      const result = await fastTransform(baseHtml, 'increase spacing');
      assertTransformResult(result, true);
      expect(result.html).toContain('padding: 24px');
    });
  });

  // ---- Bold / italic / underline ----
  describe('text styling', () => {
    it('applies bold', async () => {
      const result = await fastTransform(baseHtml, 'make bold');
      assertTransformResult(result, true);
      expect(result.html).toContain('font-weight: bold');
    });

    it('applies italic to header', async () => {
      const result = await fastTransform(baseHtml, 'make the heading italic');
      assertTransformResult(result, true);
      expect(result.html).toContain('font-style: italic');
    });

    it('applies underline to title', async () => {
      const result = await fastTransform(baseHtml, 'underline the title');
      assertTransformResult(result, true);
      expect(result.html).toContain('text-decoration: underline');
    });
  });

  // ---- Background (simple) ----
  describe('simple background', () => {
    it('adds light gray background', async () => {
      const result = await fastTransform(baseHtml, 'add light gray background');
      assertTransformResult(result, true);
      expect(result.html).toContain('background-color');
    });

    it('adds beige background', async () => {
      const result = await fastTransform(baseHtml, 'add beige background');
      assertTransformResult(result, true);
      expect(result.html).toContain('background-color');
    });
  });

  // ---- Borders ----
  describe('borders', () => {
    it('adds table borders', async () => {
      const result = await fastTransform(baseHtml, 'add a table border');
      assertTransformResult(result, true);
      expect(result.html).toContain('glyph-bordered-table');
      expect(result.html).toContain('border-collapse');
    });

    it('does not duplicate borders', async () => {
      const withBorder = baseHtml.replace('<table', '<table class="glyph-bordered-table"');
      const htmlWithBorderCSS = withBorder.replace('header { background: red; }', 'header { background: red; } table { border: 1px solid; }');
      const result = await fastTransform(htmlWithBorderCSS, 'add border');
      assertTransformResult(result, true);
      expect(result.changes).toContain('Table borders already present');
    });

    it('removes borders', async () => {
      const result = await fastTransform(baseHtml, 'remove borders');
      assertTransformResult(result, true);
      expect(result.html).toContain('border: none !important');
    });
  });

  // ---- Zebra stripes ----
  describe('zebra stripes', () => {
    it('adds alternating row colors', async () => {
      const result = await fastTransform(baseHtml, 'zebra stripe');
      assertTransformResult(result, true);
      expect(result.html).toContain('nth-child(even)');
      expect(result.html).toContain('glyph-zebra-stripes');
    });

    it('does not duplicate zebra stripes', async () => {
      const withZebra = baseHtml.replace('<style>', '<style> tr:nth-child(even) { background: #eee; }');
      const result = await fastTransform(withZebra, 'striped table');
      assertTransformResult(result, true);
      expect(result.changes).toContain('Zebra stripes already present');
    });
  });

  // ---- Font family ----
  describe('font family', () => {
    it('changes to monospace', async () => {
      const result = await fastTransform(baseHtml, 'use monospace');
      assertTransformResult(result, true);
      expect(result.html).toContain('Courier');
      expect(result.changes.some(c => c.includes('monospace'))).toBe(true);
    });

    it('changes to arial', async () => {
      const result = await fastTransform(baseHtml, 'change font to arial');
      assertTransformResult(result, true);
      expect(result.html).toContain('Arial');
    });

    it('changes to georgia', async () => {
      const result = await fastTransform(baseHtml, 'set the font to georgia');
      assertTransformResult(result, true);
      expect(result.html).toContain('Georgia');
    });
  });

  // ---- Payment terms ----
  describe('payment terms', () => {
    it('adds default Net 30 terms', async () => {
      const result = await fastTransform(baseHtml, 'add payment terms');
      assertTransformResult(result, true);
      expect(result.html).toContain('glyph-payment-terms');
      expect(result.html).toContain('Net 30');
    });

    it('adds terms with custom net days', async () => {
      const result = await fastTransform(baseHtml, 'payment terms net 15');
      assertTransformResult(result, true);
      expect(result.html).toContain('Net 15');
    });

    it('adds terms with discount', async () => {
      const result = await fastTransform(baseHtml, 'add payment terms net 30 with 5% discount');
      assertTransformResult(result, true);
      expect(result.html).toContain('5%');
    });

    it('does not duplicate payment terms', async () => {
      const withTerms = baseHtml.replace('</body>', '<div class="glyph-payment-terms">terms</div></body>');
      const result = await fastTransform(withTerms, 'add payment terms');
      assertTransformResult(result, true);
      expect(result.changes).toContain('Payment terms already present');
    });
  });

  // ---- Signature ----
  describe('signature', () => {
    it('adds signature lines', async () => {
      const result = await fastTransform(baseHtml, 'add signature');
      assertTransformResult(result, true);
      expect(result.html).toContain('signature');
      expect(result.html).toContain('Client Signature');
    });

    it('does not duplicate signature', async () => {
      const withSig = baseHtml.replace('</body>', '<div class="signature-line">sig</div></body>');
      const result = await fastTransform(withSig, 'add signature');
      assertTransformResult(result, true);
      expect(result.changes).toContain('Signature section already present');
    });
  });

  // ---- Thank you ----
  describe('thank you message', () => {
    it('adds thank you message', async () => {
      const result = await fastTransform(baseHtml, 'add a thank you message');
      assertTransformResult(result, true);
      expect(result.html).toContain('glyph-thank-you');
      expect(result.html).toContain('Thank you for your business');
    });

    it('does not duplicate thank you', async () => {
      const withTy = baseHtml.replace('</body>', '<div class="glyph-thank-you">thanks</div></body>');
      const result = await fastTransform(withTy, 'add thank you');
      assertTransformResult(result, true);
      expect(result.changes).toContain('Thank you message already present');
    });
  });

  // ---- Logo ----
  describe('logo', () => {
    it('adds logo placeholder', async () => {
      const result = await fastTransform(baseHtml, 'add logo');
      assertTransformResult(result, true);
      expect(result.html).toContain('branding.logoUrl');
    });

    it('does not duplicate logo', async () => {
      const withLogo = baseHtml.replace('<header', '<header><img class="logo" src="x.png"/><header');
      const result = await fastTransform(withLogo, 'add logo');
      assertTransformResult(result, true);
      expect(result.changes).toContain('Logo placeholder already present');
    });
  });

  // ---- Phone ----
  describe('phone', () => {
    it('adds phone field', async () => {
      const htmlWithClient = baseHtml.replace('<body>', '<body><div data-glyph-region="client-info"><p>{{client.name}}</p></div>');
      const result = await fastTransform(htmlWithClient, 'add phone');
      assertTransformResult(result, true);
      expect(result.html).toContain('client.phone');
    });

    it('does not duplicate phone', async () => {
      const withPhone = baseHtml.replace('<body>', '<body><p>{{client.phone}}</p>');
      const result = await fastTransform(withPhone, 'add phone');
      assertTransformResult(result, true);
      expect(result.changes).toContain('Phone field already present');
    });
  });

  // ---- Email ----
  describe('email', () => {
    it('adds email field', async () => {
      const htmlWithClient = baseHtml.replace('<body>', '<body><div data-glyph-region="client-info"><p>{{client.name}}</p></div>');
      const result = await fastTransform(htmlWithClient, 'add email');
      assertTransformResult(result, true);
      expect(result.html).toContain('client.email');
    });

    it('does not duplicate email', async () => {
      const withEmail = baseHtml.replace('<body>', '<body><p>{{client.email}}</p>');
      const result = await fastTransform(withEmail, 'add email');
      assertTransformResult(result, true);
      expect(result.changes).toContain('Email field already present');
    });
  });

  // ---- Compound requests ----
  describe('compound requests', () => {
    it('returns transformed=false for compound requests', async () => {
      const result = await fastTransform(baseHtml, 'Add a thank you message and signature');
      assertTransformResult(result, false);
      expect(result.html).toBe(baseHtml);
    });
  });

  // ---- Edge cases ----
  describe('edge cases', () => {
    it('handles empty HTML string gracefully', async () => {
      // Empty HTML has no <body> tag, so watermark regex won't insert the div,
      // but the function still returns transformed=true with empty watermark text
      const result = await fastTransform('', 'Add watermark');
      // The watermark logic matches the prompt but can't insert into empty HTML
      // since there's no body tag to anchor to. Result: html stays empty.
      expect(result).toHaveProperty('html');
      expect(result).toHaveProperty('changes');
      expect(result).toHaveProperty('transformed');
    });

    it('handles empty prompt', async () => {
      const result = await fastTransform(baseHtml, '');
      assertTransformResult(result, false);
    });

    it('handles minimal HTML (no head/style tag)', async () => {
      const result = await fastTransform(minimalHtml, 'add more padding');
      assertTransformResult(result, true);
      expect(result.html).toContain('padding');
    });

    it('handles HTML without body tag for watermark', async () => {
      const noBodHtml = '<div>content</div>';
      const result = await fastTransform(noBodHtml, 'Add watermark');
      // Watermark insertion depends on body tag; should still set transformed
      assertTransformResult(result, true);
    });

    it('preserves existing body style when adding position:relative', async () => {
      const withStyle = `<body style="margin:0;padding:10px;">content</body>`;
      const result = await fastTransform(withStyle, 'Add watermark');
      assertTransformResult(result, true);
      expect(result.html).toContain('position:relative');
      expect(result.html).toContain('margin:0');
    });
  });

  // ---- Performance ----
  describe('performance', () => {
    it('transforms watermark in under 10ms', async () => {
      const start = performance.now();
      await fastTransform(baseHtml, 'Add watermark');
      expect(performance.now() - start).toBeLessThan(10);
    });

    it('transforms font size in under 5ms', async () => {
      const start = performance.now();
      await fastTransform(baseHtml, 'make title bigger');
      expect(performance.now() - start).toBeLessThan(5);
    });
  });
});
