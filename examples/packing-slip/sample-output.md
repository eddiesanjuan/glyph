# Packing Slip Sample Output

## Visual Description

The packing slip renders as a clear, scannable warehouse document:

### Header
```
┌─────────────────────────────────────────────────────────┐
│  [PCS LOGO]               PACKING SLIP                 │
│                                                         │
│  Pacific Coast Supply Co.        PKS-2025-08742        │
│  1847 Distribution Way           ─────────────────     │
│  Warehouse B                     Order: ORD-2025-14521 │
│  San Diego, CA 92154             PO: PO-78542          │
│  (619) 555-0147                  Date: January 22, 2025│
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │ |||||||||||||||||||||||||||||||||||||||||||||||  │  │
│  │            PKS-2025-08742                        │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Addresses Section
```
SHIP TO                          BILL TO
─────────────────────────────────────────────────────────
Marcus Thompson                  Thompson Hardware
Thompson Hardware                Accounts Payable
4521 Main Street                 4521 Main Street
Phoenix, AZ 85004                Phoenix, AZ 85004
(602) 555-0298

📦 Deliver to rear loading dock
   Business hours 7 AM - 5 PM
```

### Shipping Information
```
SHIPPING DETAILS
─────────────────────────────────────────────────────────
Carrier:           UPS Ground
Tracking:          1Z999AA10123456784
Package Count:     2
Total Weight:      28.4 lbs
Expected Delivery: January 27, 2025
```

### Items Table
```
ITEMS
─────────────────────────────────────────────────────────
SKU          │ Description                  │ Ord │Ship │ B/O
─────────────┼──────────────────────────────┼─────┼─────┼────
DWT-DCD771C2 │ DeWalt 20V Drill/Driver Kit  │  6  │  6  │  -
DWT-DCB203-2 │ DeWalt 20V Battery 2-Pack    │ 12  │ 12  │  -
MKT-HP2071   │ Makita 18V LXT Hammer Drill  │  4  │  4  │  -
MKT-BL1850B-2│ Makita 18V 5.0Ah Battery     │  8  │  6  │  2
BWH-35A-15   │ Bosch 15-pc Drill Bit Set    │ 24  │ 24  │  -
IRW-1877482  │ IRWIN Quick-Grip Clamp Set   │ 10  │ 10  │  -
─────────────┴──────────────────────────────┴─────┴─────┴────
                                    TOTALS: │ 64  │ 62  │  2
```

### Package Details
```
PACKAGE CONTENTS
─────────────────────────────────────────────────────────

📦 Package 1 of 2
   Tracking: 1Z999AA10123456784
   Weight: 18.2 lbs │ Dims: 24" x 18" x 12"
   ─────────────────────────────────────────
   □ (6) DWT-DCD771C2 - DeWalt Drill Kit
   □ (12) DWT-DCB203-2 - DeWalt Battery Pack


📦 Package 2 of 2
   Tracking: 1Z999AA10123456785
   Weight: 10.2 lbs │ Dims: 20" x 16" x 10"
   ─────────────────────────────────────────
   □ (4) MKT-HP2071 - Makita Hammer Drill
   □ (6) MKT-BL1850B-2 - Makita Battery Pack
   □ (24) BWH-35A-15 - Bosch Bit Set
   □ (10) IRW-1877482 - IRWIN Clamp Set
```

### Special Instructions
```
⚠️ SPECIAL HANDLING INSTRUCTIONS
─────────────────────────────────────────────────────────
• FRAGILE - Handle with care
• Keep dry - do not expose to moisture
• Stack limit: 3 boxes
```

### Notes & Return Info
```
NOTES
─────────────────────────────────────────────────────────
Backordered items (2x Makita Battery 2-Pack) expected
to ship January 29, 2025. You will receive tracking
notification when shipped.


RETURNS
─────────────────────────────────────────────────────────
Returns accepted within 30 days in original packaging.
Defective items may be returned for replacement or refund.
Opened power tools subject to 15% restocking fee.

Contact customer service for RMA number before returning.
Include packing slip copy with return.
```

### Footer
```
─────────────────────────────────────────────────────────
Questions? (619) 555-0147 │ shipping@pacificcoastsupply.com
                         pacificcoastsupply.com

Thank you for your order!
```

## Format Options

### Standard (Default)
- Full details for warehouse and customer
- Checkboxes for verification
- All items and packages listed

### Warehouse Pick List
- Adds warehouse locations
- Optimized for picking route
- Large checkboxes

### Customer Copy
- Removes internal details (locations, lot numbers)
- Emphasizes tracking info
- Includes return label section

## Print Optimization

- Letter size (8.5" x 11")
- Designed for single page when possible
- Barcode sized for handheld scanner
- High contrast for warehouse lighting
- Checkbox size optimized for pen marking
