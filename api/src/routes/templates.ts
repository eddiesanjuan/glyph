/**
 * Templates Routes
 * AI-powered template generation from Airtable schema
 *
 * GET  /v1/templates - List all available built-in templates
 * POST /v1/templates - Create a custom template (returns ID usable with /v1/create)
 * GET  /v1/templates/:id - Get template details (built-in or custom)
 * POST /v1/templates/generate - Generate template from description + schema
 * POST /v1/templates/refine - Refine existing template with natural language
 * POST /v1/templates/preview - Render template with sample data
 * POST /v1/templates/batch - Generate PDFs for all records (small batches)
 * POST /v1/templates/batch/start - Start async batch job (large batches)
 * GET  /v1/templates/batch/:jobId - Get batch job status
 * GET  /v1/templates/batch/:jobId/download - Download completed batch ZIP
 * GET  /v1/templates/views - Get views for a table
 * GET  /v1/templates/count - Get record count for a view
 */

import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { resolve, join, dirname } from "path";
import { fileURLToPath } from "url";
import Mustache from "mustache";
import { createHash } from "crypto";
import {
  AirtableService,
  isValidAirtableKeyFormat,
} from "../services/airtable.js";
import {
  generateTemplateFromSchema,
  refineTemplate,
  type AirtableAISchema,
} from "../services/ai.js";
import {
  generateBatchSync,
  startBatchJob,
  getJobStatus,
  getJobResult,
  getTableViews,
  getRecordCount,
} from "../services/batch.js";
import { generatePNG } from "../services/pdf.js";
import { templateEngine } from "../services/template.js";
import type { ApiError } from "../lib/types.js";
import {
  createCustomTemplate,
  getCustomTemplate,
  isCustomTemplateId,
} from "../lib/customTemplates.js";

// In-memory cache for template preview thumbnails
const thumbnailCache = new Map<string, Buffer>();

const templates = new Hono();

/** Generate a short ETag from content using SHA-256 (first 16 hex chars). */
function generateETag(content: string | Buffer | Uint8Array): string {
  const hash = createHash("sha256");
  if (typeof content === "string") {
    hash.update(content);
  } else {
    hash.update(content);
  }
  return `"${hash.digest("hex").slice(0, 16)}"`;
}

// =============================================================================
// Request Schemas
// =============================================================================

const generateSchema = z.object({
  // Airtable connection info
  airtable: z.object({
    apiKey: z.string().min(1, "Airtable API key is required"),
    baseId: z.string().min(1, "Base ID is required"),
    tableId: z.string().min(1, "Table ID is required"),
  }),
  // User's natural language description
  description: z.string().min(10, "Please provide a more detailed description"),
  // Optional style preset
  style: z
    .enum(["modern", "professional", "classic", "vibrant", "minimal", "invoice", "report"])
    .optional(),
  // Include sample data for preview
  includeSample: z.boolean().optional().default(true),
});

const refineSchema = z.object({
  // Current template HTML
  html: z.string().min(1, "Template HTML is required"),
  // Airtable connection for schema context
  airtable: z.object({
    apiKey: z.string().min(1, "Airtable API key is required"),
    baseId: z.string().min(1, "Base ID is required"),
    tableId: z.string().min(1, "Table ID is required"),
  }),
  // User's modification request
  instruction: z.string().min(1, "Please describe what you want to change"),
});

const previewSchema = z.object({
  // Template HTML with Mustache placeholders
  html: z.string().min(1, "Template HTML is required"),
  // Data to render (typically from Airtable)
  data: z.record(z.unknown()),
});

// =============================================================================
// Built-in Template Catalog
// =============================================================================

interface TemplateCatalogEntry {
  id: string;
  name: string;
  description: string;
  category: "quote" | "invoice" | "receipt" | "report" | "letter" | "contract" | "certificate" | "proposal" | "shipping" | "other" | "purchase-order" | "legal" | "service";
  sampleData: Record<string, unknown>;
}

