/**
 * Field Mapper Service
 * Applies field mappings and transformations to source data
 *
 * This service transforms raw source data into the format expected by templates,
 * applying any configured transformations (currency formatting, date formatting, etc.)
 */

import type {
  FieldMappings,
  Transformations,
  Transformation,
  CurrencyTransformation,
  DateTransformation,
  TextTransformation,
  NumberTransformation,
  BooleanTransformation,
} from "../types/data-sources.js";
import type { SourceRecord } from "./sourceConnector.js";

// =============================================================================
// Types
// =============================================================================

export interface MappingResult {
  /** Mapped data ready for template rendering */
  data: Record<string, unknown>;
  /** Fields that could not be mapped */
  unmappedFields: string[];
  /** Warnings during mapping (e.g., type coercion) */
  warnings: string[];
}

// =============================================================================
// Value Extraction
// =============================================================================

/**
 * Extract a value from nested object using dot notation path
 * Supports paths like "fields.Customer Name" or "fields.Items[0].price"
 */
function extractValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }

    // Handle array notation like "items[0]"
    const arrayMatch = part.match(/^(.+)\[(\d+)\]$/);
    if (arrayMatch) {
      const [, key, indexStr] = arrayMatch;
      const index = parseInt(indexStr, 10);
      current = (current as Record<string, unknown>)[key];
      if (Array.isArray(current)) {
        current = current[index];
      } else {
        return undefined;
      }
    } else {
      current = (current as Record<string, unknown>)[part];
    }
  }

  return current;
}

/**
 * Set a value in nested object using dot notation path
 * Creates intermediate objects as needed
 */
function setValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): void {
  const parts = path.split(".");
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current)) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }

  current[parts[parts.length - 1]] = value;
}

// =============================================================================
// Transformations
// =============================================================================

/**
 * Apply a currency transformation
 */
function applyCurrencyTransform(
  value: unknown,
  transform: CurrencyTransformation
): string {
  const num = typeof value === "number" ? value : parseFloat(String(value));

  if (isNaN(num)) {
    return String(value);
  }

  const locale = transform.locale || "en-US";
  const currency = transform.currency || "USD";

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(num);
}

/**
 * Apply a date transformation
 */
function applyDateTransform(
  value: unknown,
  transform: DateTransformation
): string {
  const date =
    value instanceof Date ? value : new Date(String(value));

  if (isNaN(date.getTime())) {
    return String(value);
  }

  // Simple format string support
  const format = transform.format || "MMMM D, YYYY";

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const shortMonths = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  const replacements: Record<string, string> = {
    YYYY: String(date.getFullYear()),
    YY: String(date.getFullYear()).slice(-2),
    MMMM: months[date.getMonth()],
    MMM: shortMonths[date.getMonth()],
    MM: String(date.getMonth() + 1).padStart(2, "0"),
    M: String(date.getMonth() + 1),
    DD: String(date.getDate()).padStart(2, "0"),
    D: String(date.getDate()),
  };

  let result = format;
  for (const [pattern, replacement] of Object.entries(replacements)) {
    result = result.replace(pattern, replacement);
  }

  return result;
}

/**
 * Apply a text transformation
 */
function applyTextTransform(
  value: unknown,
  transform: TextTransformation
): string {
  const str = String(value);

  switch (transform.transform) {
    case "uppercase":
      return str.toUpperCase();
    case "lowercase":
      return str.toLowerCase();
    case "capitalize":
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    case "trim":
      return str.trim();
    default:
      return str;
  }
}

/**
 * Apply a number transformation
 */
function applyNumberTransform(
  value: unknown,
  transform: NumberTransformation
): string {
  const num = typeof value === "number" ? value : parseFloat(String(value));

  if (isNaN(num)) {
    return String(value);
  }

  const locale = transform.locale || "en-US";
  const decimals = transform.decimals;

  const options: Intl.NumberFormatOptions = {};
  if (decimals !== undefined) {
    options.minimumFractionDigits = decimals;
    options.maximumFractionDigits = decimals;
  }

  return new Intl.NumberFormat(locale, options).format(num);
}

/**
 * Apply a boolean transformation
 */
function applyBooleanTransform(
  value: unknown,
  transform: BooleanTransformation
): string {
  const bool = Boolean(value);
  const trueValue = transform.true_value || "Yes";
  const falseValue = transform.false_value || "No";

  return bool ? trueValue : falseValue;
}

/**
 * Apply a transformation to a value
 */
function applyTransformation(
  value: unknown,
  transformation: Transformation
): unknown {
  switch (transformation.type) {
    case "currency":
      return applyCurrencyTransform(value, transformation);
    case "date":
      return applyDateTransform(value, transformation);
    case "text":
      return applyTextTransform(value, transformation);
    case "number":
      return applyNumberTransform(value, transformation);
    case "boolean":
      return applyBooleanTransform(value, transformation);
    default:
      return value;
  }
}

