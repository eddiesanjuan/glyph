import { describe, it, expect } from 'vitest';
import { canFastTransform, fastTransform } from '../api/src/services/fastTransform';

describe('fastTransform', () => {
  const baseHtml = `<!DOCTYPE html>
<html>
<head><style>header { background: red; }</style></head>
<body>
<header data-glyph-region="header"><h1>Quote</h1></header>
</body>
</html>`;

  describe('canFastTransform', () => {
    it('should return true for QR code requests', () => {
      expect(canFastTransform('Add a QR code')).toBe(true);
      expect(canFastTransform('add qr code')).toBe(true);
      expect(canFastTransform('Add QR Code to the document')).toBe(true);
    });

    it('should return true for watermark requests', () => {
      expect(canFastTransform('Add a draft watermark')).toBe(true);
      expect(canFastTransform('add paid watermark')).toBe(true);
      expect(canFastTransform('Add watermark with text CONFIDENTIAL')).toBe(true);
      // Flexible patterns - words between "add" and "watermark"
      expect(canFastTransform('Add a diagonal watermark that says DRAFT across the page')).toBe(true);
      expect(canFastTransform('add a large watermark saying paid')).toBe(true);
      expect(canFastTransform('Add watermark')).toBe(true); // Should default to DRAFT
    });

    it('should return true for color change requests', () => {
      expect(canFastTransform('Make the header blue')).toBe(true);
      expect(canFastTransform('Change header color to red')).toBe(true);
      expect(canFastTransform('make title purple')).toBe(true);
    });

    it('should return false for complex requests', () => {
      expect(canFastTransform('Add a new column for quantity')).toBe(false);
      expect(canFastTransform('Restructure the layout')).toBe(false);
      expect(canFastTransform('Add client phone number')).toBe(false);
    });
  });

  describe('QR code transformation', () => {
    it('should add QR code to document', () => {
      const result = fastTransform(baseHtml, 'Add a QR code');

      expect(result.transformed).toBe(true);
      expect(result.html).toContain('glyph-qr-code');
      expect(result.html).toContain('position:relative');
      expect(result.changes.length).toBeGreaterThan(0);
    });

    it('should not duplicate QR code', () => {
      const htmlWithQr = baseHtml.replace('<body>', '<body><div class="glyph-qr-code"></div>');
      const result = fastTransform(htmlWithQr, 'Add a QR code');

      expect(result.transformed).toBe(true);
      expect(result.changes).toContain('QR code already present');
    });
  });

  describe('Watermark transformation', () => {
    it('should add DRAFT watermark', () => {
      const result = fastTransform(baseHtml, 'Add a draft watermark');

      expect(result.transformed).toBe(true);
      expect(result.html).toContain('glyph-watermark');
      expect(result.html).toContain('DRAFT');
      expect(result.html).toContain('position:relative');
    });

    it('should add PAID watermark', () => {
      const result = fastTransform(baseHtml, 'Add paid watermark');

      expect(result.transformed).toBe(true);
      expect(result.html).toContain('PAID');
    });

    it('should add CONFIDENTIAL watermark', () => {
      const result = fastTransform(baseHtml, 'Add confidential watermark');

      expect(result.transformed).toBe(true);
      expect(result.html).toContain('CONFIDENTIAL');
    });

    it('should handle flexible watermark prompts with words between add and watermark', () => {
      const result = fastTransform(baseHtml, 'Add a diagonal watermark that says DRAFT across the page');

      expect(result.transformed).toBe(true);
      expect(result.html).toContain('glyph-watermark');
      expect(result.html).toContain('DRAFT');
    });

    it('should default to DRAFT when no text specified', () => {
      const result = fastTransform(baseHtml, 'Add watermark');

      expect(result.transformed).toBe(true);
      expect(result.html).toContain('DRAFT');
    });

    it('should add APPROVED watermark', () => {
      const result = fastTransform(baseHtml, 'Add approved watermark');

      expect(result.transformed).toBe(true);
      expect(result.html).toContain('APPROVED');
    });
  });

  describe('Color transformation', () => {
    it('should change header background color', () => {
      const result = fastTransform(baseHtml, 'Make the header blue');

      expect(result.transformed).toBe(true);
      expect(result.html).toContain('#3b82f6'); // blue hex
      expect(result.changes.some(c => c.toLowerCase().includes('blue'))).toBe(true);
    });

    it('should handle header without existing background', () => {
      const htmlNoBackground = `<!DOCTYPE html>
<html>
<head><style>header { padding: 1rem; }</style></head>
<body><header><h1>Quote</h1></header></body>
</html>`;

      const result = fastTransform(htmlNoBackground, 'Make the header purple');

      expect(result.transformed).toBe(true);
      expect(result.html).toContain('#a855f7'); // purple hex
    });
  });

  describe('Performance', () => {
    it('should transform in under 10ms', () => {
      const start = performance.now();
      fastTransform(baseHtml, 'Add a QR code');
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(10);
    });
  });
});