const TEMPLATE_CATALOG: TemplateCatalogEntry[] = [
  {
    id: "quote-modern",
    name: "Modern Quote",
    description: "Clean, minimal quote with sans-serif fonts and subtle borders.",
    category: "quote",
    sampleData: {
      meta: { quoteNumber: "Q-2024-001", date: "January 15, 2024", validUntil: "February 15, 2024" },
      client: { name: "John Smith", company: "Acme Corporation" },
      lineItems: [
        { description: "Website Design", quantity: 1, unitPrice: "3,500.00", total: "3,500.00" },
      ],
      totals: { subtotal: "3,500.00", total: "3,500.00" },
      branding: { companyName: "Design Studio Pro" },
    },
  },
  {
    id: "quote-bold",
    name: "Bold Quote",
    description: "High-impact modern design with strong visual hierarchy.",
    category: "quote",
    sampleData: {
      meta: { quoteNumber: "Q-2024-042", date: "January 18, 2024", validUntil: "February 18, 2024" },
      client: { name: "Sarah Chen", company: "Horizon Ventures" },
      lineItems: [
        { description: "Brand Strategy Workshop", quantity: 1, unitPrice: "5,000.00", total: "5,000.00" },
      ],
      totals: { subtotal: "5,000.00", total: "5,000.00" },
      branding: { companyName: "BOLD STUDIO" },
    },
  },
  {
    id: "quote-professional",
    name: "Professional Quote",
    description: "Traditional business style with formal serif typography.",
    category: "quote",
    sampleData: {
      meta: { quoteNumber: "Q-2024-001", date: "January 15, 2024", validUntil: "February 15, 2024" },
      client: { name: "John Smith", company: "Acme Corporation" },
      lineItems: [
        { description: "Consulting Services", quantity: 20, unitPrice: "250.00", total: "5,000.00" },
      ],
      totals: { subtotal: "5,000.00", total: "5,000.00" },
      branding: { companyName: "Professional Services Inc." },
    },
  },
  {
    id: "invoice-clean",
    name: "Clean Invoice",
    description: "Clear, structured invoice with line items, totals, and payment terms.",
    category: "invoice",
    sampleData: {
      invoice: { number: "INV-2024-0042", date: "January 20, 2024", dueDate: "February 19, 2024" },
      billTo: { name: "Sarah Chen", company: "Northwind Traders" },
      lineItems: [
        { description: "Brand Identity Package", quantity: 1, rate: "4,500.00", amount: "4,500.00" },
      ],
      totals: { subtotal: "4,500.00", total: "4,500.00" },
      branding: { companyName: "Studio Forma" },
    },
  },
  {
    id: "receipt-minimal",
    name: "Minimal Receipt",
    description: "Compact receipt layout for point-of-sale or digital transactions.",
    category: "receipt",
    sampleData: {
      merchant: { name: "The Daily Grind" },
      receipt: { number: "R-8847", date: "Jan 20, 2024", time: "9:32 AM" },
      items: [
        { name: "Oat Milk Latte (L)", quantity: 2, price: "5.50" },
      ],
      totals: { subtotal: "11.00", tax: "0.99", total: "11.99" },
      payment: { method: "Visa ending in 4242" },
    },
  },
  {
    id: "report-cover",
    name: "Report Cover Page",
    description: "Professional cover page for reports with title, author, and abstract.",
    category: "report",
    sampleData: {
      report: {
        title: "Q4 2024 Market Analysis",
        subtitle: "Trends, Opportunities, and Strategic Recommendations",
        author: "Dr. Emily Rodriguez",
        date: "January 15, 2024",
        organization: "Meridian Research Group",
      },
    },
  },
  {
    id: "contract-simple",
    name: "Simple Contract",
    description: "Clean service agreement with numbered clauses, party details, and signature lines.",
    category: "contract",
    sampleData: {
      contract: {
        title: "Service Agreement",
        number: "CTR-2024-0042",
        effectiveDate: "March 1, 2024",
        term: "12 months",
        jurisdiction: "State of California",
      },
      parties: {
        party1: { name: "Acme Solutions Inc.", address: "100 Innovation Drive\nSan Francisco, CA 94105" },
        party2: { name: "Northwind Traders LLC", address: "250 Commerce Street\nPortland, OR 97201" },
      },
      sections: [
        { number: "1", title: "Scope of Services", content: "The Service Provider agrees to deliver software development consulting services as outlined in Exhibit A." },
        { number: "2", title: "Compensation", content: "The Client agrees to pay a monthly retainer of $15,000 USD, due on the first business day of each month." },
        { number: "3", title: "Confidentiality", content: "Both parties agree to maintain the confidentiality of all proprietary information shared during the term of this agreement." },
        { number: "4", title: "Termination", content: "Either party may terminate this agreement with thirty (30) days written notice." },
      ],
      signatures: { showLines: true },
    },
  },
  {
    id: "certificate-modern",
    name: "Modern Certificate",
    description: "Elegant certificate of achievement with centered layout and decorative border.",
    category: "certificate",
    sampleData: {
      certificate: {
        title: "Certificate of Achievement",
        recipientName: "Alexandra Chen",
        description: "In recognition of exceptional performance and dedication in the Advanced Software Engineering Program.",
        date: "March 15, 2024",
        issuer: "Dr. James Walker",
        issuerTitle: "Program Director",
        organization: "Meridian Institute of Technology",
      },
    },
  },
  {
    id: "letter-business",
    name: "Business Letter",
    description: "Professional business letter with sender/recipient blocks, subject line, and formal layout.",
    category: "letter",
    sampleData: {
      letter: {
        date: "January 15, 2024",
        senderName: "Michael Torres",
        senderTitle: "Vice President, Business Development",
        senderCompany: "Cascade Partners LLC",
        senderAddress: "800 Fifth Avenue, Suite 3200\nSeattle, WA 98104",
        recipientName: "Sarah Chen",
        recipientTitle: "Chief Technology Officer",
        recipientCompany: "Horizon Dynamics Inc.",
        recipientAddress: "1200 Market Street\nSan Francisco, CA 94103",
        subject: "Strategic Partnership Proposal - Q1 2024",
        salutation: "Dear Ms. Chen,",
        body: [
          "I am writing to express our strong interest in establishing a strategic partnership between Cascade Partners and Horizon Dynamics.",
          "Cascade Partners brings over fifteen years of expertise in cloud infrastructure optimization. Combined with your innovative approach to AI-driven analytics, we see a significant opportunity.",
          "Please let me know if you are available for a meeting during the week of February 5th.",
        ],
        closing: "Sincerely,",
      },
    },
  },
  {
    id: "proposal-basic",
    name: "Basic Proposal",
    description: "Clean project proposal with deliverables, timeline, and pricing breakdown.",
    category: "proposal",
    sampleData: {
      proposal: {
        title: "Website Redesign & Development",
        number: "PROP-2024-018",
        date: "January 25, 2024",
        validUntil: "February 24, 2024",
        description: "A comprehensive redesign and development of your company website to improve user experience, modernize the visual identity, and increase conversion rates.",
      },
      client: {
        name: "James Mitchell",
        company: "Clearwater Analytics",
        address: "450 Market Street\nSuite 800\nSan Francisco, CA 94105",
        email: "james@clearwater.io",
      },
      deliverables: [
        { title: "Discovery & Research", description: "Stakeholder interviews, competitive analysis, user research, and requirements documentation." },
        { title: "UX Design", description: "Wireframes, user flows, and interactive prototypes for all key pages." },
        { title: "Visual Design", description: "High-fidelity mockups, design system, and component library." },
        { title: "Frontend Development", description: "Responsive implementation using Next.js with performance optimization." },
        { title: "QA & Launch", description: "Cross-browser testing, accessibility audit, and production deployment." },
      ],
      timeline: [
        { phase: "Discovery & Research", duration: "2 weeks", details: "Kickoff, interviews, audit" },
        { phase: "UX & Visual Design", duration: "3 weeks", details: "Wireframes, prototypes, mockups" },
        { phase: "Development", duration: "4 weeks", details: "Build, integrate, iterate" },
        { phase: "QA & Launch", duration: "1 week", details: "Testing, fixes, deployment" },
      ],
      pricing: {
        lineItems: [
          { description: "Discovery & Research", details: "Stakeholder interviews, competitive audit", amount: "3,500.00" },
          { description: "UX & Visual Design", details: "Wireframes, prototypes, design system", amount: "8,500.00" },
          { description: "Frontend Development", details: "Next.js implementation, CMS integration", amount: "12,000.00" },
          { description: "QA & Launch Support", details: "Testing, accessibility, deployment", amount: "2,000.00" },
        ],
        subtotal: "26,000.00",
        total: "26,000.00",
      },
      terms: "Payment is due in three installments: 40% upon signing, 30% at design approval, and 30% upon project completion.",
      branding: {
        logoInitial: "A",
        companyName: "Apex Digital Studio",
        companyAddress: "220 Design Way\nAustin, TX 78701",
      },
      styles: { accentColor: "#2563eb" },
    },
  },
  {
    id: "shipping-label",
    name: "Shipping Label",
    description: "Standard 4x6 shipping label with sender/recipient addresses, tracking barcode, and shipment details.",
    category: "shipping",
    sampleData: {
      sender: {
        name: "John Martinez",
        company: "Acme Fulfillment Center",
        address: "1234 Warehouse Blvd",
        city: "Memphis",
        state: "TN",
        zip: "38118",
        phone: "(901) 555-0123",
      },
      recipient: {
        name: "Sarah Chen",
        company: "Horizon Dynamics Inc.",
        address: "567 Innovation Drive, Suite 200",
        city: "San Francisco",
        state: "CA",
        zip: "94105",
        phone: "(415) 555-0456",
      },
      shipment: {
        trackingNumber: "1Z999AA10123456784",
        weight: "3.2 lbs",
        dimensions: "12x10x8 in",
        method: "Ground",
        carrier: "UPS",
        serviceType: "2-Day Air",
        shipDate: "Jan 28, 2024",
      },
      branding: { companyColor: "#351c15" },
    },
  },
  {
    id: "resume",
    name: "Professional Resume",
    description: "Clean, ATS-friendly resume/CV template with experience, education, and skills sections.",
    category: "other",
    sampleData: {
      name: "Sarah Chen",
      title: "Senior Software Engineer",
      email: "sarah.chen@email.com",
      phone: "(555) 123-4567",
      location: "San Francisco, CA",
      linkedin: "linkedin.com/in/sarahchen",
      website: "sarahchen.dev",
      summary: "Results-driven software engineer with 8+ years of experience building scalable web applications. Expert in TypeScript, React, and Node.js.",
      experience: [
        { company: "Tech Corp", role: "Senior Software Engineer", dates: "2020 - Present", description: "Led development of microservices architecture serving 10M+ users." },
        { company: "StartupXYZ", role: "Software Engineer", dates: "2016 - 2020", description: "Built core product features from 0 to 1, growing user base 10x." },
      ],
      education: [
        { school: "Stanford University", degree: "M.S. Computer Science", dates: "2014 - 2016" },
        { school: "UC Berkeley", degree: "B.S. Computer Science", dates: "2010 - 2014" },
      ],
      skills: ["TypeScript", "React", "Node.js", "PostgreSQL", "AWS", "Docker", "Kubernetes"],
      styles: { accentColor: "#2563eb" },
    },
  },
  {
    id: "menu",
    name: "Restaurant Menu",
    description: "Elegant restaurant or cafe menu with sections, item descriptions, and dietary badges.",
    category: "other",
    sampleData: {
      restaurant_name: "The Golden Fork",
      tagline: "Farm to Table Since 2010",
      address: "123 Main Street, San Francisco, CA",
      phone: "(415) 555-0123",
      hours: "Mon-Sat 11am-10pm, Sun 10am-9pm",
      sections: [
        {
          name: "Appetizers",
          items: [
            { name: "Bruschetta", description: "Fresh tomatoes, basil, garlic on toasted bread", price: "12", vegetarian: true },
            { name: "Calamari Fritti", description: "Crispy fried calamari with marinara", price: "16" },
          ],
        },
        {
          name: "Main Courses",
          items: [
            { name: "Grilled Salmon", description: "Atlantic salmon with lemon butter sauce", price: "28", popular: true },
            { name: "Mushroom Risotto", description: "Arborio rice with wild mushrooms", price: "22", vegetarian: true, vegan: true },
          ],
        },
      ],
      styles: { accentColor: "#8b4513" },
    },
  },
  {
    id: "event-ticket",
    name: "Event Ticket",
    description: "Professional event or concert ticket with seating info, barcode, and tear-off stub.",
    category: "other",
    sampleData: {
      event_name: "Summer Music Festival 2024",
      event_subtitle: "Featuring Taylor Swift",
      date: "Saturday, August 15, 2024",
      time: "Doors 6:00 PM | Show 7:30 PM",
      venue: "Madison Square Garden",
      venue_address: "4 Pennsylvania Plaza, New York, NY 10001",
      seat_section: "Orchestra",
      seat_row: "A",
      seat_number: "12",
      ticket_holder_name: "John Smith",
      ticket_type: "VIP",
      ticket_price: "$250.00",
      barcode_value: "TKT-2024-SMF-001234",
      order_number: "ORD-789456",
      styles: { accentColor: "#7c3aed" },
    },
  },
  {
    id: "packing-slip",
    name: "Packing Slip",
    description: "Warehouse-friendly packing slip with item details, SKUs, and checkboxes.",
    category: "shipping",
    sampleData: {
      order_number: "ORD-2024-00156",
      order_date: "January 25, 2024",
      ship_date: "January 28, 2024",
      ship_to: {
        name: "John Smith",
        company: "Acme Corp",
        address: "123 Main Street",
        city: "San Francisco",
        state: "CA",
        zip: "94105",
      },
      ship_from: {
        name: "Warehouse A",
        company: "Fulfillment Center",
        address: "456 Industrial Blvd",
        city: "Memphis",
        state: "TN",
        zip: "38118",
      },
      items: [
        { name: "Wireless Headphones", sku: "WH-001", quantity: 1, location: "A-12-3" },
        { name: "USB-C Cable (6ft)", sku: "USB-C-6", quantity: 2, location: "B-04-1" },
        { name: "Phone Case - Black", sku: "PC-BLK-L", quantity: 1, location: "C-08-2" },
      ],
      tracking_number: "1Z999AA10123456784",
      notes: "Handle with care - fragile items",
      branding: { companyName: "TechStore Inc.", companyLogo: "" },
    },
  },
  {
    id: "purchase-order",
    name: "Purchase Order",
    description: "Professional purchase order with vendor info, buyer details, line items, and shipping terms.",
    category: "purchase-order",
    sampleData: {
      po_number: "PO-2024-0089",
      date: "January 28, 2024",
      vendor: {
        name: "Industrial Supply Co.",
        address: "500 Commerce Drive\nUnit 12\nChicago, IL 60612",
        email: "orders@industrialsupply.com",
        phone: "(312) 555-0199",
      },
      buyer: {
        name: "Michael Chen",
        company: "Apex Manufacturing Inc.",
        address: "1200 Factory Lane\nBuilding C\nDetroit, MI 48201",
        email: "mchen@apexmfg.com",
      },
      shipping: {
        method: "Ground",
        deliveryDate: "February 15, 2024",
        terms: "FOB Destination",
      },
      items: [
        { description: "Industrial Ball Bearings (50mm)", sku: "BB-50-SS", quantity: 100, unit_price: "12.50", amount: "1,250.00" },
        { description: "Hydraulic Cylinder Seals", sku: "HCS-200", quantity: 25, unit_price: "45.00", amount: "1,125.00" },
        { description: "Precision Motor Shaft", sku: "PMS-1500", quantity: 10, unit_price: "189.00", amount: "1,890.00" },
      ],
      totals: {
        subtotal: "4,265.00",
        shipping: "150.00",
        tax: "364.24",
        taxRate: 8.25,
        total: "4,779.24",
      },
      terms: "Net 30. Payment due within 30 days of invoice date.",
      notes: "Please include packing slip with shipment.",
      branding: {
        logoInitial: "A",
        companyName: "Apex Manufacturing Inc.",
        companyAddress: "1200 Factory Lane\nDetroit, MI 48201",
      },
      styles: { accentColor: "#2563eb" },
    },
  },
  {
    id: "statement-of-work",
    name: "Statement of Work",
    description: "Professional SOW document defining project scope, deliverables, timeline, and payment terms between client and contractor.",
    category: "legal",
    sampleData: {
      project_name: "E-Commerce Platform Redesign",
      client_name: "Northwind Traders LLC",
      contractor_name: "Apex Development Inc.",
      scope_of_work: "Design and develop a modern e-commerce platform including:\n- User authentication and account management\n- Product catalog with search and filtering\n- Shopping cart and checkout flow\n- Payment gateway integration (Stripe)\n- Admin dashboard for inventory management\n- Mobile-responsive design\n- Performance optimization for SEO",
      deliverables: [
        { name: "Project Requirements Document", due_date: "February 1, 2024" },
        { name: "UI/UX Design Mockups", due_date: "March 1, 2024" },
        { name: "Development Phase 1 - Core Features", due_date: "April 15, 2024" },
        { name: "Development Phase 2 - Integrations", due_date: "May 30, 2024" },
        { name: "Final Delivery & Documentation", due_date: "June 15, 2024" },
      ],
      timeline_start: "January 15, 2024",
      timeline_end: "June 30, 2024",
      payment_terms: "50% upon signing ($37,500), 25% at midpoint delivery ($18,750), 25% upon final acceptance ($18,750). Net 30 payment terms apply to all invoices.",
      total_amount: 75000,
      signature_date: "January 10, 2024",
    },
  },
  {
    id: "nda",
    name: "Non-Disclosure Agreement",
    description: "Standard mutual NDA protecting confidential information shared between two parties with customizable terms and jurisdiction.",
    category: "legal",
    sampleData: {
      party_a_name: "Innovate Technologies Inc.",
      party_a_address: "500 Innovation Boulevard\nSan Francisco, CA 94107",
      party_b_name: "Strategic Partners LLC",
      party_b_address: "200 Business Center Drive\nAustin, TX 78701",
      effective_date: "January 15, 2024",
      confidential_info_description: "Technical specifications, software source code, algorithms, product roadmaps, business strategies, customer lists, pricing information, financial data, marketing plans, and any other proprietary information related to the parties' technology and business operations.",
      term_years: 3,
      governing_law: "State of California",
      signature_date: "January 15, 2024",
    },
  },
  {
    id: "work-order",
    name: "Work Order",
    description: "Field service work order with customer info, work description, materials list, labor costs, and priority levels for technician dispatch.",
    category: "service",
    sampleData: {
      work_order_number: "WO-2024-00157",
      customer_name: "Johnson Residence",
      customer_address: "1842 Oak Street\nSpringfield, IL 62701",
      contact_phone: "(555) 123-4567",
      work_description: "HVAC system inspection and repair. Customer reports AC unit not cooling properly. Inspect refrigerant levels, check compressor, clean condenser coils, and replace air filter.",
      materials: [
        { item: "R-410A Refrigerant (lb)", quantity: 2, unit_price: 45.00, line_total: 90.00 },
        { item: "Air Filter 20x25x1", quantity: 1, unit_price: 18.00, line_total: 18.00 },
        { item: "Capacitor 45/5 MFD", quantity: 1, unit_price: 35.00, line_total: 35.00 },
      ],
      labor_hours: 2.5,
      labor_rate: 85.00,
      labor_total: 212.50,
      materials_subtotal: 143.00,
      grand_total: 355.50,
      scheduled_date: "March 15, 2024",
      technician_name: "Mike Rodriguez",
      priority: "normal",
    },
  },
];

