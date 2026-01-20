/**
 * Glyph PDF Generation Script
 *
 * Usage:
 *   npx tsx scripts/generate-pdf.ts
 */

import { writeFileSync } from 'node:fs';

const GLYPH_API_KEY = process.env.GLYPH_API_KEY;
const GLYPH_API_URL = 'https://api.glyph.you';

interface GenerateOptions {
  template: string;
  data: Record<string, unknown>;
  outputPath?: string;
}

async function generatePdf({
  template,
  data,
  outputPath = './output.pdf',
}: GenerateOptions): Promise<void> {
  if (!GLYPH_API_KEY) {
    throw new Error('GLYPH_API_KEY environment variable is required');
  }

  console.log('Creating preview session...');

  // Create preview session
  const previewRes = await fetch(`${GLYPH_API_URL}/v1/preview`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GLYPH_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ template, data }),
  });

  if (!previewRes.ok) {
    const error = await previewRes.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to create preview');
  }

  const { sessionId } = await previewRes.json();
  console.log(`Session created: ${sessionId}`);

  console.log('Generating PDF...');

  // Generate PDF
  const pdfRes = await fetch(`${GLYPH_API_URL}/v1/generate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GLYPH_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sessionId }),
  });

  if (!pdfRes.ok) {
    throw new Error('Failed to generate PDF');
  }

  const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
  writeFileSync(outputPath, pdfBuffer);

  console.log(`PDF saved to: ${outputPath}`);
}

// Example usage
const invoiceData = {
  invoiceNumber: 'INV-2024-001',
  date: new Date().toISOString().split('T')[0],
  company: {
    name: 'Your Company',
    address: '123 Business St',
    email: 'hello@company.com',
  },
  client: {
    name: 'Client Name',
    address: '456 Client Ave',
    email: 'client@example.com',
  },
  lineItems: [
    { description: 'Service A', quantity: 5, unitPrice: 100 },
    { description: 'Service B', quantity: 10, unitPrice: 50 },
  ],
  subtotal: 1000,
  tax: 100,
  total: 1100,
};

generatePdf({
  template: 'invoice',
  data: invoiceData,
  outputPath: './invoice.pdf',
})
  .then(() => console.log('Done!'))
  .catch(console.error);
