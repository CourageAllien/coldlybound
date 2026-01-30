import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '@/lib/supabase';
import { scrapeWebsite } from '@/lib/scraper';
import { BulkProspect, ScrapedData } from '@/lib/types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Process 10 prospects per chunk to stay within timeout limits
// With parallel processing, this takes ~5-10 seconds per chunk
const CHUNK_SIZE = 10;

// Process prospects in parallel batches of 5 for speed
const PARALLEL_BATCH_SIZE = 5;

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
    
    // Check if already completed or cancelled
    if (job.status === 'completed' || job.status === 'cancelled') {
      return NextResponse.json({ 
        message: 'Job already completed',
        status: job.status,
        processedCount: job.processed_count,
        successCount: job.success_count,
        failedCount: job.failed_count,
        totalProspects: job.total_prospects,
        remainingCount: 0,
        isComplete: true,
      });
    }
    
    // Parse prospects
    let prospects: BulkProspect[] = [];
    try {
      const rawData = job.prospects_data;
      prospects = typeof rawData === 'string' 
        ? JSON.parse(rawData) 
        : rawData;
      
      // Ensure prospects is an array
      if (!Array.isArray(prospects)) {
        throw new Error('Prospects data is not an array');
      }
      
      // Ensure all prospects have a status - default to 'pending' if missing
      prospects = prospects.map(p => ({
        ...p,
        status: p.status || 'pending',
      }));
      
    } catch (parseError) {
      console.error('Error parsing prospects:', parseError);
      await supabase
        .from('bulk_jobs')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', jobId);
      return NextResponse.json({ error: 'Invalid prospects data' }, { status: 500 });
    }
    
    console.log(`Job ${jobId}: Total prospects: ${prospects.length}, Pending: ${prospects.filter(p => p.status === 'pending').length}, Expected: ${job.total_prospects}`);
    
    // Verify we have all prospects (sanity check against data truncation)
    if (prospects.length !== job.total_prospects) {
      console.error(`Job ${jobId}: Prospect count mismatch! Got ${prospects.length}, expected ${job.total_prospects}`);
    }
    
    // Parse pre-processed sender data from metadata stored in sender_what_we_do
    let senderData: ScrapedData;
    let transformedWhatWeDo: string;
    
    try {
      // Try to parse metadata from sender_what_we_do (new format)
      const metadata = typeof job.sender_what_we_do === 'string'
        ? JSON.parse(job.sender_what_we_do)
        : job.sender_what_we_do;
      
      if (metadata && metadata.senderData) {
        senderData = metadata.senderData;
        transformedWhatWeDo = metadata.transformedWhatWeDo || job.sender_intent;
      } else {
        throw new Error('No metadata found');
      }
    } catch {
      // Fallback - scrape sender website if metadata not found (legacy jobs)
      console.log('No cached sender data, scraping...');
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
      transformedWhatWeDo = job.sender_intent;
    }
    
    // Get style info for prompt
    const styleInfo = {
      name: job.style_slug,
      promptTemplate: '',
      guidelines: [],
    };
    
    // Update status to processing
    if (job.status === 'pending') {
      await supabase
        .from('bulk_jobs')
        .update({ status: 'processing', updated_at: new Date().toISOString() })
        .eq('id', jobId);
    }
    
    // Find unprocessed prospects
    const unprocessedProspects = prospects.filter(p => p.status === 'pending');
    
    // If no more to process, mark as complete
    if (unprocessedProspects.length === 0) {
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
        status: 'completed',
        processedCount: job.processed_count || prospects.length,
        successCount: job.success_count || prospects.filter(p => p.status === 'completed').length,
        failedCount: job.failed_count || prospects.filter(p => p.status === 'failed').length,
        totalProspects: prospects.length,
        remainingCount: 0,
        isComplete: true,
      });
    }
    
    // Take a chunk to process
    const chunkToProcess = unprocessedProspects.slice(0, CHUNK_SIZE);
    
    let processedCount = job.processed_count || 0;
    let successCount = job.success_count || 0;
    let failedCount = job.failed_count || 0;
    
    // Process in parallel batches
    for (let i = 0; i < chunkToProcess.length; i += PARALLEL_BATCH_SIZE) {
      const batch = chunkToProcess.slice(i, i + PARALLEL_BATCH_SIZE);
      
      // Process batch in parallel
      const batchResults = await Promise.allSettled(
        batch.map(prospect => processProspect(
          prospect, 
          styleInfo, 
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
    }
    
    // Check if all prospects are now processed
    const remainingUnprocessed = prospects.filter(p => p.status === 'pending').length;
    const isComplete = remainingUnprocessed === 0;
    
    console.log(`Job ${jobId}: After processing chunk - Processed: ${processedCount}, Remaining: ${remainingUnprocessed}, IsComplete: ${isComplete}`);
    
    // Update job in database
    const { error: updateError } = await supabase
      .from('bulk_jobs')
      .update({
        status: isComplete ? 'completed' : 'processing',
        processed_count: processedCount,
        success_count: successCount,
        failed_count: failedCount,
        prospects_data: JSON.stringify(prospects),
        updated_at: new Date().toISOString(),
        ...(isComplete ? { completed_at: new Date().toISOString() } : {}),
      })
      .eq('id', jobId);
    
    if (updateError) {
      console.error('Error updating job:', updateError);
    }
    
    return NextResponse.json({
      message: isComplete ? 'Processing complete' : 'Chunk processed',
      status: isComplete ? 'completed' : 'processing',
      processedCount,
      successCount,
      failedCount,
      totalProspects: prospects.length,
      remainingCount: remainingUnprocessed,
      isComplete,
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
    
    // Build prompt for 3 emails with 80-100 word rule
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
1. EMAIL BODY MUST BE 80-100 WORDS EXACTLY (no more, no less - count carefully!)
2. SUBJECT LINE: 1-3 words only, lowercase, no punctuation
3. Personalization in the FIRST LINE - reference something specific about them
4. Call out a challenge they face, then offer a perspective on "a better way"
5. Each email should have a DIFFERENT angle/hook
6. Interest-based, low friction CTA (e.g., "Open to learning more?" - don't ask for time!)

STYLE RULES:
- Minimize "I, we, our" language - focus on THEM
- Zero marketing jargon - write the way you speak
- Professional but not overly formal
- Plenty of white space (no big chunks of text)

STYLE: ${style.name}
${style.promptTemplate}

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

Generate 3 emails in this EXACT format (each 80-100 words):

EMAIL 1:
SUBJECT: [1-3 word subject, lowercase]
BODY:
[80-100 words - personalized first line, challenge + better way, soft CTA]

EMAIL 2:
SUBJECT: [1-3 word subject, lowercase]
BODY:
[80-100 words - personalized first line, challenge + better way, soft CTA]

EMAIL 3:
SUBJECT: [1-3 word subject, lowercase]
BODY:
[80-100 words - personalized first line, challenge + better way, soft CTA]
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
    if (subjectWords.length > 3) {
      subject = subjectWords.slice(0, 3).join(' ');
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