// =============================================================================
// Template Style Tags
// =============================================================================

const templateStyleTags: Record<string, { style: string; tags: string[] }> = {
  'quote-modern': { style: 'modern', tags: ['modern', 'minimal', 'clean'] },
  'quote-bold': { style: 'modern', tags: ['modern', 'bold', 'high-contrast'] },
  'quote-professional': { style: 'traditional', tags: ['traditional', 'formal', 'serif'] },
  'invoice-clean': { style: 'modern', tags: ['modern', 'clean', 'minimal'] },
  'receipt-minimal': { style: 'minimal', tags: ['minimal', 'compact'] },
  'report-cover': { style: 'modern', tags: ['modern', 'cover-page'] },
  'contract-simple': { style: 'traditional', tags: ['formal', 'legal'] },
  'certificate-modern': { style: 'modern', tags: ['modern', 'decorative', 'formal'] },
  'letter-business': { style: 'traditional', tags: ['traditional', 'formal', 'business'] },
  'proposal-basic': { style: 'modern', tags: ['modern', 'professional'] },
  'shipping-label': { style: 'minimal', tags: ['minimal', 'compact', 'logistics', 'thermal'] },
  'resume': { style: 'modern', tags: ['modern', 'clean', 'ats-friendly', 'professional'] },
  'menu': { style: 'elegant', tags: ['elegant', 'restaurant', 'food', 'hospitality'] },
  'event-ticket': { style: 'modern', tags: ['modern', 'ticket', 'event', 'entertainment'] },
  'packing-slip': { style: 'minimal', tags: ['minimal', 'warehouse', 'logistics', 'shipping'] },
  'purchase-order': { style: 'modern', tags: ['modern', 'professional', 'procurement', 'business'] },
  'statement-of-work': { style: 'traditional', tags: ['traditional', 'formal', 'legal', 'contract', 'project'] },
  'nda': { style: 'traditional', tags: ['traditional', 'formal', 'legal', 'confidential', 'contract'] },
  'work-order': { style: 'modern', tags: ['modern', 'service', 'field-service', 'technician', 'maintenance'] },
};

