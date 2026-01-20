/**
 * Work Order Schema
 *
 * Service or repair orders documenting work to be performed.
 * Common use cases: field service, maintenance, repairs, installations.
 */

export interface WorkOrderData {
  workOrder: {
    /** Work order number */
    number: string;
    /** Creation date */
    date: string;
    /** Scheduled date/time */
    scheduledDate?: string;
    /** Priority level */
    priority: 'low' | 'medium' | 'high' | 'urgent';
    /** Current status */
    status: 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'on_hold';
    /** Work order type */
    type?: 'repair' | 'maintenance' | 'installation' | 'inspection' | 'service' | 'emergency';
    /** Reference to quote or estimate */
    quoteNumber?: string;
    /** Purchase order number */
    poNumber?: string;
  };

  /** Service company information */
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
    /** License number */
    license?: string;
  };

  /** Customer information */
  customer: {
    /** Customer name */
    name: string;
    /** Account number */
    accountNumber?: string;
    /** Email */
    email?: string;
    /** Phone */
    phone?: string;
    /** Alternate phone */
    altPhone?: string;
    /** Billing address */
    billingAddress?: string;
  };

  /** Service location */
  location: {
    /** Site name or identifier */
    name?: string;
    /** Full address */
    address: string;
    /** Access instructions */
    accessInstructions?: string;
    /** Gate/door code */
    accessCode?: string;
    /** Contact person on site */
    siteContact?: string;
    /** Site contact phone */
    siteContactPhone?: string;
  };

  /** Job details */
  job: {
    /** Work type/category */
    type: string;
    /** Job description */
    description: string;
    /** Detailed problem description or symptoms */
    problemDescription?: string;
    /** Special instructions */
    specialInstructions?: string;
    /** Equipment/asset being serviced */
    equipment?: {
      type: string;
      make?: string;
      model?: string;
      serialNumber?: string;
      location?: string;
    };
    /** Safety requirements or notes */
    safetyNotes?: string;
  };

  /** Assigned technician(s) */
  technicians?: Array<{
    /** Technician name */
    name: string;
    /** Employee ID */
    employeeId?: string;
    /** Phone */
    phone?: string;
    /** Specialty or certification */
    certification?: string;
  }>;

  /** Labor entries */
  labor: Array<{
    /** Technician name or ID */
    technician: string;
    /** Date of work */
    date?: string;
    /** Start time */
    startTime?: string;
    /** End time */
    endTime?: string;
    /** Hours worked */
    hours: number;
    /** Labor type */
    type?: 'regular' | 'overtime' | 'emergency' | 'travel';
    /** Hourly rate */
    rate: number;
    /** Work description */
    description?: string;
  }>;

  /** Materials used */
  materials: Array<{
    /** Item name/description */
    item: string;
    /** Part number or SKU */
    partNumber?: string;
    /** Quantity used */
    quantity: number;
    /** Unit of measure */
    unit?: string;
    /** Unit price */
    unitPrice: number;
    /** Warranty indicator */
    warranty?: boolean;
  }>;

  /** Work performed notes */
  workPerformed?: {
    /** Summary of work done */
    summary: string;
    /** Detailed notes */
    details?: string[];
    /** Recommendations for future */
    recommendations?: string[];
    /** Issues found but not addressed */
    deferredItems?: string[];
  };

  /** Totals */
  totals: {
    /** Total labor cost */
    laborTotal: number;
    /** Total materials cost */
    materialsTotal: number;
    /** Travel charges */
    travelCharges?: number;
    /** Other fees */
    otherCharges?: number;
    /** Subtotal */
    subtotal?: number;
    /** Tax */
    tax?: number;
    /** Tax rate */
    taxRate?: number;
    /** Discount */
    discount?: number;
    /** Grand total */
    total: number;
  };

  /** Completion information */
  completion?: {
    /** Date completed */
    completedDate?: string;
    /** Time completed */
    completedTime?: string;
    /** Resolution notes */
    resolution?: string;
    /** Follow-up required */
    followUpRequired?: boolean;
    /** Follow-up notes */
    followUpNotes?: string;
  };

  /** Signatures */
  signatures?: {
    /** Technician signature */
    technician?: {
      name?: string;
      date?: string;
      signature?: string;
    };
    /** Customer signature */
    customer?: {
      name?: string;
      date?: string;
      signature?: string;
    };
  };

  /** Terms and conditions */
  terms?: string;
}
