# Packing Slip Template

Shipping and delivery documents listing the contents of packages.

## Use Cases

- E-commerce order shipments
- Wholesale/B2B orders
- Warehouse operations
- Inventory transfers
- Drop shipping
- Returns processing

## Schema Overview

| Field | Required | Description |
|-------|----------|-------------|
| `shipment.number` | Yes | Packing slip ID |
| `shipment.date` | Yes | Ship date |
| `shipment.orderNumber` | Yes | Related order |
| `company.name` | Yes | Shipping company |
| `company.address` | Yes | Origin address |
| `shipTo.name` | Yes | Recipient name |
| `shipTo.address` | Yes | Destination address |
| `items` | Yes | Items in shipment |
| `summary.totalOrdered` | Yes | Total ordered |
| `summary.totalShipped` | Yes | Total shipped |

## Common Natural Language Modifications

### Shipment Details
- "Add tracking number 1Z999..."
- "Change carrier to FedEx Express"
- "Update expected delivery to January 28"
- "Add package count of 3"

### Items
- "Change SKU-123 quantity shipped to 4"
- "Mark 2 units of SKU-456 as backordered"
- "Add lot number B2025-01 to all items"
- "Include warehouse location codes"

### Packages
- "Split into 3 separate packages"
- "Add dimensions for each box"
- "Include individual tracking numbers"

### Delivery
- "Add delivery instructions: Signature required"
- "Include loading dock hours"
- "Add contact phone for delivery issues"

### Returns
- "Include prepaid return label"
- "Update return policy to 60 days"
- "Add RMA instructions"

## Variations

### E-commerce Shipment
```json
{
  "shipment": {
    "carrier": "USPS Priority Mail",
    "trackingNumber": "9400111899223033756789"
  },
  "shipTo": {
    "name": "John Smith",
    "address": "123 Main Street\nApt 4B\nNew York, NY 10001"
  },
  "returns": {
    "includeReturnLabel": true,
    "policy": "Free returns within 30 days"
  }
}
```

### Wholesale Order
```json
{
  "shipment": {
    "poNumber": "PO-2025-4521",
    "packageCount": 5
  },
  "shipTo": {
    "company": "Retail Store Inc.",
    "deliveryInstructions": "Dock B, appointment required"
  },
  "items": [
    {
      "sku": "PROD-001",
      "quantityOrdered": 144,
      "quantityShipped": 144,
      "unit": "case"
    }
  ]
}
```

### Partial Shipment
```json
{
  "summary": {
    "totalOrdered": 100,
    "totalShipped": 75,
    "totalBackordered": 25,
    "shipmentNumber": "1 of 2"
  },
  "notes": "Remaining items will ship by February 1"
}
```

### Multi-Package Shipment
```json
{
  "packages": [
    {
      "packageNumber": "1 of 3",
      "trackingNumber": "1Z...",
      "weight": "15 lbs",
      "contents": [{"sku": "HEAVY-001", "quantity": 1}]
    },
    {
      "packageNumber": "2 of 3",
      "trackingNumber": "1Z...",
      "weight": "22 lbs",
      "contents": [{"sku": "HEAVY-002", "quantity": 2}]
    }
  ]
}
```

## Tips

1. **Include barcodes** - Enables scanning at receiving
2. **Show ordered vs shipped** - Makes discrepancies obvious
3. **Note backorders clearly** - Set customer expectations
4. **Specify delivery instructions** - Reduces failed deliveries
5. **Add package contents** - Helps verify multi-box shipments
6. **Include return info** - Reduces customer service inquiries
7. **Warehouse locations** - Speeds up picking/packing
