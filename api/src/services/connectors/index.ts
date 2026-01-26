/**
 * Source Connectors Index
 * Factory function and exports for all connector types
 */

import type { DataSource } from "../../types/data-sources.js";
import type { SourceConnector } from "../sourceConnector.js";
import { AirtableConnector } from "./airtable.js";
import { RestApiConnector } from "./restApi.js";
import { WebhookConnector } from "./webhook.js";

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a connector instance for the given data source
 * @param source The data source to create a connector for
 * @returns A SourceConnector implementation appropriate for the source type
 * @throws Error if the source type is not supported
 */
export function createConnector(source: DataSource): SourceConnector {
  switch (source.source_type) {
    case "airtable":
      return new AirtableConnector(source);

    case "rest_api":
      return new RestApiConnector(source);

    case "webhook":
      return new WebhookConnector(source);

    case "graphql":
      throw new Error(
        "GraphQL connector not yet implemented. Use REST API connector with appropriate configuration."
      );

    case "database":
      throw new Error(
        "Database connector not yet implemented. Direct database connections require additional security considerations."
      );

    case "file":
      throw new Error(
        "File connector not yet implemented. Use the file upload API to process files."
      );

    case "manual":
      throw new Error(
        "Manual sources do not require a connector. Data is provided directly in API calls."
      );

    default:
      throw new Error(
        `Unsupported source type: ${source.source_type}. ` +
          `Supported types: airtable, rest_api, webhook`
      );
  }
}

// =============================================================================
// Exports
// =============================================================================

export { AirtableConnector } from "./airtable.js";
export { RestApiConnector } from "./restApi.js";
export { WebhookConnector } from "./webhook.js";

// Re-export types for convenience
export type {
  SourceConnector,
  FetchOptions,
  SourceRecord,
  ConnectionTestResult,
} from "../sourceConnector.js";

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Check if a source type is supported by the connector system
 */
export function isSourceTypeSupported(
  sourceType: string
): sourceType is "airtable" | "rest_api" | "webhook" {
  return ["airtable", "rest_api", "webhook"].includes(sourceType);
}

/**
 * Get a list of all supported source types
 */
export function getSupportedSourceTypes(): string[] {
  return ["airtable", "rest_api", "webhook"];
}

/**
 * Get connector capabilities for a source type
 */
export function getConnectorCapabilities(
  sourceType: string
): {
  canFetch: boolean;
  canPush: boolean;
  supportsSchema: boolean;
  supportsFiltering: boolean;
  supportsPagination: boolean;
} {
  switch (sourceType) {
    case "airtable":
      return {
        canFetch: true,
        canPush: false,
        supportsSchema: true,
        supportsFiltering: true,
        supportsPagination: true,
      };

    case "rest_api":
      return {
        canFetch: true,
        canPush: false,
        supportsSchema: true,
        supportsFiltering: true,
        supportsPagination: true,
      };

    case "webhook":
      return {
        canFetch: false,
        canPush: true,
        supportsSchema: true,
        supportsFiltering: false,
        supportsPagination: false,
      };

    default:
      return {
        canFetch: false,
        canPush: false,
        supportsSchema: false,
        supportsFiltering: false,
        supportsPagination: false,
      };
  }
}
