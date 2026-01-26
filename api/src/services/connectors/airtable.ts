/**
 * Airtable Connector
 * Implements SourceConnector for Airtable data sources
 */

import {
  BaseConnector,
  type ConnectionTestResult,
  type FetchOptions,
  type SourceRecord,
} from "../sourceConnector.js";
import type {
  DataSource,
  AirtableConfig,
  DiscoveredSchema,
  DiscoveredField,
  FieldType,
} from "../../types/data-sources.js";

// =============================================================================
// Constants
// =============================================================================

const AIRTABLE_API_BASE = "https://api.airtable.com/v0";
const AIRTABLE_META_BASE = "https://api.airtable.com/v0/meta/bases";

/** Rate limit: 5 requests per second */
const RATE_LIMIT_DELAY_MS = 200;

/** Airtable field type to our FieldType mapping */
const FIELD_TYPE_MAP: Record<string, FieldType> = {
  singleLineText: "string",
  multilineText: "string",
  richText: "string",
  email: "string",
  url: "string",
  phoneNumber: "string",
  number: "number",
  currency: "number",
  percent: "number",
  count: "number",
  autoNumber: "number",
  rating: "number",
  date: "date",
  dateTime: "date",
  duration: "number",
  singleSelect: "string",
  multipleSelects: "array",
  checkbox: "boolean",
  barcode: "string",
  formula: "string",
  rollup: "string",
  lookup: "array",
  multipleRecordLinks: "array",
  attachment: "array",
  collaborator: "object",
  multipleCollaborators: "array",
  createdTime: "date",
  createdBy: "object",
  lastModifiedTime: "date",
  lastModifiedBy: "object",
  button: "string",
  aiText: "string",
};

// =============================================================================
// Types
// =============================================================================

interface AirtableApiError {
  error?: {
    type: string;
    message: string;
  };
}

interface AirtableField {
  id: string;
  name: string;
  type: string;
  description?: string;
  options?: Record<string, unknown>;
}

interface AirtableTable {
  id: string;
  name: string;
  description?: string;
  primaryFieldId: string;
  fields: AirtableField[];
  views: Array<{ id: string; name: string; type: string }>;
}

interface AirtableRecord {
  id: string;
  createdTime: string;
  fields: Record<string, unknown>;
}

interface AirtableListResponse {
  records: AirtableRecord[];
  offset?: string;
}

// =============================================================================
// Airtable Connector
// =============================================================================

export class AirtableConnector extends BaseConnector {
  private lastRequestTime = 0;

  constructor(source: DataSource) {
    super(source);

    // Validate config type
    if (!this.isAirtableConfig(source.config)) {
      throw new Error("Invalid Airtable configuration");
    }
  }

  /**
   * Type guard for AirtableConfig
   */
  private isAirtableConfig(config: unknown): config is AirtableConfig {
    const c = config as AirtableConfig;
    return (
      typeof c === "object" &&
      c !== null &&
      typeof c.personal_access_token === "string" &&
      typeof c.base_id === "string" &&
      typeof c.table_id === "string"
    );
  }

  /**
   * Get typed config
   */
  private get airtableConfig(): AirtableConfig {
    return this.config as AirtableConfig;
  }

