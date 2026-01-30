import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '@/lib/supabase';
import { scrapeWebsite } from '@/lib/scraper';
import { getStyleBySlug } from '@/lib/styles';
import { validateEmails } from '@/lib/email-validator';
import { BulkProspect, ScrapedData, EmailStyle } from '@/lib/types';

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
    
    // Get the ACTUAL style with all its templates and examples
    const style = await getStyleBySlug(job.style_slug);
    if (!style) {
      console.error(`Style not found: ${job.style_slug}`);
      // Use a fallback but log the error
    }
    
    console.log(`Job ${jobId}: Using style "${style?.name || job.style_slug}"`);
    
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
  style: EmailStyle | null,
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
    
    // Validate emails for fabricated content
    const verifiedCaseStudies = senderData.caseStudies?.map(cs => `${cs.company}: ${cs.result}`) || [];
    const verifiedTestimonials = senderData.testimonials?.map(t => t.quote) || [];
    
    const validation = validateEmails(emails, verifiedCaseStudies, verifiedTestimonials);
    
    if (!validation.overallValid) {
      console.warn(`[QA WARNING] Prospect ${prospect.email}: ${validation.totalWarnings} potential fabrication(s) detected`);
      validation.results.forEach((result, idx) => {
        if (result.warnings.length > 0) {
          console.warn(`  Email ${idx + 1}: ${result.warnings.join('; ')}`);
        }
      });
    }
    
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
  style: EmailStyle | null;
  intent: string;
  transformedWhatWeDo: string;
  additionalInfo?: string;
}): string {
  const { prospect, targetData, senderData, style, intent, transformedWhatWeDo, additionalInfo } = input;
  
  // Build examples section from style
  const examplesSection = style?.examples?.length ? `
STYLE EXAMPLES (Follow this tone, structure, and approach):
${style.examples.slice(0, 2).map((ex, i) => `
--- EXAMPLE ${i + 1} ---
Context: ${ex.context}
Subject: ${ex.subject}
Body:
${ex.body}
Why it works: ${ex.whyItWorks}
---
`).join('\n')}
` : '';

  // Build guidelines section
  const guidelinesSection = style?.guidelines?.length ? `
STYLE GUIDELINES (MUST FOLLOW):
${style.guidelines.map(g => `- ${g}`).join('\n')}
` : '';

  return `
You are an expert cold email copywriter using the "${style?.name || 'Professional'}" framework.

=== OFFER VS SERVICE (CRITICAL) ===
NEVER write emails that just mention a service ("We do X"). ALWAYS present an OFFER:
- SPECIFIC OUTCOME: What exactly will they get? (5 new clients, 10 qualified calls)
- CLEAR TIMEFRAME: When? (in 30 days, within 60 days)  
- MECHANISM: HOW you deliver it - this makes it believable
- PROOF: Who else you've helped (only if verified above)

THE MECHANISM IS EVERYTHING - Cold traffic does NOT believe the result until they understand the METHOD.
❌ "We book 10 meetings a month" (no mechanism)
✅ "We book meetings by targeting companies hiring SDRs using intent signals" (includes mechanism)

If you can't sell the RESULT, sell the INFORMATION (low friction, high curiosity):
❌ "We'll get you 10 leads" (needs trust)
✅ "Report on 5 things competitors are doing to steal your leads" (high curiosity)

=== EMAIL STYLE FRAMEWORK ===
${style?.promptTemplate || 'Write professional, personalized cold emails.'}

${guidelinesSection}

${examplesSection}

=== CRITICAL FORMAT REQUIREMENTS ===
1. Each email MUST be 3-5 paragraphs (not less than 3, not more than 5)
2. Total word count: 80-100 words per email
3. SUBJECT LINE: 1-3 words only, lowercase, no punctuation
4. Each email must use a DIFFERENT angle/hook based on the ${style?.name || 'chosen'} framework
5. End with a soft, interest-based CTA (not asking for time/meeting)

=== STYLE RULES ===
- Minimize "I, we, our" language - focus on THEM
- Zero marketing jargon - write conversationally
- Professional but not overly formal
- Use plenty of white space between paragraphs

=== TARGET PROSPECT ===
- First Name: ${prospect.firstName}
- Last Name: ${prospect.lastName}
- Job Title: ${prospect.jobTitle}
- Company: ${prospect.companyName}
- Website: ${prospect.website}
${prospect.city ? `- Location: ${prospect.city}${prospect.country ? ', ' + prospect.country : ''}` : ''}

=== TARGET COMPANY RESEARCH ===
- Company: ${targetData.companyName}
- What they do: ${targetData.description}
- Key details: ${targetData.keyPoints.join(', ') || 'None found'}
- Business type: ${targetData.businessType}
${targetData.rawContent ? `\nWebsite excerpt:\n${targetData.rawContent.slice(0, 1000)}` : ''}

=== SENDER INFO ===
- Company: ${senderData.companyName}
- Value Proposition: ${transformedWhatWeDo}
- Intent: ${intent}
${senderData.caseStudies && senderData.caseStudies.length > 0 ? `
VERIFIED CASE STUDIES (you may ONLY reference these exact ones):
${senderData.caseStudies.map((cs, i) => `${i + 1}. ${cs.company}: ${cs.result}`).join('\n')}
` : `
NO CASE STUDIES PROVIDED - Do not reference any client names, results, or statistics.
`}
${senderData.testimonials && senderData.testimonials.length > 0 ? `
VERIFIED TESTIMONIALS (you may ONLY use these exact quotes):
${senderData.testimonials.map((t, i) => `${i + 1}. "${t.quote}" - ${t.author}`).join('\n')}
` : ''}
${additionalInfo ? `\nAdditional context:\n${additionalInfo.slice(0, 1000)}` : ''}

=== ANTI-FABRICATION RULES (CRITICAL - MUST FOLLOW) ===
DO NOT invent or fabricate ANY of the following:
1. NO fake percentages (e.g., "increased by 47%") unless from verified case studies above
2. NO fake company names as social proof (e.g., "companies like Acme, TechCorp use us")
3. NO fake statistics or data points
4. NO fake testimonials or quotes
5. NO fake dollar amounts or revenue claims
6. NO fake timeframes with results (e.g., "in just 30 days")
7. NO "studies show" or "research indicates" claims
8. NO specific client counts (e.g., "500+ companies trust us") unless verified

INSTEAD, focus on:
- The value proposition itself (what you can do for them)
- Questions about their potential challenges
- Observations about their business from the research
- General benefits without specific numbers

If you have NO verified case studies, write emails that focus on the VALUE PROPOSITION 
and ask curiosity-driven questions rather than making claims about results.

=== GENERATE 3 DIFFERENT EMAILS ===
Each email should apply the "${style?.name || 'Professional'}" framework differently.
Format each exactly like this:

EMAIL 1:
SUBJECT: [1-3 words, lowercase]
BODY:
[Paragraph 1: Opening hook using the ${style?.name || 'chosen'} approach]

[Paragraph 2: Connection to their situation]

[Paragraph 3: Your value/relevance]

[Paragraph 4-5 (optional): Additional context or social proof]

[Final line: Soft CTA]

EMAIL 2:
SUBJECT: [1-3 words, lowercase]  
BODY:
[Different angle using the same framework - 3-5 paragraphs, 80-100 words]

EMAIL 3:
SUBJECT: [1-3 words, lowercase]
BODY:
[Another unique angle using the same framework - 3-5 paragraphs, 80-100 words]
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
