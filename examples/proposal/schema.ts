/**
 * Proposal Schema
 *
 * Business proposals for pitching services, projects, or partnerships.
 * Common use cases: consulting proposals, project bids, partnership pitches.
 */

export interface ProposalData {
  proposal: {
    /** Proposal title */
    title: string;
    /** Proposal number */
    number?: string;
    /** Proposal date */
    date: string;
    /** Valid until date */
    validUntil: string;
    /** Proposal type */
    type?: 'project' | 'consulting' | 'partnership' | 'grant' | 'rfp_response';
    /** Version number */
    version?: string;
  };

  /** Company/proposer information */
  company: {
    /** Company name */
    name: string;
    /** Logo URL */
    logo?: string;
    /** Company tagline */
    tagline?: string;
    /** Address */
    address?: string;
    /** Contact email */
    email?: string;
    /** Phone */
    phone?: string;
    /** Website */
    website?: string;
  };

  /** Client/recipient information */
  client: {
    /** Client name */
    name: string;
    /** Company name */
    company?: string;
    /** Title */
    title?: string;
    /** Email */
    email?: string;
    /** Phone */
    phone?: string;
  };

  /** Executive summary */
  executiveSummary: string;

  /** Problem statement or opportunity description */
  problemStatement?: string;

  /** Proposed solution */
  solution: {
    /** Solution overview */
    overview: string;
    /** Key features or components */
    features?: Array<{
      title: string;
      description: string;
    }>;
    /** Unique value proposition */
    differentiators?: string[];
  };

  /** Project scope */
  scope: Array<{
    /** Phase or section name */
    phase: string;
    /** Phase description */
    description: string;
    /** Deliverables for this phase */
    deliverables: string[];
    /** Duration estimate */
    duration?: string;
  }>;

  /** Timeline */
  timeline: {
    /** Estimated start date */
    startDate?: string;
    /** Estimated end date */
    endDate?: string;
    /** Total duration */
    duration?: string;
    /** Key milestones */
    milestones: Array<{
      name: string;
      description?: string;
      date?: string;
      deliverables?: string[];
    }>;
  };

  /** Pricing */
  pricing: {
    /** Pricing model */
    model?: 'fixed' | 'hourly' | 'retainer' | 'milestone' | 'value_based';
    /** Price breakdown */
    items: Array<{
      description: string;
      details?: string;
      quantity?: number | string;
      rate?: number;
      price: number;
      optional?: boolean;
    }>;
    /** Total price */
    total: number;
    /** Discount if applicable */
    discount?: number;
    /** Discount description */
    discountNote?: string;
    /** Payment terms */
    paymentTerms: string;
    /** Payment schedule */
    paymentSchedule?: Array<{
      milestone: string;
      percentage: number;
      amount: number;
    }>;
  };

  /** Team members */
  team?: Array<{
    /** Team member name */
    name: string;
    /** Role in this project */
    role: string;
    /** Photo URL */
    photo?: string;
    /** Brief bio */
    bio?: string;
    /** Relevant experience */
    experience?: string[];
  }>;

  /** Case studies or portfolio */
  caseStudies?: Array<{
    /** Project name */
    name: string;
    /** Client name */
    client?: string;
    /** Project description */
    description: string;
    /** Key results */
    results?: string[];
    /** Image URL */
    image?: string;
    /** Testimonial */
    testimonial?: {
      quote: string;
      author: string;
      title?: string;
    };
  }>;

  /** Why choose us section */
  whyUs?: {
    /** Heading */
    heading?: string;
    /** Reasons/points */
    points: string[];
  };

  /** Terms and conditions */
  terms: string[];

  /** What's NOT included */
  exclusions?: string[];

  /** Assumptions */
  assumptions?: string[];

  /** Next steps */
  nextSteps?: Array<{
    step: number;
    description: string;
  }>;

  /** Acceptance section */
  acceptance?: {
    /** Show signature lines */
    showSignature: boolean;
    /** Acceptance text */
    acceptanceText?: string;
  };

  /** Appendices */
  appendices?: Array<{
    title: string;
    content: string;
  }>;
}
