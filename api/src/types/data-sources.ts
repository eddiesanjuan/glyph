/**
 * Data Sources Type Definitions
 * Types for the intelligent template data source system
 *
 * These types match the JSONB schemas defined in 002_data_sources.sql
 */

// ============================================
// Data Source Types
// ============================================

export type DataSourceType =
  | "airtable"
  | "webhook"
  | "rest_api"
  | "graphql"
  | "database"
  | "file"
  | "manual";

export type DataSourceStatus = "active" | "pending" | "failed" | "disabled";
export type SyncStatus = "success" | "partial" | "failed";

// ============================================
// Config Types (per source type)
// ============================================

export interface AirtableConfig {
  /** Personal Access Token (encrypted at rest) */
  personal_access_token: string;
  /** Airtable base ID (appXXXXX) */
  base_id: string;
  /** Airtable table ID (tblXXXXX) */
  table_id: string;
  /** Optional view ID (viwXXXXX) */
  view_id?: string;
  /** Optional Airtable filter formula */
  filter_formula?: string;
}

export interface WebhookConfig {
  /** JSON Schema for payload validation */
  expected_schema?: Record<string, unknown>;
  /** Webhook secret for signature verification (encrypted) */
  secret?: string;
  /** Optional IP whitelist */
  allowed_ips?: string[];
}

export type AuthType = "bearer" | "basic" | "api_key" | "none";

export interface RestApiConfig {
  /** API endpoint URL */
  endpoint: string;
  /** HTTP method */
  method: "GET" | "POST" | "PUT" | "PATCH";
  /** Request headers (auth headers encrypted) */
  headers?: Record<string, string>;
  /** Query parameters */
  query_params?: Record<string, string>;
  /** Authentication type */
  auth_type: AuthType;
  /** Auth configuration (encrypted) */
  auth_config?: {
    token?: string; // For bearer
    username?: string; // For basic
    password?: string; // For basic
    api_key?: string; // For api_key
    api_key_header?: string; // Header name for api_key
  };
  /** JSONPath to extract records from response */
  response_path?: string;
}

export interface GraphqlConfig {
  /** GraphQL endpoint URL */
  endpoint: string;
  /** GraphQL query */
  query: string;
  /** Query variables */
  variables?: Record<string, unknown>;
  /** Request headers (encrypted) */
  headers?: Record<string, string>;
  /** JSONPath to extract records from response */
  response_path?: string;
}

export type DatabaseType = "postgres" | "mysql" | "mssql";

export interface DatabaseConfig {
  /** Database type */
  connection_type: DatabaseType;
  /** Connection string (encrypted) */
  connection_string: string;
  /** SQL query to fetch data */
  query: string;
  /** Query parameters */
  params?: Record<string, unknown>;
}

export type FileType = "csv" | "json" | "excel";

export interface FileConfig {
  /** File type */
  file_type: FileType;
  /** Storage path (S3 or local) */
  storage_path: string;
  /** Original filename */
  original_filename: string;
  /** Parsed schema from file */
  parsed_schema?: Record<string, unknown>;
  /** CSV delimiter */
  delimiter?: string;
}

export interface ManualConfig {
  /** User-defined schema for testing */
  schema?: Record<string, unknown>;
}

/** Union type for all config types */
export type DataSourceConfig =
  | AirtableConfig
  | WebhookConfig
  | RestApiConfig
  | GraphqlConfig
  | DatabaseConfig
  | FileConfig
  | ManualConfig;

// ============================================
// Schema Types
// ============================================

export type FieldType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "array"
  | "object";

export interface DiscoveredField {
  /** Human-readable field name */
  name: string;
  /** Dot-notation path for accessing the field */
  path: string;
  /** Data type of the field */
  type: FieldType;
  /** Whether the field is required */
  required?: boolean;
  /** Example value from the data */
  sample_value?: unknown;
}

export interface DiscoveredSchema {
  /** Array of discovered fields */
  fields: DiscoveredField[];
  /** When the schema was discovered */
  discovered_at: string;
  /** Number of records found */
  record_count?: number;
  /** Sample records for preview (first 3) */
  sample_records?: Record<string, unknown>[];
}

// ============================================
// Data Source Entity
// ============================================

