/**
 * Hono Context Type Extensions
 * Extends Hono's context to include custom variables set by auth middleware
 */

import "hono";

declare module "hono" {
  interface ContextVariableMap {
    apiKeyId: string;
    tier: string;
    monthlyLimit: number;
    currentUsage: number;
  }
}
