# Receipt Sample Output

## Visual Description

The receipt renders in a narrow, vertical format optimized for thermal printing or mobile display:

### Header
```
        [LOGO]
  EVERGREEN HARDWARE & HOME
    Downtown Store #12
      547 Oak Street
     Portland, OR 97205
      (503) 555-0142

 Date: January 22, 2024  2:34 PM
 Receipt: TXN-20240122-4521
 ─────────────────────────────────
 Member: Robert Chen (EVG-78524)
         Gold Member
```

### Items Section
```
 ─────────────────────────────────
 DeWalt 20V MAX Drill/Driver Kit
   DWT-DCD771C2
   1 @ $169.99              $169.99

 DeWalt 20V 2.0Ah Battery 2-Pack
   DWT-DCB203-2
   1 @ $99.99               $99.99
   Member Discount         -$15.00

 IRWIN Titanium Drill Bit Set
   IRW-316015
   1 @ $34.99               $34.99

 3M Safety Glasses - Clear
   3M-11329
   2 @ $8.99                $17.98

 Carhartt Work Gloves - Large
   CHT-A659L
   1 @ $24.99               $24.99
```

### Totals Section
```
 ─────────────────────────────────
 Subtotal                  $347.94
 Member Discount (MEMBER10) -$15.00
 Multnomah County Tax (8%)  $26.64
 ─────────────────────────────────
 TOTAL                     $359.58
 ═════════════════════════════════

 VISA ****4521
 Auth: 847291              $359.58
```

### Rewards Section
```
 ─────────────────────────────────
 ★ REWARDS SUMMARY ★
 Points Earned Today:         +360
 Total Points Balance:       2,847
 ─────────────────────────────────
 You saved $15.00 as a Gold Member!
```

### Footer Section
```
 ─────────────────────────────────
 RETURN POLICY
 Returns accepted within 90 days
 with receipt. Power tools require
 original packaging. See store for
 details.

 ─────────────────────────────────

        [QR CODE]
   Scan for digital receipt

 Tell us about your visit:
 evergreenhardware.com/feedback

 ─────────────────────────────────
    Thank you for shopping at
   Evergreen Hardware & Home!

 Questions? Call (503) 555-0142
   evergreenhardware.com
```

## Format Options

### Standard (Default)
- Width: 80mm (thermal printer standard)
- Monospace font for alignment
- Centered headers, right-aligned amounts

### Wide Format
- Full page width (8.5" or A4)
- Two-column layout for items
- Larger logo and branding

### Digital/Email
- Responsive HTML
- Clickable links for survey, tracking
- Embedded QR code for returns

## Typography
- **Business Name**: Bold, larger size
- **Item Names**: Regular weight
- **SKUs**: Smaller, lighter color
- **Totals**: Bold, slightly larger
- **Discount**: Accent color (green for savings)

## Print Optimization
- Optimized for 58mm and 80mm thermal paper
- High contrast for thermal printing
- QR code sized for easy scanning (min 25mm)
- Page break before footer for long receipts
