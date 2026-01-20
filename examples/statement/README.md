# Statement Template

Account statements showing transactions and balances over a billing period.

## Use Cases

- Customer account statements
- Monthly billing statements
- Activity summaries
- Accounts receivable aging
- Payment reminders
- Account reconciliation

## Schema Overview

| Field | Required | Description |
|-------|----------|-------------|
| `statement.date` | Yes | Statement date |
| `statement.periodStart` | Yes | Period start date |
| `statement.periodEnd` | Yes | Period end date |
| `company.name` | Yes | Issuing company |
| `customer.name` | Yes | Account holder |
| `summary.previousBalance` | Yes | Opening balance |
| `summary.currentBalance` | Yes | Closing balance |
| `transactions` | Yes | Transaction history |

## Common Natural Language Modifications

### Summary
- "Update current balance to $15,000"
- "Add past due amount of $2,500"
- "Set minimum payment to $3,000"
- "Change payment due date to March 1"

### Transactions
- "Add a payment of $5,000 received on Jan 25"
- "Include finance charge of $150"
- "Add credit adjustment for $200"

### Aging
- "Show $5,000 in 31-60 days bucket"
- "Move $2,000 from current to 1-30 days"

### Messages
- "Add past due warning message"
- "Include holiday schedule notice"
- "Add promotion for early payment discount"

### Payment
- "Add ACH bank details"
- "Include QR code for quick payment"
- "Enable auto-pay enrollment link"

## Statement Types

### B2B Customer Statement
```json
{
  "statement": {
    "type": "customer"
  },
  "summary": {
    "previousBalance": 10000,
    "newCharges": 5000,
    "payments": 8000,
    "currentBalance": 7000
  },
  "aging": {
    "current": 5000,
    "days1to30": 2000,
    "days31to60": 0,
    "days61to90": 0,
    "over90": 0
  },
  "openInvoices": [...]
}
```

### Consumer Billing Statement
```json
{
  "statement": {
    "type": "billing"
  },
  "summary": {
    "previousBalance": 150.00,
    "newCharges": 89.99,
    "payments": 150.00,
    "currentBalance": 89.99,
    "minimumPayment": 25.00,
    "paymentDueDate": "February 15, 2025"
  },
  "payment": {
    "autoPay": {
      "enrolled": true,
      "paymentMethod": "Visa ****4521",
      "nextPaymentDate": "February 15, 2025"
    }
  }
}
```

### Past Due Statement
```json
{
  "summary": {
    "currentBalance": 5000,
    "pastDue": 2500,
    "paymentDueDate": "PAST DUE"
  },
  "aging": {
    "current": 1000,
    "days1to30": 1500,
    "days31to60": 1000,
    "days61to90": 1000,
    "over90": 500
  },
  "messages": [
    {
      "type": "warning",
      "content": "IMPORTANT: Your account is past due. Please remit payment immediately to avoid service interruption."
    }
  ]
}
```

### Credit Card Statement
```json
{
  "statement": {
    "type": "billing"
  },
  "summary": {
    "previousBalance": 1250.00,
    "newCharges": 847.50,
    "payments": 500.00,
    "credits": 25.00,
    "financeCharges": 18.75,
    "currentBalance": 1591.25,
    "minimumPayment": 35.00
  },
  "payment": {
    "methods": ["Online", "Auto-Pay", "Phone", "Mail"],
    "paymentUrl": "www.bank.com/pay"
  }
}
```

## Tips

1. **Show aging clearly** - Helps customers prioritize payments
2. **List open invoices** - Enables specific invoice payments
3. **Include payment options** - Make it easy to pay
4. **Add account messages** - Communicate promotions or issues
5. **Use running balance** - Shows account activity at a glance
6. **Include payment stub** - For customers who pay by mail
7. **Show credits prominently** - Builds customer trust
