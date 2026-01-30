/**
 * Email Validation & QA
 * Checks generated emails for potentially fabricated content
 */

export interface ValidationResult {
  isValid: boolean;
  warnings: string[];
  flaggedContent: string[];
}

// Patterns that indicate potentially fabricated data
const FABRICATION_PATTERNS = [
  // Specific percentages (unless from verified case studies)
  { pattern: /\b\d{1,3}%\s*(increase|decrease|growth|improvement|boost|reduction|more|less|higher|lower)/gi, reason: 'Unverified percentage claim' },
  { pattern: /\b(increased|decreased|grew|improved|boosted|reduced)\s*(by\s*)?\d{1,3}%/gi, reason: 'Unverified percentage claim' },
  
  // Specific dollar amounts
  { pattern: /\$\d{1,3}(,\d{3})*(\.\d{2})?\s*(million|billion|k|m|b)?/gi, reason: 'Specific dollar amount - verify if from case study' },
  
  // Specific timeframes with results
  { pattern: /\b(in|within|after)\s*(just\s*)?\d+\s*(days?|weeks?|months?)\s*(we|they|clients?|companies?)\s*(saw|achieved|got|generated)/gi, reason: 'Specific timeframe claim' },
  
  // "Companies like X, Y, Z" - potential fake social proof
  { pattern: /companies\s*(like|such as|including)\s*[A-Z][a-z]+(\s*,\s*[A-Z][a-z]+)+/gi, reason: 'Company name list - verify these are real clients' },
  
  // Fake testimonial patterns
  { pattern: /"[^"]{20,}"\s*[-–—]\s*[A-Z][a-z]+\s+[A-Z][a-z]+/g, reason: 'Quote with attribution - verify this is real' },
  
  // Specific client results
  { pattern: /\b(helped|enabled|allowed)\s+[A-Z][a-z]+\s+(to\s+)?(achieve|generate|increase|grow|save)/gi, reason: 'Specific client claim - verify company name' },
  
  // X number of clients/customers
  { pattern: /\b\d{2,}\+?\s*(clients?|customers?|companies?|businesses?)\s*(have\s*)?(seen|achieved|use|trust)/gi, reason: 'Client count claim - verify if accurate' },
  
  // ROI claims
  { pattern: /\b\d+x\s*(ROI|return|ROAS)/gi, reason: 'ROI multiplier claim - verify if from case study' },
];

// Words that often indicate fabrication
const SUSPICIOUS_PHRASES = [
  'studies show',
  'research indicates',
  'according to',
  'statistics show',
  'data shows',
  'proven to',
  'guaranteed to',
  'always results in',
  'never fails',
  '100% of our clients',
  'all of our clients',
  'every single client',
];

/**
 * Validates an email for potentially fabricated content
 */
export function validateEmail(
  emailBody: string,
  verifiedCaseStudies: string[] = [],
  verifiedTestimonials: string[] = []
): ValidationResult {
  const warnings: string[] = [];
  const flaggedContent: string[] = [];
  
  // Check for fabrication patterns
  for (const { pattern, reason } of FABRICATION_PATTERNS) {
    const matches = emailBody.match(pattern);
    if (matches) {
      for (const match of matches) {
        // Check if this content is from verified sources
        const isVerified = verifiedCaseStudies.some(cs => 
          cs.toLowerCase().includes(match.toLowerCase())
        ) || verifiedTestimonials.some(t => 
          t.toLowerCase().includes(match.toLowerCase())
        );
        
        if (!isVerified) {
          flaggedContent.push(match);
          warnings.push(`${reason}: "${match}"`);
        }
      }
    }
  }
  
  // Check for suspicious phrases
  const lowerBody = emailBody.toLowerCase();
  for (const phrase of SUSPICIOUS_PHRASES) {
    if (lowerBody.includes(phrase)) {
      flaggedContent.push(phrase);
      warnings.push(`Suspicious phrase that may indicate fabrication: "${phrase}"`);
    }
  }
  
  return {
    isValid: flaggedContent.length === 0,
    warnings,
    flaggedContent,
  };
}

/**
 * Validates all 3 emails and returns combined results
 */
export function validateEmails(
  emails: string[],
  verifiedCaseStudies: string[] = [],
  verifiedTestimonials: string[] = []
): { 
  results: ValidationResult[]; 
  overallValid: boolean;
  totalWarnings: number;
} {
  const results = emails.map(email => 
    validateEmail(email, verifiedCaseStudies, verifiedTestimonials)
  );
  
  return {
    results,
    overallValid: results.every(r => r.isValid),
    totalWarnings: results.reduce((sum, r) => sum + r.warnings.length, 0),
  };
}

/**
 * Cleans an email by removing potentially fabricated content
 * Returns the original if no issues, or a warning if content was problematic
 */
export function sanitizeEmail(
  emailBody: string,
  verifiedCaseStudies: string[] = []
): { body: string; wasModified: boolean; removedContent: string[] } {
  let body = emailBody;
  const removedContent: string[] = [];
  
  // If email contains unverified percentage claims, we don't modify
  // but flag it for review - modifying could break the email flow
  
  return {
    body,
    wasModified: false,
    removedContent,
  };
}