// =============================================================================
// Routes
// =============================================================================

/**
 * GET /
 * List all available built-in templates with metadata and sample data.
 */
templates.get("/", (c) => {
  const category = c.req.query("category");
  const search = c.req.query("search");
  const styleFilter = c.req.query("style");
  const tagFilter = c.req.query("tag");

  let filtered = TEMPLATE_CATALOG;

  if (category) {
    const categoryLower = category.toLowerCase();
    filtered = filtered.filter((t) => t.category.toLowerCase() === categoryLower);
  }

  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
    );
  }

  if (styleFilter) {
    const s = styleFilter.toLowerCase();
    filtered = filtered.filter((t) => {
      const meta = templateStyleTags[t.id];
      return meta && meta.style.toLowerCase() === s;
    });
  }

  if (tagFilter) {
    const tag = tagFilter.toLowerCase();
    filtered = filtered.filter((t) => {
      const meta = templateStyleTags[t.id];
      return meta && meta.tags.some((tg) => tg.toLowerCase() === tag);
    });
  }

  const body = JSON.stringify({
    templates: filtered.map((t) => ({
      ...t,
      style: templateStyleTags[t.id]?.style ?? null,
      tags: templateStyleTags[t.id]?.tags ?? [],
    })),
    count: filtered.length,
  });
  const etag = generateETag(body);

  if (c.req.header("If-None-Match") === etag) {
    return c.body(null, 304);
  }

  c.header("Cache-Control", "public, max-age=300");
  c.header("ETag", etag);
  c.header("Content-Type", "application/json; charset=UTF-8");
  return c.body(body);
});

// =============================================================================
// Custom Template Creation Schema
// =============================================================================

const createCustomTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required").max(255),
  html: z.string().min(1, "Template HTML is required"),
  schema: z.record(z.unknown()).optional().default({}),
  description: z.string().max(1000).optional(),
});

/**
 * POST /
 * Create a custom template that can be used with /v1/create via templateId.
 *
 * This endpoint allows users to store their own HTML templates with optional
 * JSON schemas. The returned template ID (tpl_xxx) can be passed to /v1/create
 * to generate PDFs using the custom template.
 *
 * Templates are stored in-memory and expire after 24 hours.
 * For persistent storage, use POST /v1/templates/saved instead.
 */
templates.post(
  "/",
  zValidator("json", createCustomTemplateSchema, (result, c) => {
    if (!result.success) {
      const error: ApiError = {
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: result.error.issues,
      };
      return c.json(error, 400);
    }
    return;
  }),
  async (c) => {
    try {
      const { name, html, schema, description } = c.req.valid("json");

      // Get the API key ID from context (set by auth middleware)
      const apiKeyId = c.get("apiKeyId") as string | undefined;

      // Create the custom template
      const template = createCustomTemplate(name, html, schema, {
        description,
        createdBy: apiKeyId,
      });

      console.log(`[Templates] Created custom template: ${template.id} (name: "${name}")`);

      return c.json(
        {
          success: true,
          id: template.id,
          name: template.name,
          createdAt: template.createdAt,
          expiresAt: template.expiresAt,
          usage: {
            createEndpoint: `/v1/create`,
            example: {
              templateId: template.id,
              data: "{ ...your data matching the schema... }",
            },
          },
          _links: {
            create: `/v1/create`,
            template: `/v1/templates/${template.id}`,
          },
        },
        201
      );
    } catch (err) {
      console.error("Template creation error:", err);
      const error: ApiError = {
        error: err instanceof Error ? err.message : "Unknown error",
        code: "TEMPLATE_CREATION_ERROR",
      };
      return c.json(error, 500);
    }
  }
);

/**
 * GET /:id/preview
 * Return a PNG thumbnail of a built-in template rendered with sample data.
 * Results are cached in-memory after first generation.
 */
templates.get("/:id/preview", async (c) => {
  const id = c.req.param("id");

  // Find template in catalog
  const catalogEntry = TEMPLATE_CATALOG.find((t) => t.id === id);
  if (!catalogEntry) {
    const error: ApiError = {
      error: `Template '${id}' not found`,
      code: "TEMPLATE_NOT_FOUND",
    };
    return c.json(error, 404);
  }

  // Return cached thumbnail if available
  if (thumbnailCache.has(id)) {
    const cached = thumbnailCache.get(id)!;
    const etag = generateETag(cached);

    if (c.req.header("If-None-Match") === etag) {
      return c.body(null, 304);
    }

    c.header("Content-Type", "image/png");
    c.header("Content-Length", String(cached.length));
    c.header("Cache-Control", "public, max-age=86400");
    c.header("ETag", etag);
    return c.body(new Uint8Array(cached));
  }

  try {
    // Load template HTML and render with sample data
    const templateHtml = await templateEngine.getTemplateHtml(id);
    const renderedHtml = Mustache.render(templateHtml, catalogEntry.sampleData);

    // Generate PNG thumbnail at 400x300
    const pngBuffer = await generatePNG(renderedHtml, {
      width: 400,
      height: 300,
    });

    // Cache for future requests
    thumbnailCache.set(id, pngBuffer);

    const etag = generateETag(pngBuffer);
    c.header("Content-Type", "image/png");
    c.header("Content-Length", String(pngBuffer.length));
    c.header("Cache-Control", "public, max-age=86400");
    c.header("ETag", etag);
    return c.body(new Uint8Array(pngBuffer));
  } catch (err) {
    console.error(`Thumbnail generation error for '${id}':`, err);
    const error: ApiError = {
      error: err instanceof Error ? err.message : "Thumbnail generation failed",
      code: "THUMBNAIL_ERROR",
    };
    return c.json(error, 500);
  }
});

/**
 * POST /generate
 * Generate a new template from Airtable schema + natural language description
 *
 * This is the KILLER FEATURE - user describes what they want, we create it.
 */
templates.post(
  "/generate",
  zValidator("json", generateSchema, (result, c) => {
    if (!result.success) {
      const error: ApiError = {
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: result.error.issues,
      };
      return c.json(error, 400);
    }
    return;
  }),
  async (c) => {
    try {
      const { airtable, description, style, includeSample } =
        c.req.valid("json");

      // Validate Airtable key format
      if (!isValidAirtableKeyFormat(airtable.apiKey)) {
        const error: ApiError = {
          error:
            "Invalid Airtable API key format. Keys should start with 'pat' or 'key'.",
          code: "INVALID_KEY_FORMAT",
        };
        return c.json(error, 400);
      }

      // Create Airtable service
      const airtableService = new AirtableService(airtable.apiKey);

      // Get table schema
      const table = await airtableService.getTableSchema(
        airtable.baseId,
        airtable.tableId
      );

      if (!table) {
        const error: ApiError = {
          error: `Table '${airtable.tableId}' not found in base.`,
          code: "TABLE_NOT_FOUND",
        };
        return c.json(error, 404);
      }

      // Format schema for AI
      const aiSchema = airtableService.formatSchemaForAI(table);

      // Get sample data if requested
      let sampleData: Record<string, unknown> | undefined;
      let sampleRecord: unknown | undefined;

      if (includeSample) {
        try {
          const records = await airtableService.getSampleRecords(
            airtable.baseId,
            airtable.tableId
          );
          if (records.length > 0) {
            sampleRecord = airtableService.formatRecordForTemplate(
              records[0],
              table
            );
            sampleData = sampleRecord as Record<string, unknown>;
          }
        } catch (err) {
          console.warn("Could not fetch sample data:", err);
          // Continue without sample data
        }
      }

      // Generate template with AI
      const result = await generateTemplateFromSchema(aiSchema, description, {
        style,
        sampleData,
      });

      // Render preview if we have sample data
      let preview: string | undefined;
      if (sampleData) {
        try {
          preview = Mustache.render(result.fullHtml, sampleData);
        } catch (err) {
          console.warn("Could not render preview:", err);
        }
      }

      return c.json({
        success: true,
        template: {
          html: result.fullHtml,
          css: result.css,
          bodyHtml: result.html,
          fieldsUsed: result.fields,
        },
        preview: preview || null,
        sampleData: sampleData || null,
        schema: {
          tableName: aiSchema.tableName,
          fieldCount: aiSchema.fields.length,
          fields: aiSchema.fields.map((f) => ({
            name: f.name,
            type: f.type,
            mustachePath: f.mustachePath,
          })),
        },
        usage: {
          tokensUsed: result.tokensUsed,
        },
      });
    } catch (err) {
      console.error("Template generation error:", err);
      const error: ApiError = {
        error: err instanceof Error ? err.message : "Unknown error",
        code: "GENERATION_ERROR",
      };
      return c.json(error, 500);
    }
  }
);

