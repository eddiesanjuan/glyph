/**
 * AI Assistant Service
 * AI-powered assistance for field mappings, schema inference, and template matching
 *
 * Uses Claude to intelligently:
 * - Suggest field mappings between templates and data sources
 * - Infer schema from sample data
 * - Match templates to data sources
 */

import Anthropic from "@anthropic-ai/sdk";
import type {
  DiscoveredSchema,
  DiscoveredField,
} from "../types/data-sources.js";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// =============================================================================
// Types
// =============================================================================

export interface MappingSuggestion {
  /** Template field placeholder (e.g., "{{invoice.number}}") */
  templateField: string;
  /** Source field path (e.g., "fields.Invoice Number") */
  sourceField: string;
  /** Confidence score 0-1 */
  confidence: number;
  /** Human-readable reasoning for the mapping */
  reasoning: string;
}

export interface SuggestMappingsResult {
  suggestions: MappingSuggestion[];
  /** Template fields that couldn't be mapped */
  unmapped: string[];
  /** Overall mapping coverage (0-1) */
  coverage: number;
}

export interface InferSchemaResult {
  schema: DiscoveredSchema;
  /** Detected document type */
  detectedType: string;
  /** Confidence in detection (0-1) */
  confidence: number;
}

export interface TemplateMatch {
  templateId: string;
  templateName: string;
  /** Match score (0-1) */
  score: number;
  /** Explanation for the match */
  reasoning: string;
}

// =============================================================================
// AI Functions
// =============================================================================

/**
 * Use AI to suggest field mappings between template and source
 */
