import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { BulkProspect } from '@/lib/types';

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
        
        if (fileName.endsWith('.txt') || fileName.endsWith('.md')) {
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
    
    // Create job in Supabase
    const { data: job, error: dbError } = await supabase
      .from('bulk_jobs')
      .insert({
        status: 'pending',
        total_prospects: prospects.length,
        processed_count: 0,
        success_count: 0,
        failed_count: 0,
        sender_url: senderUrl,
        sender_what_we_do: whatWeDo,
        sender_intent: intent,
        style_slug: styleSlug,
        attached_file_content: attachedFileContent.slice(0, 10000), // Limit size
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
    
    // Trigger processing (fire and forget)
    // In production, you'd use a proper queue like QStash or Supabase Edge Functions
    triggerProcessing(job.id);
    
    return NextResponse.json({
      jobId: job.id,
      status: 'pending',
      totalProspects: prospects.length,
    });
    
  } catch (error) {
    console.error('Start bulk job error:', error);
    return NextResponse.json(
      { error: 'Failed to start bulk job' },
      { status: 500 }
    );
  }
}

// Trigger processing in the background
async function triggerProcessing(jobId: string) {
  try {
    // Get the base URL for the API
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                    'http://localhost:3000';
    
    // Fire and forget - don't await
    fetch(`${baseUrl}/api/bulk/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ jobId }),
    }).catch(err => {
      console.error('Failed to trigger processing:', err);
    });
  } catch (err) {
    console.error('Failed to trigger processing:', err);
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
