import { ScrapedData } from './types';

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

  return {
    url,
    companyName,
    description,
    keyPoints,
    businessType,
    rawContent: content.substring(0, 3000), // Limit raw content
  };
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
