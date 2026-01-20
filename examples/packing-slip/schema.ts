/**
 * Packing Slip Schema
 *
 * Shipping and delivery documents listing contents of a package.
 * Common use cases: e-commerce shipments, wholesale orders, warehouse operations.
 */

export interface PackingSlipData {
  shipment: {
    /** Packing slip or shipment number */
    number: string;
    /** Date shipped */
    date: string;
    /** Related order number */
    orderNumber: string;
    /** Purchase order number */
    poNumber?: string;
    /** Carrier/shipping method */
    carrier?: string;
    /** Tracking number */
    trackingNumber?: string;
    /** Number of packages */
    packageCount?: number;
    /** Package weight */
    weight?: string;
    /** Expected delivery date */
    expectedDelivery?: string;
  };

  /** Shipping company (from) */
  company: {
    /** Company name */
    name: string;
    /** Logo URL */
    logo?: string;
    /** Warehouse/return address */
    address: string;
    /** Phone */
    phone?: string;
    /** Email */
    email?: string;
    /** Website */
    website?: string;
  };

  /** Ship to address */
  shipTo: {
    /** Recipient name */
    name: string;
    /** Company name */
    company?: string;
    /** Full address */
    address: string;
    /** Phone */
    phone?: string;
    /** Delivery instructions */
    deliveryInstructions?: string;
  };

  /** Bill to address (if different) */
  billTo?: {
    /** Name */
    name: string;
    /** Company */
    company?: string;
    /** Address */
    address: string;
  };

  /** Items in shipment */
  items: Array<{
    /** Item SKU or code */
    sku: string;
    /** Item description */
    description: string;
    /** Quantity ordered */
    quantityOrdered: number;
    /** Quantity shipped in this package */
    quantityShipped: number;
    /** Quantity backordered */
    quantityBackordered?: number;
    /** Unit of measure */
    unit?: string;
    /** Lot number or batch */
    lotNumber?: string;
    /** Location in warehouse */
    location?: string;
    /** Weight per unit */
    unitWeight?: string;
  }>;

  /** Package details for multi-package shipments */
  packages?: Array<{
    /** Package number (e.g., "1 of 3") */
    packageNumber: string;
    /** Package tracking number */
    trackingNumber?: string;
    /** Package weight */
    weight?: string;
    /** Package dimensions */
    dimensions?: string;
    /** Items in this package */
    contents?: Array<{
      sku: string;
      quantity: number;
    }>;
  }>;

  /** Order summary */
  summary: {
    /** Total items ordered */
    totalOrdered: number;
    /** Total items shipped */
    totalShipped: number;
    /** Total backordered */
    totalBackordered?: number;
    /** This shipment number (e.g., "1 of 2") */
    shipmentNumber?: string;
  };

  /** Special handling instructions */
  specialInstructions?: string[];

  /** Return information */
  returns?: {
    /** Return policy summary */
    policy?: string;
    /** RMA instructions */
    instructions?: string;
    /** Return address (if different) */
    returnAddress?: string;
    /** Include return label */
    includeReturnLabel?: boolean;
  };

  /** Notes */
  notes?: string;

  /** Barcode for scanning */
  barcode?: {
    type: 'qr' | 'code128' | 'code39';
    value: string;
  };
}
