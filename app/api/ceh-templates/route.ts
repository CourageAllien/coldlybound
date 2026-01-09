import { NextResponse } from 'next/server';
import { supabase, CEHTemplate } from '@/lib/supabase';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('ceh_templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ templates: [] });
    }

    return NextResponse.json({ templates: data || [] });
  } catch (error) {
    console.error('Error reading templates:', error);
    return NextResponse.json({ templates: [] });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, template, templates } = body;

    if (action === 'add') {
      // Add single template
      const { data, error } = await supabase
        .from('ceh_templates')
        .insert([{
          name: template.name,
          subject: template.subject || null,
          body: template.body,
        }])
        .select();

      if (error) throw error;
      return NextResponse.json({ success: true, template: data?.[0] });
    }

    if (action === 'bulk-add') {
      // Add multiple templates
      const { data, error } = await supabase
        .from('ceh_templates')
        .insert(templates.map((t: { name: string; subject?: string; body: string }) => ({
          name: t.name,
          subject: t.subject || null,
          body: t.body,
        })))
        .select();

      if (error) throw error;
      return NextResponse.json({ success: true, templates: data });
    }

    if (action === 'update') {
      // Update template
      const { data, error } = await supabase
        .from('ceh_templates')
        .update({
          name: template.name,
          subject: template.subject || null,
          body: template.body,
        })
        .eq('id', template.id)
        .select();

      if (error) throw error;
      return NextResponse.json({ success: true, template: data?.[0] });
    }

    if (action === 'delete') {
      // Delete template
      const { error } = await supabase
        .from('ceh_templates')
        .delete()
        .eq('id', template.id);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error with templates:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
