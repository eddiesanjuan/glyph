/**
 * Sources Commands
 * Manage data sources for template-data workflows
 */

import chalk from 'chalk';
import ora from 'ora';

const DEFAULT_API_URL = 'https://api.glyph.you';

interface SourcesListOptions {
  type?: string;
  apiKey?: string;
  apiUrl?: string;
}

interface SourcesRecordsOptions {
  limit?: string;
  apiKey?: string;
  apiUrl?: string;
}

interface DataSource {
  id: string;
  name: string;
  source_type: string;
  status: string;
  last_sync_record_count?: number;
  created_at: string;
}

interface SourceRecord {
  id: string;
  fields?: Record<string, unknown>;
  [key: string]: unknown;
}

async function apiRequest<T>(
  endpoint: string,
  apiKey: string,
  apiUrl: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${apiUrl}${endpoint}`;
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

/**
 * List all data sources
 */
export async function sourcesList(options: SourcesListOptions = {}): Promise<void> {
  const apiKey = options.apiKey || process.env.GLYPH_API_KEY;
  const apiUrl = (options.apiUrl || DEFAULT_API_URL).replace(/\/$/, '');

  console.log();
  console.log(chalk.bold('  Data Sources'));
  console.log();

  if (!apiKey) {
    console.log(chalk.red('  Error: No API key provided'));
    console.log();
    console.log(chalk.dim('  Set GLYPH_API_KEY environment variable or use --api-key flag'));
    console.log();
    return;
  }

  const spinner = ora('Fetching sources...').start();

  try {
    const params = new URLSearchParams();
    if (options.type) params.set('type', options.type);
    const queryString = params.toString();
    const endpoint = `/v1/sources${queryString ? '?' + queryString : ''}`;

    const data = await apiRequest<{ success: boolean; sources: DataSource[]; error?: string }>(
      endpoint,
      apiKey,
      apiUrl
    );

    if (data.success) {
      spinner.succeed(`Found ${data.sources.length} source(s)`);
      console.log();

      if (data.sources.length === 0) {
        console.log(chalk.dim('  No data sources configured.'));
        console.log();
        console.log(chalk.dim('  Create a source with:'));
        console.log(chalk.dim('    glyph sources create --type airtable --name "My Table"'));
        console.log();
        return;
      }

      // Display as formatted table
      console.log(
        chalk.dim('  ') +
        chalk.bold.white('ID'.padEnd(38)) +
        chalk.bold.white('Name'.padEnd(25)) +
        chalk.bold.white('Type'.padEnd(12)) +
        chalk.bold.white('Status'.padEnd(10)) +
        chalk.bold.white('Records')
      );
      console.log(chalk.dim('  ' + '-'.repeat(100)));

      for (const source of data.sources) {
        const statusColor = source.status === 'active' ? chalk.green :
                           source.status === 'error' ? chalk.red : chalk.yellow;
        console.log(
          chalk.dim('  ') +
          chalk.cyan(source.id.padEnd(38)) +
          chalk.white(source.name.substring(0, 23).padEnd(25)) +
          chalk.magenta(source.source_type.padEnd(12)) +
          statusColor(source.status.padEnd(10)) +
          chalk.white(String(source.last_sync_record_count || 0))
        );
      }
      console.log();
    } else {
      spinner.fail(data.error || 'Failed to fetch sources');
    }
  } catch (error) {
    spinner.fail(error instanceof Error ? error.message : 'Failed to fetch sources');
  }
}

/**
 * List records from a specific source
 */
export async function sourcesRecords(
  sourceId: string,
  options: SourcesRecordsOptions = {}
): Promise<void> {
  const apiKey = options.apiKey || process.env.GLYPH_API_KEY;
  const apiUrl = (options.apiUrl || DEFAULT_API_URL).replace(/\/$/, '');
  const limit = options.limit || '10';

  console.log();
  console.log(chalk.bold(`  Records from source ${chalk.cyan(sourceId)}`));
  console.log();

  if (!apiKey) {
    console.log(chalk.red('  Error: No API key provided'));
    console.log();
    console.log(chalk.dim('  Set GLYPH_API_KEY environment variable or use --api-key flag'));
    console.log();
    return;
  }

  const spinner = ora('Fetching records...').start();

  try {
    const endpoint = `/v1/sources/${sourceId}/records?limit=${limit}`;

    const data = await apiRequest<{ success: boolean; records: SourceRecord[]; error?: string }>(
      endpoint,
      apiKey,
      apiUrl
    );

    if (data.success) {
      spinner.succeed(`Found ${data.records.length} record(s)`);
      console.log();

      if (data.records.length === 0) {
        console.log(chalk.dim('  No records found in this source.'));
        console.log();
        return;
      }

      // Display records
      data.records.forEach((record, index) => {
        console.log(chalk.bold(`  [${index + 1}] `) + chalk.cyan(`ID: ${record.id}`));

        const fields = record.fields || record;
        Object.entries(fields).forEach(([key, value]) => {
          if (key !== 'id') {
            const displayValue = typeof value === 'object'
              ? JSON.stringify(value).substring(0, 50) + (JSON.stringify(value).length > 50 ? '...' : '')
              : String(value).substring(0, 60) + (String(value).length > 60 ? '...' : '');
            console.log(chalk.dim('      ') + chalk.white(key + ': ') + chalk.gray(displayValue));
          }
        });
        console.log();
      });
    } else {
      spinner.fail(data.error || 'Failed to fetch records');
    }
  } catch (error) {
    spinner.fail(error instanceof Error ? error.message : 'Failed to fetch records');
  }
}

/**
 * Show mappings for a source
 */
export async function sourcesMappings(
  sourceId: string,
  options: { apiKey?: string; apiUrl?: string } = {}
): Promise<void> {
  const apiKey = options.apiKey || process.env.GLYPH_API_KEY;
  const apiUrl = (options.apiUrl || DEFAULT_API_URL).replace(/\/$/, '');

  console.log();
  console.log(chalk.bold(`  Mappings for source ${chalk.cyan(sourceId)}`));
  console.log();

  if (!apiKey) {
    console.log(chalk.red('  Error: No API key provided'));
    console.log();
    console.log(chalk.dim('  Set GLYPH_API_KEY environment variable or use --api-key flag'));
    console.log();
    return;
  }

  const spinner = ora('Fetching mappings...').start();

  try {
    const endpoint = `/v1/mappings?source_id=${sourceId}`;

    interface MappingData {
      id: string;
      template_id: string;
      template_name?: string;
      field_mappings: Record<string, string>;
      is_default: boolean;
    }

    const data = await apiRequest<{ success: boolean; mappings: MappingData[]; error?: string }>(
      endpoint,
      apiKey,
      apiUrl
    );

    if (data.success) {
      spinner.succeed(`Found ${data.mappings.length} mapping(s)`);
      console.log();

      if (data.mappings.length === 0) {
        console.log(chalk.dim('  No mappings found for this source.'));
        console.log();
        console.log(chalk.dim('  Create a mapping by linking a template to this source.'));
        console.log();
        return;
      }

      for (const mapping of data.mappings) {
        console.log(chalk.bold('  Mapping: ') + chalk.cyan(mapping.id));
        console.log(chalk.dim('    Template: ') + chalk.white(mapping.template_name || mapping.template_id));
        console.log(chalk.dim('    Default: ') + (mapping.is_default ? chalk.green('Yes') : chalk.gray('No')));
        console.log(chalk.dim('    Field Mappings:'));

        Object.entries(mapping.field_mappings).forEach(([templateField, sourceField]) => {
          console.log(chalk.dim('      ') + chalk.yellow(templateField) + chalk.dim(' <- ') + chalk.magenta(sourceField));
        });
        console.log();
      }
    } else {
      spinner.fail(data.error || 'Failed to fetch mappings');
    }
  } catch (error) {
    spinner.fail(error instanceof Error ? error.message : 'Failed to fetch mappings');
  }
}
