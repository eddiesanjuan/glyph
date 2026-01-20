/**
 * Interactive Command
 * Natural language editing session for documents
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import chalk from 'chalk';
import ora from 'ora';
import open from 'open';
import { WebSocketServer, WebSocket } from 'ws';
import { createApiClient } from '../utils/api.js';

interface InteractiveOptions {
  template?: string;
  data?: string;
  port?: number;
  apiKey?: string;
  apiUrl?: string;
}

interface SessionState {
  html: string;
  sessionId: string | null;
  data: Record<string, unknown>;
  template: string;
  history: Array<{ prompt: string; changes: string[] }>;
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
 * Extract available fields from data object
 */
function extractFields(obj: Record<string, unknown>, prefix = ''): string[] {
  const fields: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (Array.isArray(value)) {
      fields.push(`${path}[]`);
      if (value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
        const nestedFields = extractFields(value[0] as Record<string, unknown>, `${path}[]`);
        fields.push(...nestedFields);
      }
    } else if (typeof value === 'object' && value !== null) {
      fields.push(path);
      const nestedFields = extractFields(value as Record<string, unknown>, path);
      fields.push(...nestedFields);
    } else {
      fields.push(path);
    }
  }

  return fields;
}

/**
 * Generate the preview HTML page for interactive mode
 */
