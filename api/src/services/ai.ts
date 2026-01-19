/**
 * AI Service - Claude Integration
 * Handles HTML modifications via natural language
 */

import Anthropic from "@anthropic-ai/sdk";
import type { ModifyRequest, ModifyResponse } from "../lib/types.js";

const anthropic = new Anthropic();

const SYSTEM_PROMPT = `You are an expert HTML/CSS editor. You receive HTML documents and modification instructions.

Your job is to:
1. Understand the user's modification request
2. Apply the changes to the HTML
3. Return the modified HTML along with a summary of changes

Rules:
- Preserve the overall structure unless explicitly asked to change it
- Keep all existing content unless told to remove it
- Use inline styles or add to existing <style> blocks
- Ensure the HTML remains valid and well-formed
- Focus on visual and structural changes, not adding JavaScript

Return your response in this exact JSON format:
{
  "html": "the complete modified HTML document",
  "changes": ["list", "of", "changes", "made"]
}`;

export async function modifyHtml(request: ModifyRequest): Promise<ModifyResponse> {
  const { html, instruction, context } = request;

  const userMessage = `Here is the HTML document to modify:

\`\`\`html
${html}
\`\`\`

${context ? `Context about the document data: ${JSON.stringify(context, null, 2)}` : ""}

Modification request: ${instruction}

Apply the requested changes and return the result as JSON.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: userMessage,
      },
    ],
  });

  // Extract text content
  const textContent = response.content.find((block) => block.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error("No text response from Claude");
  }

  // Parse JSON from response
  const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Could not parse JSON response from Claude");
  }

  const result = JSON.parse(jsonMatch[0]) as ModifyResponse;
  return result;
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
