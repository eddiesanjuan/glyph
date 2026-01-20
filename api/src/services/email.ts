/**
 * Email Service
 * Handles sending emails with PDF attachments via Resend
 */

import { Resend } from 'resend';

// Initialize Resend client (lazy initialization for when API key isn't set)
let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

// =============================================================================
// Types
// =============================================================================

export interface EmailAttachment {
  filename: string;
  content: Buffer;
}

export interface EmailOptions {
  to: string;
  subject: string;
  body: string;
  attachments: EmailAttachment[];
  from?: string;
  replyTo?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// =============================================================================
// Default Templates
// =============================================================================

export const DEFAULT_EMAIL_SUBJECT = 'Your document is ready';

export const DEFAULT_EMAIL_BODY = `
<div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <p>Hello,</p>
  <p>Please find your document attached to this email.</p>
  <p>If you have any questions, please don't hesitate to reach out.</p>
  <p style="margin-top: 30px;">Best regards</p>
</div>
`;

// =============================================================================
// Email Sending
// =============================================================================

/**
 * Send an email with PDF attachment
 */
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  const {
    to,
    subject,
    body,
    attachments,
    from = process.env.EMAIL_FROM || 'Glyph Documents <documents@glyph.you>',
    replyTo,
  } = options;

  // Validate email address format
  if (!isValidEmail(to)) {
    return {
      success: false,
      error: `Invalid email address: ${to}`,
    };
  }

  try {
    const resend = getResendClient();

    // Convert attachments to Resend format
    const resendAttachments = attachments.map(a => ({
      filename: a.filename,
      content: a.content,
    }));

    const result = await resend.emails.send({
      from,
      to: [to],
      subject,
      html: body,
      attachments: resendAttachments,
      ...(replyTo && { replyTo }),
    });

    if (result.error) {
      console.error('[Email] Resend error:', result.error);
      return {
        success: false,
        error: result.error.message || 'Failed to send email',
      };
    }

    console.log(`[Email] Sent successfully to ${to}, messageId: ${result.data?.id}`);

    return {
      success: true,
      messageId: result.data?.id,
    };
  } catch (err) {
    console.error('[Email] Send error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown email error',
    };
  }
}

/**
 * Send PDF via email with customizable template
 */
export async function sendPdfEmail(options: {
  to: string;
  subject: string;
  body: string;
  pdf: Buffer;
  filename: string;
  from?: string;
  replyTo?: string;
}): Promise<EmailResult> {
  return sendEmail({
    to: options.to,
    subject: options.subject,
    body: options.body,
    attachments: [
      {
        filename: options.filename,
        content: options.pdf,
      },
    ],
    from: options.from,
    replyTo: options.replyTo,
  });
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Basic email validation
 */
function isValidEmail(email: string): boolean {
  // Basic regex for email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Check if Resend is configured
 */
export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}
