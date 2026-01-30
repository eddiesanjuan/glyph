/**
 * Brand Extraction Service
 *
 * Extracts brand attributes (colors, fonts, layout) from PDF, image, or website URL
 * using Claude Vision API.
 */

import Anthropic from "@anthropic-ai/sdk";
import { chromium, Browser, Page } from 'playwright';
import { logger } from "./logger.js";

// Reuse browser pooling pattern from pdf.ts
let browser: Browser | null = null;
const pagePool: Page[] = [];
const MAX_POOL_SIZE = 4;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Brand attributes extracted from visual content
 */
export interface BrandAttributes {
  colors: {
    primary: string;      // Hex color
    secondary?: string;
    accent?: string;
    background?: string;
    text?: string;
  };
  fonts: {
    heading?: string;     // Font name or web-safe fallback
    body?: string;
  };
  layout: {
    style: 'modern' | 'traditional' | 'minimal' | 'bold' | 'corporate';
    hasLogo: boolean;
    logoDescription?: string;
  };
  companyName?: string;
  industry?: string;
  confidence: number;     // 0-1
}

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

  if (pagePool.length > 0) {
    const page = pagePool.pop()!;
    return page;
  }

  const context = await b.newContext({
    viewport: { width: 1200, height: 1600 },
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

/**
 * Vision prompt for brand extraction
 */
const BRAND_EXTRACTION_PROMPT = `You are a brand identity analyst. Analyze this image and extract brand attributes.

Return a JSON object with this exact structure:
{
  "colors": {
    "primary": "#HEXCODE",
    "secondary": "#HEXCODE or null",
    "accent": "#HEXCODE or null",
    "background": "#HEXCODE",
    "text": "#HEXCODE"
  },
  "fonts": {
    "heading": "font description or web-safe fallback",
    "body": "font description or web-safe fallback"
  },
  "layout": {
    "style": "modern" | "traditional" | "minimal" | "bold" | "corporate",
    "hasLogo": true | false,
    "logoDescription": "brief description or null"
  },
  "companyName": "extracted name or null",
  "industry": "inferred industry or null",
  "confidence": 0.0-1.0
}

Rules:
1. Colors MUST be valid hex codes (e.g., "#4A90D9")
2. For fonts, suggest web-safe alternatives if unsure
3. Style should match overall aesthetic
4. Be conservative - only extract what you clearly see
5. Return ONLY the JSON object, no markdown`;

/**
 * Supported media types for image extraction
 */
type SupportedMediaType = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';

/**
 * Validate media type is supported by Claude Vision API
 */
function isValidMediaType(mediaType: string): mediaType is SupportedMediaType {
  return ['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(mediaType);
}

/**
 * Parse JSON response from Claude, handling potential markdown wrapping
 */
function parseJsonResponse(text: string): BrandAttributes {
  let jsonStr = text.trim();

  // Remove markdown code block if present
  if (jsonStr.startsWith('```json')) {
    jsonStr = jsonStr.slice(7);
  } else if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.slice(3);
  }
  if (jsonStr.endsWith('```')) {
    jsonStr = jsonStr.slice(0, -3);
  }
  jsonStr = jsonStr.trim();

  const parsed = JSON.parse(jsonStr);

  // Validate and normalize the response
  return validateBrandAttributes(parsed);
}

/**
 * Validate and normalize brand attributes
 */
function validateBrandAttributes(data: unknown): BrandAttributes {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid brand attributes: expected object');
  }

  const obj = data as Record<string, unknown>;

  // Validate colors
  const colors = obj.colors as Record<string, unknown> | undefined;
  if (!colors || typeof colors !== 'object') {
    throw new Error('Invalid brand attributes: missing colors');
  }
  if (!colors.primary || typeof colors.primary !== 'string') {
    throw new Error('Invalid brand attributes: missing primary color');
  }

  // Validate layout
  const layout = obj.layout as Record<string, unknown> | undefined;
  if (!layout || typeof layout !== 'object') {
    throw new Error('Invalid brand attributes: missing layout');
  }

  const validStyles = ['modern', 'traditional', 'minimal', 'bold', 'corporate'];
  if (!validStyles.includes(layout.style as string)) {
    layout.style = 'modern'; // Default fallback
  }

  // Validate confidence
  let confidence = typeof obj.confidence === 'number' ? obj.confidence : 0.5;
  confidence = Math.max(0, Math.min(1, confidence));

  return {
    colors: {
      primary: normalizeHexColor(colors.primary as string),
      secondary: colors.secondary ? normalizeHexColor(colors.secondary as string) : undefined,
      accent: colors.accent ? normalizeHexColor(colors.accent as string) : undefined,
      background: colors.background ? normalizeHexColor(colors.background as string) : undefined,
      text: colors.text ? normalizeHexColor(colors.text as string) : undefined,
    },
    fonts: {
      heading: (obj.fonts as Record<string, unknown>)?.heading as string | undefined,
      body: (obj.fonts as Record<string, unknown>)?.body as string | undefined,
    },
    layout: {
      style: layout.style as BrandAttributes['layout']['style'],
      hasLogo: Boolean(layout.hasLogo),
      logoDescription: layout.logoDescription as string | undefined,
    },
    companyName: obj.companyName as string | undefined,
    industry: obj.industry as string | undefined,
    confidence,
  };
}

/**
 * Normalize hex color to standard format
 */
function normalizeHexColor(color: string): string {
  if (!color) return '#000000';

  let hex = color.trim();

  // Add # if missing
  if (!hex.startsWith('#')) {
    hex = '#' + hex;
  }

  // Expand shorthand (e.g., #ABC -> #AABBCC)
  if (hex.length === 4) {
    hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
  }

  // Validate format
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) {
    logger.warn(`Invalid hex color: ${color}, defaulting to #000000`);
    return '#000000';
  }

  return hex.toUpperCase();
}

