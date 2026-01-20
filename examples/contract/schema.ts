/**
 * Contract Schema
 *
 * Service agreements and legally-binding contracts between parties.
 * Common use cases: freelance agreements, service contracts, NDAs, rental agreements.
 */

export interface ContractData {
  contract: {
    /** Contract title */
    title: string;
    /** Contract/agreement number */
    number?: string;
    /** Effective date */
    effectiveDate: string;
    /** Contract end date (if term-based) */
    endDate?: string;
    /** Contract duration description */
    term?: string;
    /** Contract type for categorization */
    type?: 'service' | 'nda' | 'employment' | 'rental' | 'sales' | 'partnership' | 'other';
    /** Governing law jurisdiction */
    jurisdiction?: string;
  };

  parties: {
    /** First party (typically the service provider or company) */
    party1: {
      /** Legal name */
      name: string;
      /** Type of entity */
      type?: 'individual' | 'company' | 'llc' | 'corporation' | 'partnership';
      /** Business/legal address */
      address?: string;
      /** Email for notices */
      email?: string;
      /** Phone */
      phone?: string;
      /** Representative name if company */
      representative?: string;
      /** Representative title */
      representativeTitle?: string;
    };
    /** Second party (typically the client) */
    party2: {
      name: string;
      type?: 'individual' | 'company' | 'llc' | 'corporation' | 'partnership';
      address?: string;
      email?: string;
      phone?: string;
      representative?: string;
      representativeTitle?: string;
    };
  };

  /** Recitals/Background section */
  recitals?: string[];

  /** Main contract sections */
  sections: Array<{
    /** Section number (e.g., "1", "2.1") */
    number?: string;
    /** Section title */
    title: string;
    /** Section content (can include subsections) */
    content: string;
    /** Subsections */
    subsections?: Array<{
      number?: string;
      title?: string;
      content: string;
    }>;
  }>;

  /** Payment/compensation terms */
  compensation?: {
    /** Payment amount or description */
    amount?: number | string;
    /** Payment schedule */
    schedule?: string;
    /** Payment method */
    method?: string;
    /** Late payment terms */
    latePayment?: string;
    /** Expenses policy */
    expenses?: string;
  };

  /** Termination conditions */
  termination?: {
    /** Notice period required */
    noticePeriod?: string;
    /** Termination for cause conditions */
    forCause?: string[];
    /** Termination for convenience */
    forConvenience?: string;
    /** Effects of termination */
    effects?: string[];
  };

  /** Exhibits/attachments reference */
  exhibits?: Array<{
    /** Exhibit letter/number (e.g., "A", "1") */
    id: string;
    /** Exhibit title */
    title: string;
    /** Exhibit description */
    description?: string;
  }>;

  /** Signature section */
  signatures: {
    /** Whether to show signature lines */
    showLines: boolean;
    /** Number of witness lines */
    witnessCount?: number;
    /** Whether notarization is required */
    notarization?: boolean;
    /** Custom signature block text */
    signatureText?: string;
    /** Pre-filled signature data */
    party1Signature?: {
      name?: string;
      title?: string;
      date?: string;
    };
    party2Signature?: {
      name?: string;
      title?: string;
      date?: string;
    };
  };

  /** Footer/boilerplate text */
  footer?: string;
}
