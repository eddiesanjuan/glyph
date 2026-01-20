/**
 * Generate Command
 * Generate a PDF from template and data
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import chalk from 'chalk';
import ora from 'ora';
import { createApiClient } from '../utils/api.js';

interface GenerateOptions {
  template?: string;
  data?: string;
  output?: string;
  apiKey?: string;
  apiUrl?: string;
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

export async function generate(options: GenerateOptions = {}): Promise<void> {
  const apiKey = options.apiKey || process.env.GLYPH_API_KEY;

  console.log();
  console.log(chalk.bold('  Glyph PDF Generator'));
  console.log();

  // Validate API key
  if (!apiKey) {
    console.log(chalk.red('  Error: No API key provided'));
    console.log();
    console.log(chalk.dim('  Set GLYPH_API_KEY environment variable or use --api-key flag'));
    console.log();
    return;
  }

  // Validate required options
  if (!options.data) {
    console.log(chalk.red('  Error: --data file is required'));
    console.log();
    console.log(chalk.dim('  Usage: glyph generate --data invoice.json --output invoice.pdf'));
    console.log();
    return;
  }

  // Load data file
  let data: Record<string, unknown>;
  const loadSpinner = ora('Loading data file...').start();
  try {
    data = loadJsonFile(options.data);
    loadSpinner.succeed(`Loaded ${options.data}`);
  } catch (error) {
    loadSpinner.fail(error instanceof Error ? error.message : 'Failed to load data');
    return;
  }

  // Create API client
  const api = createApiClient({
    apiKey,
    baseUrl: options.apiUrl,
  });

  // Create preview session
  const previewSpinner = ora('Creating document...').start();
  let sessionId: string;
  try {
    const result = await api.preview(options.template || 'invoice', data);
    sessionId = result.sessionId;
    previewSpinner.succeed('Document created');
  } catch (error) {
    previewSpinner.fail(error instanceof Error ? error.message : 'Failed to create document');
    return;
  }

  // Generate PDF
  const generateSpinner = ora('Generating PDF...').start();
  try {
    const pdfBlob = await api.generate(sessionId);
    const buffer = Buffer.from(await pdfBlob.arrayBuffer());

    // Determine output path
    const outputPath = options.output || 'output.pdf';
    writeFileSync(outputPath, buffer);

    generateSpinner.succeed(`PDF saved to ${chalk.cyan(outputPath)}`);

    // Show file size
    const sizeKB = (buffer.length / 1024).toFixed(1);
    console.log(chalk.dim(`  Size: ${sizeKB} KB`));
  } catch (error) {
    generateSpinner.fail(error instanceof Error ? error.message : 'Failed to generate PDF');
    return;
  }

  console.log();
  console.log(chalk.green('  Done!'));
  console.log();
}
