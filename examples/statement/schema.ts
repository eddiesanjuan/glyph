/**
 * Statement Schema
 *
 * Account statements showing transactions and balances over a period.
 * Common use cases: customer account statements, billing statements, activity summaries.
 */

export interface StatementData {
  statement: {
    /** Statement number or ID */
    number?: string;
    /** Statement date */
    date: string;
    /** Statement period start */
    periodStart: string;
    /** Statement period end */
    periodEnd: string;
    /** Account number */
    accountNumber?: string;
    /** Statement type */
    type?: 'customer' | 'billing' | 'activity' | 'reconciliation';
  };

  /** Company issuing the statement */
  company: {
    /** Company name */
    name: string;
    /** Logo URL */
    logo?: string;
    /** Address */
    address?: string;
    /** Phone */
    phone?: string;
    /** Email */
    email?: string;
    /** Website */
    website?: string;
  };

  /** Account holder information */
  customer: {
    /** Customer name */
    name: string;
    /** Account number */
    accountNumber?: string;
    /** Address */
    address?: string;
    /** Email */
    email?: string;
    /** Phone */
    phone?: string;
  };

  /** Account summary */
  summary: {
    /** Balance at period start */
    previousBalance: number;
    /** Total new charges */
    newCharges?: number;
    /** Total payments received */
    payments?: number;
    /** Total credits/adjustments */
    credits?: number;
    /** Finance charges */
    financeCharges?: number;
    /** Current balance */
    currentBalance: number;
    /** Minimum payment due */
    minimumPayment?: number;
    /** Payment due date */
    paymentDueDate?: string;
    /** Amount past due */
    pastDue?: number;
  };

  /** Aging breakdown */
  aging?: {
    /** Current (not yet due) */
    current: number;
    /** 1-30 days past due */
    days1to30: number;
    /** 31-60 days past due */
    days31to60: number;
    /** 61-90 days past due */
    days61to90: number;
    /** Over 90 days past due */
    over90: number;
  };

  /** Transaction history */
  transactions: Array<{
    /** Transaction date */
    date: string;
    /** Transaction type */
    type: 'charge' | 'payment' | 'credit' | 'adjustment' | 'finance_charge';
    /** Reference number */
    reference?: string;
    /** Description */
    description: string;
    /** Charge amount */
    charge?: number;
    /** Payment/credit amount */
    payment?: number;
    /** Running balance */
    balance?: number;
  }>;

  /** Outstanding invoices */
  openInvoices?: Array<{
    /** Invoice number */
    invoiceNumber: string;
    /** Invoice date */
    date: string;
    /** Original amount */
    originalAmount: number;
    /** Amount paid */
    amountPaid: number;
    /** Balance due */
    balanceDue: number;
    /** Due date */
    dueDate: string;
    /** Days past due */
    daysPastDue?: number;
  }>;

  /** Payment information */
  payment?: {
    /** Accepted payment methods */
    methods?: string[];
    /** Online payment URL */
    paymentUrl?: string;
    /** Payment address */
    paymentAddress?: string;
    /** Include payment stub */
    includePaymentStub?: boolean;
    /** Credit card payment phone */
    payByPhone?: string;
    /** Auto-pay status */
    autoPay?: {
      enrolled: boolean;
      paymentMethod?: string;
      nextPaymentDate?: string;
    };
  };

  /** Account messages */
  messages?: Array<{
    /** Message type */
    type?: 'info' | 'warning' | 'promotion';
    /** Message content */
    content: string;
  }>;

  /** Terms and conditions */
  terms?: string;

  /** Footer notes */
  footer?: string;
}
