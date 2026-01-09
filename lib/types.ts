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

export interface ScrapedData {
  url: string;
  companyName: string;
  description: string;
  keyPoints: string[];
  businessType: string;
  rawContent?: string;
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

