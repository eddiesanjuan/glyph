#!/usr/bin/env node
/**
 * Glyph CLI
 * AI-powered PDF generation from the command line
 */

import { Command } from 'commander';
import chalk from 'chalk';

import { init } from './commands/init.js';
import { preview } from './commands/preview.js';
import { generate } from './commands/generate.js';
import { interactive } from './commands/interactive.js';
import { templates } from './commands/templates.js';
import { templateGenerate } from './commands/template-generate.js';

const VERSION = '0.1.0';

const program = new Command()
  .name('glyph')
  .description('AI-powered PDF generation CLI')
  .version(VERSION);

// init - Initialize Glyph in a project
program
  .command('init')
  .description('Initialize Glyph in your project')
  .option('-f, --force', 'Create files even if project type is unknown')
  .option('--skip-install', 'Skip the SDK install step')
  .action(init);

// preview - Start preview server
program
  .command('preview')
  .description('Preview a document in the browser with hot reload')
  .option('-t, --template <name>', 'Template name or path', 'invoice')
  .option('-d, --data <file>', 'Data file (JSON)')
  .option('-p, --port <port>', 'Server port', '3847')
  .option('--api-key <key>', 'Glyph API key (or set GLYPH_API_KEY)')
  .option('--api-url <url>', 'API URL override')
  .option('--no-open', 'Do not open browser automatically')
  .action((options) => {
    preview({
      ...options,
      port: parseInt(options.port, 10),
    });
  });

// generate - Generate PDF
program
  .command('generate')
  .description('Generate a PDF from template and data')
  .option('-t, --template <name>', 'Template name or path', 'invoice')
  .option('-d, --data <file>', 'Data file (JSON)')
  .option('-o, --output <file>', 'Output PDF file path')
  .option('--api-key <key>', 'Glyph API key (or set GLYPH_API_KEY)')
  .option('--api-url <url>', 'API URL override')
  .action(generate);

// interactive - Interactive editing session
program
  .command('interactive')
  .description('Start an interactive editing session with natural language')
  .option('-t, --template <name>', 'Template name or path', 'invoice')
  .option('-d, --data <file>', 'Data file (JSON)')
  .option('-p, --port <port>', 'Server port', '3847')
  .option('--api-key <key>', 'Glyph API key (or set GLYPH_API_KEY)')
  .option('--api-url <url>', 'API URL override')
  .action((options) => {
    interactive({
      ...options,
      port: parseInt(options.port, 10),
    });
  });

// templates - List available templates
program
  .command('templates')
  .description('List available templates')
  .option('--api-key <key>', 'Glyph API key (or set GLYPH_API_KEY)')
  .option('--api-url <url>', 'API URL override')
  .action(templates);

// template:generate - Generate template from data
program
  .command('template:generate')
  .description('Generate a template from your data structure')
  .option('-d, --data <file>', 'Sample data file (JSON)')
  .option('-o, --output <name>', 'Output file name (without extension)')
  .option('--description <text>', 'Description of the document for AI')
  .option('--api-key <key>', 'Glyph API key (or set GLYPH_API_KEY)')
  .option('--api-url <url>', 'API URL override')
  .action(templateGenerate);

// Show banner on help
program.addHelpText('beforeAll', `
${chalk.bold.blue('Glyph PDF CLI')} ${chalk.dim(`v${VERSION}`)}
${chalk.dim('AI-powered PDF generation from the command line')}
`);

// Add examples
program.addHelpText('after', `
${chalk.bold('Examples:')}

  ${chalk.dim('# Initialize Glyph in your project')}
  $ npx @glyph-pdf/cli init

  ${chalk.dim('# Preview a document')}
  $ glyph preview --data invoice.json

  ${chalk.dim('# Generate a PDF')}
  $ glyph generate --template invoice --data data.json --output invoice.pdf

  ${chalk.dim('# Interactive editing session')}
  $ glyph interactive --data invoice.json

  ${chalk.dim('# Generate template from data structure')}
  $ glyph template:generate --data sample.json

${chalk.bold('Documentation:')}

  https://docs.glyph.so/cli
`);

program.parse();
