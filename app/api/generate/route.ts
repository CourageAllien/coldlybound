import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getStyleBySlug } from '@/lib/styles';
import { scrapeWebsite } from '@/lib/scraper';
import { buildPrompt, parseMultipleEmails } from '@/lib/prompt-builder';

// Initialize Anthropic with API key from environment
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    
    const targetUrl = formData.get('targetUrl') as string;
    const senderUrl = formData.get('senderUrl') as string;
    const intent = formData.get('intent') as string;
    const styleSlug = formData.get('styleSlug') as string;
    const targetFirstName = formData.get('targetFirstName') as string;
    const targetLinkedInUrl = formData.get('targetLinkedInUrl') as string | null;
    const attachedFile = formData.get('attachedFile') as File | null;
    const whatWeDo = formData.get('whatWeDo') as string | null;
    
    // Validate required inputs
    if (!targetUrl || !senderUrl || !intent || !styleSlug || !targetFirstName || !attachedFile) {
      return NextResponse.json(
        { error: 'Missing required fields. Please fill all required fields and attach a file.' },
        { status: 400 }
      );
    }
    
    // 1. Get the full style with examples
    const style = await getStyleBySlug(styleSlug);
    if (!style) {
      return NextResponse.json(
        { error: `Style not found: ${styleSlug}` },
        { status: 404 }
      );
    }
    
    // 2. Extract text from attached file
    let attachedContent = '';
    try {
      const fileBuffer = await attachedFile.arrayBuffer();
      const fileName = attachedFile.name.toLowerCase();
      
      if (fileName.endsWith('.txt') || fileName.endsWith('.md') || fileName.endsWith('.csv')) {
        attachedContent = new TextDecoder().decode(fileBuffer);
      } else if (fileName.endsWith('.pdf')) {
        attachedContent = `[PDF Document: ${attachedFile.name}]\n` + await extractTextFromPDF(fileBuffer);
      } else if (fileName.endsWith('.doc') || fileName.endsWith('.docx')) {
        attachedContent = `[Word Document: ${attachedFile.name}]\n` + await extractTextFromDoc(fileBuffer);
      } else if (fileName.endsWith('.ppt') || fileName.endsWith('.pptx')) {
        attachedContent = `[PowerPoint: ${attachedFile.name}]\n` + await extractTextFromPPT(fileBuffer);
      } else {
        attachedContent = new TextDecoder().decode(fileBuffer);
      }
    } catch (e) {
      console.error('Error extracting file content:', e);
      attachedContent = `[File: ${attachedFile.name}] - Unable to extract text content`;
    }
    
    // 3. Scrape websites in parallel
    const scrapePromises = [
      scrapeWebsite(targetUrl),
      scrapeWebsite(senderUrl),
    ];
    
    // Optionally scrape LinkedIn if provided
    let linkedInData: string | undefined;
    if (targetLinkedInUrl) {
      try {
        const linkedInResult = await scrapeWebsite(targetLinkedInUrl);
        linkedInData = linkedInResult.rawContent || linkedInResult.description;
      } catch (e) {
        console.log('LinkedIn scrape failed, continuing without it:', e);
      }
    }
    
    const [targetData, senderData] = await Promise.all(scrapePromises);
    
    // 4. Transform "What We Do" from service category to specific outcome
    let transformedWhatWeDo: string | undefined;
    if (whatWeDo && whatWeDo.trim()) {
      try {
        const transformResponse = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 300,
          messages: [{
            role: 'user',
            content: `Transform this generic service description into a specific, outcome-focused value proposition.

INPUT: "${whatWeDo}"

RULES:
- Convert what they ARE into what they DO (specific outcomes)
- Include measurable results, timeframes, or specific benefits
- Keep it to 1-2 sentences max
- Make it compelling and specific

EXAMPLES:
❌ "We do SEO" → ✅ "We get B2B companies ranking on page 1 for their highest-intent keywords in 90 days"
❌ "We run paid ads" → ✅ "We build paid ad systems that generate 3-5x ROAS within 60 days"
❌ "We do lead generation" → ✅ "We book 15-30 qualified sales calls per month through cold outreach"
❌ "We're a web design agency" → ✅ "We redesign websites that convert 2-3x more visitors into leads"
❌ "We do cold email" → ✅ "We build cold email systems that book 15-30 qualified calls per month"

OUTPUT only the transformed statement, nothing else:`
          }]
        });
        
        const transformedContent = transformResponse.content.find(block => block.type === 'text');
        if (transformedContent && transformedContent.type === 'text') {
          transformedWhatWeDo = transformedContent.text.trim().replace(/^["']|["']$/g, '');
        }
      } catch (e) {
        console.log('What We Do transformation failed, using original:', e);
        transformedWhatWeDo = whatWeDo;
      }
    }
    
    // 6. Build the dynamic prompt for 5 emails
    const prompt = buildPrompt({
      style,
      targetData,
      senderData,
      intent,
      targetFirstName,
      targetLinkedInData: linkedInData,
      additionalInfo: attachedContent,
      emailCount: 5, // Generate 5 emails
      transformedWhatWeDo,
    });
    
    // 5. Generate with Claude
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096, // Increased for 5 emails
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });
    
    // 6. Parse and return multiple emails
    const textContent = response.content.find(block => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in response');
    }
    
    const emails = parseMultipleEmails(textContent.text);
    
    return NextResponse.json({
      emails,
      style: style.name,
      targetCompany: targetData.companyName,
      targetFirstName,
      transformedWhatWeDo: transformedWhatWeDo || null,
      originalWhatWeDo: whatWeDo || null,
      metadata: {
        targetBusinessType: targetData.businessType,
        senderBusinessType: senderData.businessType,
        styleSlug: style.slug,
        hadLinkedIn: !!linkedInData,
        attachedFileName: attachedFile.name,
      },
    });
  } catch (error) {
    console.error('Generation error:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('API key') || error.message.includes('authentication') || error.message.includes('401')) {
        return NextResponse.json(
          { error: 'API key issue. Please check your Anthropic API key configuration.' },
          { status: 500 }
        );
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to generate emails. Please try again.' },
      { status: 500 }
    );
  }
}

// Simple text extraction helpers
async function extractTextFromPDF(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  
  const textMatches = text.match(/\(([^)]+)\)/g) || [];
  const extractedText = textMatches
    .map(m => m.slice(1, -1))
    .filter(t => t.length > 2 && !/^[\\\/\d\s]+$/.test(t))
    .join(' ');
  
  if (extractedText.length > 50) {
    return extractedText.slice(0, 5000);
  }
  
  return 'PDF content could not be fully extracted. Please copy/paste key information into the intent field for best results.';
}

async function extractTextFromDoc(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  
  const textMatches = text.match(/<w:t[^>]*>([^<]+)<\/w:t>/g) || [];
  const extractedText = textMatches
    .map(m => m.replace(/<[^>]+>/g, ''))
    .join(' ');
  
  if (extractedText.length > 50) {
    return extractedText.slice(0, 5000);
  }
  
  return 'Document content could not be fully extracted. Please copy/paste key information into the intent field for best results.';
}

async function extractTextFromPPT(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  
  const textMatches = text.match(/<a:t[^>]*>([^<]+)<\/a:t>/g) || [];
  const extractedText = textMatches
    .map(m => m.replace(/<[^>]+>/g, ''))
    .join(' ');
  
  if (extractedText.length > 50) {
    return extractedText.slice(0, 5000);
  }
  
  return 'Presentation content could not be fully extracted. Please copy/paste key information into the intent field for best results.';
}
