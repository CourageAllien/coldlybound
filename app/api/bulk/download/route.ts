import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { BulkProspect } from '@/lib/types';
import { generateOutputCSV } from '@/lib/csv-parser';

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
      .select('prospects_data, status')
      .eq('id', jobId)
      .single();
    
    if (fetchError || !job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }
    
    // Parse prospects
    let prospects: BulkProspect[];
    try {
      prospects = typeof job.prospects_data === 'string' 
        ? JSON.parse(job.prospects_data) 
        : job.prospects_data;
    } catch {
      return NextResponse.json(
        { error: 'Invalid job data' },
        { status: 500 }
      );
    }
    
    // Generate CSV
    const csvContent = generateOutputCSV(prospects);
    
    // Return as downloadable file
    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="coldlybound-bulk-${jobId.slice(0, 8)}.csv"`,
      },
    });
    
  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json(
      { error: 'Failed to generate download' },
      { status: 500 }
    );
  }
}