export interface DataSource {
  id: string;
  api_key_id: string;
  name: string;
  description?: string;
  source_type: DataSourceType;
  config: DataSourceConfig;
  discovered_schema?: DiscoveredSchema;
  status: DataSourceStatus;
  status_message?: string;
  last_sync_at?: string;
  last_sync_status?: SyncStatus;
  last_sync_record_count?: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

// ============================================
// Template Source Mapping Types
// ============================================

export type MappingValidationStatus = "valid" | "stale" | "broken" | "pending";

/**
 * Field mappings: template placeholder -> source field path
 * Example: { "{{invoice.total}}": "fields.Total Amount" }
 */
export type FieldMappings = Record<string, string>;

/**
 * Transformation types for formatting values
 */
export type TransformationType =
  | "currency"
  | "date"
  | "text"
  | "number"
  | "boolean";

export interface CurrencyTransformation {
  type: "currency";
  locale?: string;
  currency?: string;
}

export interface DateTransformation {
  type: "date";
  format: string; // e.g., "MMMM D, YYYY"
}

export interface TextTransformation {
  type: "text";
  transform: "uppercase" | "lowercase" | "capitalize" | "trim";
}

export interface NumberTransformation {
  type: "number";
  decimals?: number;
  locale?: string;
}

export interface BooleanTransformation {
  type: "boolean";
  true_value?: string;
  false_value?: string;
}

export type Transformation =
  | CurrencyTransformation
  | DateTransformation
  | TextTransformation
  | NumberTransformation
  | BooleanTransformation;

/**
 * Transformations: template placeholder -> transformation rule
 */
export type Transformations = Record<string, Transformation>;

export interface TemplateSourceMapping {
  id: string;
  template_id: string;
  source_id: string;
  field_mappings: FieldMappings;
  transformations?: Transformations;
  is_default: boolean;
  validation_status: MappingValidationStatus;
  validation_message?: string;
  last_validated_at?: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// Enhanced Template Types
// ============================================

export interface AiMetadata {
  /** Original prompt used to generate the template */
  prompt: string;
  /** AI model used */
  model: string;
  /** When the template was generated */
  generated_at: string;
  /** Number of AI iterations/refinements */
  iterations?: number;
}

/**
 * Extended Template with new fields from 002_data_sources migration
 */
export interface EnhancedTemplate {
  id: string;
  api_key_id: string;
  name: string;
  type:
    | "invoice"
    | "quote"
    | "report"
    | "certificate"
    | "letter"
    | "receipt"
    | "contract"
    | "custom";
  description?: string;
  html_template: string;
  schema: Record<string, unknown>;
  style:
    | "stripe-clean"
    | "professional"
    | "minimal"
    | "bold"
    | "classic"
    | "corporate"
    | "modern"
    | "vibrant";
  is_default: boolean;
  version: number;
  created_at: string;
  updated_at: string;
  // New fields from 002_data_sources
  required_fields: string[];
  sample_data: Record<string, unknown>;
  default_source_id?: string;
  ai_metadata?: AiMetadata;
  deleted_at?: string;
}

// ============================================
// API Request/Response Types
// ============================================

/** Create data source request */
export interface CreateDataSourceRequest {
  name: string;
  description?: string;
  source_type: DataSourceType;
  config: DataSourceConfig;
}

/** Update data source request */
export interface UpdateDataSourceRequest {
  name?: string;
  description?: string;
  config?: Partial<DataSourceConfig>;
  status?: DataSourceStatus;
}

/** Create mapping request */
export interface CreateMappingRequest {
  template_id: string;
  source_id: string;
  field_mappings: FieldMappings;
  transformations?: Transformations;
  is_default?: boolean;
}

/** Update mapping request */
export interface UpdateMappingRequest {
  field_mappings?: FieldMappings;
  transformations?: Transformations;
  is_default?: boolean;
}

/** Schema discovery response */
export interface DiscoverSchemaResponse {
  source_id: string;
  schema: DiscoveredSchema;
  status: "success" | "partial" | "failed";
  message?: string;
}

/** Mapping validation response */
export interface ValidateMappingResponse {
  mapping_id: string;
  status: MappingValidationStatus;
  missing_fields?: string[];
  type_mismatches?: Array<{
    field: string;
    expected: FieldType;
    actual: FieldType;
  }>;
}

// ============================================
// Type Guards
// ============================================

export function isAirtableConfig(
  config: DataSourceConfig
): config is AirtableConfig {
  return "base_id" in config && "table_id" in config;
}

export function isWebhookConfig(
  config: DataSourceConfig
): config is WebhookConfig {
  return "expected_schema" in config || "secret" in config;
}

export function isRestApiConfig(
  config: DataSourceConfig
): config is RestApiConfig {
  return "endpoint" in config && "method" in config && "auth_type" in config;
}

export function isGraphqlConfig(
  config: DataSourceConfig
): config is GraphqlConfig {
  return "endpoint" in config && "query" in config && !("method" in config);
}

export function isDatabaseConfig(
  config: DataSourceConfig
): config is DatabaseConfig {
  return "connection_type" in config && "connection_string" in config;
}

export function isFileConfig(config: DataSourceConfig): config is FileConfig {
  return "file_type" in config && "storage_path" in config;
}

export function isManualConfig(
  config: DataSourceConfig
): config is ManualConfig {
  return (
    !isAirtableConfig(config) &&
    !isWebhookConfig(config) &&
    !isRestApiConfig(config) &&
    !isGraphqlConfig(config) &&
    !isDatabaseConfig(config) &&
    !isFileConfig(config)
  );
}
