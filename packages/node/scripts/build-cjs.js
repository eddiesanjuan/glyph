/**
 * Generate a CommonJS wrapper and copy type declarations for CJS consumers.
 * Uses dynamic import() to load the ESM entry point from CJS.
 */
import { writeFileSync, copyFileSync } from "fs";

// CJS wrapper using dynamic import
const cjsContent = `"use strict";

const { Glyph, GlyphError } = require("./index.cjs.compat.js");

module.exports = function glyph(config) {
  return new Glyph(config);
};
module.exports.Glyph = Glyph;
module.exports.GlyphError = GlyphError;
module.exports.default = module.exports;
`;

// We actually need a simpler approach — produce a fully self-contained CJS file
// by writing out the CJS-compatible code directly.
const cjsSelfContained = `"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

class GlyphError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = "GlyphError";
  }
}
exports.GlyphError = GlyphError;

class Glyph {
  constructor(config) {
    if (typeof config === "string") {
      this.apiKey = config;
      this.baseUrl = "https://api.glyph.you";
    } else {
      this.apiKey = config.apiKey;
      this.baseUrl = (config.baseUrl || "https://api.glyph.you").replace(/\\/$/, "");
    }
  }

  async request(method, path, body) {
    const res = await fetch(this.baseUrl + path, {
      method,
      headers: {
        Authorization: "Bearer " + this.apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new GlyphError(
        json.error || "Request failed with status " + res.status,
        res.status,
        json.code || "UNKNOWN_ERROR"
      );
    }
    return json;
  }

  async create(options) {
    return this.request("POST", "/v1/create", options);
  }

  async templates(category) {
    const q = category ? "?category=" + encodeURIComponent(category) : "";
    const res = await this.request("GET", "/v1/templates" + q);
    return res.templates;
  }

  async templateSchema(templateId) {
    return this.request("GET", "/v1/templates/" + encodeURIComponent(templateId) + "/schema");
  }
}
exports.Glyph = Glyph;

function glyph(config) {
  return new Glyph(config);
}
exports.default = glyph;
module.exports = glyph;
module.exports.Glyph = Glyph;
module.exports.GlyphError = GlyphError;
module.exports.default = glyph;
`;

writeFileSync("dist/index.cjs", cjsSelfContained);

// Copy .d.ts as .d.cts for CJS type resolution
copyFileSync("dist/index.d.ts", "dist/index.d.cts");

console.log("CJS build + .d.cts generated.");
