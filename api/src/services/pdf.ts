/**
 * PDF Generation Service
 * Uses Playwright for HTML to PDF conversion with browser pooling for performance
 */

import { chromium, Browser, Page } from 'playwright';
import { createHash } from 'crypto';
import type { GenerateRequest, GenerateResponse } from "../lib/types.js";

// Browser instance (reused across requests)
let browser: Browser | null = null;

// Page pool for better performance
const pagePool: Page[] = [];
const MAX_POOL_SIZE = 8;

/**
 * Get or create browser instance
 */
async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
  return browser;
}

/**
 * Get a page from pool or create new one
 */
async function getPage(): Promise<Page> {
  const b = await getBrowser();

  // Try to get a page from pool
  if (pagePool.length > 0) {
    const page = pagePool.pop()!;
    return page;
  }

  // Create new page with letter size viewport at 96 DPI
  const context = await b.newContext({
    viewport: { width: 816, height: 1056 },
  });
  return context.newPage();
}

/**
 * Return page to pool for reuse
 */
function returnPage(page: Page): void {
  if (pagePool.length < MAX_POOL_SIZE) {
    pagePool.push(page);
  } else {
    page.close().catch(() => {});
  }
}

// --- PDF Output Cache ---
const PDF_CACHE_MAX = 50;
const PDF_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

interface CacheEntry {
  buffer: Buffer;
  createdAt: number;
}

const pdfCache = new Map<string, CacheEntry>();

function computeCacheKey(html: string, options: PDFOptions = {}): string {
  const raw = JSON.stringify({ html, format: options.format, landscape: options.landscape, margin: options.margin, scale: options.scale });
  return createHash('sha256').update(raw).digest('hex');
}

function evictExpired(): void {
  const now = Date.now();
  for (const [key, entry] of pdfCache) {
    if (now - entry.createdAt > PDF_CACHE_TTL_MS) {
      pdfCache.delete(key);
    }
  }
}

function evictOldestIfFull(): void {
  if (pdfCache.size < PDF_CACHE_MAX) return;
  // Delete the oldest entry (first inserted — Map preserves insertion order)
  const oldestKey = pdfCache.keys().next().value;
  if (oldestKey !== undefined) {
    pdfCache.delete(oldestKey);
  }
}

export function getPdfCacheStats() {
  return { size: pdfCache.size, maxSize: PDF_CACHE_MAX, ttlMs: PDF_CACHE_TTL_MS };
}

export interface PDFOptions {
  format?: 'letter' | 'a4';
  landscape?: boolean;
  margin?: {
    top?: string;
    bottom?: string;
    left?: string;
    right?: string;
  };
  scale?: number;
}

export interface PNGOptions {
  width?: number;
  height?: number;
  scale?: number;
}

/**
 * Generate PDF from HTML content (with caching).
 * Returns a Buffer for backward compatibility.
 * Use generatePDFCached() to also get cache hit info.
 */
export async function generatePDF(
  html: string,
  options: PDFOptions = {}
): Promise<Buffer> {
  const result = await generatePDFCached(html, options);
  return result.buffer;
}

/**
 * Generate PDF with cache metadata returned alongside the buffer.
 */
export async function generatePDFCached(
  html: string,
  options: PDFOptions = {}
): Promise<{ buffer: Buffer; cacheHit: boolean }> {
  // Check cache first
  evictExpired();
  const key = computeCacheKey(html, options);
  const cached = pdfCache.get(key);
  if (cached && Date.now() - cached.createdAt < PDF_CACHE_TTL_MS) {
    return { buffer: cached.buffer, cacheHit: true };
  }

  const page = await getPage();

  try {
    // Set content
    await page.setContent(html, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // Wait for fonts to load
    await page.waitForTimeout(200);

    // Generate PDF
    const pdf = await page.pdf({
      format: options.format === 'a4' ? 'A4' : 'Letter',
      landscape: options.landscape || false,
      printBackground: true,
      margin: {
        top: options.margin?.top || '0.5in',
        bottom: options.margin?.bottom || '0.5in',
        left: options.margin?.left || '0.5in',
        right: options.margin?.right || '0.5in',
      },
      scale: options.scale || 1,
    });

    const buffer = Buffer.from(pdf);

    // Store in cache
    evictOldestIfFull();
    pdfCache.set(key, { buffer, createdAt: Date.now() });

    return { buffer, cacheHit: false };
  } finally {
    returnPage(page);
  }
}

/**
 * Generate PNG screenshot from HTML content
 */
export async function generatePNG(html: string, options: PNGOptions = {}): Promise<Buffer> {
  const page = await getPage();

  try {
    // Set viewport if dimensions specified
    if (options.width || options.height) {
      await page.setViewportSize({
        width: options.width || 800,
        height: options.height || 1000,
      });
    }

    await page.setContent(html, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // Wait for fonts to load
    await page.waitForTimeout(200);

    const screenshot = await page.screenshot({
      fullPage: true,
      type: 'png',
    });

    return Buffer.from(screenshot);
  } finally {
    returnPage(page);
  }
}

// Keep old function names for backwards compatibility
export const generatePdf = generatePDF;
export const generatePdfCached = generatePDFCached;
export const generatePng = generatePNG;

/**
 * Generate document (wrapper for both PDF and PNG)
 */
export async function generate(
  request: GenerateRequest
): Promise<GenerateResponse> {
  const { html, format, options } = request;

  let buffer: Buffer;

  if (format === "pdf") {
    buffer = await generatePDF(html, { scale: options?.scale });
  } else {
    buffer = await generatePNG(html, options);
  }

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  return {
    url: "placeholder", // Will be set after upload
    format,
    size: buffer.length,
    expiresAt: expiresAt.toISOString(),
  };
}

// Alias exports
export { generatePDF as toPdf, generatePNG as toPng };

// Cleanup on process exit
process.on('beforeExit', async () => {
  for (const page of pagePool) {
    await page.close().catch(() => {});
  }
  if (browser) {
    await browser.close().catch(() => {});
  }
});

// Also handle SIGINT/SIGTERM for graceful shutdown
const cleanup = async () => {
  console.log('Cleaning up Playwright resources...');
  for (const page of pagePool) {
    await page.close().catch(() => {});
  }
  if (browser) {
    await browser.close().catch(() => {});
  }
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
