# Work Order Template

Service or repair orders documenting work to be performed or completed.

## Use Cases

- HVAC service calls
- Plumbing repairs
- Electrical work
- Equipment maintenance
- Installation orders
- Facility management
- Field service dispatch

## Schema Overview

| Field | Required | Description |
|-------|----------|-------------|
| `workOrder.number` | Yes | Work order ID |
| `workOrder.date` | Yes | Creation date |
| `workOrder.priority` | Yes | Priority level |
| `workOrder.status` | Yes | Current status |
| `company.name` | Yes | Service company |
| `customer.name` | Yes | Customer name |
| `location.address` | Yes | Service location |
| `job.type` | Yes | Work category |
| `job.description` | Yes | Job description |
| `labor` | Yes | Labor entries |
| `materials` | Yes | Materials used |
| `totals.total` | Yes | Total cost |

## Common Natural Language Modifications

### Job Details
- "Change priority to urgent"
- "Update status to in_progress"
- "Add equipment serial number ABC123"
- "Include safety note about confined space entry"

### Labor
- "Add 2 hours overtime for Carlos"
- "Include travel time of 45 minutes"
- "Change hourly rate to $135"
- "Add helper technician at $65/hour"

### Materials
- "Add filter replacement - part #FLT-2020"
- "Mark the compressor as warranty replacement"
- "Remove the brazing supplies"
- "Update refrigerant quantity to 22 lbs"

### Completion
- "Add recommendation for annual service contract"
- "Note that follow-up needed in 90 days"
- "Include customer approval signature"

### Totals
- "Apply 10% discount for service agreement customers"
- "Add $75 emergency service fee"
- "Update tax rate to 7.5%"

## Work Order Types

### HVAC Service
```json
{
  "job": {
    "type": "HVAC Maintenance",
    "equipment": {
      "type": "Rooftop Unit",
      "make": "Carrier",
      "model": "50XC",
      "serialNumber": "1234567890"
    }
  },
  "materials": [
    {"item": "Air Filter 20x25x4", "quantity": 4, "unitPrice": 28.50}
  ]
}
```

### Plumbing Repair
```json
{
  "job": {
    "type": "Plumbing - Leak Repair",
    "description": "Water leak under kitchen sink",
    "problemDescription": "Customer noticed water pooling in cabinet"
  },
  "materials": [
    {"item": "P-Trap Assembly", "partNumber": "PT-112", "quantity": 1},
    {"item": "Supply Lines", "partNumber": "SL-SS12", "quantity": 2}
  ]
}
```

### Electrical Installation
```json
{
  "workOrder": {
    "type": "installation"
  },
  "job": {
    "type": "Electrical - Panel Upgrade",
    "description": "Upgrade 100A panel to 200A service",
    "safetyNotes": "Main disconnect required. Utility coordination needed."
  }
}
```

### Preventive Maintenance
```json
{
  "workOrder": {
    "type": "maintenance",
    "priority": "low"
  },
  "job": {
    "type": "Quarterly PM",
    "description": "Routine preventive maintenance per service agreement"
  },
  "workPerformed": {
    "summary": "Completed all PM checklist items",
    "details": [
      "Checked refrigerant levels",
      "Cleaned condenser coils",
      "Inspected electrical connections",
      "Tested safety controls"
    ]
  }
}
```

## Tips

1. **Capture equipment details** - Serial numbers help with warranty and history
2. **Document thoroughly** - What you found, what you did, what you recommend
3. **Get customer signature** - Proof of service completion
4. **Note access requirements** - Save time on future visits
5. **Track warranty items** - Flag parts under manufacturer or labor warranty
6. **Include follow-up notes** - Keeps recurring revenue flowing
7. **Separate labor types** - Regular, overtime, travel for accurate billing