  /**
   * Enforce rate limiting (5 req/sec = 200ms between requests)
   */
  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < RATE_LIMIT_DELAY_MS) {
      await new Promise((resolve) =>
        setTimeout(resolve, RATE_LIMIT_DELAY_MS - timeSinceLastRequest)
      );
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Make authenticated request to Airtable API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    await this.rateLimit();

    const url = endpoint.startsWith("http")
      ? endpoint
      : `${AIRTABLE_API_BASE}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.airtableConfig.personal_access_token}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => ({}))) as AirtableApiError;
      const errorMessage =
        errorBody.error?.message ||
        `Airtable API error: ${response.status} ${response.statusText}`;
      throw new Error(errorMessage);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Test connection to Airtable
   */
  async testConnection(): Promise<ConnectionTestResult> {
    try {
      // Try to fetch the table schema to verify credentials and access
      const { base_id, table_id } = this.airtableConfig;

      const response = await this.request<{ tables: AirtableTable[] }>(
        `${AIRTABLE_META_BASE}/${base_id}/tables`
      );

      // Check if the specified table exists
      const table = response.tables.find(
        (t) => t.id === table_id || t.name === table_id
      );

      if (!table) {
        return {
          success: false,
          error: `Table '${table_id}' not found in base '${base_id}'`,
        };
      }

      return {
        success: true,
        details: {
          baseId: base_id,
          tableId: table.id,
          tableName: table.name,
          fieldCount: table.fields.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to connect to Airtable",
      };
    }
  }

  /**
   * Discover schema from Airtable table
   */
  async discoverSchema(): Promise<DiscoveredSchema> {
    const { base_id, table_id } = this.airtableConfig;

    // Get table schema
    const schemaResponse = await this.request<{ tables: AirtableTable[] }>(
      `${AIRTABLE_META_BASE}/${base_id}/tables`
    );

    const table = schemaResponse.tables.find(
      (t) => t.id === table_id || t.name === table_id
    );

    if (!table) {
      throw new Error(`Table '${table_id}' not found in base '${base_id}'`);
    }

    // Get sample records to extract sample values
    const records = await this.fetchRecords({ limit: 3 });

    // Build discovered fields from Airtable schema
    const fields: DiscoveredField[] = table.fields.map((field) => {
      const fieldType = FIELD_TYPE_MAP[field.type] || "string";

      // Get sample value from first record if available
      let sampleValue: unknown = undefined;
      if (records.length > 0) {
        sampleValue = records[0].fields[field.name];
      }

      return {
        name: field.name,
        path: `fields.${field.name}`,
        type: fieldType,
        required: false, // Airtable fields are generally optional
        sample_value: sampleValue,
      };
    });

    // Add metadata fields
    fields.unshift(
      {
        name: "Record ID",
        path: "id",
        type: "string",
        required: true,
        sample_value: records[0]?.id,
      },
      {
        name: "Created Time",
        path: "createdTime",
        type: "date",
        required: true,
        sample_value: records[0]?.createdTime,
      }
    );

    // Convert sample records to our format
    const sampleRecords = records.slice(0, 3).map((record) => ({
      id: record.id,
      createdTime: record.createdTime,
      fields: record.fields,
    }));

    return {
      fields,
      discovered_at: new Date().toISOString(),
      record_count: records.length,
      sample_records: sampleRecords,
    };
  }

  /**
   * Fetch records from Airtable
   */
  async fetchRecords(options: FetchOptions = {}): Promise<SourceRecord[]> {
    const { base_id, table_id, view_id, filter_formula } = this.airtableConfig;
    const { limit = 100, offset, filter } = options;

    // Build query parameters
    const params = new URLSearchParams();

    if (limit) {
      params.append("maxRecords", String(limit));
    }

    if (view_id) {
      params.append("view", view_id);
    }

    // Combine config filter formula with runtime filter
    const combinedFilter = filter || filter_formula;
    if (combinedFilter) {
      params.append("filterByFormula", combinedFilter);
    }

    // Airtable uses offset token, not numeric offset
    // If we have an offset string from previous request, use it
    if (typeof offset === "string") {
      params.append("offset", offset);
    }

    const queryString = params.toString();
    const endpoint = `/${base_id}/${encodeURIComponent(table_id)}${queryString ? `?${queryString}` : ""}`;

    const response = await this.request<AirtableListResponse>(endpoint);

    // Convert to SourceRecord format
    return response.records.map((record) => ({
      id: record.id,
      fields: record.fields,
      createdTime: record.createdTime,
    }));
  }

  /**
   * Fetch a single record by ID
   */
  async fetchRecord(recordId: string): Promise<SourceRecord> {
    const { base_id, table_id } = this.airtableConfig;

    const record = await this.request<AirtableRecord>(
      `/${base_id}/${encodeURIComponent(table_id)}/${recordId}`
    );

    return {
      id: record.id,
      fields: record.fields,
      createdTime: record.createdTime,
    };
  }
}
