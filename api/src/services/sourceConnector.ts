/**
 * Source Connector Abstract Interface
 * Base interface and abstract class for all data source connectors
 */

import type {
  DataSource,
  DiscoveredSchema,
  DataSourceConfig,
} from "../types/data-sources.js";

// =============================================================================
// Types
// =============================================================================

export interface FetchOptions {
  /** Maximum number of records to fetch */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Filter expression (format depends on source type) */
  filter?: string;
}

export interface SourceRecord {
  /** Unique identifier from the source */
  id: string;
  /** Field values */
  fields: Record<string, unknown>;
  /** When the record was created (if available) */
  createdTime?: string;
}

export interface ConnectionTestResult {
  /** Whether the connection was successful */
  success: boolean;
  /** Error message if connection failed */
  error?: string;
  /** Additional details about the connection */
  details?: Record<string, unknown>;
}

// =============================================================================
// Source Connector Interface
// =============================================================================

/**
 * Interface that all source connectors must implement
 */
export interface SourceConnector {
  /**
   * Test if the connection to the data source works
   * @returns Result indicating success or failure with error details
   */
  testConnection(): Promise<ConnectionTestResult>;

  /**
   * Discover the schema from the data source
   * This introspects the source to understand its structure
   * @returns Discovered schema with field definitions
   */
  discoverSchema(): Promise<DiscoveredSchema>;

  /**
   * Fetch multiple records from the source
   * @param options Pagination and filtering options
   * @returns Array of source records
   */
  fetchRecords(options?: FetchOptions): Promise<SourceRecord[]>;

  /**
   * Fetch a single record by ID
   * @param recordId The unique identifier of the record
   * @returns The source record
   */
  fetchRecord(recordId: string): Promise<SourceRecord>;
}

// =============================================================================
// Base Connector Abstract Class
// =============================================================================

/**
 * Abstract base class for source connectors
 * Provides common functionality and enforces interface implementation
 */
export abstract class BaseConnector implements SourceConnector {
  protected source: DataSource;

  constructor(source: DataSource) {
    this.source = source;
  }

  /**
   * Get the source ID
   */
  get sourceId(): string {
    return this.source.id;
  }

  /**
   * Get the source type
   */
  get sourceType(): string {
    return this.source.source_type;
  }

  /**
   * Get the source config (typed based on implementation)
   */
  get config(): DataSourceConfig {
    return this.source.config;
  }

  // Abstract methods that must be implemented by subclasses
  abstract testConnection(): Promise<ConnectionTestResult>;
  abstract discoverSchema(): Promise<DiscoveredSchema>;
  abstract fetchRecords(options?: FetchOptions): Promise<SourceRecord[]>;
  abstract fetchRecord(recordId: string): Promise<SourceRecord>;

  /**
   * Helper to infer field type from a sample value
   */
  protected inferFieldType(
    value: unknown
  ): "string" | "number" | "boolean" | "date" | "array" | "object" {
    if (value === null || value === undefined) {
      return "string"; // Default to string for null values
    }

    if (Array.isArray(value)) {
      return "array";
    }

    if (typeof value === "boolean") {
      return "boolean";
    }

    if (typeof value === "number") {
      return "number";
    }

    if (typeof value === "object") {
      return "object";
    }

    // Check if string looks like a date
    if (typeof value === "string") {
      // ISO date pattern
      if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/.test(value)) {
        const parsed = Date.parse(value);
        if (!isNaN(parsed)) {
          return "date";
        }
      }
    }

    return "string";
  }

  /**
   * Helper to sanitize field names for use as paths
   */
  protected sanitizeFieldName(name: string): string {
    // Replace spaces and special chars with underscores
    return name.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();
  }
}
