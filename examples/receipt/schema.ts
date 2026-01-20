/**
 * Receipt Schema
 *
 * Transaction confirmations for completed purchases or payments.
 * Common use cases: retail sales, service payments, donations, refunds.
 */

export interface ReceiptData {
  receipt: {
    /** Unique receipt/transaction number */
    number: string;
    /** Transaction date */
    date: string;
    /** Transaction time (optional) */
    time?: string;
    /** Receipt type */
    type?: 'sale' | 'refund' | 'exchange' | 'donation' | 'payment';
    /** Reference to original transaction (for refunds/exchanges) */
    originalReceipt?: string;
  };

  business: {
    /** Business name */
    name: string;
    /** Logo URL */
    logo?: string;
    /** Store location or branch name */
    location?: string;
    /** Full address */
    address?: string;
    /** Phone number */
    phone?: string;
    /** Tax ID for tax-deductible receipts */
    taxId?: string;
    /** Website */
    website?: string;
  };

  /** Customer information (optional for retail) */
  customer?: {
    /** Customer name */
    name?: string;
    /** Email for digital receipt */
    email?: string;
    /** Phone number */
    phone?: string;
    /** Loyalty/membership number */
    memberId?: string;
  };

  items: Array<{
    /** Item name/description */
    name: string;
    /** SKU or product code */
    sku?: string;
    /** Quantity purchased */
    quantity: number;
    /** Unit price */
    unitPrice: number;
    /** Line total */
    total: number;
    /** Discount on this item */
    discount?: number;
    /** Whether item was returned (for exchange receipts) */
    returned?: boolean;
  }>;

  totals: {
    /** Sum of all items */
    subtotal: number;
    /** Total discounts applied */
    discount?: number;
    /** Discount code used */
    discountCode?: string;
    /** Tax amount */
    tax?: number;
    /** Tax breakdown by type */
    taxBreakdown?: Array<{
      name: string;
      rate: number;
      amount: number;
    }>;
    /** Tip amount */
    tip?: number;
    /** Shipping/delivery fee */
    shipping?: number;
    /** Final total */
    total: number;
  };

  payment: {
    /** Payment method used */
    method: 'cash' | 'credit' | 'debit' | 'check' | 'gift_card' | 'store_credit' | 'mixed';
    /** Card type (Visa, Mastercard, etc.) */
    cardType?: string;
    /** Last 4 digits of card */
    cardLast4?: string;
    /** Authorization code */
    authCode?: string;
    /** Amount tendered (for cash) */
    amountTendered?: number;
    /** Change given */
    change?: number;
    /** Multiple payment methods */
    splitPayments?: Array<{
      method: string;
      amount: number;
      reference?: string;
    }>;
  };

  /** Loyalty/rewards information */
  rewards?: {
    /** Points earned this transaction */
    pointsEarned?: number;
    /** Points redeemed */
    pointsRedeemed?: number;
    /** Current point balance */
    pointsBalance?: number;
    /** Rewards tier */
    tier?: string;
  };

  /** Return policy text */
  returnPolicy?: string;

  /** Survey or feedback URL */
  surveyUrl?: string;

  /** Barcode for returns/lookups */
  barcode?: {
    /** Barcode type */
    type: 'qr' | 'code128' | 'code39';
    /** Barcode value */
    value: string;
  };

  /** Additional notes or messages */
  notes?: string;

  /** Footer message */
  footer?: string;
}
