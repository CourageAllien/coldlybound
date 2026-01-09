import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getStyleBySlug } from '@/lib/styles';
import { scrapeWebsite } from '@/lib/scraper';
import { promises as fs } from 'fs';
import path from 'path';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface Template {
  id: string;
  name: string;
  subject?: string;
  body: string;
}

async function getTemplates(): Promise<Template[]> {
  try {
    const filePath = path.join(process.cwd(), 'data', 'ceh-templates.json');
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);
    return data.templates || [];
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    
    const targetUrl = formData.get('targetUrl') as string;
    const senderUrl = formData.get('senderUrl') as string;
    const intent = formData.get('intent') as string;
    const styleSlug = formData.get('styleSlug') as string;
    const targetFirstName = formData.get('targetFirstName') as string;
    const targetLinkedInUrl = formData.get('targetLinkedInUrl') as string | null;
    const painPoint = formData.get('painPoint') as string;
    const attachedFile = formData.get('attachedFile') as File | null;
    
    if (!targetUrl || !senderUrl || !intent || !targetFirstName || !attachedFile) {
      return NextResponse.json(
        { error: 'Missing required fields.' },
        { status: 400 }
      );
    }
    
    // Extract file content
    let attachedContent = '';
    try {
      const fileBuffer = await attachedFile.arrayBuffer();
      attachedContent = new TextDecoder().decode(fileBuffer);
    } catch {
      attachedContent = `[File: ${attachedFile.name}]`;
    }
    
    // Scrape websites
    const [targetData, senderData] = await Promise.all([
      scrapeWebsite(targetUrl),
      scrapeWebsite(senderUrl),
    ]);
    
    // Get LinkedIn data if provided
    let linkedInData = '';
    if (targetLinkedInUrl) {
      try {
        const result = await scrapeWebsite(targetLinkedInUrl);
        linkedInData = result.rawContent || result.description;
      } catch {
        // Ignore LinkedIn errors
      }
    }
    
    // Get templates if using email-temp style
    let templatesSection = '';
    if (styleSlug === 'email-temp') {
      const templates = await getTemplates();
      if (templates.length > 0) {
        templatesSection = `
TEMPLATE EMAILS FOR STRUCTURAL INSPIRATION:
(Analyze the structure, flow, and tone - NEVER copy content directly. Create completely original emails using the user's information.)

${templates.map((t, i) => `
--- TEMPLATE ${i + 1}: ${t.name} ---
${t.subject ? `Subject: ${t.subject}` : '(No subject provided - you must generate one)'}
Body:
${t.body}
---
`).join('\n')}
`;
      }
    }
    
    // Get style info if not using email-temp
    let styleInfo = '';
    if (styleSlug !== 'email-temp') {
      const style = await getStyleBySlug(styleSlug);
      if (style) {
        styleInfo = `
STYLE: ${style.name}
${style.promptTemplate}
Guidelines: ${style.guidelines.join(', ')}
`;
      }
    }
    
    // Pain point mapping
    const painPointText = {
      'make-money': 'MAKE MONEY - Focus on revenue growth, new customers, increased sales, better conversion rates',
      'save-money': 'SAVE MONEY - Focus on cost reduction, efficiency gains, eliminating waste, better ROI',
      'save-time': 'SAVE TIME - Focus on automation, faster processes, reduced manual work, quicker results',
    }[painPoint] || painPoint;
    
    const prompt = `You are an expert cold email copywriter specializing in high-converting B2B outreach. Generate 8 DIFFERENT cold emails following the CEH (Cold Email Hub) framework.

CRITICAL CEH COPY RULES (MUST FOLLOW EXACTLY):
1. FIRST LINE: Maximum 12 words - punchy, personalized opener
2. SUBJECT LINE: Maximum 3 words + {{companyName}} - e.g., "quick question {{companyName}}" or "idea for {{companyName}}"
3. BODY: 3-4 sentences maximum (not counting first line or bullet points)
4. CTA: Must end with "Open to learning more?" (or very similar soft ask)
5. TOTAL WORD COUNT: Under 80 words per email
6. AVOID GENERIC COPY: If it sounds generic to you, it will sound generic to the prospect

PRIMARY PAIN POINT TO ADDRESS:
${painPointText}

${styleInfo}

${templatesSection}

TARGET INFORMATION:
- First Name: ${targetFirstName}
- Company: ${targetData.companyName}
- Website: ${targetData.url}
- Description: ${targetData.description}
- Key Details: ${targetData.keyPoints.join(', ') || 'None'}
${linkedInData ? `- LinkedIn Info: ${linkedInData}` : ''}
- Additional Context: ${attachedContent}

SENDER/PRODUCT INFORMATION:
- Company: ${senderData.companyName}
- Website: ${senderData.url}
- Description: ${senderData.description}
- Key Services: ${senderData.keyPoints.join(', ') || 'None'}

PITCH/INTENT:
${intent}

DIFFERENTIATION CHECK:
- Make sure your mechanism is NOT generic (avoid saturated terms like "SEO", "Facebook ads" unless reframed)
- Reframe common services into specific outcomes (e.g., "SEO" → "exclusive leads that aren't price shopping you")
- Be specific to their industry when possible

NOW GENERATE 8 DIFFERENT EMAILS:
Each email should have a unique angle while following all CEH rules.
Replace {{companyName}} with the actual company name in subject lines.

Format each email EXACTLY like this:

EMAIL 1:
SUBJECT: [3 words max + company name]
BODY:
[First line - max 12 words]

[2-3 more sentences - body of email]

Open to learning more?

EMAIL 2:
SUBJECT: [3 words max + company name]
BODY:
[First line - max 12 words]

[2-3 more sentences - body of email]

Open to learning more?

(Continue for all 8 emails with different angles/hooks)
`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 6000,
      messages: [{ role: 'user', content: prompt }],
    });
    
    const textContent = response.content.find(block => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in response');
    }
    
    // Parse 8 emails
    const emails = parseMultipleEmails(textContent.text, targetData.companyName);
    
    return NextResponse.json({
      emails,
      style: styleSlug === 'email-temp' ? 'Email Temp' : styleSlug,
      targetCompany: targetData.companyName,
      targetFirstName,
    });
  } catch (error) {
    console.error('CEH Generation error:', error);
    
    if (error instanceof Error && (error.message.includes('API key') || error.message.includes('401'))) {
      return NextResponse.json(
        { error: 'API key issue. Please check your Anthropic API key configuration.' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to generate emails. Please try again.' },
      { status: 500 }
    );
  }
}

function parseMultipleEmails(response: string, companyName: string): { subject: string; body: string }[] {
  const emails: { subject: string; body: string }[] = [];
  
  const emailSections = response.split(/EMAIL\s*\d+:/i).filter(s => s.trim());
  
  for (const section of emailSections) {
    const subjectMatch = section.match(/SUBJECT:\s*(.+?)(?:\n|$)/i);
    const bodyMatch = section.match(/BODY:\s*\n?([\s\S]+?)(?=EMAIL\s*\d+:|$)/i);
    
    if (subjectMatch || bodyMatch) {
      let subject = subjectMatch ? subjectMatch[1].trim() : 'quick question';
      // Replace placeholder with actual company name
      subject = subject.replace(/\{\{companyName\}\}/gi, companyName);
      subject = subject.replace(/\{\{company\}\}/gi, companyName);
      subject = subject.toLowerCase();
      
      let body = bodyMatch ? bodyMatch[1].trim() : '';
      body = body.replace(/EMAIL\s*\d+:\s*$/i, '').trim();
      
      if (body) {
        emails.push({ subject, body });
      }
    }
  }
  
  // Ensure we have at least some emails
  if (emails.length === 0) {
    const subjectMatch = response.match(/SUBJECT:\s*(.+?)(?:\n|$)/i);
    const bodyMatch = response.match(/BODY:\s*\n?([\s\S]+)/i);
    
    if (subjectMatch && bodyMatch) {
      emails.push({
        subject: subjectMatch[1].trim().toLowerCase(),
        body: bodyMatch[1].trim()
      });
    }
  }
  
  return emails;
}
