/**
 * AI Service - Claude Integration
 * Handles HTML modifications via natural language
 */

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ModifyResult {
  html: string;
  changes: string[];
  tokensUsed: number;
}

const SYSTEM_PROMPT = `You are an expert HTML/CSS developer modifying a PDF document template.

CRITICAL RULES:
1. NEVER change data values (prices, quantities, names, dates, etc.) - these use Mustache syntax like {{client.name}}
2. NEVER remove required sections (header, line-items, totals, footer)
3. ONLY modify styling, layout, colors, fonts, spacing
4. Keep all data-glyph-region attributes intact
5. Output ONLY the complete modified HTML document, nothing else
6. Preserve all Mustache placeholders exactly as they appear

You may:
- Change colors, backgrounds, borders
- Modify fonts, sizes, weights
- Adjust spacing, margins, padding
- Rearrange layout within sections
- Add visual elements (borders, shadows, gradients)
- Modify table styling
- Add or change CSS classes`;

export async function modifyTemplate(
  currentHtml: string,
  userPrompt: string,
  region?: string
): Promise<ModifyResult> {
  const contextPrompt = region
    ? `The user selected the "${region}" section and wants: ${userPrompt}`
    : userPrompt;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Current HTML document:

\`\`\`html
${currentHtml}
\`\`\`

Modification request: ${contextPrompt}

Output the complete modified HTML document. After the HTML, on a new line, write "CHANGES:" followed by a brief bullet list of what you changed.`,
      },
    ],
  });

  const responseText =
    message.content[0].type === "text" ? message.content[0].text : "";

  // Parse response - extract HTML and changes
  const htmlMatch = responseText.match(/```html\n([\s\S]*?)\n```/);
  let html = htmlMatch ? htmlMatch[1] : responseText;

  // If no code block, try to extract HTML directly
  if (!htmlMatch) {
    const docStart =
      responseText.indexOf("<!DOCTYPE html>") !== -1
        ? responseText.indexOf("<!DOCTYPE html>")
        : responseText.indexOf("<html");
    const docEnd = responseText.lastIndexOf("</html>") + 7;
    if (docStart !== -1 && docEnd > docStart) {
      html = responseText.slice(docStart, docEnd);
    }
  }

  // Extract changes list
  const changesMatch = responseText.match(/CHANGES:\s*([\s\S]*?)(?:$|```)/);
  const changes: string[] = [];
  if (changesMatch) {
    const changeLines = changesMatch[1].trim().split("\n");
    for (const line of changeLines) {
      const cleanLine = line.replace(/^[-*•]\s*/, "").trim();
      if (cleanLine) changes.push(cleanLine);
    }
  }

  return {
    html,
    changes: changes.length > 0 ? changes : ["Template modified as requested"],
    tokensUsed: message.usage.input_tokens + message.usage.output_tokens,
  };
}

// Validate that modification didn't break critical elements
export function validateModification(
  originalHtml: string,
  modifiedHtml: string
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  // Check all data-glyph-region attributes are preserved
  const originalRegions: string[] =
    originalHtml.match(/data-glyph-region="[^"]+"/g) || [];
  const modifiedRegions: string[] =
    modifiedHtml.match(/data-glyph-region="[^"]+"/g) || [];

  for (const region of originalRegions) {
    if (!modifiedRegions.includes(region)) {
      issues.push(`Missing region: ${region}`);
    }
  }

  // Check Mustache placeholders are preserved
  const originalPlaceholders = originalHtml.match(/\{\{[^}]+\}\}/g) || [];
  const modifiedPlaceholders = modifiedHtml.match(/\{\{[^}]+\}\}/g) || [];

  const originalSet = new Set(originalPlaceholders);
  const modifiedSet = new Set(modifiedPlaceholders);

  for (const placeholder of originalSet) {
    if (!modifiedSet.has(placeholder)) {
      // Allow removal of conditional blocks but not data placeholders
      if (!placeholder.startsWith("{{#") && !placeholder.startsWith("{{/")) {
        issues.push(`Missing placeholder: ${placeholder}`);
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

// Legacy function for backwards compatibility
export async function modifyHtml(request: {
  html: string;
  instruction: string;
  context?: unknown;
}): Promise<{ html: string; changes: string[] }> {
  const result = await modifyTemplate(request.html, request.instruction);
  return {
    html: result.html,
    changes: result.changes,
  };
}

export async function generateHtmlFromPrompt(prompt: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8192,
    system: `You are an expert HTML/CSS designer. Generate beautiful, professional HTML documents.
Use modern CSS with flexbox/grid. Include all styles inline or in a <style> block.
Return only the HTML document, no explanations.`,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const textContent = response.content.find((block) => block.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error("No text response from Claude");
  }

  return textContent.text;
}
