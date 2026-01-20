# Resume/CV Template

Professional profiles for job applications and career presentations.

## Use Cases

- Job applications
- Portfolio websites
- Conference speaker bios
- Consulting profiles
- Academic CVs

## Schema Overview

| Field | Required | Description |
|-------|----------|-------------|
| `personal.name` | Yes | Full name |
| `personal.email` | Yes | Contact email |
| `experience` | Yes | Work history array |
| `education` | Yes | Educational background |
| `skills` | Yes | Skills by category |

## Common Natural Language Modifications

### Contact Information
- "Change location to 'Remote - US'"
- "Add my Dribbble portfolio link"
- "Remove phone number for privacy"

### Experience
- "Add a bullet point about leading the migration project"
- "Change my current title to 'Staff Engineer'"
- "Remove the Microsoft internship"
- "Add technologies: Rust, WebAssembly"

### Summary
- "Rewrite summary to focus on leadership experience"
- "Make the summary shorter - 2 sentences max"
- "Add that I'm open to relocation"

### Skills
- "Add a 'Leadership' category with: Team Management, Agile, Mentoring"
- "Remove Vue.js from frontend skills"
- "Consolidate all skills into a single list"

### Formatting
- "Make this a one-page resume"
- "Expand to full CV format with publications"
- "Use a more creative layout for design roles"

## Resume Styles

### Tech/Engineering (Default)
- Skills section prominent
- Technologies listed per role
- Projects/open source section

### Executive/Leadership
```json
{
  "personal": {
    "title": "VP of Engineering"
  },
  "experience": [
    {
      "highlights": [
        "Built and led engineering organization from 15 to 85 engineers",
        "Drove $50M revenue growth through platform modernization",
        "Established engineering culture and career ladders"
      ]
    }
  ]
}
```

### Creative/Design
```json
{
  "personal": {
    "title": "Senior Product Designer",
    "portfolio": "dribbble.com/designer"
  },
  "projects": [
    {
      "name": "Brand Redesign - Fortune 500",
      "description": "Complete visual identity overhaul",
      "highlights": [
        "40% increase in brand recognition",
        "Featured in Communication Arts"
      ]
    }
  ]
}
```

### Academic CV
```json
{
  "personal": {
    "title": "Assistant Professor of Computer Science"
  },
  "publications": [
    {
      "title": "Machine Learning for Climate Prediction",
      "publisher": "Nature Climate Change",
      "coAuthors": ["J. Smith", "A. Johnson"]
    }
  ],
  "customSections": [
    {
      "title": "Research Grants",
      "items": [
        {"title": "NSF CAREER Award", "description": "$500K, 2023-2028"}
      ]
    },
    {
      "title": "Teaching",
      "items": [
        {"title": "CS 229: Machine Learning", "description": "Fall 2022, 2023"}
      ]
    }
  ]
}
```

### Career Transition
```json
{
  "personal": {
    "summary": "Marketing professional transitioning to product management. Combining 5 years of customer insights with newly acquired technical skills."
  },
  "certifications": [
    {"name": "Product Management Certificate", "issuer": "Reforge"}
  ],
  "customSections": [
    {
      "title": "Relevant Coursework",
      "items": [
        {"description": "SQL for Data Analysis - Codecademy"},
        {"description": "Product Analytics - Amplitude Academy"}
      ]
    }
  ]
}
```

## Tips

1. **Quantify achievements** - Numbers make impact tangible
2. **Lead with action verbs** - "Led," "Built," "Increased," not "Responsible for"
3. **Tailor for the role** - Emphasize relevant experience
4. **Keep it scannable** - Recruiters spend 7 seconds on initial review
5. **Include keywords** - Match job posting terminology for ATS
6. **Show progression** - Titles and responsibilities should grow over time
