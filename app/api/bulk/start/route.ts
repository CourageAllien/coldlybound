import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '@/lib/supabase';
import { scrapeWebsite } from '@/lib/scraper';
import { getStyleBySlug } from '@/lib/styles';
import { BulkProspect, ScrapedData } from '@/lib/types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// For Vercel, process up to 10 prospects synchronously (within timeout limits)
const SYNC_PROCESS_LIMIT = 10;

export async function POST(request: Request) {
  try {
    // Check if Supabase is configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json(
        { error: 'Supabase environment variables not configured. Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.' },
        { status: 500 }
      );
    }
    
    const formData = await request.formData();
    
    const prospectsJson = formData.get('prospects') as string;
    const senderUrl = formData.get('senderUrl') as string;
    const whatWeDo = formData.get('whatWeDo') as string;
    const intent = formData.get('intent') as string;
    const styleSlug = formData.get('styleSlug') as string;
    const attachedFile = formData.get('attachedFile') as File | null;
    
    // Validate required fields
    if (!prospectsJson || !senderUrl || !whatWeDo || !intent || !styleSlug) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Parse prospects
    let prospects: BulkProspect[];
    try {
      prospects = JSON.parse(prospectsJson);
    } catch {
      return NextResponse.json(
        { error: 'Invalid prospects data' },
        { status: 400 }
      );
    }
    
    // Validate prospect count
    if (prospects.length === 0) {
      return NextResponse.json(
        { error: 'No prospects provided' },
        { status: 400 }
      );
    }
    
    if (prospects.length > 5000) {
      return NextResponse.json(
        { error: 'Maximum 5000 prospects allowed' },
        { status: 400 }
      );
    }
    
    // Extract attached file content if provided
    let attachedFileContent = '';
    if (attachedFile) {
      try {
        const fileBuffer = await attachedFile.arrayBuffer();
        const fileName = attachedFile.name.toLowerCase();
        
        if (fileName.endsWith('.txt') || fileName.endsWith('.md') || fileName.endsWith('.csv')) {
          attachedFileContent = new TextDecoder().decode(fileBuffer);
        } else if (fileName.endsWith('.pdf')) {
          attachedFileContent = extractTextFromPDF(fileBuffer);
        } else if (fileName.endsWith('.doc') || fileName.endsWith('.docx')) {
          attachedFileContent = extractTextFromDoc(fileBuffer);
        } else {
          attachedFileContent = new TextDecoder().decode(fileBuffer);
        }
      } catch (e) {
        console.error('Error extracting file content:', e);
      }
    }
    
    // Get style
    const style = await getStyleBySlug(styleSlug);
    if (!style) {
      return NextResponse.json(
        { error: `Style not found: ${styleSlug}` },
        { status: 404 }
      );
    }
    
    // Scrape sender website once
    let senderData: ScrapedData;
    try {
      senderData = await scrapeWebsite(senderUrl);
    } catch {
      senderData = {
        url: senderUrl,
        companyName: 'Company',
        description: 'No description available',
        keyPoints: [],
        businessType: 'b2b company',
        caseStudies: [],
        testimonials: [],
      };
    }
    
    // Transform "What We Do"
    let transformedWhatWeDo = whatWeDo;
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

OUTPUT only the transformed statement, nothing else:`
        }]
      });
      
      const content = transformResponse.content.find(block => block.type === 'text');
      if (content && content.type === 'text') {
        transformedWhatWeDo = content.text.trim().replace(/^["']|["']$/g, '');
      }
    } catch (e) {
      console.log('Transform failed, using original:', e);
    }
    
    // Process prospects synchronously (for Vercel compatibility)
    let processedCount = 0;
    let successCount = 0;
    let failedCount = 0;
    
    // Process all prospects (limit to SYNC_PROCESS_LIMIT for Vercel timeout)
    const prospectsToProcess = prospects.slice(0, Math.min(prospects.length, SYNC_PROCESS_LIMIT));
    
    for (const prospect of prospectsToProcess) {
      try {
        const result = await processProspect(
          prospect,
          style,
          senderData,
          transformedWhatWeDo,
          intent,
          attachedFileContent
        );
        
        if (result) {
          prospect.generatedEmail1 = result.generatedEmail1;
          prospect.generatedEmail2 = result.generatedEmail2;
          prospect.generatedEmail3 = result.generatedEmail3;
          prospect.status = 'completed';
          successCount++;
        } else {
          prospect.status = 'failed';
          prospect.error = 'No emails generated';
          failedCount++;
        }
      } catch (error) {
        prospect.status = 'failed';
        prospect.error = error instanceof Error ? error.message : 'Processing failed';
        failedCount++;
      }
      processedCount++;
    }
    
    // Create completed job in Supabase
    const { data: job, error: dbError } = await supabase
      .from('bulk_jobs')
      .insert({
        status: 'completed',
        total_prospects: prospects.length,
        processed_count: processedCount,
        success_count: successCount,
        failed_count: failedCount,
        sender_url: senderUrl,
        sender_what_we_do: whatWeDo,
        sender_intent: intent,
        style_slug: styleSlug,
        attached_file_content: attachedFileContent.slice(0, 10000),
        prospects_data: JSON.stringify(prospects),
        completed_at: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json(
        { error: `Database error: ${dbError.message || dbError.code || 'Unknown error'}. Hint: ${dbError.hint || 'Check if bulk_jobs table exists.'}` },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      jobId: job.id,
      status: 'completed',
      totalProspects: prospects.length,
      processedCount,
      successCount,
      failedCount,
    });
    
  } catch (error) {
    console.error('Start bulk job error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start bulk job' },
      { status: 500 }
    );
  }
}

async function processProspect(
  prospect: BulkProspect,
  style: { name: string; promptTemplate: string; guidelines: string[] },
  senderData: ScrapedData,
  transformedWhatWeDo: string,
  intent: string,
  additionalInfo?: string
): Promise<{ generatedEmail1: string; generatedEmail2: string; generatedEmail3: string } | null> {
  // Scrape target website
  let targetData: ScrapedData;
  try {
    targetData = await scrapeWebsite(prospect.website);
  } catch {
    targetData = {
      url: prospect.website,
      companyName: prospect.companyName || 'Company',
      description: 'No description available',
      keyPoints: [],
      businessType: 'b2b company',
      caseStudies: [],
      testimonials: [],
    };
  }
  
  // Build prompt for 3 emails
  const prompt = `
