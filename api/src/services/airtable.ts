/**
 * Airtable Service
 * Handles connection, schema discovery, and data fetching from Airtable
 */

// Airtable API Base URL
const AIRTABLE_API_BASE = "https://api.airtable.com/v0";

// =============================================================================
// Types
// =============================================================================

export interface AirtableBase {
  id: string;
  name: string;
  permissionLevel: string;
}

export interface AirtableField {
  id: string;
  name: string;
  type: string;
  description?: string;
  options?: {
    choices?: Array<{ id: string; name: string; color?: string }>;
    linkedTableId?: string;
    isReversed?: boolean;
    prefersSingleRecordLink?: boolean;
    result?: { type: string };
  };
}

export interface AirtableView {
  id: string;
  name: string;
  type: string;
}

export interface AirtableTable {
  id: string;
  name: string;
  description?: string;
  primaryFieldId: string;
  fields: AirtableField[];
  views: AirtableView[];
}

export interface AirtableRecord {
  id: string;
  createdTime: string;
  fields: Record<string, unknown>;
}

export interface AirtableSchema {
  baseId: string;
  baseName: string;
  tables: AirtableTable[];
}

// Field type mapping for template generation
export const AIRTABLE_FIELD_TYPES: Record<string, string> = {
  singleLineText: "text",
  multilineText: "text",
  richText: "html",
  email: "email",
  url: "url",
  phoneNumber: "phone",
  number: "number",
  currency: "currency",
  percent: "percent",
  count: "number",
  autoNumber: "number",
  date: "date",
  dateTime: "datetime",
  duration: "duration",
  singleSelect: "select",
  multipleSelects: "multiselect",
  checkbox: "boolean",
  rating: "number",
  barcode: "text",
  formula: "computed",
  rollup: "computed",
  lookup: "lookup",
  multipleRecordLinks: "links",
  attachment: "attachment",
  collaborator: "user",
  multipleCollaborators: "users",
  createdTime: "datetime",
  createdBy: "user",
  lastModifiedTime: "datetime",
  lastModifiedBy: "user",
  button: "button",
  aiText: "text",
};

// =============================================================================
// Service Class
// =============================================================================

