import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Sanitize text to prevent Unicode escape sequence errors in Postgres
function sanitizeText(text: string): string {
  if (!text) return text;
  // Replace backslash-u sequences that could be interpreted as Unicode escapes
  return text
    .replace(/\\u([0-9a-fA-F]{4})/g, '\\\\u$1')  // Escape \uXXXX patterns
    .replace(/\\x([0-9a-fA-F]{2})/g, '\\\\x$1'); // Escape \xXX patterns
}

export async function GET() {
  try {
    // Check if Supabase is configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error('Supabase not configured');
      return NextResponse.json({ 
        templates: [], 
        error: 'Supabase not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to environment variables.' 
      });
    }

    const { data, error } = await supabase
      .from('ceh_templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ templates: [], error: error.message });
    }

    return NextResponse.json({ templates: data || [] });
  } catch (error) {
    console.error('Error reading templates:', error);
    return NextResponse.json({ templates: [], error: String(error) });
  }
}

export async function POST(request: Request) {
  try {
    // Check if Supabase is configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json(
        { error: 'Supabase not configured. Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your Vercel environment variables, then redeploy.' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { action, template, templates } = body;

    if (action === 'add') {
      const { data, error } = await supabase
        .from('ceh_templates')
        .insert([{
          name: sanitizeText(template.name),
          subject: template.subject ? sanitizeText(template.subject) : null,
          body: sanitizeText(template.body),
        }])
        .select();

      if (error) {
        console.error('Supabase insert error:', error);
        return NextResponse.json({ error: `Database error: ${error.message}` }, { status: 500 });
      }
      return NextResponse.json({ success: true, template: data?.[0] });
    }

    if (action === 'bulk-add') {
      const { data, error } = await supabase
        .from('ceh_templates')
        .insert(templates.map((t: { name: string; subject?: string; body: string }) => ({
          name: sanitizeText(t.name),
          subject: t.subject ? sanitizeText(t.subject) : null,
          body: sanitizeText(t.body),
        })))
        .select();

      if (error) {
        console.error('Supabase bulk insert error:', error);
        return NextResponse.json({ error: `Database error: ${error.message}` }, { status: 500 });
      }
      return NextResponse.json({ success: true, templates: data });
    }

    if (action === 'update') {
      const { data, error } = await supabase
        .from('ceh_templates')
        .update({
          name: sanitizeText(template.name),
          subject: template.subject ? sanitizeText(template.subject) : null,
          body: sanitizeText(template.body),
        })
        .eq('id', template.id)
        .select();

      if (error) {
        console.error('Supabase update error:', error);
        return NextResponse.json({ error: `Database error: ${error.message}` }, { status: 500 });
      }
      return NextResponse.json({ success: true, template: data?.[0] });
    }

    if (action === 'delete') {
      const { error } = await supabase
        .from('ceh_templates')
        .delete()
        .eq('id', template.id);

      if (error) {
        console.error('Supabase delete error:', error);
        return NextResponse.json({ error: `Database error: ${error.message}` }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error with templates:', error);
    return NextResponse.json(
      { error: `Server error: ${String(error)}` },
      { status: 500 }
    );
  }
}
