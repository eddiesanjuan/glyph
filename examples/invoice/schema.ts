/**
 * Invoice Schema
 *
 * Service invoices for billing clients for completed work.
 * Common use cases: freelance billing, consulting fees, product sales.
 */

export interface InvoiceData {
  invoice: {
    /** Unique invoice identifier (e.g., "INV-2024-001") */
    number: string;
    /** Invoice creation date */
    date: string;
    /** Payment due date */
    dueDate: string;
    /** Current payment status */
    status?: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
    /** Purchase order number for client reference */
    poNumber?: string;
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
    /** Tax ID or business registration number */
    taxId?: string;
    /** Website URL */
    website?: string;
  };

  client: {
    /** Client name (person or business) */
    name: string;
    /** Company name if different from client name */
    company?: string;
    /** Billing address */
    address?: string;
    /** Client email for delivery */
    email?: string;
    /** Client phone */
    phone?: string;
    /** Client's tax ID for tax compliance */
    taxId?: string;
  };

  lineItems: Array<{
    /** Service or product description */
    description: string;
    /** Extended details or specifications */
    details?: string;
    /** Quantity (numeric or text like "10 hours") */
    quantity: number | string;
    /** Unit of measure (hours, units, etc.) */
    unit?: string;
    /** Price per unit */
    unitPrice: number;
    /** Line total (quantity * unitPrice) */
    total: number;
  }>;

  totals: {
    /** Sum of all line items */
    subtotal: number;
    /** Discount amount (optional) */
    discount?: number;
    /** Discount percentage for display */
    discountPercent?: number;
    /** Tax amount */
    tax?: number;
    /** Tax rate for display */
    taxRate?: number;
    /** Shipping or handling fees */
    shipping?: number;
    /** Final total due */
    total: number;
    /** Amount already paid */
    amountPaid?: number;
    /** Balance remaining */
    balanceDue?: number;
  };

  payment?: {
    /** Accepted payment methods */
    methods?: string[];
    /** Bank name for wire transfers */
    bankName?: string;
    /** Account number */
    accountNumber?: string;
    /** Routing number */
    routingNumber?: string;
    /** PayPal email or link */
    paypal?: string;
    /** Venmo handle */
    venmo?: string;
    /** Stripe payment link */
    stripeLink?: string;
    /** Payment instructions */
    instructions?: string;
  };

  notes?: string;
  terms?: string;
}