// =============================================================================
// Main Functions
// =============================================================================

/**
 * Apply field mappings to source record data
 *
 * @param record The source record with fields
 * @param mappings Field mappings (template placeholder -> source field path)
 * @param transformations Optional transformations to apply
 * @returns Mapped data ready for template rendering
 */
export function applyMappings(
  record: SourceRecord,
  mappings: FieldMappings,
  transformations?: Transformations
): MappingResult {
  const result: Record<string, unknown> = {};
  const unmappedFields: string[] = [];
  const warnings: string[] = [];

  // Include the record ID
  result.id = record.id;
  result.createdTime = record.createdTime;

  // Apply each mapping
  for (const [templateField, sourcePath] of Object.entries(mappings)) {
    // Extract value from source record
    // Source paths typically start with "fields." for Airtable records
    let value = extractValue(record.fields, sourcePath.replace(/^fields\./, ""));

    // If not found in fields, try the whole record
    if (value === undefined) {
      value = extractValue(record as unknown as Record<string, unknown>, sourcePath);
    }

    if (value === undefined) {
      unmappedFields.push(templateField);
      continue;
    }

    // Apply transformation if configured
    if (transformations && transformations[templateField]) {
      try {
        value = applyTransformation(value, transformations[templateField]);
      } catch (err) {
        warnings.push(
          `Failed to transform ${templateField}: ${
            err instanceof Error ? err.message : "Unknown error"
          }`
        );
      }
    }

    // Set value in result using template field path
    // Template fields use Mustache notation like {{invoice.total}}
    // We convert to nested object structure
    const cleanPath = templateField.replace(/\{\{|\}\}/g, "").trim();
    setValue(result, cleanPath, value);
  }

  // Also include all raw fields for flexibility
  result.fields = record.fields;

  return {
    data: result,
    unmappedFields,
    warnings,
  };
}

/**
 * Apply mappings to multiple records
 */
export function applyMappingsToRecords(
  records: SourceRecord[],
  mappings: FieldMappings,
  transformations?: Transformations
): {
  results: MappingResult[];
  summary: {
    total: number;
    successful: number;
    withWarnings: number;
    totalWarnings: number;
  };
} {
  const results = records.map((record) =>
    applyMappings(record, mappings, transformations)
  );

  const withWarnings = results.filter((r) => r.warnings.length > 0).length;
  const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0);

  return {
    results,
    summary: {
      total: records.length,
      successful: records.length - withWarnings,
      withWarnings,
      totalWarnings,
    },
  };
}

/**
 * Validate that all required template fields have mappings
 */
export function validateMappings(
  requiredFields: string[],
  mappings: FieldMappings
): {
  valid: boolean;
  missingFields: string[];
} {
  const mappedFields = new Set(
    Object.keys(mappings).map((f) => f.replace(/\{\{|\}\}/g, "").trim())
  );

  const missingFields = requiredFields.filter(
    (field) => !mappedFields.has(field)
  );

  return {
    valid: missingFields.length === 0,
    missingFields,
  };
}

/**
 * Auto-generate mappings from source schema to template fields
 * Uses fuzzy matching on field names
 */
export function suggestMappings(
  templateFields: string[],
  sourceFields: Array<{ name: string; path: string }>
): FieldMappings {
  const suggestions: FieldMappings = {};

  for (const templateField of templateFields) {
    // Clean template field name
    const cleanName = templateField
      .replace(/\{\{|\}\}/g, "")
      .replace(/\./g, " ")
      .toLowerCase()
      .trim();

    // Find best matching source field
    let bestMatch: { name: string; path: string; score: number } | null = null;

    for (const sourceField of sourceFields) {
      const sourceName = sourceField.name.toLowerCase();

      // Calculate similarity score
      let score = 0;

      // Exact match
      if (sourceName === cleanName) {
        score = 100;
      }
      // Contains match
      else if (sourceName.includes(cleanName) || cleanName.includes(sourceName)) {
        score = 70;
      }
      // Word overlap
      else {
        const templateWords = cleanName.split(/\s+/);
        const sourceWords = sourceName.split(/\s+/);
        const overlap = templateWords.filter((w) =>
          sourceWords.some((s) => s.includes(w) || w.includes(s))
        ).length;
        score = (overlap / Math.max(templateWords.length, sourceWords.length)) * 50;
      }

      if (score > 30 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { ...sourceField, score };
      }
    }

    if (bestMatch) {
      suggestions[`{{${templateField}}}`] = `fields.${bestMatch.path}`;
    }
  }

  return suggestions;
}
