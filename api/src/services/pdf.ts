/**
 * PDF Generation Service
 * Uses Playwright for HTML to PDF conversion
 *
 * Note: Playwright requires separate installation.
 * For production, consider using a dedicated PDF service or
 * running Playwright in a container with browsers pre-installed.
 */

import type { GenerateRequest, GenerateResponse } from "../lib/types.js";

// Playwright types (optional dependency)
interface PlaywrightBrowser {
  newPage(): Promise<PlaywrightPage>;
  close(): Promise<void>;
}

interface PlaywrightPage {
  setContent(html: string, options?: { waitUntil?: string }): Promise<void>;
  pdf(options?: Record<string, unknown>): Promise<Uint8Array>;
  screenshot(options?: Record<string, unknown>): Promise<Uint8Array>;
}

interface PlaywrightModule {
  chromium: {
    launch(options?: { headless?: boolean }): Promise<PlaywrightBrowser>;
  };
}

// Lazy import Playwright to handle cases where it's not installed
let playwright: PlaywrightModule | null = null;

async function getPlaywright(): Promise<PlaywrightModule> {
  if (!playwright) {
    try {
      // Dynamic import to handle optional dependency
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const dynamicImport = new Function("modulePath", "return import(modulePath)");
      playwright = await dynamicImport("playwright") as PlaywrightModule;
    } catch {
      throw new Error(
        "Playwright is not installed. Run: bun add playwright && npx playwright install chromium"
      );
    }
  }
  return playwright;
}

export async function generatePdf(
  html: string,
  options?: GenerateRequest["options"]
): Promise<Buffer> {
  const pw = await getPlaywright();

  const browser = await pw.chromium.launch({
    headless: true,
  });

  try {
    const page = await browser.newPage();

    await page.setContent(html, {
      waitUntil: "networkidle",
    });

    const pdf = await page.pdf({
      format: "Letter",
      printBackground: true,
      margin: {
        top: "0.5in",
        right: "0.5in",
        bottom: "0.5in",
        left: "0.5in",
      },
      scale: options?.scale || 1,
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

export async function generatePng(
  html: string,
  options?: GenerateRequest["options"]
): Promise<Buffer> {
  const pw = await getPlaywright();

  const browser = await pw.chromium.launch({
    headless: true,
  });

  try {
    const page = await browser.newPage();

    await page.setContent(html, {
      waitUntil: "networkidle",
    });

    const screenshot = await page.screenshot({
      fullPage: true,
      type: "png",
      scale: "device",
      viewport: {
        width: options?.width || 800,
        height: options?.height || 1000,
      },
    });

    return Buffer.from(screenshot);
  } finally {
    await browser.close();
  }
}

export async function generate(
  request: GenerateRequest
): Promise<GenerateResponse> {
  const { html, format, options } = request;

  let buffer: Buffer;

  if (format === "pdf") {
    buffer = await generatePdf(html, options);
  } else {
    buffer = await generatePng(html, options);
  }

  // TODO: Upload to Supabase Storage and return URL
  // For now, we'll need to handle this at the route level

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  return {
    url: "placeholder", // Will be set after upload
    format,
    size: buffer.length,
    expiresAt: expiresAt.toISOString(),
  };
}

export { generatePdf as toPdf, generatePng as toPng };