function generateInteractivePage(html: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Glyph Interactive Editor</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0a;
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
      background: linear-gradient(180deg, #1a1a1a 0%, #111 100%);
      border-bottom: 1px solid #333;
      padding: 12px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      z-index: 100;
    }
    .toolbar-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .toolbar h1 {
      color: #fff;
      font-size: 16px;
      font-weight: 600;
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
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
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .toolbar-right {
      display: flex;
      gap: 8px;
    }
    .toolbar-hint {
      color: #666;
      font-size: 12px;
    }
    .preview-container {
      margin-top: 80px;
      background: #fff;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
      border-radius: 8px;
      overflow: hidden;
      width: 100%;
      max-width: 816px;
      min-height: 1056px;
      transition: transform 0.3s ease, box-shadow 0.3s ease;
    }
    .preview-container:hover {
      transform: translateY(-2px);
      box-shadow: 0 30px 60px -15px rgba(0, 0, 0, 0.8);
    }
    .preview-content {
      padding: 40px;
    }
    .update-toast {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%) translateY(100px);
      background: #1a1a1a;
      color: #fff;
      padding: 12px 24px;
      border-radius: 24px;
      font-size: 14px;
      border: 1px solid #333;
      opacity: 0;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .update-toast.visible {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
    .update-toast .icon {
      color: #10b981;
    }
    .changes-list {
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      background: #1a1a1a;
      border: 1px solid #333;
      border-radius: 8px;
      padding: 12px 16px;
      opacity: 0;
      transition: opacity 0.3s ease;
      max-width: 400px;
    }
    .changes-list.visible {
      opacity: 1;
    }
    .changes-list h4 {
      color: #888;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    .changes-list ul {
      list-style: none;
      color: #ccc;
      font-size: 13px;
    }
    .changes-list li {
      padding: 4px 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .changes-list li::before {
      content: '+';
      color: #10b981;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div class="toolbar-left">
      <h1>Glyph Interactive</h1>
      <span class="status">Connected</span>
    </div>
    <div class="toolbar-right">
      <span class="toolbar-hint">Type commands in the terminal</span>
    </div>
  </div>
  <div class="preview-container">
    <div class="preview-content" id="preview">
      ${html}
    </div>
  </div>
  <div class="update-toast" id="toast">
    <span class="icon">&#10003;</span>
    <span id="toastMessage">Updated</span>
  </div>
  <div class="changes-list" id="changesList">
    <h4>Changes</h4>
    <ul id="changesContent"></ul>
  </div>

  <script>
    const ws = new WebSocket('ws://' + location.host);
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    const changesList = document.getElementById('changesList');
    const changesContent = document.getElementById('changesContent');

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'update') {
        document.getElementById('preview').innerHTML = data.html;

        // Show toast
        toastMessage.textContent = 'Preview updated';
        toast.classList.add('visible');
        setTimeout(() => toast.classList.remove('visible'), 2000);
      }

      if (data.type === 'changes' && data.changes && data.changes.length > 0) {
        changesContent.innerHTML = data.changes.map(c => '<li>' + c + '</li>').join('');
        changesList.classList.add('visible');
        setTimeout(() => changesList.classList.remove('visible'), 4000);
      }

      if (data.type === 'saving') {
        toastMessage.textContent = 'Generating PDF...';
        toast.classList.add('visible');
      }

      if (data.type === 'saved') {
        toastMessage.textContent = 'PDF saved: ' + data.filename;
        toast.classList.add('visible');
        setTimeout(() => toast.classList.remove('visible'), 3000);
      }
    };

    ws.onclose = () => {
      toastMessage.textContent = 'Disconnected from CLI';
      toast.classList.add('visible');
    };
  </script>
</body>
</html>`;
}

export async function interactive(options: InteractiveOptions = {}): Promise<void> {
  const port = options.port || 3847;
  const apiKey = options.apiKey || process.env.GLYPH_API_KEY;

  console.log();
  console.log(chalk.bold.blue('  Glyph Interactive Mode'));
  console.log(chalk.dim('  Natural language document editing'));
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

  // Extract available fields for autocomplete hints
  const availableFields = extractFields(data);

  // Initialize session state
  const state: SessionState = {
    html: '<div style="text-align: center; padding: 100px; color: #666;">Initializing...</div>',
    sessionId: null,
    data,
    template: options.template || 'invoice',
    history: [],
  };

  // Create API client
  const api = createApiClient({
    apiKey,
    baseUrl: options.apiUrl,
  });

  // Create HTTP server
  const server = createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end(generateInteractivePage(state.html));
  });

  // Create WebSocket server
  const wss = new WebSocketServer({ server });
  const clients = new Set<WebSocket>();

  wss.on('connection', (ws) => {
    clients.add(ws);
    ws.on('close', () => clients.delete(ws));
  });

  // Broadcast message to all clients
  function broadcast(message: Record<string, unknown>): void {
    const json = JSON.stringify(message);
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(json);
      }
    }
  }

  // Create initial preview
  const previewSpinner = ora('Creating initial preview...').start();
  try {
    const result = await api.preview(state.template, state.data);
    state.html = result.html;
    state.sessionId = result.sessionId;
    previewSpinner.succeed('Preview ready');
  } catch (error) {
    previewSpinner.fail(error instanceof Error ? error.message : 'Failed to create preview');
    state.html = `<div style="text-align: center; padding: 100px; color: #e11d48;">
      <h2>Preview Error</h2>
      <p style="margin-top: 12px;">${error instanceof Error ? error.message : 'Unknown error'}</p>
    </div>`;
  }

  // Start server and open browser
  server.listen(port, () => {
    const url = `http://localhost:${port}`;

    console.log();
    console.log(chalk.green(`  Preview: ${chalk.bold(url)}`));
    console.log();

    if (availableFields.length > 0) {
      console.log(chalk.dim('  Available fields:'));
      const displayFields = availableFields.slice(0, 8);
      console.log(chalk.dim(`  ${displayFields.join(', ')}${availableFields.length > 8 ? '...' : ''}`));
      console.log();
    }

    console.log(chalk.dim('  Commands:'));
    console.log(chalk.dim('    Type natural language to modify the document'));
    console.log(chalk.dim('    "save" or "s" - Generate and save PDF'));
    console.log(chalk.dim('    "undo" or "u" - Undo last change'));
    console.log(chalk.dim('    "quit" or "q" - Exit interactive mode'));
    console.log();

    open(url);
  });

  // Create readline interface for terminal input
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Print prompt
  function printPrompt(): void {
    process.stdout.write(chalk.cyan('\n  > '));
  }

  printPrompt();

  // Handle user input
  rl.on('line', async (input) => {
    const command = input.trim().toLowerCase();

    // Handle special commands
    if (command === 'quit' || command === 'q' || command === 'exit') {
      console.log();
      console.log(chalk.dim('  Goodbye!'));
      console.log();
      rl.close();
      server.close();
      process.exit(0);
    }

    if (command === 'save' || command === 's') {
      if (!state.sessionId) {
        console.log(chalk.red('  No active session'));
        printPrompt();
        return;
      }

      broadcast({ type: 'saving' });
      const saveSpinner = ora('Generating PDF...').start();

      try {
        const pdfBlob = await api.generate(state.sessionId);
        const buffer = Buffer.from(await pdfBlob.arrayBuffer());
        const filename = `document-${Date.now()}.pdf`;
        writeFileSync(filename, buffer);
        saveSpinner.succeed(`Saved to ${chalk.cyan(filename)}`);
        broadcast({ type: 'saved', filename });
      } catch (error) {
        saveSpinner.fail(error instanceof Error ? error.message : 'Failed to generate PDF');
      }

      printPrompt();
      return;
    }

    if (command === 'undo' || command === 'u') {
      if (state.history.length === 0) {
        console.log(chalk.yellow('  Nothing to undo'));
        printPrompt();
        return;
      }

      // Re-create preview to reset
      const undoSpinner = ora('Undoing...').start();
      try {
        const result = await api.preview(state.template, state.data);
        state.html = result.html;
        state.sessionId = result.sessionId;

        // Replay all but last command
        state.history.pop();
        for (const item of state.history) {
          const modResult = await api.modify(state.sessionId!, item.prompt);
          state.html = modResult.html;
        }

        broadcast({ type: 'update', html: state.html });
        undoSpinner.succeed('Undone');
      } catch (error) {
        undoSpinner.fail(error instanceof Error ? error.message : 'Failed to undo');
      }

      printPrompt();
      return;
    }

    if (command === 'help' || command === 'h' || command === '?') {
      console.log();
      console.log(chalk.dim('  Available commands:'));
      console.log(chalk.dim('    save, s     - Generate and save PDF'));
      console.log(chalk.dim('    undo, u     - Undo last change'));
      console.log(chalk.dim('    quit, q     - Exit interactive mode'));
      console.log(chalk.dim('    help, h, ?  - Show this help'));
      console.log();
      console.log(chalk.dim('  Or type any modification in natural language:'));
      console.log(chalk.dim('    "add QR code for payment"'));
      console.log(chalk.dim('    "make the header larger"'));
      console.log(chalk.dim('    "add terms: Net 30, 2% early payment discount"'));
      printPrompt();
      return;
    }

    // Skip empty input
    if (!command) {
      printPrompt();
      return;
    }

    // Process as modification prompt
    if (!state.sessionId) {
      console.log(chalk.red('  No active session'));
      printPrompt();
      return;
    }

    const modifySpinner = ora('Processing...').start();
    try {
      const result = await api.modify(state.sessionId, input.trim());
      state.html = result.html;
      state.history.push({ prompt: input.trim(), changes: result.changes });

      modifySpinner.succeed('Updated');

      if (result.changes && result.changes.length > 0) {
        for (const change of result.changes) {
          console.log(chalk.dim(`    + ${change}`));
        }
      }

      broadcast({ type: 'update', html: state.html });
      broadcast({ type: 'changes', changes: result.changes });
    } catch (error) {
      modifySpinner.fail(error instanceof Error ? error.message : 'Failed to modify');
    }

    printPrompt();
  });

  // Handle Ctrl+C
  rl.on('close', () => {
    console.log();
    server.close();
    process.exit(0);
  });
}
