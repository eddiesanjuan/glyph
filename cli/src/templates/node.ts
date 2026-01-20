/**
 * Generic Node.js Integration Templates
 */

export const nodeScript = (hasTypescript: boolean) => {
  const ext = hasTypescript ? 'ts' : 'js';

  return {
    filename: `scripts/generate-pdf.${ext}`,
    content: `/**
 * Glyph PDF Generation Script
 *
 * Usage:
 *   ${hasTypescript ? 'npx tsx' : 'node'} scripts/generate-pdf.${ext}
 */

import { writeFileSync } from 'node:fs';

const GLYPH_API_KEY = process.env.GLYPH_API_KEY;
const GLYPH_API_URL = 'https://api.glyph.you';

${hasTypescript ? `interface GenerateOptions {
  template: string;
  data: Record<string, unknown>;
  outputPath?: string;
}

` : ''}async function generatePdf({
  template,
  data,
  outputPath = './output.pdf',
}${hasTypescript ? ': GenerateOptions' : ''})${hasTypescript ? ': Promise<void>' : ''} {
  if (!GLYPH_API_KEY) {
    throw new Error('GLYPH_API_KEY environment variable is required');
  }

  console.log('Creating preview session...');

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
  console.log(\`Session created: \${sessionId}\`);

  console.log('Generating PDF...');

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
  writeFileSync(outputPath, pdfBuffer);

  console.log(\`PDF saved to: \${outputPath}\`);
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
`
  };
};

export const nodeModule = (hasTypescript: boolean) => {
  const ext = hasTypescript ? 'ts' : 'js';

  return {
    filename: `lib/glyph.${ext}`,
    content: `/**
 * Glyph Client Module
 * Reusable module for PDF generation
 */

const GLYPH_API_URL = 'https://api.glyph.you';

${hasTypescript ? `export interface GlyphClientConfig {
  apiKey: string;
  apiUrl?: string;
}

export interface Session {
  sessionId: string;
  html: string;
}

` : ''}export class GlyphClient {
  ${hasTypescript ? 'private ' : '#'}apiKey${hasTypescript ? ': string' : ''};
  ${hasTypescript ? 'private ' : '#'}apiUrl${hasTypescript ? ': string' : ''};

  constructor(config${hasTypescript ? ': GlyphClientConfig' : ''}) {
    ${hasTypescript ? 'this.' : 'this.#'}apiKey = config.apiKey;
    ${hasTypescript ? 'this.' : 'this.#'}apiUrl = config.apiUrl || GLYPH_API_URL;
  }

  ${hasTypescript ? 'private ' : '#'}async request${hasTypescript ? '<T>' : ''}(
    endpoint${hasTypescript ? ': string' : ''},
    options${hasTypescript ? ': RequestInit' : ''} = {}
  )${hasTypescript ? ': Promise<T>' : ''} {
    const response = await fetch(\`\${${hasTypescript ? 'this.' : 'this.#'}apiUrl}\${endpoint}\`, {
      ...options,
      headers: {
        'Authorization': \`Bearer \${${hasTypescript ? 'this.' : 'this.#'}apiKey}\`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || \`Request failed: \${response.status}\`);
    }

    return response.json();
  }

  /**
   * Create a preview session from template and data
   */
  async preview(
    template${hasTypescript ? ': string' : ''},
    data${hasTypescript ? ': Record<string, unknown>' : ''}
  )${hasTypescript ? ': Promise<Session>' : ''} {
    return ${hasTypescript ? 'this.' : 'this.#'}request${hasTypescript ? '<Session>' : ''}('/v1/preview', {
      method: 'POST',
      body: JSON.stringify({ template, data }),
    });
  }

  /**
   * Modify the document with an AI prompt
   */
  async modify(
    sessionId${hasTypescript ? ': string' : ''},
    prompt${hasTypescript ? ': string' : ''}
  )${hasTypescript ? ': Promise<{ html: string; changes: string[] }>' : ''} {
    return ${hasTypescript ? 'this.' : 'this.#'}request('/v1/modify', {
      method: 'POST',
      body: JSON.stringify({ sessionId, prompt }),
    });
  }

  /**
   * Generate PDF from session
   */
  async generate(sessionId${hasTypescript ? ': string' : ''})${hasTypescript ? ': Promise<Buffer>' : ''} {
    const response = await fetch(\`\${${hasTypescript ? 'this.' : 'this.#'}apiUrl}/v1/generate\`, {
      method: 'POST',
      headers: {
        'Authorization': \`Bearer \${${hasTypescript ? 'this.' : 'this.#'}apiKey}\`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sessionId }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate PDF');
    }

    return Buffer.from(await response.arrayBuffer());
  }

  /**
   * Convenience method: preview -> generate in one call
   */
  async generatePdf(
    template${hasTypescript ? ': string' : ''},
    data${hasTypescript ? ': Record<string, unknown>' : ''}
  )${hasTypescript ? ': Promise<Buffer>' : ''} {
    const { sessionId } = await this.preview(template, data);
    return this.generate(sessionId);
  }
}

/**
 * Create a Glyph client instance
 */
export function createClient(apiKey${hasTypescript ? ': string' : ''})${hasTypescript ? ': GlyphClient' : ''} {
  return new GlyphClient({ apiKey });
}
`
  };
};
