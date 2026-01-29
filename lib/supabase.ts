import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (supabaseInstance) {
    return supabaseInstance;
  }
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase environment variables not configured');
  }
  
  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  return supabaseInstance;
}

// Legacy export for compatibility - will throw if env vars not set
export const supabase = {
  from: (table: string) => getSupabase().from(table),
};

export interface CEHTemplate {
  id: string;
  name: string;
  subject?: string;
  body: string;
  created_at: string;
}

// Bulk Jobs table interface
export interface BulkJobRow {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  total_prospects: number;
  processed_count: number;
  success_count: number;
  failed_count: number;
  sender_url: string;
  sender_what_we_do: string;
  sender_intent: string;
  style_slug: string;
  attached_file_content?: string;
  prospects_data: string; // JSON string of BulkProspect[]
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

// SQL to create bulk_jobs table (run in Supabase SQL editor):
/*
CREATE TABLE IF NOT EXISTS bulk_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'pending',
  total_prospects INTEGER NOT NULL DEFAULT 0,
  processed_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  sender_url TEXT NOT NULL,
  sender_what_we_do TEXT NOT NULL,
  sender_intent TEXT NOT NULL,
  style_slug TEXT NOT NULL,
  attached_file_content TEXT,
  prospects_data JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Add index for faster status queries
CREATE INDEX IF NOT EXISTS idx_bulk_jobs_status ON bulk_jobs(status);

-- Enable RLS
ALTER TABLE bulk_jobs ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (adjust based on your auth needs)
CREATE POLICY "Allow all operations on bulk_jobs" ON bulk_jobs
  FOR ALL USING (true) WITH CHECK (true);
*/
