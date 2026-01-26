/**
 * Webhook Connector
 * Implements SourceConnector for webhook-based data sources
 *
 * Webhooks are push-based, so fetching is not the primary use case.
 * This connector primarily handles schema validation for incoming payloads.
 */

import {
  BaseConnector,
  type ConnectionTestResult,
  type FetchOptions,
  type SourceRecord,
} from "../sourceConnector.js";
import type {
  DataSource,
  WebhookConfig,
  DiscoveredSchema,
  DiscoveredField,
  FieldType,
} from "../../types/data-sources.js";

// =============================================================================
// Webhook Connector
// =============================================================================

export class WebhookConnector extends BaseConnector {
  constructor(source: DataSource) {
    super(source);

    // Validate config type
    if (!this.isWebhookConfig(source.config)) {
      throw new Error("Invalid Webhook configuration");
    }
  }

  /**
   * Type guard for WebhookConfig
   */
  private isWebhookConfig(config: unknown): config is WebhookConfig {
    const c = config as WebhookConfig;
    return typeof c === "object" && c !== null;
  }

  /**
   * Get typed config
   */
  private get webhookConfig(): WebhookConfig {
    return this.config as WebhookConfig;
  }

  /**
   * Test connection for webhook
   * Since webhooks are push-based, we just verify the configuration is valid
   */
  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const { expected_schema, secret, allowed_ips } = this.webhookConfig;

      const details: Record<string, unknown> = {
        hasSecret: !!secret,
        hasExpectedSchema: !!expected_schema,
        allowedIpCount: allowed_ips?.length || 0,
      };

      // Validate expected schema if provided
      if (expected_schema) {
        const schemaFields = this.extractSchemaFields(expected_schema);
        details.fieldCount = schemaFields.length;
      }

