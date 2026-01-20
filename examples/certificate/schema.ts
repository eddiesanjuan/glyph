/**
 * Certificate Schema
 *
 * Completion certificates, awards, and recognition documents.
 * Common use cases: course completion, professional certifications, awards, achievements.
 */

export interface CertificateData {
  certificate: {
    /** Certificate title */
    title: string;
    /** Unique certificate number */
    number?: string;
    /** Date issued */
    issueDate: string;
    /** Expiration date (if applicable) */
    expirationDate?: string;
    /** Certificate type */
    type?: 'completion' | 'achievement' | 'award' | 'license' | 'accreditation' | 'membership';
  };

  /** Issuing organization */
  issuer: {
    /** Organization name */
    name: string;
    /** Logo URL */
    logo?: string;
    /** Tagline or description */
    tagline?: string;
    /** Website */
    website?: string;
    /** Accreditation or authorization text */
    accreditation?: string;
  };

  /** Certificate recipient */
  recipient: {
    /** Full name */
    name: string;
    /** Title or designation */
    title?: string;
    /** Organization/company */
    organization?: string;
    /** Photo URL (for ID-style certificates) */
    photo?: string;
  };

  /** Achievement details */
  achievement: {
    /** What was achieved */
    description: string;
    /** Extended description or course details */
    details?: string;
    /** Credential earned */
    credential?: string;
    /** Credit hours or CEUs */
    credits?: string;
    /** Level or grade achieved */
    level?: string;
    /** Score or percentage */
    score?: string;
    /** Skills or competencies demonstrated */
    skills?: string[];
  };

  /** Course or program details */
  program?: {
    /** Program name */
    name: string;
    /** Program description */
    description?: string;
    /** Duration */
    duration?: string;
    /** Start date */
    startDate?: string;
    /** End date */
    endDate?: string;
    /** Instructor or facilitator */
    instructor?: string;
    /** Location */
    location?: string;
  };

  /** Authorized signatures */
  signatures: Array<{
    /** Signatory name */
    name: string;
    /** Signatory title */
    title: string;
    /** Signature image URL */
    signatureImage?: string;
    /** Organization */
    organization?: string;
  }>;

  /** Official seal or badge */
  seal?: {
    /** Seal image URL */
    imageUrl?: string;
    /** Seal type */
    type?: 'gold' | 'silver' | 'bronze' | 'official' | 'accredited';
  };

  /** Verification information */
  verification?: {
    /** Verification URL */
    url?: string;
    /** Verification code */
    code?: string;
    /** QR code for verification */
    qrCode?: boolean;
    /** Blockchain/ledger verification */
    ledgerHash?: string;
  };

  /** Additional recognitions or badges */
  badges?: Array<{
    /** Badge name */
    name: string;
    /** Badge image URL */
    imageUrl?: string;
  }>;

  /** Renewal information */
  renewal?: {
    /** Renewal requirements */
    requirements?: string;
    /** Continuing education needed */
    continuingEducation?: string;
    /** Renewal URL */
    renewalUrl?: string;
  };

  /** Legal or disclaimer text */
  disclaimer?: string;
}
