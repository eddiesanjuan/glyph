/**
 * Templates Command
 * List available templates
 */

import chalk from 'chalk';
import ora from 'ora';
import { createApiClient } from '../utils/api.js';

interface TemplatesOptions {
  apiKey?: string;
  apiUrl?: string;
}

// Default templates (shown when API is not available)
const DEFAULT_TEMPLATES = [
  {
    id: 'invoice',
    name: 'Invoice',
    description: 'Professional invoice with line items, taxes, and payment details',
    category: 'Business',
  },
  {
    id: 'quote',
    name: 'Quote / Estimate',
    description: 'Price quote with optional sections and terms',
    category: 'Business',
  },
  {
    id: 'proposal',
    name: 'Proposal',
    description: 'Business proposal with scope, timeline, and pricing',
    category: 'Business',
  },
  {
    id: 'receipt',
    name: 'Receipt',
    description: 'Simple receipt for transactions',
    category: 'Business',
  },
  {
    id: 'contract',
    name: 'Contract',
    description: 'Legal agreement template with signature blocks',
    category: 'Legal',
  },
  {
    id: 'report',
    name: 'Report',
    description: 'Structured report with sections and data tables',
    category: 'Documents',
  },
  {
    id: 'certificate',
    name: 'Certificate',
    description: 'Award or completion certificate',
    category: 'Documents',
  },
  {
    id: 'letter',
    name: 'Business Letter',
    description: 'Formal letter with letterhead',
    category: 'Documents',
  },
];

export async function templates(options: TemplatesOptions = {}): Promise<void> {
  const apiKey = options.apiKey || process.env.GLYPH_API_KEY;

  console.log();
  console.log(chalk.bold('  Available Templates'));
  console.log();

  let templateList = DEFAULT_TEMPLATES;

  // Try to fetch from API if key is available
  if (apiKey) {
    const spinner = ora('Fetching templates...').start();
    try {
      const api = createApiClient({
        apiKey,
        baseUrl: options.apiUrl,
      });
      const fetched = await api.listTemplates();
      if (fetched && fetched.length > 0) {
        templateList = fetched;
      }
      spinner.stop();
    } catch {
      spinner.stop();
      // Fall back to default templates
    }
  }

  // Group by category
  const grouped = templateList.reduce((acc, template) => {
    const category = template.category || 'Other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(template);
    return acc;
  }, {} as Record<string, typeof templateList>);

  // Display templates
  for (const [category, items] of Object.entries(grouped)) {
    console.log(chalk.dim(`  ${category}`));
    console.log();

    for (const template of items) {
      console.log(`    ${chalk.cyan(template.id.padEnd(16))} ${template.name}`);
      console.log(chalk.dim(`    ${''.padEnd(16)} ${template.description}`));
      console.log();
    }
  }

  console.log(chalk.dim('  Usage:'));
  console.log(chalk.dim('    glyph generate --template invoice --data data.json'));
  console.log();
}
