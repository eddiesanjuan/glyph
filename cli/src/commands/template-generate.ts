/**
 * Template Generate Command
 * Generate a template from data schema
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import chalk from 'chalk';
import ora from 'ora';
import { createApiClient } from '../utils/api.js';

interface TemplateGenerateOptions {
  data?: string;
  output?: string;
  description?: string;
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

/**
 * Infer schema from data object
 */
function inferSchema(obj: Record<string, unknown>, prefix = ''): Record<string, unknown> {
  const schema: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (Array.isArray(value)) {
      if (value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
        schema[key] = {
          type: 'array',
          items: inferSchema(value[0] as Record<string, unknown>),
        };
      } else {
        schema[key] = {
          type: 'array',
          items: { type: typeof value[0] || 'string' },
        };
      }
    } else if (typeof value === 'object' && value !== null) {
      schema[key] = {
        type: 'object',
        properties: inferSchema(value as Record<string, unknown>),
      };
    } else if (typeof value === 'number') {
      schema[key] = { type: 'number' };
    } else if (typeof value === 'boolean') {
      schema[key] = { type: 'boolean' };
    } else if (typeof value === 'string') {
      // Try to detect special types
      if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
        schema[key] = { type: 'date' };
      } else if (/^https?:\/\//.test(value)) {
        schema[key] = { type: 'url' };
      } else if (/@/.test(value) && /\.\w+$/.test(value)) {
        schema[key] = { type: 'email' };
      } else if (/^\+?\d[\d\s-]{8,}$/.test(value)) {
        schema[key] = { type: 'phone' };
      } else if (/\.(jpg|jpeg|png|gif|svg|webp)$/i.test(value)) {
        schema[key] = { type: 'image' };
      } else {
        schema[key] = { type: 'string' };
      }
    } else {
      schema[key] = { type: 'string' };
    }
  }

  return schema;
}

export async function templateGenerate(options: TemplateGenerateOptions = {}): Promise<void> {
  const apiKey = options.apiKey || process.env.GLYPH_API_KEY;

  console.log();
  console.log(chalk.bold('  Glyph Template Generator'));
  console.log(chalk.dim('  AI-powered template creation'));
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
    console.log(chalk.dim('  Usage: glyph template:generate --data sample.json'));
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

  // Infer schema from data
  const schemaSpinner = ora('Analyzing data structure...').start();
  const schema = inferSchema(data);
  schemaSpinner.succeed('Schema inferred');

  // Display detected fields
  console.log();
  console.log(chalk.dim('  Detected fields:'));
  const fields = Object.keys(schema);
  for (const field of fields.slice(0, 10)) {
    const fieldSchema = schema[field] as Record<string, unknown>;
    console.log(chalk.dim(`    ${field}: ${fieldSchema.type}`));
  }
  if (fields.length > 10) {
    console.log(chalk.dim(`    ... and ${fields.length - 10} more`));
  }
  console.log();

  // Generate template
  const api = createApiClient({
    apiKey,
    baseUrl: options.apiUrl,
  });

  const generateSpinner = ora('Generating template with AI...').start();
  try {
    const description = options.description || `Professional document template for ${basename(options.data, '.json')}`;
    const result = await api.generateTemplate(description, schema, data);

    generateSpinner.succeed('Template generated');

    // Determine output paths
    const baseName = options.output || basename(options.data, '.json');
    const htmlPath = `${baseName}.html`;
    const schemaPath = `${baseName}.schema.json`;

    // Save HTML template
    writeFileSync(htmlPath, result.html);
    console.log(chalk.dim(`  + ${htmlPath}`));

    // Save schema
    writeFileSync(schemaPath, JSON.stringify({ fields: schema, sample: data }, null, 2));
    console.log(chalk.dim(`  + ${schemaPath}`));

    console.log();
    console.log(chalk.green('  Template generated successfully!'));
    console.log();
    console.log(chalk.dim('  Next steps:'));
    console.log(chalk.dim(`    glyph preview --template ${htmlPath} --data ${options.data}`));
    console.log();
  } catch (error) {
    generateSpinner.fail(error instanceof Error ? error.message : 'Failed to generate template');
  }
}
