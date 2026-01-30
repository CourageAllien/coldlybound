import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getStyleBySlug } from '@/lib/styles';
import { scrapeWebsite } from '@/lib/scraper';
import { supabase } from '@/lib/supabase';

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
    const { data, error } = await supabase
      .from('ceh_templates')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching templates:', error);
      return [];
    }
    
    return data || [];
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
    const fileCount = parseInt(formData.get('fileCount') as string) || 0;
    
    // Collect all attached files (up to 3)
    const attachedFiles: File[] = [];
    for (let i = 0; i < fileCount; i++) {
      const file = formData.get(`attachedFile${i}`) as File | null;
      if (file) {
        attachedFiles.push(file);
      }
    }
    
    // Fallback for old single file format
    if (attachedFiles.length === 0) {
      const singleFile = formData.get('attachedFile') as File | null;
      if (singleFile) {
        attachedFiles.push(singleFile);
      }
    }
    
    if (!targetUrl || !senderUrl || !intent || !targetFirstName || attachedFiles.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields. Please attach at least one file.' },
        { status: 400 }
      );
    }
    
    // Extract content from all files
    const attachedContents: string[] = [];
    for (const file of attachedFiles) {
      try {
        const fileBuffer = await file.arrayBuffer();
        const content = new TextDecoder().decode(fileBuffer);
        attachedContents.push(`--- ${file.name} ---\n${content}\n---`);
      } catch {
        attachedContents.push(`[File: ${file.name} - could not extract content]`);
      }
    }
    const attachedContent = attachedContents.join('\n\n');
    
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
1. WORD COUNT: 80-100 words per email (no more, no less - count carefully!)
2. SUBJECT LINE: 1-3 words only (short, punchy, intriguing)
3. FIRST LINE: Personalization - reference something specific about them
4. STRUCTURE: Call out a challenge they face, then offer a perspective on "a better way"
5. CTA: Interest-based, low friction (e.g., "Open to learning more?" - don't ask for time!)
6. AVOID GENERIC COPY: If it sounds generic to you, it will sound generic to the prospect

STYLE RULES:
- Minimize "I, we, our" language - focus on THEM
- Zero marketing jargon - write the way you speak
- Professional but not overly formal
- Plenty of white space (no big chunks of text)

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
- Additional Context (${attachedFiles.length} file${attachedFiles.length > 1 ? 's' : ''} attached):
${attachedContent}

SENDER/PRODUCT INFORMATION:
- Company: ${senderData.companyName}
- Website: ${senderData.url}
- Description: ${senderData.description}
- Key Services: ${senderData.keyPoints.join(', ') || 'None'}
${senderData.caseStudies && senderData.caseStudies.length > 0 ? `
VERIFIED CASE STUDIES (FROM SENDER'S WEBSITE - USE ONLY THESE):
${senderData.caseStudies.map((cs, i) => `${i + 1}. ${cs.company}: ${cs.result}`).join('\n')}
` : `
NO VERIFIED CASE STUDIES FOUND - DO NOT INVENT OR MAKE UP ANY CASE STUDIES, STATISTICS, OR CLIENT NAMES.
`}
${senderData.testimonials && senderData.testimonials.length > 0 ? `
VERIFIED TESTIMONIALS (FROM SENDER'S WEBSITE - USE ONLY THESE):
${senderData.testimonials.map((t, i) => `${i + 1}. "${t.quote}" - ${t.author}${t.company ? `, ${t.company}` : ''}`).join('\n')}
` : `
NO VERIFIED TESTIMONIALS FOUND - DO NOT INVENT OR MAKE UP ANY TESTIMONIALS OR REVIEWS.
`}

PITCH/INTENT:
${intent}

CRITICAL AUTHENTICITY RULES (MUST FOLLOW - NO EXCEPTIONS):
1. ONLY reference case studies, testimonials, or statistics that are EXPLICITLY listed above
2. If no case studies are provided, DO NOT invent any - focus on the value proposition instead
3. NEVER fabricate:
   - Percentage claims (e.g., "increased by 47%")
   - Company names as social proof (e.g., "companies like X, Y, Z")
   - Dollar amounts or revenue figures
   - Specific timeframes with results (e.g., "in just 30 days")
   - Testimonial quotes with attribution
   - Client counts (e.g., "500+ companies")
   - ROI multipliers (e.g., "3x ROI")
4. DO NOT use phrases like "studies show", "research indicates", "proven to"
5. Instead, focus on:
   - The value proposition and what you can do for them
   - Questions about their potential challenges
   - Observations from your research about their business
   - Genuine curiosity about their situation

DIFFERENTIATION CHECK:
- Make sure your mechanism is NOT generic (avoid saturated terms like "SEO", "Facebook ads" unless reframed)
- Reframe common services into specific outcomes (e.g., "SEO" → "exclusive leads that aren't price shopping you")
- Be specific to their industry when possible

NOW GENERATE 8 DIFFERENT EMAILS:
Each email MUST be 80-100 words (count carefully - no exceptions).
Each email should have a unique angle while following all CEH rules.

Format each email EXACTLY like this:

EMAIL 1:
SUBJECT: [1-3 words, lowercase]
BODY:
[Personalized first line about them]

[Call out their challenge, offer a better way - 2-3 sentences]

Open to learning more?

EMAIL 2:
SUBJECT: [1-3 words, lowercase]
BODY:
[Personalized first line about them]

[Call out their challenge, offer a better way - 2-3 sentences]

Open to learning more?

(Continue for all 8 emails with different angles/hooks - each 80-100 words)
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
