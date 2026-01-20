/**
 * Next.js Integration Templates
 */

export const nextjsApiRoute = (hasTypescript: boolean) => {
  const ext = hasTypescript ? 'ts' : 'js';
  const typeAnnotations = hasTypescript;

  return {
    filename: `api/glyph/generate/route.${ext}`,
    content: `/**
 * Glyph PDF Generation API Route
 * POST /api/glyph/generate
 */

${typeAnnotations ? `import { NextRequest, NextResponse } from 'next/server';

interface GenerateRequest {
  template: string;
  data: Record<string, unknown>;
}

` : ''}export async function POST(request${typeAnnotations ? ': NextRequest' : ''}) {
  try {
    const { template, data }${typeAnnotations ? ': GenerateRequest' : ''} = await request.json();

    // Create preview session
    const previewRes = await fetch('https://api.glyph.you/v1/preview', {
      method: 'POST',
      headers: {
        'Authorization': \`Bearer \${process.env.GLYPH_API_KEY}\`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ template, data }),
    });

    if (!previewRes.ok) {
      throw new Error('Failed to create preview');
    }

    const { sessionId } = await previewRes.json();

    // Generate PDF
    const pdfRes = await fetch('https://api.glyph.you/v1/generate', {
      method: 'POST',
      headers: {
        'Authorization': \`Bearer \${process.env.GLYPH_API_KEY}\`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sessionId }),
    });

    if (!pdfRes.ok) {
      throw new Error('Failed to generate PDF');
    }

    const pdfBuffer = await pdfRes.arrayBuffer();

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="document.pdf"',
      },
    });
  } catch (error) {
    console.error('Glyph generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}
`
  };
};

export const nextjsClientExample = (hasTypescript: boolean) => {
  const ext = hasTypescript ? 'tsx' : 'jsx';

  return {
    filename: `components/GlyphExample.${ext}`,
    content: `/**
 * Example: Generate PDF with Glyph
 */
'use client';

import { useState } from 'react';

export function GlyphExample() {
  const [loading, setLoading] = useState(false);

  const generateInvoice = async () => {
    setLoading(true);

    try {
      const response = await fetch('/api/glyph/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template: 'invoice',
          data: {
            invoiceNumber: 'INV-001',
            date: new Date().toISOString().split('T')[0],
            clientName: 'Acme Corp',
            lineItems: [
              { description: 'Web Development', quantity: 40, unitPrice: 150 },
              { description: 'Design Services', quantity: 20, unitPrice: 100 },
            ],
            subtotal: 8000,
            tax: 800,
            total: 8800,
          },
        }),
      });

      if (!response.ok) throw new Error('Failed to generate PDF');

      // Download the PDF
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'invoice.pdf';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={generateInvoice}
      disabled={loading}
      style={{
        padding: '12px 24px',
        fontSize: '16px',
        cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.7 : 1,
      }}
    >
      {loading ? 'Generating...' : 'Generate Invoice PDF'}
    </button>
  );
}
`
  };
};
