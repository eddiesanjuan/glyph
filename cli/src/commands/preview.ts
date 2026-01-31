/**
 * Preview Command
 * Start a local preview server for document editing
 */

import { readFileSync, existsSync, watch } from 'node:fs';
import { createServer } from 'node:http';
import { join, resolve } from 'node:path';
import chalk from 'chalk';
import ora from 'ora';
import open from 'open';
import { WebSocketServer, WebSocket } from 'ws';
import { createApiClient } from '../utils/api.js';

interface PreviewOptions {
  template?: string;
  data?: string;
  port?: number;
  apiKey?: string;
  apiUrl?: string;
  open?: boolean;
  // Source-first options
  source?: string;
  mapping?: string;
  record?: string;
}

interface PreviewState {
  html: string;
  sessionId: string | null;
  data: Record<string, unknown>;
  template: string;
}

/**
 * Load JSON data from a file
 */
function loadJsonFile(filePath: string): Record<string, unknown> {
  const fullPath = resolve(filePath);
  if (!existsSync(fullPath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  try {
    const content = readFileSync(fullPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to parse JSON: ${filePath}`);
  }
}

/**
 * Generate the preview HTML page
 */
function generatePreviewPage(html: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Glyph Preview</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1a1a1a;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 40px 20px;
    }
    .toolbar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: #2a2a2a;
      border-bottom: 1px solid #333;
      padding: 12px 20px;
      display: flex;
      align-items: center;
      gap: 16px;
      z-index: 100;
    }
    .toolbar h1 {
      color: #fff;
      font-size: 16px;
      font-weight: 600;
    }
    .toolbar .status {
      color: #10b981;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .toolbar .status::before {
      content: '';
      width: 8px;
      height: 8px;
      background: #10b981;
      border-radius: 50%;
    }
    .preview-container {
      margin-top: 80px;
      background: #fff;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      border-radius: 4px;
      overflow: hidden;
      width: 100%;
      max-width: 816px; /* Letter width at 96dpi */
      min-height: 1056px; /* Letter height */
    }
    .preview-content {
      padding: 40px;
    }
    .reload-indicator {
      position: fixed;
      top: 60px;
      right: 20px;
      background: #3b82f6;
      color: #fff;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 13px;
      opacity: 0;
      transform: translateY(-10px);
      transition: all 0.3s ease;
    }
    .reload-indicator.visible {
      opacity: 1;
      transform: translateY(0);
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <h1>Glyph Preview</h1>
    <span class="status">Live</span>
  </div>
  <div class="reload-indicator" id="reloadIndicator">Refreshing...</div>
  <div class="preview-container">
    <div class="preview-content" id="preview">
      ${html}
    </div>
  </div>

  <script>
    // WebSocket for live reload
    const ws = new WebSocket('ws://' + location.host);
    const indicator = document.getElementById('reloadIndicator');

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'update') {
        indicator.classList.add('visible');
        document.getElementById('preview').innerHTML = data.html;
        setTimeout(() => {
          indicator.classList.remove('visible');
        }, 1000);
      }
    };

    ws.onclose = () => {
      console.log('Preview connection closed. Reload the page to reconnect.');
    };
  </script>
</body>
</html>`;
}

/**
 * Fetch from API with authorization
 */
async function apiRequest<T>(
  endpoint: string,
  apiKey: string,
  baseUrl: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${baseUrl}${endpoint}`;
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${apiKey}`);
  headers.set('Content-Type', 'application/json');

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error((errorData.error as string) || `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function preview(options: PreviewOptions = {}): Promise<void> {
  const port = options.port || 3847;
  const apiKey = options.apiKey || process.env.GLYPH_API_KEY;
  const baseUrl = (options.apiUrl || 'https://api.glyph.you').replace(/\/$/, '');

  console.log();
  console.log(chalk.bold('  Glyph Preview Server'));
  console.log();

  // Validate API key
  if (!apiKey) {
    console.log(chalk.red('  Error: No API key provided'));
    console.log();
    console.log(chalk.dim('  Set GLYPH_API_KEY environment variable or use --api-key flag'));
    console.log();
    return;
  }

  // Load data file
  let data: Record<string, unknown> = {};
  if (options.data) {
    const spinner = ora('Loading data file...').start();
    try {
      data = loadJsonFile(options.data);
      spinner.succeed(`Loaded ${options.data}`);
    } catch (error) {
      spinner.fail(error instanceof Error ? error.message : 'Failed to load data');
      return;
    }
  }

  // Initialize state
  const state: PreviewState = {
    html: '<div style="text-align: center; padding: 100px; color: #666;">Loading preview...</div>',
    sessionId: null,
    data,
    template: options.template || 'invoice',
  };

  // Create API client
  const api = createApiClient({
    apiKey,
    baseUrl: options.apiUrl,
  });

  // Create HTTP server
  const server = createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end(generatePreviewPage(state.html));
  });

  // Create WebSocket server for live reload
  const wss = new WebSocketServer({ server });
  const clients = new Set<WebSocket>();

  wss.on('connection', (ws) => {
    clients.add(ws);
    ws.on('close', () => clients.delete(ws));
  });

  // Broadcast update to all connected clients
  function broadcastUpdate(): void {
    const message = JSON.stringify({ type: 'update', html: state.html });
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }

  // Initial preview generation
  const previewSpinner = ora('Generating initial preview...').start();
  try {
    // Source-first workflow: use mapping + record
    if (options.mapping || options.source) {
      let mappingId = options.mapping;

      // If only source provided, find the mapping for it
      if (!mappingId && options.source) {
        interface MappingResponse {
          success: boolean;
          mappings: Array<{ id: string }>;
          error?: string;
        }
        const mappingsRes = await apiRequest<MappingResponse>(
          `/v1/mappings?source_id=${options.source}`,
          apiKey,
          baseUrl
        );
        mappingId = mappingsRes.mappings?.[0]?.id;
        if (!mappingId) {
          throw new Error('No mapping found for this source. Create a mapping first with glyph_link_template.');
        }
      }

      // Create session from mapping
      interface SessionResponse {
        success: boolean;
        sessionId: string;
        preview: { html: string; record_id: string };
        template: { id: string; name: string };
        source: { id: string; name: string };
        error?: string;
      }
      const sessionRes = await apiRequest<SessionResponse>(
        '/v1/sessions/from-mapping',
        apiKey,
        baseUrl,
        {
          method: 'POST',
          body: JSON.stringify({
            mapping_id: mappingId,
            record_id: options.record,
          }),
        }
      );

      state.html = sessionRes.preview.html;
      state.sessionId = sessionRes.sessionId;
      state.template = sessionRes.template.name;
      previewSpinner.succeed(
        `Preview generated from ${chalk.cyan(sessionRes.source.name)} (record: ${sessionRes.preview.record_id})`
      );
    } else {
      // Traditional template + data workflow
      const result = await api.preview(state.template, state.data);
      state.html = result.html;
      state.sessionId = result.sessionId;
      previewSpinner.succeed('Preview generated');
    }
  } catch (error) {
    previewSpinner.fail(error instanceof Error ? error.message : 'Failed to generate preview');
    // Use placeholder HTML
    state.html = `<div style="text-align: center; padding: 100px; color: #e11d48;">
      <h2>Preview Error</h2>
      <p style="margin-top: 12px;">${error instanceof Error ? error.message : 'Unknown error'}</p>
    </div>`;
  }

  // Watch data file for changes
  if (options.data) {
    const dataPath = resolve(options.data);
    watch(dataPath, async () => {
      console.log(chalk.dim('  Data file changed, refreshing...'));
      try {
        state.data = loadJsonFile(options.data!);
        const result = await api.preview(state.template, state.data);
        state.html = result.html;
        state.sessionId = result.sessionId;
        broadcastUpdate();
        console.log(chalk.green('  Preview updated'));
      } catch (error) {
        console.log(chalk.red(`  Error: ${error instanceof Error ? error.message : 'Unknown'}`));
      }
    });
  }

  // Start server
  server.listen(port, () => {
    const url = `http://localhost:${port}`;

    console.log();
    console.log(chalk.green(`  Preview running at ${chalk.bold(url)}`));
    console.log();
    console.log(chalk.dim('  Press Ctrl+C to stop'));
    console.log();

    // Open browser
    if (options.open !== false) {
      open(url);
    }
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log();
    console.log(chalk.dim('  Stopping preview server...'));
    server.close();
    process.exit(0);
  });
}
