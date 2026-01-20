/**
 * Express/Node API Integration Templates
 */

export const expressRouteHandler = (hasTypescript: boolean) => {
  const ext = hasTypescript ? 'ts' : 'js';
  const typeAnnotations = hasTypescript;

  return {
    filename: `routes/glyph.${ext}`,
    content: `/**
 * Glyph PDF Generation Routes
 */

${typeAnnotations ? `import { Router, Request, Response } from 'express';` : `const { Router } = require('express');`}

const router = Router();

const GLYPH_API_URL = 'https://api.glyph.you';
const GLYPH_API_KEY = process.env.GLYPH_API_KEY;

/**
 * POST /api/glyph/generate
 * Generate a PDF from template and data
 */
router.post('/generate', async (req${typeAnnotations ? ': Request' : ''}, res${typeAnnotations ? ': Response' : ''}) => {
  try {
    const { template, data } = req.body;

    if (!template || !data) {
      return res.status(400).json({ error: 'Missing template or data' });
    }

    // Create preview session
    const previewRes = await fetch(\`\${GLYPH_API_URL}/v1/preview\`, {
      method: 'POST',
      headers: {
        'Authorization': \`Bearer \${GLYPH_API_KEY}\`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ template, data }),
    });

    if (!previewRes.ok) {
      const error = await previewRes.json().catch(() => ({}));
      throw new Error(error.message || 'Failed to create preview');
    }

    const { sessionId } = await previewRes.json();

    // Generate PDF
    const pdfRes = await fetch(\`\${GLYPH_API_URL}/v1/generate\`, {
      method: 'POST',
      headers: {
        'Authorization': \`Bearer \${GLYPH_API_KEY}\`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sessionId }),
    });

    if (!pdfRes.ok) {
      throw new Error('Failed to generate PDF');
    }

    const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="document.pdf"',
      'Content-Length': pdfBuffer.length,
    });

    res.send(pdfBuffer);
  } catch (error${typeAnnotations ? ': unknown' : ''}) {
    console.error('Glyph generation error:', error);
    res.status(500).json({
      error: 'Failed to generate PDF',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/glyph/preview
 * Get HTML preview of a document
 */
router.post('/preview', async (req${typeAnnotations ? ': Request' : ''}, res${typeAnnotations ? ': Response' : ''}) => {
  try {
    const { template, data } = req.body;

    const response = await fetch(\`\${GLYPH_API_URL}/v1/preview\`, {
      method: 'POST',
      headers: {
        'Authorization': \`Bearer \${GLYPH_API_KEY}\`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ template, data }),
    });

    if (!response.ok) {
      throw new Error('Failed to create preview');
    }

    const result = await response.json();
    res.json(result);
  } catch (error${typeAnnotations ? ': unknown' : ''}) {
    console.error('Glyph preview error:', error);
    res.status(500).json({ error: 'Failed to create preview' });
  }
});

${typeAnnotations ? 'export default router;' : 'module.exports = router;'}
`
  };
};

export const expressUsageExample = (hasTypescript: boolean) => {
  const ext = hasTypescript ? 'ts' : 'js';

  return {
    filename: `examples/glyph-usage.${ext}`,
    content: `/**
 * Example: Using Glyph to generate an invoice PDF
 */

${hasTypescript ? '' : '// '}// Add this to your Express app setup:
${hasTypescript ? '' : '// '}// import glyphRouter from './routes/glyph';
${hasTypescript ? '' : '// '}// app.use('/api/glyph', glyphRouter);

// Then call from anywhere:
async function generateInvoicePdf() {
  const response = await fetch('http://localhost:3000/api/glyph/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      template: 'invoice',
      data: {
        invoiceNumber: 'INV-2024-001',
        date: '2024-01-15',
        dueDate: '2024-02-14',
        company: {
          name: 'Your Company',
          address: '123 Business St, Suite 100',
          email: 'billing@yourcompany.com',
        },
        client: {
          name: 'Client Corp',
          address: '456 Client Ave',
          email: 'accounts@client.com',
        },
        lineItems: [
          { description: 'Consulting Services', quantity: 10, unitPrice: 200 },
          { description: 'Development Work', quantity: 40, unitPrice: 150 },
        ],
        subtotal: 8000,
        taxRate: 10,
        tax: 800,
        total: 8800,
        notes: 'Thank you for your business!',
      },
    }),
  });

  if (response.ok) {
    const blob = await response.blob();
    // Save or send the PDF...
    console.log('PDF generated successfully!');
  }
}

${hasTypescript ? 'export { generateInvoicePdf };' : 'module.exports = { generateInvoicePdf };'}
`
  };
};
