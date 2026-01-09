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
      
      if (fileName.endsWith('.txt') || fileName.endsWith('.md')) {
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
    
    // 4. Build the dynamic prompt for 5 emails
    const prompt = buildPrompt({
      style,
      targetData,
      senderData,
      intent,
      targetFirstName,
      targetLinkedInData: linkedInData,
      additionalInfo: attachedContent,
      emailCount: 5, // Generate 5 emails
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
