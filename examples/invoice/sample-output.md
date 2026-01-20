# Invoice Sample Output

## Visual Description

The invoice renders as a professional, print-ready document with:

### Header Section
- **Top Left**: Company logo (if provided) or company name in bold
- **Top Right**: Large "INVOICE" label with invoice number
- **Below Header**:
  - Left side: Company contact information (address, phone, email, tax ID)
  - Right side: Invoice meta (date, due date, PO number, status badge)

### Client Section
- Clear "Bill To" label
- Client name and company (if different)
- Full billing address
- Contact details

### Line Items Table
| Description | Details | Qty | Unit | Rate | Amount |
|-------------|---------|-----|------|------|--------|
| E-commerce Platform Development | Custom B2B ordering portal... | 120 | hours | $175.00 | $21,000.00 |
| Payment Gateway Integration | Stripe and ACH payment... | 24 | hours | $175.00 | $4,200.00 |
| ERP Data Migration | Migration of 50,000+ product... | 1 | project | $8,500.00 | $8,500.00 |
| Staff Training Sessions | 3 virtual training sessions... | 3 | sessions | $750.00 | $2,250.00 |
| Monthly Hosting & Support | AWS infrastructure + 24/7... | 3 | months | $1,200.00 | $3,600.00 |

### Totals Section (Right-Aligned)
```
                    Subtotal:  $39,550.00
              Discount (5%):  -$1,977.50
              Tax (8.25%):    $3,012.60
                    ─────────────────────
                       TOTAL:  $40,585.10
                 Amount Paid: -$15,000.00
                    ─────────────────────
                 BALANCE DUE:  $25,585.10
```

### Payment Section
- Accepted payment methods icons/badges
- Bank details for wire/ACH (partially masked account number)
- Payment reference instructions

### Footer
- Notes section with thank you message
- Terms and conditions in smaller text
- Page numbers for multi-page invoices

## Color Scheme (Default)
- **Accent Color**: Deep navy blue (#1e3a5f)
- **Headers**: Accent color background with white text
- **Amounts**: Bold, accent color for totals
- **Status Badge**:
  - Draft: Gray
  - Sent: Blue
  - Paid: Green
  - Overdue: Red

## Print Optimization
- Renders at 8.5" x 11" (Letter) by default
- Clean margins for hole-punch compatibility
- Page breaks between sections for long invoices
- QR code option for digital payment links
