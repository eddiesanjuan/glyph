/**
 * React Integration Templates
 */

export const reactComponent = (hasTypescript: boolean) => {
  const ext = hasTypescript ? 'tsx' : 'jsx';

  return {
    filename: `components/GlyphPdfButton.${ext}`,
    content: `/**
 * Glyph PDF Generation Button Component
 *
 * Usage:
 *   <GlyphPdfButton
 *     template="invoice"
 *     data={invoiceData}
 *     filename="invoice.pdf"
 *   />
 */

import { useState${hasTypescript ? ', FC' : ''} } from 'react';

${hasTypescript ? `interface GlyphPdfButtonProps {
  template: string;
  data: Record<string, unknown>;
  filename?: string;
  children?: React.ReactNode;
  className?: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

` : ''}const GLYPH_API_KEY = import.meta.env.VITE_GLYPH_API_KEY || process.env.REACT_APP_GLYPH_API_KEY;
const GLYPH_API_URL = 'https://api.glyph.so';

export ${hasTypescript ? 'const GlyphPdfButton: FC<GlyphPdfButtonProps> = ' : 'function GlyphPdfButton'}({
  template,
  data,
  filename = 'document.pdf',
  children = 'Download PDF',
  className = '',
  onSuccess,
  onError,
}${hasTypescript ? ')' : ''} {
  const [loading, setLoading] = useState(false);

  const generatePdf = async () => {
    if (!GLYPH_API_KEY) {
      const error = new Error('Glyph API key not configured');
      onError?.(error);
      console.error(error.message);
      return;
    }

    setLoading(true);

    try {
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
        throw new Error('Failed to create preview');
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

      // Download the PDF
      const blob = await pdfRes.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      onSuccess?.();
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      console.error('Glyph PDF generation error:', err);
      onError?.(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={generatePdf}
      disabled={loading}
      className={className}
      style={{
        opacity: loading ? 0.7 : 1,
        cursor: loading ? 'not-allowed' : 'pointer',
      }}
    >
      {loading ? 'Generating...' : children}
    </button>
  );
}${hasTypescript ? ';' : ''}

${hasTypescript ? '' : 'export default GlyphPdfButton;'}
`
  };
};

export const reactHook = (hasTypescript: boolean) => {
  const ext = hasTypescript ? 'ts' : 'js';

  return {
    filename: `hooks/useGlyph.${ext}`,
    content: `/**
 * useGlyph Hook
 * React hook for generating PDFs with Glyph
 */

import { useState, useCallback } from 'react';

${hasTypescript ? `interface UseGlyphOptions {
  apiKey?: string;
  apiUrl?: string;
}

interface GlyphState {
  loading: boolean;
  error: Error | null;
  sessionId: string | null;
  html: string | null;
}

interface UseGlyphReturn extends GlyphState {
  preview: (template: string, data: Record<string, unknown>) => Promise<string>;
  modify: (prompt: string) => Promise<string>;
  generate: () => Promise<Blob>;
  download: (filename?: string) => Promise<void>;
  reset: () => void;
}

` : ''}const DEFAULT_API_URL = 'https://api.glyph.so';

export function useGlyph(options${hasTypescript ? '?: UseGlyphOptions' : ''} = {})${hasTypescript ? ': UseGlyphReturn' : ''} {
  const apiKey = options${hasTypescript ? '?' : ''}.apiKey || import.meta.env.VITE_GLYPH_API_KEY || process.env.REACT_APP_GLYPH_API_KEY;
  const apiUrl = options${hasTypescript ? '?' : ''}.apiUrl || DEFAULT_API_URL;

  const [state, setState] = useState${hasTypescript ? '<GlyphState>' : ''}({
    loading: false,
    error: null,
    sessionId: null,
    html: null,
  });

  const request = useCallback(async ${hasTypescript ? '<T>' : ''}(
    endpoint${hasTypescript ? ': string' : ''},
    options${hasTypescript ? ': RequestInit' : ''} = {}
  )${hasTypescript ? ': Promise<T>' : ''} => {
    const response = await fetch(\`\${apiUrl}\${endpoint}\`, {
      ...options,
      headers: {
        'Authorization': \`Bearer \${apiKey}\`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || \`Request failed: \${response.status}\`);
    }

    return response.json();
  }, [apiKey, apiUrl]);

  const preview = useCallback(async (
    template${hasTypescript ? ': string' : ''},
    data${hasTypescript ? ': Record<string, unknown>' : ''}
  ) => {
    setState(s => ({ ...s, loading: true, error: null }));

    try {
      const result = await request${hasTypescript ? '<{ html: string; sessionId: string }>' : ''}('/v1/preview', {
        method: 'POST',
        body: JSON.stringify({ template, data }),
      });

      setState(s => ({
        ...s,
        loading: false,
        sessionId: result.sessionId,
        html: result.html,
      }));

      return result.html;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Preview failed');
      setState(s => ({ ...s, loading: false, error: err }));
      throw err;
    }
  }, [request]);

  const modify = useCallback(async (prompt${hasTypescript ? ': string' : ''}) => {
    if (!state.sessionId) {
      throw new Error('No active session. Call preview() first.');
    }

    setState(s => ({ ...s, loading: true, error: null }));

    try {
      const result = await request${hasTypescript ? '<{ html: string; changes: string[] }>' : ''}('/v1/modify', {
        method: 'POST',
        body: JSON.stringify({ sessionId: state.sessionId, prompt }),
      });

      setState(s => ({ ...s, loading: false, html: result.html }));
      return result.html;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Modify failed');
      setState(s => ({ ...s, loading: false, error: err }));
      throw err;
    }
  }, [request, state.sessionId]);

  const generate = useCallback(async () => {
    if (!state.sessionId) {
      throw new Error('No active session. Call preview() first.');
    }

    setState(s => ({ ...s, loading: true, error: null }));

    try {
      const response = await fetch(\`\${apiUrl}/v1/generate\`, {
        method: 'POST',
        headers: {
          'Authorization': \`Bearer \${apiKey}\`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId: state.sessionId }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      const blob = await response.blob();
      setState(s => ({ ...s, loading: false }));
      return blob;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Generate failed');
      setState(s => ({ ...s, loading: false, error: err }));
      throw err;
    }
  }, [apiKey, apiUrl, state.sessionId]);

  const download = useCallback(async (filename${hasTypescript ? '?' : ''} = 'document.pdf') => {
    const blob = await generate();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, [generate]);

  const reset = useCallback(() => {
    setState({
      loading: false,
      error: null,
      sessionId: null,
      html: null,
    });
  }, []);

  return {
    ...state,
    preview,
    modify,
    generate,
    download,
    reset,
  };
}
`
  };
};
