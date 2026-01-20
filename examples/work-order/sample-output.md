# Work Order Sample Output

## Visual Description

The work order renders as a comprehensive field service document:

### Header
```
┌─────────────────────────────────────────────────────────┐
│  [SUMMIT HVAC LOGO]          WORK ORDER                │
│                                                         │
│  Summit HVAC Services        WO-2025-04521             │
│  2847 Industrial Parkway     ─────────────────────     │
│  Denver, CO 80216            Date: January 22, 2025    │
│  (303) 555-0187              Scheduled: Jan 23, 9:00 AM│
│  License: MC-4521897                                   │
│                              ┌─────────┐ ┌───────────┐ │
│                              │  HIGH   │ │ COMPLETED │ │
│                              │PRIORITY │ │  STATUS   │ │
│                              └─────────┘ └───────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Customer & Location Section
```
CUSTOMER INFORMATION          SERVICE LOCATION
─────────────────────────────────────────────────────────
Mountain View Office Complex  Building A - Server Room
Account: CUST-78452           1200 Corporate Drive
(303) 555-0245                Building A, 3rd Floor
facilities@mountainview...    Denver, CO 80203

Billing Address:              Site Contact: Mike Rodriguez
1200 Corporate Drive          Phone: (303) 555-0246
Suite 100
Denver, CO 80203              Access: Check in at main lobby
                              Code: #4521
```

### Job Details Section
```
JOB DETAILS
─────────────────────────────────────────────────────────
Type:  HVAC Repair - Commercial

Description:
Server room CRAC unit not cooling. Temperature rising,
currently at 82°F. Critical infrastructure at risk.

Problem Description:
Customer reported CRAC unit stopped cooling around 6 PM
yesterday. Unit is running but blowing warm air. No error
codes displayed.

EQUIPMENT
─────────────────────────────────────────────────────────
Type:     Computer Room Air Conditioning (CRAC)
Make:     Liebert
Model:    DS077A
Serial:   LB-2019-78452-A
Location: Server Room A, northwest corner

⚠️ SAFETY NOTES
High-voltage electrical. Lockout/tagout required.
Refrigerant handling - EPA 608 certification required.
```

### Assigned Technicians
```
ASSIGNED TECHNICIANS
─────────────────────────────────────────────────────────
┌─────────────────┬──────────┬───────────────────────────┐
│ Name            │ ID       │ Certification             │
├─────────────────┼──────────┼───────────────────────────┤
│ Carlos Mendez   │ EMP-142  │ EPA 608 Universal, NATE   │
│ James Wilson    │ EMP-087  │ EPA 608 Universal         │
└─────────────────┴──────────┴───────────────────────────┘
```

### Labor & Materials Tables
```
LABOR
─────────────────────────────────────────────────────────
Technician     │ Date    │ Hours │ Type    │ Rate   │ Total
───────────────┼─────────┼───────┼─────────┼────────┼────────
Carlos Mendez  │ 1/23/25 │  5.50 │ Regular │ $125.00│ $687.50
James Wilson   │ 1/23/25 │  3.75 │ Regular │  $95.00│ $356.25
Carlos Mendez  │ 1/23/25 │  0.50 │ Travel  │  $75.00│  $37.50
───────────────┴─────────┴───────┴─────────┴────────┴────────
                                    LABOR TOTAL:    $1,081.25


MATERIALS
─────────────────────────────────────────────────────────
Item                          │ Part #      │ Qty │   Total
──────────────────────────────┼─────────────┼─────┼─────────
Scroll Compressor - Liebert   │ LB-COMP-... │  1  │$2,847.50
R-410A Refrigerant            │ REF-410A-25 │ 18  │  $810.00
Compressor Contactor          │ CTR-40A-3P  │  1  │   $87.50
Filter Drier                  │ FD-307S     │  1  │  $124.00
Misc. Fittings/Brazing        │ MISC-BRAZE  │  1  │   $65.00
──────────────────────────────┴─────────────┴─────┴─────────
                                MATERIALS TOTAL:   $3,934.00
```

### Work Performed Section
```
WORK PERFORMED
─────────────────────────────────────────────────────────
Summary:
Diagnosed failed scroll compressor. Replaced compressor,
contactor, and filter drier. System restored to operation.

Details:
• Arrived on site 9:15 AM, met with site contact
• Initial diagnostics: compressor not starting
• Compressor windings tested - shorted to ground
• Recovered 22 lbs R-410A (EPA documented)
• Installed new scroll compressor and contactor
• Evacuated system to 500 microns
• Charged with 18 lbs R-410A per spec
• Room temperature returned to 68°F

RECOMMENDATIONS
• Schedule preventive maintenance quarterly
• Consider backup portable cooling
• Replace air filters (at 60% capacity)
```

### Totals Section
```
TOTALS
─────────────────────────────────────────────────────────
                              Labor Total:    $1,081.25
                          Materials Total:    $3,934.00
                          Travel Charges:        $37.50
                                          ─────────────
                               Subtotal:     $5,052.75
                          Tax (6.27%):         $316.55
                                          ─────────────
                                  TOTAL:     $5,369.30
```

### Signatures Section
```
COMPLETION & SIGNATURES
─────────────────────────────────────────────────────────
Completed: January 23, 2025 at 2:45 PM
Resolution: System restored to full operation.

☑ Follow-up required within 90 days


Technician:                    Customer:

_________________________     _________________________
Carlos Mendez                  Mike Rodriguez
Date: 1/23/2025                Date: 1/23/2025
```

## Format Options

### Field Copy (Default)
- Fits on 2-3 pages
- Durable printing recommended
- Space for handwritten notes

### Office Copy
- Full details with complete work log
- Archive-ready formatting

### Customer Copy
- Summary view without internal details
- Professional presentation

## Print Optimization
- Letter size (8.5" x 11")
- Carbonless multi-part option supported
- Signature areas sized for tablets
- QR code option for digital records
