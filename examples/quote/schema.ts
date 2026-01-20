/**
 * Quote/Estimate Schema
 *
 * Proposals sent before work begins, outlining scope and pricing.
 * Common use cases: service estimates, project proposals, price quotes.
 */

export interface QuoteData {
  quote: {
    /** Unique quote identifier (e.g., "Q-2024-001") */
    number: string;
    /** Quote creation date */
    date: string;
    /** Expiration date for the quote */
    validUntil: string;
    /** Current quote status */
    status?: 'draft' | 'sent' | 'accepted' | 'declined' | 'expired';
    /** Reference number for follow-up */
    referenceNumber?: string;
    /** Project or job name */
    projectName?: string;
  };

  company: {
    /** Your business name */
    name: string;
    /** Company logo URL */
    logo?: string;
    /** Full business address */
    address?: string;
    /** Contact email */
    email?: string;
    /** Contact phone */
    phone?: string;
    /** License or certification numbers */
    license?: string;
    /** Website URL */
    website?: string;
  };

  client: {
    /** Client name (person or business) */
    name: string;
    /** Company name if different from client name */
    company?: string;
    /** Client address */
    address?: string;
    /** Client email */
    email?: string;
    /** Client phone */
    phone?: string;
  };

  /** Optional project or job location (if different from client address) */
  jobSite?: {
    /** Site name or identifier */
    name?: string;
    /** Full address */
    address: string;
    /** Access or scheduling notes */
    notes?: string;
  };

  lineItems: Array<{
    /** Service or product description */
    description: string;
    /** Extended details or specifications */
    details?: string;
    /** Quantity */
    quantity: number | string;
    /** Unit of measure */
    unit?: string;
    /** Price per unit */
    unitPrice: number;
    /** Line total */
    total: number;
    /** Whether this item is optional/add-on */
    optional?: boolean;
  }>;

  /** Optional grouped sections for complex quotes */
  sections?: Array<{
    /** Section title (e.g., "Phase 1: Discovery") */
    title: string;
    /** Section description */
    description?: string;
    /** Line items within this section */
    items: Array<{
      description: string;
      details?: string;
      quantity: number | string;
      unit?: string;
      unitPrice: number;
      total: number;
      optional?: boolean;
    }>;
    /** Section subtotal */
    subtotal: number;
  }>;

  totals: {
    /** Sum of all line items */
    subtotal: number;
    /** Discount amount */
    discount?: number;
    /** Discount percentage */
    discountPercent?: number;
    /** Tax amount */
    tax?: number;
    /** Tax rate */
    taxRate?: number;
    /** Final quoted total */
    total: number;
    /** Deposit required to begin */
    depositRequired?: number;
    /** Deposit percentage */
    depositPercent?: number;
  };

  /** Scope of work description */
  scope?: string;

  /** What's NOT included */
  exclusions?: string[];

  /** Important assumptions */
  assumptions?: string[];

  /** Estimated timeline */
  timeline?: {
    /** Estimated start date */
    startDate?: string;
    /** Estimated completion date */
    completionDate?: string;
    /** Duration description */
    duration?: string;
    /** Milestone schedule */
    milestones?: Array<{
      name: string;
      date?: string;
      description?: string;
    }>;
  };

  /** Terms and conditions */
  terms?: string[];

  /** Additional notes */
  notes?: string;

  /** Acceptance signature section */
  acceptance?: {
    /** Show signature lines */
    showSignature: boolean;
    /** Acceptance text/disclaimer */
    acceptanceText?: string;
    /** Date signed */
    signedDate?: string;
    /** Printed name */
    printedName?: string;
  };
}
