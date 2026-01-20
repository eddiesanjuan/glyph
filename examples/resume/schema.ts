/**
 * Resume/CV Schema
 *
 * Professional profiles for job applications and career presentations.
 * Common use cases: job applications, portfolio websites, LinkedIn exports.
 */

export interface ResumeData {
  personal: {
    /** Full name */
    name: string;
    /** Professional title/headline */
    title?: string;
    /** Email address */
    email: string;
    /** Phone number */
    phone?: string;
    /** City, State or full address */
    location?: string;
    /** Personal website URL */
    website?: string;
    /** LinkedIn profile URL or username */
    linkedin?: string;
    /** GitHub profile URL or username */
    github?: string;
    /** Twitter/X handle */
    twitter?: string;
    /** Portfolio URL */
    portfolio?: string;
    /** Professional summary or objective */
    summary?: string;
  };

  experience: Array<{
    /** Company or organization name */
    company: string;
    /** Job title */
    title: string;
    /** Work location */
    location?: string;
    /** Start date (e.g., "March 2021" or "2021-03") */
    startDate: string;
    /** End date (null or undefined for current position) */
    endDate?: string | null;
    /** Whether this is the current position */
    current?: boolean;
    /** Job description or responsibilities */
    description?: string;
    /** Key achievements and accomplishments */
    highlights: string[];
    /** Technologies or tools used */
    technologies?: string[];
  }>;

  education: Array<{
    /** School or university name */
    institution: string;
    /** Degree type (e.g., "Bachelor of Science") */
    degree: string;
    /** Field of study or major */
    field?: string;
    /** Graduation date or expected graduation */
    graduationDate?: string;
    /** GPA if notable */
    gpa?: string;
    /** Location */
    location?: string;
    /** Honors, activities, or relevant coursework */
    highlights?: string[];
  }>;

  skills: Array<{
    /** Skill category (e.g., "Programming Languages", "Tools") */
    category: string;
    /** Skills within this category */
    items: string[];
  }>;

  certifications?: Array<{
    /** Certification name */
    name: string;
    /** Issuing organization */
    issuer: string;
    /** Date obtained */
    date?: string;
    /** Expiration date if applicable */
    expirationDate?: string;
    /** Credential ID or URL */
    credentialId?: string;
    /** Verification URL */
    url?: string;
  }>;

  projects?: Array<{
    /** Project name */
    name: string;
    /** Project description */
    description: string;
    /** Project URL or repository */
    url?: string;
    /** Technologies used */
    technologies?: string[];
    /** Key features or accomplishments */
    highlights?: string[];
    /** Date or date range */
    date?: string;
  }>;

  publications?: Array<{
    /** Publication title */
    title: string;
    /** Publisher or journal */
    publisher: string;
    /** Publication date */
    date: string;
    /** URL to publication */
    url?: string;
    /** Co-authors */
    coAuthors?: string[];
  }>;

  awards?: Array<{
    /** Award name */
    name: string;
    /** Issuing organization */
    issuer: string;
    /** Date received */
    date: string;
    /** Description */
    description?: string;
  }>;

  languages?: Array<{
    /** Language name */
    name: string;
    /** Proficiency level */
    proficiency: 'native' | 'fluent' | 'professional' | 'conversational' | 'basic';
  }>;

  volunteer?: Array<{
    /** Organization name */
    organization: string;
    /** Role/title */
    role: string;
    /** Date range */
    startDate: string;
    endDate?: string;
    /** Description */
    description?: string;
  }>;

  /** Additional sections for custom content */
  customSections?: Array<{
    /** Section title */
    title: string;
    /** Content items */
    items: Array<{
      title?: string;
      description: string;
      date?: string;
    }>;
  }>;
}
