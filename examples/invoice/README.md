# Invoice Template

Service invoices for billing clients for completed work, products, or ongoing services.

## Use Cases

- Freelance and consulting billing
- Product sales invoices
- Recurring subscription billing
- Progress billing for projects
- Final project invoices

## Schema Overview

| Field | Required | Description |
|-------|----------|-------------|
| `invoice.number` | Yes | Unique identifier |
| `invoice.date` | Yes | Invoice creation date |
| `invoice.dueDate` | Yes | Payment due date |
| `company.name` | Yes | Your business name |
| `client.name` | Yes | Client/customer name |
| `lineItems` | Yes | Array of billed items |
| `totals.subtotal` | Yes | Sum before adjustments |
| `totals.total` | Yes | Final amount due |

## Common Natural Language Modifications

Use these with Glyph's AI modification feature:

### Adjusting Terms
- "Change payment terms to net 15"
- "Make this due in 7 days"
- "Add a 2% early payment discount for paying within 10 days"

### Modifying Line Items
- "Add a 10% discount to all services"
- "Remove the hosting line item"
- "Change the hourly rate to $200"
- "Add a rush fee of $500"

### Payment Information
- "Add PayPal as a payment option with email payments@company.com"
- "Include wire transfer instructions for international clients"
- "Add a QR code for quick payment"

### Status Updates
- "Mark this invoice as paid"
- "Update status to overdue"
- "Add partial payment of $5,000 received on Jan 20"

### Branding
- "Use our blue color scheme (#2563eb)"
- "Add our company tagline under the logo"
- "Include our license number in the footer"

## Industry-Specific Variations

### Legal Services
```json
{
  "lineItems": [
    {
      "description": "Legal Consultation",
      "details": "Matter: Contract Review - Acme Acquisition",
      "quantity": 4.5,
      "unit": "hours",
      "unitPrice": 450,
      "total": 2025
    }
  ]
}
```

### Construction/Trades
```json
{
  "lineItems": [
    {
      "description": "HVAC System Installation",
      "details": "Carrier 3-ton split system, Model 24ACC636",
      "quantity": 1,
      "unit": "unit",
      "unitPrice": 8500,
      "total": 8500
    },
    {
      "description": "Labor - Installation",
      "quantity": 16,
      "unit": "hours",
      "unitPrice": 95,
      "total": 1520
    }
  ]
}
```

### Creative Services
```json
{
  "lineItems": [
    {
      "description": "Brand Identity Package",
      "details": "Logo design, color palette, typography guidelines",
      "quantity": 1,
      "unit": "project",
      "unitPrice": 3500,
      "total": 3500
    },
    {
      "description": "Additional Revision Rounds",
      "quantity": 2,
      "unit": "rounds",
      "unitPrice": 250,
      "total": 500
    }
  ]
}
```

## Tips

1. **Always include payment terms** - Clear expectations prevent late payments
2. **Use descriptive line items** - Clients should understand what they're paying for
3. **Include PO numbers** - Helps corporate clients process payments faster
4. **Track partial payments** - Use `amountPaid` and `balanceDue` for payment plans
