# Receipt Template

Transaction confirmations for completed purchases, payments, or donations.

## Use Cases

- Retail sales receipts
- Service payment confirmations
- Donation acknowledgments (tax-deductible)
- Refund/exchange documentation
- Digital receipt delivery

## Schema Overview

| Field | Required | Description |
|-------|----------|-------------|
| `receipt.number` | Yes | Transaction ID |
| `receipt.date` | Yes | Transaction date |
| `business.name` | Yes | Business name |
| `items` | Yes | Array of purchased items |
| `totals.subtotal` | Yes | Sum before tax |
| `totals.total` | Yes | Final amount |
| `payment.method` | Yes | How customer paid |

## Common Natural Language Modifications

### Transaction Details
- "Add the transaction time as 3:45 PM"
- "Mark this as a refund receipt"
- "Include the original receipt number TXN-123"

### Items
- "Add a 10% discount to the drill"
- "Remove the safety glasses from the receipt"
- "Change quantity of gloves to 2 pairs"

### Payment
- "Change payment method to cash with $400 tendered"
- "Split payment: $200 credit, $159.58 gift card"
- "Add auth code 123456"

### Rewards/Loyalty
- "Add 500 bonus points for the promotion"
- "Show that customer redeemed 1000 points worth $10"
- "Update points balance to 3500"

### Branding
- "Add store hours to the footer"
- "Include our Instagram handle @evergreenhardware"
- "Add holiday return policy extending to January 31"

## Industry-Specific Variations

### Restaurant Receipt
```json
{
  "receipt": {
    "number": "CHK-4521",
    "type": "sale"
  },
  "items": [
    {"name": "Margherita Pizza", "quantity": 1, "unitPrice": 18.00, "total": 18.00},
    {"name": "House Salad", "quantity": 2, "unitPrice": 8.00, "total": 16.00},
    {"name": "Sparkling Water", "quantity": 2, "unitPrice": 4.00, "total": 8.00}
  ],
  "totals": {
    "subtotal": 42.00,
    "tax": 3.47,
    "tip": 8.40,
    "total": 53.87
  }
}
```

### Donation Receipt (Tax-Deductible)
```json
{
  "receipt": {
    "number": "DON-2024-0542",
    "type": "donation"
  },
  "business": {
    "name": "Portland Food Bank",
    "taxId": "EIN: 93-1234567"
  },
  "items": [
    {"name": "General Fund Donation", "quantity": 1, "unitPrice": 250, "total": 250}
  ],
  "notes": "No goods or services were provided in exchange for this donation. This receipt may be used for tax purposes."
}
```

### Gas Station Receipt
```json
{
  "items": [
    {"name": "Regular Unleaded", "sku": "FUEL-REG", "quantity": 12.547, "unitPrice": 3.459, "total": 43.40}
  ],
  "payment": {
    "method": "credit",
    "cardType": "Shell Rewards",
    "cardLast4": "8827"
  },
  "rewards": {
    "pointsEarned": 125,
    "fuelDiscount": 0.05
  }
}
```

### E-commerce Order Confirmation
```json
{
  "receipt": {
    "number": "ORD-2024-78542",
    "type": "sale"
  },
  "customer": {
    "name": "Sarah Mitchell",
    "email": "sarah.m@email.com"
  },
  "totals": {
    "subtotal": 89.99,
    "shipping": 7.99,
    "tax": 8.10,
    "total": 106.08
  },
  "notes": "Estimated delivery: January 25-27, 2024\nTracking: 1Z999AA10123456784"
}
```

## Tips

1. **Include barcode for returns** - Makes return processing faster
2. **Show tax breakdown** - Required in some jurisdictions
3. **Add loyalty info** - Encourages repeat business
4. **Keep return policy visible** - Reduces customer service inquiries
5. **Digital receipts need customer contact** - Email or phone required for delivery