You are an expert cold email copywriter. Write 3 DIFFERENT hyper-personalized cold emails.

CRITICAL CONSTRAINTS:
1. EMAIL BODY MUST BE UNDER 100 WORDS (non-negotiable)
2. SUBJECT LINE: 1-4 words only, lowercase, no punctuation
3. Use the target's first name naturally
4. Reference specific details from their website/company
5. Each email should have a DIFFERENT angle/hook

STYLE: ${style.name}
${style.promptTemplate}

STYLE GUIDELINES:
${style.guidelines.map(g => `- ${g}`).join('\n')}

TARGET PROSPECT:
- First Name: ${prospect.firstName}
- Last Name: ${prospect.lastName}
- Job Title: ${prospect.jobTitle}
- Company: ${prospect.companyName}
- Website: ${prospect.website}
${prospect.city ? `- Location: ${prospect.city}${prospect.country ? ', ' + prospect.country : ''}` : ''}

TARGET COMPANY RESEARCH:
- Company: ${targetData.companyName}
- What they do: ${targetData.description}
- Key details: ${targetData.keyPoints.join(', ') || 'None found'}
- Business type: ${targetData.businessType}
${targetData.rawContent ? `\nWebsite excerpt:\n${targetData.rawContent.slice(0, 1000)}` : ''}

SENDER (what you're pitching):
- Company: ${senderData.companyName}
- Value Proposition: ${transformedWhatWeDo}
- Intent: ${intent}
${senderData.caseStudies && senderData.caseStudies.length > 0 ? `
VERIFIED CASE STUDIES (use only these, don't invent):
${senderData.caseStudies.map((cs, i) => `${i + 1}. ${cs.company}: ${cs.result}`).join('\n')}
` : ''}
${additionalInfo ? `\nAdditional context:\n${additionalInfo.slice(0, 1000)}` : ''}

CRITICAL: If no case studies provided, DO NOT invent any. Focus on value proposition instead.

Generate 3 emails in this EXACT format:

EMAIL 1:
SUBJECT: [1-4 word subject]
BODY:
[Full email body - under 100 words]

EMAIL 2:
SUBJECT: [1-4 word subject]
BODY:
[Full email body - under 100 words]

EMAIL 3:
SUBJECT: [1-4 word subject]
BODY:
[Full email body - under 100 words]
`.trim();
  
  // Generate with Claude
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });
  
  const textContent = response.content.find(block => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text content in response');
  }
  
  // Parse 3 emails
  const emails = parseThreeEmails(textContent.text);
  
  return {
    generatedEmail1: emails[0] || '',
    generatedEmail2: emails[1] || '',
    generatedEmail3: emails[2] || '',
  };
}

function parseThreeEmails(response: string): string[] {
  const emails: string[] = [];
  
  const emailSections = response.split(/EMAIL\s*\d+:/i).filter(s => s.trim());
  
  for (const section of emailSections.slice(0, 3)) {
    const subjectMatch = section.match(/SUBJECT:\s*(.+?)(?:\n|$)/i);
    const bodyMatch = section.match(/BODY:\s*\n?([\s\S]+?)(?=EMAIL\s*\d+:|$)/i);
    
    let subject = subjectMatch ? subjectMatch[1].trim() : 'quick question';
    subject = subject.replace(/^["']|["']$/g, '').toLowerCase();
    
    const subjectWords = subject.split(/\s+/);
    if (subjectWords.length > 4) {
      subject = subjectWords.slice(0, 4).join(' ');
    }
    
    let body = bodyMatch ? bodyMatch[1].trim() : '';
    body = body.replace(/^---+\s*$/gm, '').replace(/EMAIL\s*\d+:\s*$/i, '').trim();
    
    if (body) {
      emails.push(`Subject: ${subject}\n\n${body}`);
    }
  }
  
  while (emails.length < 3) {
    emails.push('');
  }
  
  return emails;
}

// Simple text extraction helpers
function extractTextFromPDF(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  
  const textMatches = text.match(/\(([^)]+)\)/g) || [];
  const extractedText = textMatches
    .map(m => m.slice(1, -1))
    .filter(t => t.length > 2 && !/^[\\\/\d\s]+$/.test(t))
    .join(' ');
  
  return extractedText.length > 50 ? extractedText.slice(0, 5000) : '';
}

function extractTextFromDoc(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  
  const textMatches = text.match(/<w:t[^>]*>([^<]+)<\/w:t>/g) || [];
  const extractedText = textMatches
    .map(m => m.replace(/<[^>]+>/g, ''))
    .join(' ');
  
  return extractedText.length > 50 ? extractedText.slice(0, 5000) : '';
}