      return {
        success: true,
        details,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to validate webhook configuration",
      };
    }
  }

  /**
   * Discover schema from webhook configuration
   * Uses the expected_schema if provided
   */
  async discoverSchema(): Promise<DiscoveredSchema> {
    const { expected_schema } = this.webhookConfig;

    if (!expected_schema) {
      // No schema defined, return empty
      return {
        fields: [],
        discovered_at: new Date().toISOString(),
        record_count: 0,
        sample_records: [],
      };
    }

    const fields = this.extractSchemaFields(expected_schema);

    return {
      fields,
      discovered_at: new Date().toISOString(),
      record_count: 0,
      sample_records: [],
    };
  }

  /**
   * Extract fields from a JSON Schema-like expected_schema
   */
  private extractSchemaFields(
    schema: Record<string, unknown>,
    prefix = ""
  ): DiscoveredField[] {
    const fields: DiscoveredField[] = [];

    // Handle JSON Schema format
    const properties = schema.properties as
      | Record<string, Record<string, unknown>>
      | undefined;
    const required = (schema.required as string[]) || [];

    if (properties) {
      for (const [key, prop] of Object.entries(properties)) {
        const path = prefix ? `${prefix}.${key}` : key;
        const name = prefix ? `${prefix} > ${key}` : key;

        const fieldType = this.jsonSchemaTypeToFieldType(
          prop.type as string | string[],
          prop.format as string | undefined
        );

        // Handle nested objects
        if (prop.type === "object" && prop.properties) {
          const nestedFields = this.extractSchemaFields(
            prop as Record<string, unknown>,
            path
          );
          fields.push(...nestedFields);
        } else if (prop.type === "array" && prop.items) {
          // Array type - add as array field
          fields.push({
            name,
            path,
            type: "array",
            required: required.includes(key),
            sample_value: prop.default,
          });
        } else {
          fields.push({
            name,
            path,
            type: fieldType,
            required: required.includes(key),
            sample_value: prop.default || prop.example,
          });
        }
      }
    } else {
      // Simple schema format: { field: "type" }
      for (const [key, value] of Object.entries(schema)) {
        if (typeof value === "string") {
          const path = prefix ? `${prefix}.${key}` : key;
          const name = prefix ? `${prefix} > ${key}` : key;

          fields.push({
            name,
            path,
            type: this.simpleTypeToFieldType(value),
            required: false,
          });
        } else if (typeof value === "object" && value !== null) {
          // Nested object
          const path = prefix ? `${prefix}.${key}` : key;
          const nestedFields = this.extractSchemaFields(
            value as Record<string, unknown>,
            path
          );
          fields.push(...nestedFields);
        }
      }
    }

    return fields;
  }

  /**
   * Convert JSON Schema type to our FieldType
   */
  private jsonSchemaTypeToFieldType(
    type: string | string[] | undefined,
    format?: string
  ): FieldType {
    // Handle union types (e.g., ["string", "null"])
    const primaryType = Array.isArray(type)
      ? type.find((t) => t !== "null") || "string"
      : type || "string";

    // Check format first for more specific types
    if (format === "date" || format === "date-time") {
      return "date";
    }

    switch (primaryType) {
      case "string":
        return "string";
      case "number":
      case "integer":
        return "number";
      case "boolean":
        return "boolean";
      case "array":
        return "array";
      case "object":
        return "object";
      default:
        return "string";
    }
  }

  /**
   * Convert simple type string to FieldType
   */
  private simpleTypeToFieldType(type: string): FieldType {
    switch (type.toLowerCase()) {
      case "string":
      case "text":
        return "string";
      case "number":
      case "integer":
      case "float":
      case "decimal":
        return "number";
      case "boolean":
      case "bool":
        return "boolean";
      case "date":
      case "datetime":
      case "timestamp":
        return "date";
      case "array":
      case "list":
        return "array";
      case "object":
      case "json":
        return "object";
      default:
        return "string";
    }
  }

  /**
   * Fetch records - Not applicable for webhooks
   * Webhooks are push-based, data comes from incoming requests
   */
  async fetchRecords(_options?: FetchOptions): Promise<SourceRecord[]> {
    // Webhooks don't support fetching
    // Data is pushed to us via webhook endpoints
    console.warn(
      "WebhookConnector.fetchRecords called - webhooks are push-based and do not support fetching"
    );
    return [];
  }

  /**
   * Fetch single record - Not applicable for webhooks
   */
  async fetchRecord(_recordId: string): Promise<SourceRecord> {
    throw new Error(
      "Webhooks are push-based and do not support fetching individual records. " +
        "Data is received via incoming webhook requests."
    );
  }

  /**
   * Validate an incoming webhook payload against the expected schema
   * This is the primary use case for webhook connectors
   */
  validatePayload(payload: unknown): {
    valid: boolean;
    errors: string[];
    record?: SourceRecord;
  } {
    const errors: string[] = [];
    const { expected_schema } = this.webhookConfig;

    if (!expected_schema) {
      // No schema to validate against, accept any payload
      return {
        valid: true,
        errors: [],
        record: this.payloadToRecord(payload),
      };
    }

    // Basic validation against expected schema
    if (typeof payload !== "object" || payload === null) {
      errors.push("Payload must be an object");
      return { valid: false, errors };
    }

    const payloadObj = payload as Record<string, unknown>;

    // Check required fields
    const required = (expected_schema.required as string[]) || [];
    for (const field of required) {
      if (!(field in payloadObj) || payloadObj[field] === undefined) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // Validate types if properties are defined
    const properties = expected_schema.properties as
      | Record<string, Record<string, unknown>>
      | undefined;

    if (properties) {
      for (const [key, prop] of Object.entries(properties)) {
        if (key in payloadObj) {
          const value = payloadObj[key];
          const expectedType = prop.type as string;

          if (!this.validateType(value, expectedType)) {
            errors.push(
              `Invalid type for field '${key}': expected ${expectedType}, got ${typeof value}`
            );
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      record: errors.length === 0 ? this.payloadToRecord(payload) : undefined,
    };
  }

  /**
   * Validate a value against an expected type
   */
  private validateType(value: unknown, expectedType: string): boolean {
    if (value === null || value === undefined) {
      return true; // Allow null/undefined for optional fields
    }

    switch (expectedType) {
      case "string":
        return typeof value === "string";
      case "number":
      case "integer":
        return typeof value === "number";
      case "boolean":
        return typeof value === "boolean";
      case "array":
        return Array.isArray(value);
      case "object":
        return typeof value === "object" && !Array.isArray(value);
      default:
        return true;
    }
  }

  /**
   * Convert a webhook payload to a SourceRecord
   */
  private payloadToRecord(payload: unknown): SourceRecord {
    const payloadObj =
      typeof payload === "object" && payload !== null
        ? (payload as Record<string, unknown>)
        : {};

    // Try to extract ID from common fields
    const id =
      (payloadObj.id as string) ||
      (payloadObj._id as string) ||
      (payloadObj.uuid as string) ||
      `webhook_${Date.now()}`;

    // Try to extract timestamp
    const createdTime =
      (payloadObj.createdTime as string) ||
      (payloadObj.created_at as string) ||
      (payloadObj.timestamp as string) ||
      new Date().toISOString();

    return {
      id: String(id),
      fields: payloadObj,
      createdTime,
    };
  }

  /**
   * Verify webhook signature (HMAC)
   * Common for services like Stripe, GitHub, etc.
   */
  verifySignature(
    payload: string | Buffer,
    signature: string,
    algorithm: "sha256" | "sha1" = "sha256"
  ): boolean {
    const { secret } = this.webhookConfig;

    if (!secret) {
      console.warn("No webhook secret configured, skipping signature verification");
      return true;
    }

    try {
      // Use crypto module for HMAC verification
      const crypto = require("crypto");
      const hmac = crypto.createHmac(algorithm, secret);
      hmac.update(payload);
      const expectedSignature = hmac.digest("hex");

      // Constant-time comparison to prevent timing attacks
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      console.error("Webhook signature verification failed:", error);
      return false;
    }
  }
}
