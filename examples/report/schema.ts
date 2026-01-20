/**
 * Report Schema
 *
 * Business, project, or analytical reports with structured content.
 * Common use cases: project status reports, financial summaries, analysis documents.
 */

export interface ReportData {
  report: {
    /** Report title */
    title: string;
    /** Report subtitle or type */
    subtitle?: string;
    /** Report number or version */
    number?: string;
    /** Report date */
    date: string;
    /** Reporting period (for periodic reports) */
    period?: string;
    /** Report status */
    status?: 'draft' | 'final' | 'confidential';
    /** Classification level */
    classification?: string;
  };

  /** Organization or author information */
  author: {
    /** Author name or department */
    name: string;
    /** Organization name */
    organization?: string;
    /** Logo URL */
    logo?: string;
    /** Contact information */
    contact?: string;
  };

  /** Report recipients */
  recipients?: Array<{
    name: string;
    role?: string;
  }>;

  /** Executive summary */
  executiveSummary?: string;

  /** Main report sections */
  sections: Array<{
    /** Section number */
    number?: string;
    /** Section title */
    title: string;
    /** Section content (markdown supported) */
    content: string;
    /** Subsections */
    subsections?: Array<{
      number?: string;
      title: string;
      content: string;
    }>;
  }>;

  /** Key metrics or KPIs */
  metrics?: Array<{
    /** Metric name */
    name: string;
    /** Current value */
    value: string | number;
    /** Previous period value for comparison */
    previousValue?: string | number;
    /** Change direction */
    trend?: 'up' | 'down' | 'stable';
    /** Whether up is good or bad */
    trendDirection?: 'positive' | 'negative';
    /** Target or goal */
    target?: string | number;
    /** Unit of measurement */
    unit?: string;
  }>;

  /** Data tables */
  tables?: Array<{
    /** Table title */
    title: string;
    /** Column headers */
    headers: string[];
    /** Table rows */
    rows: Array<Array<string | number>>;
    /** Footer notes */
    notes?: string;
  }>;

  /** Charts (placeholder references for rendering) */
  charts?: Array<{
    /** Chart ID for reference */
    id: string;
    /** Chart title */
    title: string;
    /** Chart type */
    type: 'bar' | 'line' | 'pie' | 'area' | 'scatter';
    /** Data for the chart */
    data?: {
      labels: string[];
      datasets: Array<{
        label: string;
        values: number[];
      }>;
    };
  }>;

  /** Key findings or highlights */
  findings?: Array<{
    /** Finding type */
    type?: 'positive' | 'negative' | 'neutral' | 'action';
    /** Finding content */
    content: string;
  }>;

  /** Recommendations */
  recommendations?: Array<{
    /** Priority level */
    priority?: 'high' | 'medium' | 'low';
    /** Recommendation content */
    content: string;
    /** Owner or responsible party */
    owner?: string;
    /** Due date */
    dueDate?: string;
  }>;

  /** Risks and issues */
  risks?: Array<{
    /** Risk description */
    description: string;
    /** Impact level */
    impact?: 'high' | 'medium' | 'low';
    /** Probability */
    probability?: 'high' | 'medium' | 'low';
    /** Mitigation plan */
    mitigation?: string;
    /** Owner */
    owner?: string;
  }>;

  /** Next steps or action items */
  nextSteps?: Array<{
    /** Action item */
    action: string;
    /** Owner */
    owner?: string;
    /** Due date */
    dueDate?: string;
    /** Status */
    status?: 'pending' | 'in_progress' | 'completed';
  }>;

  /** Appendices */
  appendices?: Array<{
    /** Appendix letter/number */
    id: string;
    /** Appendix title */
    title: string;
    /** Appendix content */
    content: string;
  }>;

  /** Footer information */
  footer?: {
    /** Confidentiality notice */
    confidentiality?: string;
    /** Page numbering text */
    pageNumbers?: boolean;
    /** Document version */
    version?: string;
  };
}