/**
 * POST /refine
 * Modify an existing template based on natural language instruction
 */
templates.post(
  "/refine",
  zValidator("json", refineSchema, (result, c) => {
    if (!result.success) {
      const error: ApiError = {
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: result.error.issues,
      };
      return c.json(error, 400);
    }
    return;
  }),
  async (c) => {
    try {
      const { html, airtable, instruction } = c.req.valid("json");

      // Validate Airtable key format
      if (!isValidAirtableKeyFormat(airtable.apiKey)) {
        const error: ApiError = {
          error:
            "Invalid Airtable API key format. Keys should start with 'pat' or 'key'.",
          code: "INVALID_KEY_FORMAT",
        };
        return c.json(error, 400);
      }

      // Create Airtable service and get schema
      const airtableService = new AirtableService(airtable.apiKey);
      const table = await airtableService.getTableSchema(
        airtable.baseId,
        airtable.tableId
      );

      if (!table) {
        const error: ApiError = {
          error: `Table '${airtable.tableId}' not found in base.`,
          code: "TABLE_NOT_FOUND",
        };
        return c.json(error, 404);
      }

      // Format schema for AI
      const aiSchema: AirtableAISchema = airtableService.formatSchemaForAI(table);

      // Refine template with AI
      const result = await refineTemplate(html, aiSchema, instruction);

      // Get sample data for preview
      let preview: string | undefined;
      try {
        const records = await airtableService.getSampleRecords(
          airtable.baseId,
          airtable.tableId
        );
        if (records.length > 0) {
          const sampleData = airtableService.formatRecordForTemplate(
            records[0],
            table
          );
          preview = Mustache.render(result.fullHtml, sampleData);
        }
      } catch (err) {
        console.warn("Could not render preview:", err);
      }

      return c.json({
        success: true,
        template: {
          html: result.fullHtml,
          css: result.css,
          bodyHtml: result.html,
          fieldsUsed: result.fields,
        },
        preview: preview || null,
        usage: {
          tokensUsed: result.tokensUsed,
        },
      });
    } catch (err) {
      console.error("Template refinement error:", err);
      const error: ApiError = {
        error: err instanceof Error ? err.message : "Unknown error",
        code: "REFINEMENT_ERROR",
      };
      return c.json(error, 500);
    }
  }
);

/**
 * POST /preview
 * Render a template with provided data (no AI involved)
 */
templates.post(
  "/preview",
  zValidator("json", previewSchema, (result, c) => {
    if (!result.success) {
      const error: ApiError = {
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: result.error.issues,
      };
      return c.json(error, 400);
    }
    return;
  }),
  async (c) => {
    try {
      const { html, data } = c.req.valid("json");

      // Render template with Mustache
      const rendered = Mustache.render(html, data);

      return c.json({
        success: true,
        html: rendered,
      });
    } catch (err) {
      console.error("Template preview error:", err);
      const error: ApiError = {
        error: err instanceof Error ? err.message : "Template rendering failed",
        code: "PREVIEW_ERROR",
      };
      return c.json(error, 500);
    }
  }
);

/**
 * GET /styles
 * List available style presets
 * NOTE: These affect visual styling only. Document structure is determined
 * automatically from the user's description (invoice, receipt, report, etc.)
 */
templates.get("/styles", (c) => {
  const body = JSON.stringify({
    styles: [
      {
        id: "modern",
        name: "Modern",
        description:
          "Clean, minimal design with lots of whitespace. Sans-serif fonts, subtle borders.",
      },
      {
        id: "professional",
        name: "Professional",
        description:
          "Traditional business style. Clean and formal, corporate appearance.",
      },
      {
        id: "classic",
        name: "Classic",
        description:
          "Traditional formal style. Serif headings, authoritative appearance.",
      },
      {
        id: "vibrant",
        name: "Vibrant",
        description:
          "Bold, colorful design with gradient accents. Eye-catching but professional.",
      },
      {
        id: "minimal",
        name: "Minimal",
        description:
          "Ultra-minimal with maximum whitespace. Typography-focused.",
      },
      {
        id: "invoice",
        name: "Invoice",
        description:
          "Optimized for financial documents. Clear tables and totals.",
      },
      {
        id: "report",
        name: "Report",
        description:
          "Professional report layout. Good for data summaries and overviews.",
      },
    ],
  });
  const etag = generateETag(body);

  if (c.req.header("If-None-Match") === etag) {
    return c.body(null, 304);
  }

  c.header("Cache-Control", "public, max-age=3600");
  c.header("ETag", etag);
  c.header("Content-Type", "application/json; charset=UTF-8");
  return c.body(body);
});

// =============================================================================
// Batch Generation Schemas
// =============================================================================

const batchSchema = z.object({
  template: z.string().min(1, "Template HTML is required"),
  airtable: z.object({
    apiKey: z.string().min(1, "Airtable API key is required"),
    baseId: z.string().min(1, "Base ID is required"),
    tableId: z.string().min(1, "Table ID is required"),
    view: z.string().optional(),
    maxRecords: z.number().int().min(1).max(500).optional().default(100),
    filterByFormula: z.string().optional(),
  }),
  output: z.object({
    filename: z.string().min(1, "Filename template is required"),
  }),
  pdfOptions: z
    .object({
      format: z.enum(["letter", "a4"]).optional(),
      landscape: z.boolean().optional(),
      scale: z.number().min(0.1).max(2).optional(),
    })
    .optional(),
});

// =============================================================================
// Batch Generation Routes
// =============================================================================

/**
 * POST /batch
 * Generate PDFs for all records synchronously (for batches <= 20 records)
 * Returns ZIP file directly
 */
templates.post(
  "/batch",
  zValidator("json", batchSchema, (result, c) => {
    if (!result.success) {
      const error: ApiError = {
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: result.error.issues,
      };
      return c.json(error, 400);
    }
    return;
  }),
  async (c) => {
    try {
      const body = c.req.valid("json");

      // Validate Airtable key format
      if (!isValidAirtableKeyFormat(body.airtable.apiKey)) {
        const error: ApiError = {
          error:
            "Invalid Airtable API key format. Keys should start with 'pat' or 'key'.",
          code: "INVALID_KEY_FORMAT",
        };
        return c.json(error, 400);
      }

      // For sync batch, limit to 20 records to avoid timeout
      const maxRecords = Math.min(body.airtable.maxRecords || 20, 20);

      // Generate batch
      const zipBuffer = await generateBatchSync({
        template: body.template,
        airtable: {
          ...body.airtable,
          maxRecords,
        },
        output: {
          format: "zip",
          filename: body.output.filename,
        },
        pdfOptions: body.pdfOptions,
      });

      // Return ZIP file
      c.header("Content-Type", "application/zip");
      c.header(
        "Content-Disposition",
        `attachment; filename="batch-${Date.now()}.zip"`
      );
      c.header("Content-Length", zipBuffer.length.toString());

      return c.body(new Uint8Array(zipBuffer));
    } catch (err) {
      console.error("Batch generation error:", err);
      const error: ApiError = {
        error: err instanceof Error ? err.message : "Unknown error",
        code: "BATCH_ERROR",
      };
      return c.json(error, 500);
    }
  }
);

