/**
 * Init Command
 * Initialize Glyph in a project
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import chalk from 'chalk';
import ora from 'ora';
import { detectProject, getProjectTypeLabel, type ProjectType } from '../utils/detect-project.js';
import { nextjsApiRoute, nextjsClientExample } from '../templates/nextjs.js';
import { expressRouteHandler, expressUsageExample } from '../templates/express.js';
import { reactComponent, reactHook } from '../templates/react.js';
import { nodeScript, nodeModule } from '../templates/node.js';

interface InitOptions {
  force?: boolean;
  skipInstall?: boolean;
}

interface TemplateFile {
  filename: string;
  content: string;
}

/**
 * Get the templates for a project type
 */
function getTemplatesForProject(
  type: ProjectType,
  hasTypescript: boolean
): TemplateFile[] {
  switch (type) {
    case 'nextjs':
      return [
        nextjsApiRoute(hasTypescript),
        nextjsClientExample(hasTypescript),
      ];
    case 'express':
      return [
        expressRouteHandler(hasTypescript),
        expressUsageExample(hasTypescript),
      ];
    case 'react':
      return [
        reactComponent(hasTypescript),
        reactHook(hasTypescript),
      ];
    case 'vue':
    case 'svelte':
    case 'node':
    default:
      return [
        nodeScript(hasTypescript),
        nodeModule(hasTypescript),
      ];
  }
}

/**
 * Update or create .env.example with GLYPH_API_KEY
 */
function updateEnvExample(cwd: string): void {
  const envExamplePath = join(cwd, '.env.example');
  const envLocalPath = join(cwd, '.env.local.example');

  // Try .env.local.example first (Next.js convention)
  const targetPath = existsSync(envLocalPath) ? envLocalPath : envExamplePath;

  let content = '';
  if (existsSync(targetPath)) {
    content = readFileSync(targetPath, 'utf-8');
    if (content.includes('GLYPH_API_KEY')) {
      return; // Already has it
    }
    content += '\n';
  }

  content += `# Glyph PDF Generation
GLYPH_API_KEY=gk_your_api_key_here
`;

  writeFileSync(targetPath, content);
}

/**
 * Write template files to the project
 */
function writeTemplates(
  cwd: string,
  templates: TemplateFile[],
  srcDir: string | null
): string[] {
  const writtenFiles: string[] = [];

  for (const template of templates) {
    // Determine the target directory
    let targetDir = cwd;
    if (srcDir) {
      targetDir = join(cwd, srcDir);
    }

    const targetPath = join(targetDir, template.filename);
    const targetDirPath = dirname(targetPath);

    // Create directory if it doesn't exist
    if (!existsSync(targetDirPath)) {
      mkdirSync(targetDirPath, { recursive: true });
    }

    // Don't overwrite existing files
    if (existsSync(targetPath)) {
      continue;
    }

    writeFileSync(targetPath, template.content);
    writtenFiles.push(template.filename);
  }

  return writtenFiles;
}

/**
 * Get the install command for the package manager
 */
function getInstallCommand(packageManager: string): string {
  switch (packageManager) {
    case 'yarn':
      return 'yarn add @glyph-pdf/core';
    case 'pnpm':
      return 'pnpm add @glyph-pdf/core';
    case 'bun':
      return 'bun add @glyph-pdf/core';
    default:
      return 'npm install @glyph-pdf/core';
  }
}

export async function init(options: InitOptions = {}): Promise<void> {
  const cwd = process.cwd();

  console.log();
  console.log(chalk.bold('  Glyph PDF CLI'));
  console.log(chalk.dim('  AI-powered PDF generation'));
  console.log();

  // Detect project
  const spinner = ora('Detecting project type...').start();
  const project = detectProject(cwd);

  if (project.type === 'unknown' && !options.force) {
    spinner.fail('Could not detect project type');
    console.log();
    console.log(chalk.yellow('  No package.json found in current directory.'));
    console.log(chalk.dim('  Run this command in a Node.js project root.'));
    console.log();
    console.log(chalk.dim('  Or use --force to create files anyway.'));
    console.log();
    return;
  }

  spinner.succeed(`Detected ${chalk.cyan(getProjectTypeLabel(project.type))} project`);

  if (project.hasTypescript) {
    console.log(chalk.dim(`  TypeScript: ${chalk.green('Yes')}`));
  }
  console.log(chalk.dim(`  Package manager: ${project.packageManager}`));
  console.log();

  // Get templates for this project type
  const templates = getTemplatesForProject(project.type, project.hasTypescript);

  // Write template files
  const writeSpinner = ora('Creating integration files...').start();
  const writtenFiles = writeTemplates(cwd, templates, project.srcDir);

  if (writtenFiles.length === 0) {
    writeSpinner.info('Integration files already exist');
  } else {
    writeSpinner.succeed(`Created ${writtenFiles.length} file(s)`);
    for (const file of writtenFiles) {
      console.log(chalk.dim(`  + ${file}`));
    }
  }

  // Update .env.example
  const envSpinner = ora('Updating .env.example...').start();
  try {
    updateEnvExample(cwd);
    envSpinner.succeed('Added GLYPH_API_KEY to .env.example');
  } catch {
    envSpinner.warn('Could not update .env.example');
  }

  console.log();

  // Print next steps
  console.log(chalk.bold('  Next steps:'));
  console.log();

  if (!options.skipInstall) {
    console.log(chalk.dim('  1. Install the SDK:'));
    console.log(`     ${chalk.cyan(getInstallCommand(project.packageManager))}`);
    console.log();
  }

  console.log(chalk.dim(`  ${options.skipInstall ? '1' : '2'}. Get your API key:`));
  console.log(`     ${chalk.cyan('https://glyph.so/dashboard')}`);
  console.log();

  console.log(chalk.dim(`  ${options.skipInstall ? '2' : '3'}. Add your key to .env:`));
  console.log(`     ${chalk.cyan('GLYPH_API_KEY=gk_your_key_here')}`);
  console.log();

  console.log(chalk.dim(`  ${options.skipInstall ? '3' : '4'}. Start generating PDFs!`));
  console.log(`     ${chalk.cyan('glyph preview --data sample.json')}`);
  console.log();
}
