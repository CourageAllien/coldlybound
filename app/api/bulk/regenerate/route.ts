import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { BulkProspect } from '@/lib/types';

export async function POST(request: Request) {
  try {
    const { jobId, styleSlug } = await request.json();
    
    if (!jobId || !styleSlug) {
      return NextResponse.json(
        { error: 'Missing jobId or styleSlug' },
        { status: 400 }
      );
    }
    
    // Get the existing job
    const { data: job, error: fetchError } = await supabase
      .from('bulk_jobs')
      .select('*')
      .eq('id', jobId)
      .single();
    
    if (fetchError || !job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }
    
    // Parse prospects and reset their status
    let prospects: BulkProspect[] = [];
    try {
      prospects = typeof job.prospects_data === 'string'
        ? JSON.parse(job.prospects_data)
        : job.prospects_data;
      
      // Reset all prospects to pending and clear generated emails
      prospects = prospects.map(p => ({
        ...p,
        status: 'pending' as const,
        generatedEmail1: undefined,
        generatedEmail2: undefined,
        generatedEmail3: undefined,
        error: undefined,
      }));
    } catch {
      return NextResponse.json(
        { error: 'Failed to parse prospects data' },
        { status: 500 }
      );
    }
    
    // Update job with new style and reset counts
    const { error: updateError } = await supabase
      .from('bulk_jobs')
      .update({
        status: 'pending',
        style_slug: styleSlug,
        processed_count: 0,
        success_count: 0,
        failed_count: 0,
        prospects_data: JSON.stringify(prospects),
        completed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);
    
    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to reset job' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      message: 'Job reset for regeneration',
      jobId,
      styleSlug,
      totalProspects: prospects.length,
    });
    
  } catch (error) {
    console.error('Regenerate error:', error);
    return NextResponse.json(
      { error: 'Failed to start regeneration' },
      { status: 500 }
    );
  }
}