export async function suggestMappings(
  templateFields: string[], // e.g., ["invoice.number", "customer.name"]
  sourceSchema: DiscoveredSchema
): Promise<SuggestMappingsResult> {
  if (templateFields.length === 0) {
    return {
      suggestions: [],
      unmapped: [],
      coverage: 1,
    };
  }

  if (sourceSchema.fields.length === 0) {
    return {
      suggestions: [],
      unmapped: templateFields.map((f) => `{{${f}}}`),
      coverage: 0,
    };
  }

  const prompt = `You are a data mapping expert. Given a template's required fields and a data source schema, suggest the best field mappings.

Template fields:
${templateFields.map((f) => `- {{${f}}}`).join("\n")}

Source schema fields:
${sourceSchema.fields.map((f) => `- ${f.name} (path: ${f.path}, type: ${f.type}${f.sample_value !== undefined ? `, sample: ${JSON.stringify(f.sample_value)}` : ""})`).join("\n")}

For each template field, suggest the best matching source field. Consider:
1. Exact name matches (highest confidence: 0.95-1.0)
2. Semantic similarity - customer vs client, total vs amount (confidence: 0.80-0.94)
3. Data type compatibility (numbers, strings, dates)
4. Field naming conventions (snake_case, camelCase, spaces)

Return a JSON object with this structure:
{
  "suggestions": [
    {
      "templateField": "{{field.name}}",
      "sourceField": "path.to.field",
      "confidence": 0.95,
      "reasoning": "Brief explanation"
    }
  ]
}

Rules:
- Only map fields you are confident about (confidence >= 0.6)
- If no good match exists, don't include that field in suggestions
- sourceField should be the exact path value from the schema
- templateField should include the {{ }} delimiters

Return ONLY the JSON object, no markdown formatting or other text.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });

    // Parse AI response
    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type from AI");
    }

    // Extract JSON from response (handle possible markdown wrapping)
    let jsonText = content.text.trim();
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const result = JSON.parse(jsonText) as { suggestions: MappingSuggestion[] };

    // Calculate unmapped fields
    const mappedFields = new Set(
      result.suggestions.map((s) => s.templateField.replace(/^\{\{|\}\}$/g, ""))
    );
    const unmapped = templateFields
      .filter((f) => !mappedFields.has(f))
      .map((f) => `{{${f}}}`);

    // Calculate coverage
    const coverage =
      templateFields.length > 0
        ? (templateFields.length - unmapped.length) / templateFields.length
        : 1;

    return {
      suggestions: result.suggestions,
      unmapped,
      coverage: Math.round(coverage * 100) / 100,
    };
  } catch (error) {
    console.error("[AI Assistant] Error suggesting mappings:", error);
    throw new Error(
      `Failed to generate mapping suggestions: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Use AI to infer schema from sample data
 */
export async function inferSchema(
  sampleData: Record<string, unknown>,
  documentTypeHint?: string
): Promise<InferSchemaResult> {
  const prompt = `You are a document schema expert. Analyze this sample data and infer a complete schema.

Sample data:
${JSON.stringify(sampleData, null, 2)}

${documentTypeHint ? `Hint: This appears to be ${documentTypeHint} data.` : "Analyze the data to determine the document type."}

Return a JSON object with this structure:
{
  "fields": [
    {
      "name": "human_readable_name",
      "path": "dot.notation.path",
      "type": "string|number|boolean|date|array|object",
      "required": true,
      "sample_value": "example from data"
    }
  ],
  "detectedType": "invoice|quote|report|certificate|letter|receipt|contract|custom",
  "confidence": 0.9
}

Rules:
- path should be the exact path to access the value (e.g., "customer.name" or "items[0].price")
- For arrays, include the array field itself AND representative child fields
- type should be one of: string, number, boolean, date, array, object
- Detect dates by looking at format (ISO 8601, common date patterns)
- Set required=true for fields that appear essential to the document type
- confidence should reflect how well the data matches the detected document type

Return ONLY the JSON object, no markdown formatting or other text.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type from AI");
    }

    // Extract JSON from response
    let jsonText = content.text.trim();
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const result = JSON.parse(jsonText) as {
      fields: DiscoveredField[];
      detectedType: string;
      confidence: number;
    };

    return {
      schema: {
        fields: result.fields,
        discovered_at: new Date().toISOString(),
        sample_records: [sampleData],
      },
      detectedType: result.detectedType,
      confidence: result.confidence,
    };
  } catch (error) {
    console.error("[AI Assistant] Error inferring schema:", error);
    throw new Error(
      `Failed to infer schema: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Use AI to find matching templates for source data
 */
export async function matchTemplates(
  sourceSchema: DiscoveredSchema,
  sampleRecord: Record<string, unknown>,
  templates: Array<{
    id: string;
    name: string;
    type: string;
    required_fields: string[];
    description?: string;
  }>
): Promise<TemplateMatch[]> {
  if (templates.length === 0) {
    return [];
  }

  const prompt = `You are a template matching expert. Given source data and available templates, rank the best matches.

Source schema:
${sourceSchema.fields.map((f) => `- ${f.name} (path: ${f.path}, type: ${f.type})`).join("\n")}

Sample data:
${JSON.stringify(sampleRecord, null, 2)}

Available templates:
${templates.map((t) => `- ID: ${t.id}
  Name: ${t.name}
  Type: ${t.type}
  Required fields: ${t.required_fields.join(", ") || "none specified"}
  ${t.description ? `Description: ${t.description}` : ""}`).join("\n\n")}

Rank templates by how well they match the source data. Consider:
1. Required field coverage - how many template fields can be filled from the source?
2. Document type alignment - does the data structure match the template purpose?
3. Data structure compatibility - do the data types match?
4. Field naming similarity - semantic matches between source and template fields

Return a JSON array (best matches first, max 5 results):
[
  {
    "templateId": "uuid",
    "templateName": "Template Name",
    "score": 0.92,
    "reasoning": "Brief explanation of why this template matches"
  }
]

Rules:
- Only include templates with score >= 0.3
- score should be 0-1 based on overall compatibility
- Limit to top 5 matches
- reasoning should explain the key factors for the match

Return ONLY the JSON array, no markdown formatting or other text.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type from AI");
    }

    // Extract JSON from response
    let jsonText = content.text.trim();
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const matches = JSON.parse(jsonText) as TemplateMatch[];

    // Sort by score descending and limit to 5
    return matches
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  } catch (error) {
    console.error("[AI Assistant] Error matching templates:", error);
    throw new Error(
      `Failed to match templates: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Extract template field placeholders from HTML template
 * Finds all {{field.name}} patterns
 */
export function extractTemplateFields(htmlTemplate: string): string[] {
  const regex = /\{\{([^{}]+)\}\}/g;
  const fields = new Set<string>();
  let match;

  while ((match = regex.exec(htmlTemplate)) !== null) {
    const field = match[1].trim();
    // Skip Mustache control directives (# ^ /)
    if (!field.startsWith("#") && !field.startsWith("^") && !field.startsWith("/")) {
      // Handle dotted paths and simple fields
      fields.add(field);
    }
  }

  return Array.from(fields);
}