/**
 * POST /batch/start
 * Start an async batch job for large batches (> 20 records)
 * Returns job ID for polling
 */
templates.post(
  "/batch/start",
  zValidator("json", batchSchema, (result, c) => {
    if (!result.success) {
      const error: ApiError = {
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: result.error.issues,
      };
      return c.json(error, 400);
    }
    return;
  }),
  async (c) => {
    try {
      const body = c.req.valid("json");

      // Validate Airtable key format
      if (!isValidAirtableKeyFormat(body.airtable.apiKey)) {
        const error: ApiError = {
          error:
            "Invalid Airtable API key format. Keys should start with 'pat' or 'key'.",
          code: "INVALID_KEY_FORMAT",
        };
        return c.json(error, 400);
      }

      // Start batch job
      const jobId = await startBatchJob({
        template: body.template,
        airtable: body.airtable,
        output: {
          format: "zip",
          filename: body.output.filename,
        },
        pdfOptions: body.pdfOptions,
      });

      // Get initial status
      const status = getJobStatus(jobId);

      return c.json({
        success: true,
        jobId,
        status: status?.status || "pending",
        total: status?.total || 0,
        message: "Batch job started. Poll /batch/:jobId for status.",
      });
    } catch (err) {
      console.error("Batch start error:", err);
      const error: ApiError = {
        error: err instanceof Error ? err.message : "Unknown error",
        code: "BATCH_START_ERROR",
      };
      return c.json(error, 500);
    }
  }
);

/**
 * GET /batch/:jobId
 * Get status of a batch job
 */
templates.get("/batch/:jobId", async (c) => {
  const jobId = c.req.param("jobId");

  const job = getJobStatus(jobId);

  if (!job) {
    const error: ApiError = {
      error: "Job not found",
      code: "JOB_NOT_FOUND",
    };
    return c.json(error, 404);
  }

  return c.json({
    jobId: job.id,
    status: job.status,
    total: job.total,
    completed: job.completed,
    failed: job.failed,
    progress: job.total > 0 ? Math.round((job.completed / job.total) * 100) : 0,
    errors: job.errors.length > 0 ? job.errors.slice(0, 10) : [], // Limit errors returned
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    downloadReady: job.status === "completed",
  });
});

/**
 * GET /batch/:jobId/download
 * Download the completed batch ZIP file
 */
templates.get("/batch/:jobId/download", async (c) => {
  const jobId = c.req.param("jobId");

  const job = getJobStatus(jobId);

  if (!job) {
    const error: ApiError = {
      error: "Job not found",
      code: "JOB_NOT_FOUND",
    };
    return c.json(error, 404);
  }

  if (job.status !== "completed") {
    const error: ApiError = {
      error: `Job is ${job.status}, not ready for download`,
      code: "JOB_NOT_READY",
    };
    return c.json(error, 400);
  }

  const zipBuffer = getJobResult(jobId);

  if (!zipBuffer) {
    const error: ApiError = {
      error: "Job result not found (may have expired)",
      code: "RESULT_NOT_FOUND",
    };
    return c.json(error, 404);
  }

  // Return ZIP file
  c.header("Content-Type", "application/zip");
  c.header("Content-Disposition", `attachment; filename="batch-${jobId}.zip"`);
  c.header("Content-Length", zipBuffer.length.toString());

  return c.body(new Uint8Array(zipBuffer));
});

/**
 * GET /views
 * Get views for a table (for UI dropdown)
 */
templates.get("/views", async (c) => {
  const apiKey = c.req.query("apiKey");
  const baseId = c.req.query("baseId");
  const tableId = c.req.query("tableId");

  if (!apiKey || !baseId || !tableId) {
    const error: ApiError = {
      error: "Missing required query parameters: apiKey, baseId, tableId",
      code: "MISSING_PARAMS",
    };
    return c.json(error, 400);
  }

  if (!isValidAirtableKeyFormat(apiKey)) {
    const error: ApiError = {
      error: "Invalid Airtable API key format",
      code: "INVALID_KEY_FORMAT",
    };
    return c.json(error, 400);
  }

  try {
    const views = await getTableViews(apiKey, baseId, tableId);
    return c.json({ success: true, views });
  } catch (err) {
    console.error("Get views error:", err);
    const error: ApiError = {
      error: err instanceof Error ? err.message : "Unknown error",
      code: "VIEWS_ERROR",
    };
    return c.json(error, 500);
  }
});

/**
 * GET /count
 * Get record count for a view (for UI display)
 */
templates.get("/count", async (c) => {
  const apiKey = c.req.query("apiKey");
  const baseId = c.req.query("baseId");
  const tableId = c.req.query("tableId");
  const view = c.req.query("view");

  if (!apiKey || !baseId || !tableId) {
    const error: ApiError = {
      error: "Missing required query parameters: apiKey, baseId, tableId",
      code: "MISSING_PARAMS",
    };
    return c.json(error, 400);
  }

  if (!isValidAirtableKeyFormat(apiKey)) {
    const error: ApiError = {
      error: "Invalid Airtable API key format",
      code: "INVALID_KEY_FORMAT",
    };
    return c.json(error, 400);
  }

  try {
    const count = await getRecordCount(apiKey, baseId, tableId, view);
    return c.json({ success: true, count });
  } catch (err) {
    console.error("Get count error:", err);
    const error: ApiError = {
      error: err instanceof Error ? err.message : "Unknown error",
      code: "COUNT_ERROR",
    };
    return c.json(error, 500);
  }
});

// =============================================================================
// Validate Request Schema
// =============================================================================

const validateBodySchema = z.object({
  data: z.record(z.unknown()),
});

/**
 * POST /:id/validate
 * Validate user-provided data against a template's JSON schema.
 * Checks for missing required fields and basic type mismatches.
 */
