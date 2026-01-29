import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '@/lib/supabase';
import { scrapeWebsite } from '@/lib/scraper';
import { getStyleBySlug } from '@/lib/styles';
import { BulkProspect, ScrapedData } from '@/lib/types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Process in batches to avoid timeouts
const BATCH_SIZE = 5;

export async function POST(request: Request) {
  try {
    const { jobId } = await request.json();
    
    if (!jobId) {
      return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
    }
    
    // Get job from database
    const { data: job, error: fetchError } = await supabase
      .from('bulk_jobs')
      .select('*')
      .eq('id', jobId)
      .single();
    
    if (fetchError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    
    // Check if already processing or completed
    if (job.status === 'completed' || job.status === 'cancelled') {
      return NextResponse.json({ message: 'Job already completed' });
    }
    
    // Update status to processing
    await supabase
      .from('bulk_jobs')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', jobId);
    
    // Parse prospects
    let prospects: BulkProspect[] = [];
    try {
      prospects = typeof job.prospects_data === 'string' 
        ? JSON.parse(job.prospects_data) 
        : job.prospects_data;
    } catch {
      await supabase
        .from('bulk_jobs')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', jobId);
      return NextResponse.json({ error: 'Invalid prospects data' }, { status: 500 });
    }
    
    // Get style
    const style = await getStyleBySlug(job.style_slug);
    if (!style) {
      await supabase
        .from('bulk_jobs')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', jobId);
      return NextResponse.json({ error: 'Style not found' }, { status: 500 });
    }
    
    // Scrape sender website once (same for all prospects)
    let senderData: ScrapedData;
    try {
      senderData = await scrapeWebsite(job.sender_url);
    } catch {
      senderData = {
        url: job.sender_url,
        companyName: 'Company',
        description: 'No description available',
        keyPoints: [],
        businessType: 'b2b company',
        caseStudies: [],
        testimonials: [],
      };
    }
    
    // Transform "What We Do" once
    let transformedWhatWeDo = job.sender_what_we_do;
    try {
      const transformResponse = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: `Transform this generic service description into a specific, outcome-focused value proposition.

INPUT: "${job.sender_what_we_do}"

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
    
    // Process prospects in batches
    let processedCount = job.processed_count || 0;
    let successCount = job.success_count || 0;
    let failedCount = job.failed_count || 0;
    
    // Find unprocessed prospects
    const unprocessedProspects = prospects.filter(p => p.status === 'pending');
    
    for (let i = 0; i < unprocessedProspects.length; i += BATCH_SIZE) {
      const batch = unprocessedProspects.slice(i, i + BATCH_SIZE);
      
      // Process batch in parallel
      const batchResults = await Promise.allSettled(
        batch.map(prospect => processProspect(
          prospect, 
          style, 
          senderData, 
          transformedWhatWeDo, 
          job.sender_intent,
          job.attached_file_content
        ))
      );
      
      // Update prospects with results
      batchResults.forEach((result, idx) => {
        const prospectIdx = prospects.findIndex(p => p.rowIndex === batch[idx].rowIndex);
        if (prospectIdx === -1) return;
        
        if (result.status === 'fulfilled' && result.value) {
          prospects[prospectIdx] = {
            ...prospects[prospectIdx],
            ...result.value,
            status: 'completed',
          };
          successCount++;
        } else {
          const errorMsg = result.status === 'rejected' 
            ? result.reason?.message || 'Processing failed'
            : 'No result';
          prospects[prospectIdx] = {
            ...prospects[prospectIdx],
            status: 'failed',
            error: errorMsg,
          };
          failedCount++;
        }
        processedCount++;
      });
      
      // Update job in database after each batch
      await supabase
        .from('bulk_jobs')
        .update({
          processed_count: processedCount,
          success_count: successCount,
          failed_count: failedCount,
          prospects_data: JSON.stringify(prospects),
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);
    }
    
    // Mark job as completed
    await supabase
      .from('bulk_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);
    
    return NextResponse.json({
      message: 'Processing complete',
      processedCount,
      successCount,
      failedCount,
    });
    
  } catch (error) {
    console.error('Process error:', error);
    return NextResponse.json(
      { error: 'Processing failed' },
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
): Promise<Partial<BulkProspect> | null> {
  try {
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
    const prompt = buildBulkPrompt({
      prospect,
      targetData,
      senderData,
      style,
      intent,
      transformedWhatWeDo,
      additionalInfo,
    });
    
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
    
  } catch (error) {
    console.error(`Error processing prospect ${prospect.email}:`, error);
    throw error;
  }
}

function buildBulkPrompt(input: {
  prospect: BulkProspect;
  targetData: ScrapedData;
  senderData: ScrapedData;
  style: { name: string; promptTemplate: string; guidelines: string[] };
  intent: string;
  transformedWhatWeDo: string;
  additionalInfo?: string;
}): string {
  const { prospect, targetData, senderData, style, intent, transformedWhatWeDo, additionalInfo } = input;
  
  return `
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
}

function parseThreeEmails(response: string): string[] {
  const emails: string[] = [];
  
  // Split by EMAIL N: pattern
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
      // Format as "Subject: X\n\nBody"
      emails.push(`Subject: ${subject}\n\n${body}`);
    }
  }
  
  // Ensure we always return 3 emails
  while (emails.length < 3) {
    emails.push('');
  }
  
  return emails;
}
