/**
 * Custom Templates Storage
 *
 * In-memory storage for user-created custom templates.
 * These templates can be used with /v1/create via templateId.
 *
 * Similar to devSessions.ts, this is designed for:
 * - Demo tier / playground usage
 * - Local development
 * - Quick prototyping
 *
 * For production persistence, templates should be stored in Supabase
 * via the /v1/templates/saved endpoints.
 *
 * WARNING: Templates are lost on server restart.
 */

export interface CustomTemplate {
  id: string;
  name: string;
  html: string;
  schema: Record<string, unknown>;
  description?: string;
  createdAt: string;
  expiresAt: string;
  /** API key ID that created this template (for access control) */
  createdBy?: string;
}

// In-memory storage for custom templates
const customTemplates = new Map<string, CustomTemplate>();

// Template TTL: 24 hours (matches document storage)
const TEMPLATE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Generate a unique template ID
 * Format: tpl_{random} to distinguish from built-in templates
 */
export function generateTemplateId(): string {
  return `tpl_${crypto.randomUUID().split("-")[0]}`;
}

/**
 * Create a new custom template
 */
export function createCustomTemplate(
  name: string,
  html: string,
  schema: Record<string, unknown>,
  options?: {
    description?: string;
    createdBy?: string;
  }
): CustomTemplate {
  const id = generateTemplateId();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TEMPLATE_TTL_MS);

  const template: CustomTemplate = {
    id,
    name,
    html,
    schema,
    description: options?.description,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    createdBy: options?.createdBy,
  };

  customTemplates.set(id, template);
  console.info(`[Custom Templates] Created template: ${id} (name: "${name}", expires: ${expiresAt.toISOString()})`);

  return template;
}

/**
 * Get a custom template by ID
 * Returns null if not found or expired
 */
export function getCustomTemplate(templateId: string): CustomTemplate | null {
  const template = customTemplates.get(templateId);

  if (!template) {
    return null;
  }

  // Check if expired
  if (new Date(template.expiresAt) < new Date()) {
    customTemplates.delete(templateId);
    console.info(`[Custom Templates] Template expired and removed: ${templateId}`);
    return null;
  }

  return template;
}

/**
 * Check if a template ID is a custom template ID
 * Custom templates start with "tpl_"
 */
export function isCustomTemplateId(templateId: string): boolean {
  return templateId.startsWith("tpl_");
}

/**
 * Delete a custom template
 */
export function deleteCustomTemplate(templateId: string): boolean {
  const deleted = customTemplates.delete(templateId);
  if (deleted) {
    console.info(`[Custom Templates] Deleted template: ${templateId}`);
  }
  return deleted;
}

/**
 * List all custom templates (for a specific API key, if provided)
 */
export function listCustomTemplates(createdBy?: string): CustomTemplate[] {
  const now = new Date();
  const templates: CustomTemplate[] = [];
  const expiredIds: string[] = [];

  customTemplates.forEach((template, id) => {
    // Check if expired
    if (new Date(template.expiresAt) < now) {
      expiredIds.push(id);
      return;
    }

    // Filter by creator if specified
    if (createdBy && template.createdBy !== createdBy) {
      return;
    }

    templates.push(template);
  });

  // Clean up expired templates
  expiredIds.forEach((id) => customTemplates.delete(id));

  return templates;
}

/**
 * Get count of active custom templates (for monitoring)
 */
export function getCustomTemplateCount(): number {
  return customTemplates.size;
}

/**
 * Clean up expired templates (can be called periodically)
 */
export function cleanupExpiredTemplates(): number {
  const now = new Date();
  let cleaned = 0;
  const expiredIds: string[] = [];

  customTemplates.forEach((template, id) => {
    if (new Date(template.expiresAt) < now) {
      expiredIds.push(id);
    }
  });

  expiredIds.forEach((id) => {
    customTemplates.delete(id);
    cleaned++;
  });

  if (cleaned > 0) {
    console.info(`[Custom Templates] Cleaned up ${cleaned} expired templates`);
  }

  return cleaned;
}