templates.post(
  "/:id/validate",
  zValidator("json", validateBodySchema, (result, c) => {
    if (!result.success) {
      const error: ApiError = {
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: result.error.issues,
      };
      return c.json(error, 400);
    }
    return;
  }),
  async (c) => {
    const id = c.req.param("id");

    // Find template in catalog
    const catalogEntry = TEMPLATE_CATALOG.find((t) => t.id === id);
    if (!catalogEntry) {
      const error: ApiError = {
        error: `Template '${id}' not found`,
        code: "TEMPLATE_NOT_FOUND",
      };
      return c.json(error, 404);
    }

    // Read schema.json
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const templatesDir = resolve(currentDir, "..", "..", "..", "templates");
    const schemaPath = join(templatesDir, id, "schema.json");

    try {
      const { readFile, access } = await import("fs/promises");

      try {
        await access(schemaPath);
      } catch {
        const error: ApiError = {
          error: `Schema file not found for template '${id}'`,
          code: "SCHEMA_NOT_FOUND",
        };
        return c.json(error, 404);
      }

      const raw = await readFile(schemaPath, "utf-8");
      const schema = JSON.parse(raw);
      const { data } = c.req.valid("json");

      const errors: Array<{ field: string; message: string }> = [];
      const warnings: Array<{ field: string; message: string }> = [];

      // Recursively validate properties against data
      function validateProperties(
        properties: Record<string, any>,
        requiredFields: string[],
        dataObj: Record<string, unknown>,
        prefix: string
      ) {
        for (const [key, prop] of Object.entries(properties)) {
          const fieldPath = prefix ? `${prefix}.${key}` : key;
          const value = dataObj?.[key];
          const isRequired = requiredFields.includes(key);

          if (value === undefined || value === null) {
            if (isRequired) {
              errors.push({ field: fieldPath, message: "Required field is missing" });
            } else {
              warnings.push({ field: fieldPath, message: "Optional field not provided" });
            }
            continue;
          }

          // Basic type checking
          const propDef = prop as Record<string, any>;
          const expectedType = propDef.type;

          if (expectedType) {
            let typeMatch = true;

            switch (expectedType) {
              case "string":
                typeMatch = typeof value === "string";
                break;
              case "number":
              case "integer":
                typeMatch = typeof value === "number";
                break;
              case "boolean":
                typeMatch = typeof value === "boolean";
                break;
              case "array":
                typeMatch = Array.isArray(value);
                break;
              case "object":
                typeMatch = typeof value === "object" && !Array.isArray(value);
                break;
            }

            if (!typeMatch) {
              errors.push({
                field: fieldPath,
                message: `Expected type '${expectedType}', got '${Array.isArray(value) ? "array" : typeof value}'`,
              });
              continue;
            }
          }

          // Recurse into nested objects
          if (
            propDef.type === "object" &&
            propDef.properties &&
            typeof value === "object" &&
            !Array.isArray(value)
          ) {
            validateProperties(
              propDef.properties,
              propDef.required || [],
              value as Record<string, unknown>,
              fieldPath
            );
          }
        }
      }

      if (schema.properties) {
        validateProperties(
          schema.properties,
          schema.required || [],
          data,
          ""
        );
      }

      return c.json({
        valid: errors.length === 0,
        templateId: id,
        errors,
        warnings,
      });
    } catch (err) {
      console.error(`Validation error for '${id}':`, err);
      const error: ApiError = {
        error: err instanceof Error ? err.message : "Validation failed",
        code: "VALIDATION_ERROR",
      };
      return c.json(error, 500);
    }
  }
);

/**
 * GET /:id/schema
 * Return only the JSON Schema for a template (agent-friendly).
 */
templates.get("/:id/schema", async (c) => {
  const id = c.req.param("id");

  const catalogEntry = TEMPLATE_CATALOG.find((t) => t.id === id);
  if (!catalogEntry) {
    const error: ApiError = {
      error: `Template '${id}' not found`,
      code: "TEMPLATE_NOT_FOUND",
    };
    return c.json(error, 404);
  }

  const currentDir = dirname(fileURLToPath(import.meta.url));
  const templatesDir = resolve(currentDir, "..", "..", "..", "templates");
  const schemaPath = join(templatesDir, id, "schema.json");

  try {
    const { readFile, access } = await import("fs/promises");

    try {
      await access(schemaPath);
    } catch {
      const error: ApiError = {
        error: `Schema not found for template '${id}'`,
        code: "SCHEMA_NOT_FOUND",
      };
      return c.json(error, 404);
    }

    const raw = await readFile(schemaPath, "utf-8");
    const etag = generateETag(raw);

    if (c.req.header("If-None-Match") === etag) {
      return c.body(null, 304);
    }

    c.header("Cache-Control", "public, max-age=300");
    c.header("ETag", etag);
    c.header("Content-Type", "application/schema+json; charset=UTF-8");
    return c.body(raw);
  } catch (err) {
    console.error(`Schema read error for '${id}':`, err);
    const error: ApiError = {
      error: err instanceof Error ? err.message : "Failed to read schema",
      code: "SCHEMA_READ_ERROR",
    };
    return c.json(error, 500);
  }
});

/**
 * GET /:id
 * Return full template detail including JSON schema, metadata, and sample data.
 * Supports both built-in templates and custom templates (tpl_xxx IDs).
 * Registered last to avoid matching static routes like /styles, /views, /count.
 */
templates.get("/:id", async (c) => {
  const id = c.req.param("id");

  // Check if this is a custom template (tpl_xxx format)
  if (isCustomTemplateId(id)) {
    const customTemplate = getCustomTemplate(id);
    if (!customTemplate) {
      const error: ApiError = {
        error: "Template not found or expired",
        code: "TEMPLATE_NOT_FOUND",
      };
      return c.json(error, 404);
    }

    return c.json({
      id: customTemplate.id,
      name: customTemplate.name,
      description: customTemplate.description || null,
      type: "custom",
      html: customTemplate.html,
      schema: customTemplate.schema,
      createdAt: customTemplate.createdAt,
      expiresAt: customTemplate.expiresAt,
    });
  }

  // Find template in built-in catalog
  const catalogEntry = TEMPLATE_CATALOG.find((t) => t.id === id);
  if (!catalogEntry) {
    const error: ApiError = {
      error: "Template not found",
      code: "TEMPLATE_NOT_FOUND",
    };
    return c.json(error, 404);
  }

  // Read schema.json from templates directory
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const templatesDir = resolve(currentDir, "..", "..", "..", "templates");
  const schemaPath = join(templatesDir, id, "schema.json");

  try {
    const { readFile, access } = await import("fs/promises");

    try {
      await access(schemaPath);
    } catch {
      const error: ApiError = {
        error: "Template not found",
        code: "TEMPLATE_NOT_FOUND",
      };
      return c.json(error, 404);
    }

    const raw = await readFile(schemaPath, "utf-8");
    const schema = JSON.parse(raw);
    const sampleData = Array.isArray(schema.examples) && schema.examples.length > 0
      ? schema.examples[0]
      : catalogEntry.sampleData;

    const body = JSON.stringify({
      id: catalogEntry.id,
      name: catalogEntry.name,
      description: catalogEntry.description,
      type: "builtin",
      schema,
      sampleData,
    });

    const etag = generateETag(body);
    if (c.req.header("If-None-Match") === etag) {
      return c.body(null, 304);
    }

    c.header("Cache-Control", "public, max-age=300");
    c.header("ETag", etag);
    c.header("Content-Type", "application/json; charset=UTF-8");
    return c.body(body);
  } catch (err) {
    console.error(`Schema read error for '${id}':`, err);
    const error: ApiError = {
      error: err instanceof Error ? err.message : "Failed to read template schema",
      code: "SCHEMA_READ_ERROR",
    };
    return c.json(error, 500);
  }
});

export default templates;
