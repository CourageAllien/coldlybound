import { ScrapedData, CaseStudy, Testimonial } from './types';

const JINA_API_URL = 'https://r.jina.ai/';

export async function scrapeWebsite(url: string): Promise<ScrapedData> {
  // Normalize URL
  let normalizedUrl = url.trim();
  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    normalizedUrl = 'https://' + normalizedUrl;
  }

  try {
    // Use Jina Reader API to scrape the website
    const response = await fetch(`${JINA_API_URL}${normalizedUrl}`, {
      headers: {
        'Accept': 'text/plain',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to scrape ${normalizedUrl}: ${response.status}`);
    }

    const content = await response.text();
    
    // Parse the content
    return parseScrapedContent(normalizedUrl, content);
  } catch (error) {
    console.error(`Scraping error for ${url}:`, error);
    
    // Return basic data if scraping fails
    return {
      url: normalizedUrl,
      companyName: extractCompanyNameFromUrl(normalizedUrl),
      description: 'Unable to fetch company details',
      keyPoints: [],
      businessType: 'unknown',
      rawContent: '',
      caseStudies: [],
      testimonials: [],
    };
  }
}

function parseScrapedContent(url: string, content: string): ScrapedData {
  // Extract company name from content or URL
  let companyName = extractCompanyNameFromUrl(url);
  
  // Try to find a better company name from the content
  const titleMatch = content.match(/^#\s*(.+?)(?:\n|$)/m) || content.match(/Title:\s*(.+?)(?:\n|$)/i);
  if (titleMatch) {
    const title = titleMatch[1].trim();
    // Clean up common suffixes
    companyName = title.replace(/\s*[-|–|—]\s*.+$/, '').replace(/\s*Home\s*$/i, '').trim() || companyName;
  }

  // Extract description (first paragraph or meta description)
  const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
  const description = lines.slice(0, 3).join(' ').substring(0, 500).trim() || 'No description available';

  // Extract key points (headers, bullet points, key phrases)
  const keyPoints: string[] = [];
  const headers = content.match(/^##?\s+(.+)$/gm) || [];
  headers.slice(0, 5).forEach(h => {
    const cleaned = h.replace(/^#+\s*/, '').trim();
    if (cleaned.length > 3 && cleaned.length < 100) {
      keyPoints.push(cleaned);
    }
  });

  // Detect business type
  const businessType = detectBusinessType(content, url);

  // Extract real case studies and testimonials
  const caseStudies = extractCaseStudies(content);
  const testimonials = extractTestimonials(content);

  return {
    url,
    companyName,
    description,
    keyPoints,
    businessType,
    rawContent: content.substring(0, 3000), // Limit raw content
    caseStudies,
    testimonials,
  };
}

function extractCaseStudies(content: string): CaseStudy[] {
  const caseStudies: CaseStudy[] = [];
  const lowerContent = content.toLowerCase();
  
  // Look for percentage-based results with company names
  // Patterns like "Company X increased Y by Z%", "helped X achieve Y%", etc.
  const resultPatterns = [
    // "Company increased/improved metric by X%"
    /([A-Z][a-zA-Z0-9\s&]+?)(?:\s+(?:increased|improved|boosted|grew|achieved|saw|experienced|gained))\s+(?:their\s+)?([a-zA-Z\s]+?)\s+(?:by\s+)?(\d+(?:\.\d+)?%)/gi,
    // "X% increase/improvement for Company"
    /(\d+(?:\.\d+)?%)\s+(?:increase|improvement|growth|boost|lift)\s+(?:in\s+)?([a-zA-Z\s]+?)\s+(?:for|with|at)\s+([A-Z][a-zA-Z0-9\s&]+)/gi,
    // "helped Company achieve X%"
    /helped\s+([A-Z][a-zA-Z0-9\s&]+?)\s+(?:achieve|reach|get|see)\s+(?:a\s+)?(\d+(?:\.\d+)?%)\s+([a-zA-Z\s]+)/gi,
  ];

  for (const pattern of resultPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null && caseStudies.length < 5) {
      const fullMatch = match[0];
      // Extract company name (usually the capitalized words)
      const companyMatch = fullMatch.match(/([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)*)/);
      const percentMatch = fullMatch.match(/(\d+(?:\.\d+)?%)/);
      
      if (companyMatch && percentMatch) {
        const company = companyMatch[1].trim();
        // Filter out generic words that aren't company names
        const genericWords = ['The', 'Our', 'Their', 'This', 'That', 'With', 'For', 'And', 'But'];
        if (!genericWords.includes(company) && company.length > 2) {
          caseStudies.push({
            company: company,
            result: fullMatch.substring(0, 150).trim(),
          });
        }
      }
    }
  }

  // Also look for named client mentions with results
  const clientPatterns = [
    /(?:client|customer|partner)\s+([A-Z][a-zA-Z0-9\s&]+?)\s+(?:achieved|saw|experienced|reported)\s+(.+?)(?:\.|$)/gi,
    /(?:case study|success story):\s*([A-Z][a-zA-Z0-9\s&]+?)\s*[-–—]\s*(.+?)(?:\.|$)/gi,
  ];

  for (const pattern of clientPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null && caseStudies.length < 5) {
      if (match[1] && match[2]) {
        caseStudies.push({
          company: match[1].trim(),
          result: match[2].trim().substring(0, 150),
        });
      }
    }
  }

  // Deduplicate by company name
  const seen = new Set<string>();
  return caseStudies.filter(cs => {
    const key = cs.company.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 3); // Return max 3 case studies
}

function extractTestimonials(content: string): Testimonial[] {
  const testimonials: Testimonial[] = [];
  
  // Look for quoted text (testimonials are usually in quotes)
  const quotePatterns = [
    // Standard quotes with attribution
    /"([^"]{30,300})"\s*[-–—]\s*([A-Z][a-zA-Z\s]+?)(?:,\s*([^,\n]+?))?(?:,\s*([^,\n]+?))?(?:\n|$)/g,
    // Smart quotes
    /"([^"]{30,300})"\s*[-–—]\s*([A-Z][a-zA-Z\s]+?)(?:,\s*([^,\n]+?))?(?:,\s*([^,\n]+?))?(?:\n|$)/g,
    // Blockquote style
    />\s*"?([^>\n]{30,300})"?\s*\n\s*[-–—]?\s*([A-Z][a-zA-Z\s]+)/g,
  ];

  for (const pattern of quotePatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null && testimonials.length < 5) {
      const quote = match[1]?.trim();
      const author = match[2]?.trim();
      const roleOrCompany1 = match[3]?.trim();
      const roleOrCompany2 = match[4]?.trim();
      
      if (quote && quote.length > 30 && author) {
        // Filter out generic placeholder text
        const placeholders = ['lorem ipsum', 'placeholder', 'example quote', 'testimonial here'];
        const lowerQuote = quote.toLowerCase();
        if (!placeholders.some(p => lowerQuote.includes(p))) {
          testimonials.push({
            quote: quote.substring(0, 200),
            author: author,
            role: roleOrCompany1,
            company: roleOrCompany2 || roleOrCompany1,
          });
        }
      }
    }
  }

  // Deduplicate by quote content
  const seen = new Set<string>();
  return testimonials.filter(t => {
    const key = t.quote.substring(0, 50).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 3); // Return max 3 testimonials
}

function extractCompanyNameFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    // Remove www and TLD
    const parts = hostname.replace(/^www\./, '').split('.');
    const name = parts[0];
    // Capitalize
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch {
    return 'Company';
  }
}

function detectBusinessType(content: string, url: string): string {
  const lowerContent = content.toLowerCase();
  const lowerUrl = url.toLowerCase();
  
  // Check for common business type indicators
  const typeIndicators: Record<string, string[]> = {
    'saas': ['saas', 'software as a service', 'cloud platform', 'subscription'],
    'agency': ['agency', 'studio', 'creative services', 'marketing agency'],
    'ecommerce': ['shop', 'store', 'buy now', 'add to cart', 'checkout'],
    'consulting': ['consulting', 'consultancy', 'advisory', 'consulting services'],
    'fintech': ['fintech', 'financial technology', 'payments', 'banking'],
    'healthtech': ['health tech', 'healthcare', 'medical', 'patient'],
    'edtech': ['education', 'learning', 'courses', 'training platform'],
    'marketplace': ['marketplace', 'buyers and sellers', 'platform connecting'],
    'enterprise': ['enterprise', 'fortune 500', 'large organizations'],
    'startup': ['startup', 'early stage', 'seed', 'series a'],
    'manufacturing': ['manufacturing', 'factory', 'production', 'industrial'],
    'professional services': ['law firm', 'accounting', 'legal', 'professional services'],
  };

  for (const [type, indicators] of Object.entries(typeIndicators)) {
    for (const indicator of indicators) {
      if (lowerContent.includes(indicator) || lowerUrl.includes(indicator)) {
        return type;
      }
    }
  }

  return 'b2b company';
}
