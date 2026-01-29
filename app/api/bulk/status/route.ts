import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { BulkJobSummary } from '@/lib/types';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    
    if (!jobId) {
      return NextResponse.json(
        { error: 'Missing jobId parameter' },
        { status: 400 }
      );
    }
    
    const { data: job, error: fetchError } = await supabase
      .from('bulk_jobs')
      .select('id, status, total_prospects, processed_count, success_count, failed_count, created_at, updated_at, completed_at')
      .eq('id', jobId)
      .single();
    
    if (fetchError || !job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }
    
    const summary: BulkJobSummary = {
      id: job.id,
      status: job.status,
      totalProspects: job.total_prospects,
      processedCount: job.processed_count,
      successCount: job.success_count,
      failedCount: job.failed_count,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
      completedAt: job.completed_at,
    };
    
    return NextResponse.json({ job: summary });
    
  } catch (error) {
    console.error('Status error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch job status' },
      { status: 500 }
    );
  }
}
