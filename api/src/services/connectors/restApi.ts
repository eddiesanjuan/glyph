/**
 * REST API Connector
 * Implements SourceConnector for REST API data sources
 */

import {
  BaseConnector,
  type ConnectionTestResult,
  type FetchOptions,
  type SourceRecord,
} from "../sourceConnector.js";
import type {
  DataSource,
  RestApiConfig,
  DiscoveredSchema,
  DiscoveredField,
} from "../../types/data-sources.js";

// =============================================================================
// Types
// =============================================================================

interface JsonPathSegment {
  key: string;
  isArray: boolean;
  index?: number;
}

// =============================================================================
// REST API Connector
// =============================================================================

export class RestApiConnector extends BaseConnector {
  constructor(source: DataSource) {
    super(source);

    // Validate config type
    if (!this.isRestApiConfig(source.config)) {
      throw new Error("Invalid REST API configuration");
    }
  }

  /**
   * Type guard for RestApiConfig
   */
  private isRestApiConfig(config: unknown): config is RestApiConfig {
    const c = config as RestApiConfig;
    return (
      typeof c === "object" &&
      c !== null &&
      typeof c.endpoint === "string" &&
      typeof c.method === "string" &&
      typeof c.auth_type === "string"
    );
  }

  /**
   * Get typed config
   */
  private get restConfig(): RestApiConfig {
    return this.config as RestApiConfig;
  }

  /**
   * Build authentication headers based on auth type
   */
  private buildAuthHeaders(): Record<string, string> {
    const { auth_type, auth_config } = this.restConfig;
    const headers: Record<string, string> = {};

    if (!auth_config) {
      return headers;
    }

    switch (auth_type) {
      case "bearer":
        if (auth_config.token) {
          headers["Authorization"] = `Bearer ${auth_config.token}`;
        }
        break;

      case "basic":
        if (auth_config.username && auth_config.password) {
          const credentials = Buffer.from(
            `${auth_config.username}:${auth_config.password}`
          ).toString("base64");
          headers["Authorization"] = `Basic ${credentials}`;
        }
        break;

      case "api_key":
        if (auth_config.api_key) {
          const headerName = auth_config.api_key_header || "X-API-Key";
          headers[headerName] = auth_config.api_key;
        }
        break;

      case "none":
      default:
        // No authentication
        break;
    }

    return headers;
  }

  /**
   * Build request URL with query parameters
   */
  private buildUrl(additionalParams?: Record<string, string>): string {
    const { endpoint, query_params } = this.restConfig;
    const url = new URL(endpoint);

    // Add configured query params
    if (query_params) {
      for (const [key, value] of Object.entries(query_params)) {
        url.searchParams.append(key, value);
      }
    }

    // Add additional params (for pagination, filtering)
    if (additionalParams) {
      for (const [key, value] of Object.entries(additionalParams)) {
        url.searchParams.append(key, value);
      }
    }

    return url.toString();
  }