export class AirtableService {
  private apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("Airtable API key is required");
    }
    this.apiKey = apiKey;
  }

  /**
   * Make authenticated request to Airtable API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = endpoint.startsWith("http")
      ? endpoint
      : `${AIRTABLE_API_BASE}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      let errorMessage = `Airtable API error: ${response.status}`;

      try {
        const errorJson = JSON.parse(errorBody);
        errorMessage = errorJson.error?.message || errorMessage;
      } catch {
        // Use default error message
      }

      throw new Error(errorMessage);
    }

    return response.json();
  }

  /**
   * Validate the API key by making a test request
   */
  async validateApiKey(): Promise<boolean> {
    try {
      await this.listBases();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List all accessible bases
   */
  async listBases(): Promise<AirtableBase[]> {
    const response = await this.request<{ bases: AirtableBase[] }>(
      "https://api.airtable.com/v0/meta/bases"
    );
    return response.bases;
  }

  /**
   * Get tables and schema for a specific base
   */
  async getBaseSchema(baseId: string): Promise<AirtableTable[]> {
    const response = await this.request<{ tables: AirtableTable[] }>(
      `https://api.airtable.com/v0/meta/bases/${baseId}/tables`
    );
    return response.tables;
  }

  /**
   * Get full schema with base name
   */
  async getFullSchema(baseId: string): Promise<AirtableSchema> {
    const [bases, tables] = await Promise.all([
      this.listBases(),
      this.getBaseSchema(baseId),
    ]);

    const base = bases.find((b) => b.id === baseId);

    return {
      baseId,
      baseName: base?.name || "Unknown Base",
      tables,
    };
  }

  /**
   * Get a specific table's schema
   */
  async getTableSchema(
    baseId: string,
    tableIdOrName: string
  ): Promise<AirtableTable | null> {
    const tables = await this.getBaseSchema(baseId);
    return (
      tables.find(
        (t) => t.id === tableIdOrName || t.name === tableIdOrName
      ) || null
    );
  }

  /**
   * List records from a table
   */
  async listRecords(
    baseId: string,
    tableIdOrName: string,
    options: {
      maxRecords?: number;
      view?: string;
      filterByFormula?: string;
      sort?: Array<{ field: string; direction?: "asc" | "desc" }>;
      fields?: string[];
    } = {}
  ): Promise<AirtableRecord[]> {
    const params = new URLSearchParams();

    if (options.maxRecords) {
      params.append("maxRecords", options.maxRecords.toString());
    }
    if (options.view) {
      params.append("view", options.view);
    }
    if (options.filterByFormula) {
      params.append("filterByFormula", options.filterByFormula);
    }
    if (options.sort) {
      options.sort.forEach((s, i) => {
        params.append(`sort[${i}][field]`, s.field);
        if (s.direction) {
          params.append(`sort[${i}][direction]`, s.direction);
        }
      });
    }
    if (options.fields) {
      options.fields.forEach((f) => params.append("fields[]", f));
    }

    const queryString = params.toString();
    const endpoint = `/${baseId}/${encodeURIComponent(tableIdOrName)}${queryString ? `?${queryString}` : ""}`;

    const response = await this.request<{ records: AirtableRecord[] }>(
      endpoint
    );
    return response.records;
  }

  /**
   * Get a single record by ID
   */
  async getRecord(
    baseId: string,
    tableIdOrName: string,
    recordId: string
  ): Promise<AirtableRecord> {
    return this.request<AirtableRecord>(
      `/${baseId}/${encodeURIComponent(tableIdOrName)}/${recordId}`
    );
  }

  /**
   * Get sample records for preview (up to 5)
   */
  async getSampleRecords(
    baseId: string,
    tableIdOrName: string
  ): Promise<AirtableRecord[]> {
    return this.listRecords(baseId, tableIdOrName, { maxRecords: 5 });
  }

  /**
   * Convert Airtable schema to a format useful for template generation
   * This creates a simplified field map that the AI can use
   */
  formatSchemaForAI(table: AirtableTable): {
    tableName: string;
    tableDescription: string;
    fields: Array<{
      name: string;
      type: string;
      glyphType: string;
      description: string;
      mustachePath: string;
      isArray: boolean;
      hasConditional: boolean;
    }>;
  } {
    return {
      tableName: table.name,
      tableDescription: table.description || `Data from ${table.name} table`,
      fields: table.fields.map((field) => {
        const glyphType = AIRTABLE_FIELD_TYPES[field.type] || "text";
        const isArray = ["multipleSelects", "multipleRecordLinks", "attachment", "multipleCollaborators"].includes(field.type);
        const isAttachment = field.type === "attachment";

        return {
          name: field.name,
          type: field.type,
          glyphType,
          description: field.description || `${field.name} field`,
          // For attachments, provide path to first item's URL
          mustachePath: isAttachment
            ? `fields.${field.name}.0.url`
            : `fields.${field.name}`,
          isArray,
          hasConditional: true, // All Airtable fields can be empty
        };
      }),
    };
  }

  /**
   * Convert Airtable record to template-ready data
   */
  formatRecordForTemplate(
    record: AirtableRecord,
    table: AirtableTable
  ): Record<string, unknown> {
    const formatted: Record<string, unknown> = {
      _id: record.id,
      _createdTime: record.createdTime,
      fields: {} as Record<string, unknown>,
    };

    // Process each field according to its type
    for (const field of table.fields) {
      const value = record.fields[field.name];

      if (value === undefined || value === null) {
        (formatted.fields as Record<string, unknown>)[field.name] = null;
        continue;
      }

      switch (field.type) {
        case "currency":
        case "number":
        case "percent":
          // Format numbers nicely
          (formatted.fields as Record<string, unknown>)[field.name] =
            typeof value === "number"
              ? value.toLocaleString("en-US", {
                  minimumFractionDigits: field.type === "currency" ? 2 : 0,
                  maximumFractionDigits: 2,
                })
              : value;
          break;

        case "date":
          // Format dates
          (formatted.fields as Record<string, unknown>)[field.name] =
            typeof value === "string"
              ? new Date(value).toLocaleDateString("en-US")
              : value;
          break;

        case "dateTime":
          // Format datetime
          (formatted.fields as Record<string, unknown>)[field.name] =
            typeof value === "string"
              ? new Date(value).toLocaleString("en-US")
              : value;
          break;

        case "checkbox":
          // Convert to boolean
          (formatted.fields as Record<string, unknown>)[field.name] = !!value;
          break;

        case "attachment":
          // Keep attachment array structure for images
          (formatted.fields as Record<string, unknown>)[field.name] = value;
          break;

        case "multipleRecordLinks":
          // Keep linked record IDs
          (formatted.fields as Record<string, unknown>)[field.name] = value;
          break;

        case "multipleSelects":
          // Keep as array
          (formatted.fields as Record<string, unknown>)[field.name] = value;
          break;

        case "richText":
          // Keep rich text as is (it's markdown)
          (formatted.fields as Record<string, unknown>)[field.name] = value;
          break;

        default:
          // Pass through as-is
          (formatted.fields as Record<string, unknown>)[field.name] = value;
      }
    }

    return formatted;
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create an Airtable service instance from an API key
 */
export function createAirtableService(apiKey: string): AirtableService {
  return new AirtableService(apiKey);
}

/**
 * Validate Airtable API key format
 * Airtable keys start with "pat" (personal access token) or "key" (legacy)
 */
export function isValidAirtableKeyFormat(key: string): boolean {
  return key.startsWith("pat") || key.startsWith("key");
}