/**
 * Extract brand attributes from an image buffer
 */
export async function extractBrandFromImage(
  imageBuffer: Buffer,
  mediaType: string
): Promise<BrandAttributes> {
  const startTime = Date.now();

  if (!isValidMediaType(mediaType)) {
    throw new Error(`Unsupported media type: ${mediaType}. Supported types: image/png, image/jpeg, image/webp, image/gif`);
  }

  const base64Data = imageBuffer.toString('base64');

  logger.info('[BrandExtraction] Analyzing image', {
    mediaType,
    sizeBytes: imageBuffer.length,
  });

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Data,
              },
            },
            {
              type: 'text',
              text: BRAND_EXTRACTION_PROMPT,
            },
          ],
        },
      ],
    });

    const textContent = response.content.find(block => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude Vision API');
    }

    const attributes = parseJsonResponse(textContent.text);

    logger.info('[BrandExtraction] Extraction complete', {
      durationMs: Date.now() - startTime,
      confidence: attributes.confidence,
      companyName: attributes.companyName,
    });

    return attributes;
  } catch (error) {
    logger.error('[BrandExtraction] Failed to extract brand from image', {
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
    });
    throw error;
  }
}

/**
 * Extract brand attributes from a website URL
 * Takes a screenshot of the page and analyzes it
 */
export async function extractBrandFromURL(url: string): Promise<BrandAttributes> {
  const startTime = Date.now();

  logger.info('[BrandExtraction] Capturing screenshot from URL', { url });

  const page = await getPage();

  try {
    // Set a larger viewport for better brand capture
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // Wait for fonts and images to load
    await page.waitForTimeout(1000);

    const screenshot = await page.screenshot({
      fullPage: false, // Just the viewport - usually contains hero/branding
      type: 'png',
    });

    const pngBuffer = Buffer.from(screenshot);

    logger.info('[BrandExtraction] Screenshot captured', {
      url,
      durationMs: Date.now() - startTime,
      sizeBytes: pngBuffer.length,
    });

    return await extractBrandFromImage(pngBuffer, 'image/png');
  } catch (error) {
    logger.error('[BrandExtraction] Failed to extract brand from URL', {
      url,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
    });
    throw error;
  } finally {
    returnPage(page);
  }
}

/**
 * Extract brand attributes from a PDF buffer
 * Renders the PDF in Chromium and captures a screenshot
 */
export async function extractBrandFromPDF(pdfBuffer: Buffer): Promise<BrandAttributes> {
  const startTime = Date.now();

  logger.info('[BrandExtraction] Rendering PDF for analysis', {
    sizeBytes: pdfBuffer.length,
  });

  const page = await getPage();

  try {
    // Convert PDF buffer to data URL
    const base64Pdf = pdfBuffer.toString('base64');
    const dataUrl = `data:application/pdf;base64,${base64Pdf}`;

    // Set viewport for PDF rendering
    await page.setViewportSize({ width: 1200, height: 1600 });

    // Navigate to the PDF data URL - Chromium renders PDFs natively
    await page.goto(dataUrl, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // Wait for PDF to render
    await page.waitForTimeout(2000);

    // Screenshot the rendered PDF
    const screenshot = await page.screenshot({
      fullPage: false,
      type: 'png',
    });

    const pngBuffer = Buffer.from(screenshot);

    logger.info('[BrandExtraction] PDF rendered and captured', {
      durationMs: Date.now() - startTime,
      screenshotSizeBytes: pngBuffer.length,
    });

    return await extractBrandFromImage(pngBuffer, 'image/png');
  } catch (error) {
    logger.error('[BrandExtraction] Failed to extract brand from PDF', {
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
    });
    throw error;
  } finally {
    returnPage(page);
  }
}

// Cleanup on process exit
process.on('beforeExit', async () => {
  for (const page of pagePool) {
    await page.close().catch(() => {});
  }
  if (browser) {
    await browser.close().catch(() => {});
  }
});
