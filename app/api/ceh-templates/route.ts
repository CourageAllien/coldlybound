import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const TEMPLATES_FILE = path.join(process.cwd(), 'data', 'ceh-templates.json');

interface Template {
  id: string;
  name: string;
  subject?: string;
  body: string;
  createdAt: string;
}

// Ensure the data directory and file exist
async function ensureFile() {
  const dir = path.dirname(TEMPLATES_FILE);
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
  
  try {
    await fs.access(TEMPLATES_FILE);
  } catch {
    await fs.writeFile(TEMPLATES_FILE, JSON.stringify({ templates: [] }, null, 2));
  }
}

export async function GET() {
  try {
    await ensureFile();
    const content = await fs.readFile(TEMPLATES_FILE, 'utf-8');
    const data = JSON.parse(content);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error reading templates:', error);
    return NextResponse.json({ templates: [] });
  }
}

export async function POST(request: Request) {
  try {
    await ensureFile();
    const body = await request.json();
    const { templates } = body as { templates: Template[] };
    
    await fs.writeFile(TEMPLATES_FILE, JSON.stringify({ templates }, null, 2));
    
    return NextResponse.json({ success: true, templates });
  } catch (error) {
    console.error('Error saving templates:', error);
    return NextResponse.json(
      { error: 'Failed to save templates' },
      { status: 500 }
    );
  }
}
