/** @glyph-pdf/node — Server-side SDK for the Glyph PDF API. Zero dependencies. */

export interface GlyphConfig { apiKey: string; baseUrl?: string }

export interface CreateOptions {
  data: Record<string, unknown>;
  templateId?: string;
  html?: string;
  url?: string;
  format?: "pdf" | "png";
  style?: "stripe-clean" | "bold" | "minimal" | "corporate";
  intent?: string;
  options?: {
    pageSize?: "A4" | "letter" | "legal";
    orientation?: "portrait" | "landscape";
    margin?: { top?: string; bottom?: string; left?: string; right?: string };
    scale?: number;
  };
}

export interface CreateResult {
  success: boolean;
  url: string;
  format: string;
  size: number;
  filename: string;
  expiresAt: string;
  sessionId: string;
  analysis?: {
    detectedType: string;
    confidence: number;
    fieldsIdentified: string[];
    layoutDecisions: string[];
  };
}

export interface TemplateInfo {
  id: string;
  name: string;
  description: string;
  category: string;
  style: string | null;
  tags: string[];
  sampleData: Record<string, unknown>;
}

export class GlyphError extends Error {
  constructor(message: string, public readonly status: number, public readonly code: string) {
    super(message);
    this.name = "GlyphError";
  }
}

export class Glyph {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(config: GlyphConfig | string) {
    if (typeof config === "string") {
      this.apiKey = config;
      this.baseUrl = "https://api.glyph.you";
    } else {
      this.apiKey = config.apiKey;
      this.baseUrl = (config.baseUrl || "https://api.glyph.you").replace(/\/$/, "");
    }
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const json = (await res.json()) as T & { error?: string; code?: string };
    if (!res.ok) {
      throw new GlyphError(
        json.error || `Request failed with status ${res.status}`,
        res.status,
        json.code || "UNKNOWN_ERROR",
      );
    }
    return json;
  }

  async create(options: CreateOptions): Promise<CreateResult> {
    return this.request<CreateResult>("POST", "/v1/create", options);
  }

  async templates(category?: string): Promise<TemplateInfo[]> {
    const q = category ? `?category=${encodeURIComponent(category)}` : "";
    const res = await this.request<{ templates: TemplateInfo[] }>("GET", `/v1/templates${q}`);
    return res.templates;
  }

  async templateSchema(templateId: string): Promise<Record<string, unknown>> {
    return this.request("GET", `/v1/templates/${encodeURIComponent(templateId)}/schema`);
  }
}

export default function glyph(config: GlyphConfig | string): Glyph {
  return new Glyph(config);
}
