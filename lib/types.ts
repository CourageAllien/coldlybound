// Core TypeScript interfaces for ColdlyBound

export interface EmailExample {
  id: string;
  context: string;           // What situation this example is for
  senderType: string;        // "agency", "freelancer", "saas", etc.
  targetType: string;        // "ecommerce", "b2b saas", "local business"
  subject: string;
  body: string;
  whyItWorks: string;        // Explanation for AI to understand
}

export interface EmailStyle {
  id: string;
  name: string;
  slug: string;
  description: string;
  bestFor: string[];         // ["service businesses", "high-ticket offers"]
  tone: string;              // "casual", "professional", "bold"
  averageLength: string;     // "short", "medium", "long"
  structure: string[];       // ["hook", "problem", "agitate", "solution", "cta"]
  guidelines: string[];      // Dos and don'ts
  examples: EmailExample[];  // 3-5 proven examples per style
  promptTemplate: string;    // Base prompt for this style
  createdAt?: Date;
  isActive: boolean;
}

export interface EmailStyleSummary {
  id: string;
  name: string;
  slug: string;
  description: string;
  bestFor: string[];
  tone: string;
}

export interface CaseStudy {
  company: string;
  result: string;
  context?: string;
}

export interface Testimonial {
  quote: string;
  author?: string;
  company?: string;
  role?: string;
}

export interface ScrapedData {
  url: string;
  companyName: string;
  description: string;
  keyPoints: string[];
  businessType: string;
  rawContent?: string;
  caseStudies: CaseStudy[];      // Real case studies found on the website
  testimonials: Testimonial[];   // Real testimonials/reviews found on the website
}

export interface GenerationInput {
  targetUrl: string;
  senderUrl: string;
  intent: string;
  styleSlug: string;
  targetFirstName: string;
  targetLinkedInUrl?: string;
  additionalInfo?: string;
}

export interface GeneratedEmail {
  subject: string;
  body: string;
  style: string;
  targetCompany: string;
  targetFirstName: string;
}

// Bulk Processing Types
export interface BulkProspect {
  rowIndex: number;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  companyName: string;
  website: string;
  linkedinUrl?: string;
  companyLinkedinUrl?: string;
  city?: string;
  country?: string;
  // Generated content (filled after processing)
  generatedEmail1?: string;
  generatedEmail2?: string;
  generatedEmail3?: string;
  // Processing metadata
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  confidence?: 'high' | 'medium' | 'low'; // Based on available data
}

export interface BulkJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  totalProspects: number;
  processedCount: number;
  successCount: number;
  failedCount: number;
  // Sender info (same for all prospects in this job)
  senderUrl: string;
  senderWhatWeDo: string;
  senderIntent: string;
  styleSlug: string;
  attachedFileContent?: string;
  // Timestamps
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  // Results
  prospects: BulkProspect[];
}

export interface BulkJobSummary {
  id: string;
  status: BulkJob['status'];
  totalProspects: number;
  processedCount: number;
  successCount: number;
  failedCount: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

// CSV Column mapping
export const BULK_CSV_COLUMNS = {
  required: [
    'Target Prospect First Name',
    'Target Prospect Last Name', 
    'Target Prospect Email',
    'Target Prospect Job Title',
    'Target Prospect Company Name',
    'Target Prospect Website',
  ],
  optional: [
    'Target Prospect Linkedin URL',
    'Target Prospect Company Linkedin URL',
    'Target Prospect City',
    'Target Prospect Country',
  ],
  output: [
    'Target Prospect Generated Email Copy 1',
    'Target Prospect Generated Email Copy 2',
    'Target Prospect Generated Email Copy 3',
  ],
} as const;