  /**
   * Make authenticated request to the API
   */
  private async request<T>(
    additionalParams?: Record<string, string>
  ): Promise<T> {
    const { method, headers: configHeaders } = this.restConfig;

    const url = this.buildUrl(additionalParams);
    const authHeaders = this.buildAuthHeaders();

    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...configHeaders,
        ...authHeaders,
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(
        `REST API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    return response.json() as Promise<T>;
  }

  /**
   * Extract data from response using JSONPath-like path
   * Supports simple dot notation: "data.records", "response.items[0]"
   */
  private extractData(
    response: unknown,
    path?: string
  ): Record<string, unknown>[] {
    if (!path) {
      // No path specified, assume response is the data
      if (Array.isArray(response)) {
        return response as Record<string, unknown>[];
      }
      return [response as Record<string, unknown>];
    }

    // Parse the path
    const segments = this.parsePath(path);
    let current: unknown = response;

    for (const segment of segments) {
      if (current === null || current === undefined) {
        return [];
      }

      if (segment.isArray && segment.index !== undefined) {
        // Array index access
        current = (current as Record<string, unknown>)[segment.key];
        if (Array.isArray(current)) {
          current = current[segment.index];
        }
      } else {
        // Object property access
        current = (current as Record<string, unknown>)[segment.key];
      }
    }

    if (Array.isArray(current)) {
      return current as Record<string, unknown>[];
    }

    if (current && typeof current === "object") {
      return [current as Record<string, unknown>];
    }

    return [];
  }

  /**
   * Parse a JSONPath-like path into segments
   * e.g., "data.records" -> [{key: "data"}, {key: "records"}]
   * e.g., "data[0].items" -> [{key: "data", isArray: true, index: 0}, {key: "items"}]
   */
  private parsePath(path: string): JsonPathSegment[] {
    const segments: JsonPathSegment[] = [];
    const parts = path.split(".");

    for (const part of parts) {
      const match = part.match(/^(\w+)(?:\[(\d+)\])?$/);
      if (match) {
        segments.push({
          key: match[1],
          isArray: match[2] !== undefined,
          index: match[2] !== undefined ? parseInt(match[2], 10) : undefined,
        });
      }
    }

    return segments;
  }

  /**
   * Test connection to the REST API
   */
  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const response = await this.request();

      // Try to extract data to verify the response path works
      const data = this.extractData(response, this.restConfig.response_path);

      return {
        success: true,
        details: {
          endpoint: this.restConfig.endpoint,
          method: this.restConfig.method,
          recordCount: data.length,
          responsePath: this.restConfig.response_path || "(root)",
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to connect to REST API",
      };
    }
  }

  /**
   * Discover schema from REST API response
   * Infers schema from sample data
   */
  async discoverSchema(): Promise<DiscoveredSchema> {
    const response = await this.request();
    const data = this.extractData(response, this.restConfig.response_path);

    if (data.length === 0) {
      return {
        fields: [],
        discovered_at: new Date().toISOString(),
        record_count: 0,
        sample_records: [],
      };
    }

    // Analyze first few records to infer schema
    const sampleRecords = data.slice(0, 3);
    const fieldMap = new Map<string, DiscoveredField>();

    for (const record of sampleRecords) {
      this.extractFields(record, "", fieldMap);
    }

    const fields = Array.from(fieldMap.values());

    return {
      fields,
      discovered_at: new Date().toISOString(),
      record_count: data.length,
      sample_records: sampleRecords,
    };
  }

  /**
   * Recursively extract fields from a record
   */
  private extractFields(
    obj: Record<string, unknown>,
    prefix: string,
    fieldMap: Map<string, DiscoveredField>
  ): void {
    for (const [key, value] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;
      const name = prefix ? `${prefix} ${key}` : key;

      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        // Recurse into nested objects
        this.extractFields(
          value as Record<string, unknown>,
          path,
          fieldMap
        );
      } else if (!fieldMap.has(path)) {
        // Add field if not already present
        fieldMap.set(path, {
          name: name.replace(/\./g, " > "),
          path,
          type: this.inferFieldType(value),
          required: false,
          sample_value: value,
        });
      }
    }
  }

  /**
   * Fetch records from REST API
   */
  async fetchRecords(options: FetchOptions = {}): Promise<SourceRecord[]> {
    const { limit, offset, filter } = options;

    // Build additional params for pagination/filtering
    // These param names are configurable but we use common defaults
    const additionalParams: Record<string, string> = {};

    if (limit !== undefined) {
      additionalParams["limit"] = String(limit);
    }

    if (offset !== undefined) {
      additionalParams["offset"] = String(offset);
    }

    if (filter) {
      additionalParams["filter"] = filter;
    }

    const response = await this.request(additionalParams);
    const data = this.extractData(response, this.restConfig.response_path);

    // Convert to SourceRecord format
    return data.map((record, index) => ({
      id: this.extractId(record, index),
      fields: record,
      createdTime: this.extractCreatedTime(record),
    }));
  }

  /**
   * Fetch a single record by ID
   * For REST APIs, this typically requires a different endpoint pattern
   */
  async fetchRecord(recordId: string): Promise<SourceRecord> {
    // Append record ID to endpoint
    const { endpoint, method, headers: configHeaders } = this.restConfig;

    // Build URL with record ID appended
    const url = new URL(endpoint);
    url.pathname = `${url.pathname.replace(/\/$/, "")}/${recordId}`;

    const authHeaders = this.buildAuthHeaders();

    const response = await fetch(url.toString(), {
      method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...configHeaders,
        ...authHeaders,
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(
        `REST API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const record = (await response.json()) as Record<string, unknown>;

    return {
      id: this.extractId(record, 0),
      fields: record,
      createdTime: this.extractCreatedTime(record),
    };
  }

  /**
   * Extract ID from a record
   * Tries common ID field names
   */
  private extractId(record: Record<string, unknown>, fallbackIndex: number): string {
    const idFields = ["id", "_id", "Id", "ID", "uuid", "key"];

    for (const field of idFields) {
      if (record[field] !== undefined && record[field] !== null) {
        return String(record[field]);
      }
    }

    // Fallback to index-based ID
    return `record_${fallbackIndex}`;
  }

  /**
   * Extract created time from a record
   * Tries common timestamp field names
   */
  private extractCreatedTime(record: Record<string, unknown>): string | undefined {
    const timeFields = [
      "createdTime",
      "created_at",
      "createdAt",
      "created",
      "timestamp",
      "date",
    ];

    for (const field of timeFields) {
      const value = record[field];
      if (value !== undefined && value !== null) {
        if (typeof value === "string") {
          return value;
        }
        if (typeof value === "number") {
          return new Date(value).toISOString();
        }
      }
    }

    return undefined;
  }
}
