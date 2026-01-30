import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '@/lib/supabase';
import { scrapeWebsite } from '@/lib/scraper';
import { getStyleBySlug } from '@/lib/styles';
import { BulkProspect, ScrapedData } from '@/lib/types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Estimated time per prospect in seconds (scrape + generation)
const SECONDS_PER_PROSPECT = 4;

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
    
    if (prospects.length > 1000) {
      return NextResponse.json(
        { error: 'Maximum 1000 prospects allowed' },
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
    
    // Scrape sender website once (this is shared across all prospects)
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
    
    // Transform "What We Do" once (this is shared across all prospects)
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
    
    // Calculate estimated time
    const estimatedSeconds = prospects.length * SECONDS_PER_PROSPECT;
    const estimatedMinutes = Math.ceil(estimatedSeconds / 60);
    
    // Prepare job data - store sender_data and transformed value in a metadata field
    // This way we don't need new columns in the database
    const jobMetadata = {
      senderData,
      transformedWhatWeDo,
      estimatedSeconds,
    };
    
    // Create job in Supabase with status 'pending' - processing will happen via chunks
    const { data: job, error: dbError } = await supabase
      .from('bulk_jobs')
      .insert({
        status: 'pending',
        total_prospects: prospects.length,
        processed_count: 0,
        success_count: 0,
        failed_count: 0,
        sender_url: senderUrl,
        sender_what_we_do: JSON.stringify(jobMetadata), // Store metadata here
        sender_intent: intent,
        style_slug: styleSlug,
        attached_file_content: attachedFileContent.slice(0, 10000),
        prospects_data: JSON.stringify(prospects),
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
      status: 'pending',
      totalProspects: prospects.length,
      estimatedMinutes,
      estimatedSeconds,
      message: `Job created. Estimated time: ${formatTime(estimatedSeconds)}`,
    });
    
  } catch (error) {
    console.error('Start bulk job error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start bulk job' },
      { status: 500 }
    );
  }
}

function formatTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} seconds`;
  } else if (seconds < 3600) {
    const mins = Math.ceil(seconds / 60);
    return `${mins} minute${mins > 1 ? 's' : ''}`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.ceil((seconds % 3600) / 60);
    return `${hours} hour${hours > 1 ? 's' : ''} ${mins} minute${mins > 1 ? 's' : ''}`;
  }
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
