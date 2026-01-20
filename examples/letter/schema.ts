/**
 * Letter Schema
 *
 * Formal business letters for professional correspondence.
 * Common use cases: cover letters, recommendation letters, official notices.
 */

export interface LetterData {
  letter: {
    /** Letter date */
    date: string;
    /** Reference number (optional) */
    reference?: string;
    /** Subject line */
    subject?: string;
    /** Letter type for formatting hints */
    type?: 'formal' | 'semi-formal' | 'informal';
    /** Delivery method */
    delivery?: 'mail' | 'email' | 'hand-delivered' | 'certified';
  };

  /** Sender information */
  sender: {
    /** Sender name */
    name: string;
    /** Sender title/position */
    title?: string;
    /** Company/organization */
    organization?: string;
    /** Logo URL */
    logo?: string;
    /** Full address */
    address?: string;
    /** Phone number */
    phone?: string;
    /** Email */
    email?: string;
    /** Website */
    website?: string;
  };

  /** Recipient information */
  recipient: {
    /** Recipient name */
    name: string;
    /** Recipient title */
    title?: string;
    /** Company/organization */
    organization?: string;
    /** Department */
    department?: string;
    /** Full address */
    address?: string;
  };

  /** Letter content */
  content: {
    /** Salutation (e.g., "Dear Mr. Smith:") */
    salutation: string;
    /** Opening paragraph */
    opening: string;
    /** Body paragraphs */
    body: string[];
    /** Closing paragraph */
    closing: string;
    /** Complimentary close (e.g., "Sincerely,") */
    signoff: string;
  };

  /** Signature section */
  signature?: {
    /** Show signature line */
    showLine?: boolean;
    /** Signature image URL */
    imageUrl?: string;
    /** Typed name under signature */
    name?: string;
    /** Title under name */
    title?: string;
  };

  /** Enclosures listed at bottom */
  enclosures?: string[];

  /** CC recipients */
  cc?: Array<{
    name: string;
    organization?: string;
  }>;

  /** Postscript */
  ps?: string;
}
