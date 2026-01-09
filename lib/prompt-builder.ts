import { EmailStyle, EmailExample, ScrapedData } from './types';

interface PromptBuilderInput {
  style: EmailStyle;
  targetData: ScrapedData;
  senderData: ScrapedData;
  intent: string;
  targetFirstName: string;
  targetLinkedInData?: string;
  additionalInfo?: string;
  emailCount?: number;
}

// High-quality reference emails for the AI to learn from
const REFERENCE_EMAILS = `
EXAMPLE EMAIL 1:
Subject: gamified experiences
Jennifer - you assess "characteristics for hyper-growth success" daily. 
Poker Power teaches decision-making under pressure, reading the room, and negotiation through gamified experiences. 
Companies like KPMG, AWS, and Verizon use us to host fun, team-bonding events.
Worth a quick call to explore what an event could look like for TechFlow?

EXAMPLE EMAIL 2:
Subject: TechFlow's mission
Hi Sarah - TechFlow's mission is "empowering teams to innovate without boundaries." Love it.
But boundaryless innovation needs leaders comfortable with uncertainty and conflict.
Poker Power runs interactive sessions where leaders practice high-stakes decisions, negotiation tactics, and reading room dynamics through fun, unique poker events. 
No experience needed—it's game theory applied to business skills.
Companies like KPMG, AWS, and Verizon use it. Worth a quick call to explore what an event could look like for TechFlow?

EXAMPLE EMAIL 3:
Subject: safety
Hi Kosi, 
Precision Manufacturing's 450 employees across three facilities means dozens of supervisors making critical calls daily.
Production decisions, safety judgment calls, team conflicts—all high-pressure moments.
Poker Power teaches decision-making under pressure through 90-minute poker experiences. 
Participants learn strategic thinking, risk assessment, and reading people through actual gameplay that mirrors business scenarios.
Morningstar and AWS use it for operational leaders. Worth exploring?

EXAMPLE EMAIL 4:
Subject: cloud migrations question
Hey Lisa – DataStream's enterprise cloud migrations mean complex stakeholder navigation daily.
I had some thoughts on developing your account team's capabilities:
Practice negotiating scope changes in low-stakes environment
Train teams to read technical buyer resistance patterns
Build confidence making strategic calls mid-meeting
Poker Power delivers this through 90-minute poker-based experiences. It's experiential learning—leaders practice actual skills through gameplay.
Open to learning more?

EXAMPLE EMAIL 5:
Subject: 75 minutes
Hey Lisa,
Remote work makes reading stakeholder dynamics harder. DataStream's teams negotiate with technical buyers, procurement, and executives—all virtually now.
Are you weighing traditional training vs. experiential learning that builds muscle memory?
Poker Power runs 75-minute sessions where participants practice decision-making, negotiation, and reading people through interactive poker gameplay with expert coaching.
AWS improved leadership capabilities 55% in 90 days using this. Open to learning more?
`;

export function buildPrompt(input: PromptBuilderInput): string {
  const { style, targetData, senderData, intent, targetFirstName, targetLinkedInData, additionalInfo, emailCount = 5 } = input;
  
  // Select most relevant examples (2-3 based on context matching)
  const relevantExamples = selectRelevantExamples(
    style.examples,
    senderData.businessType,
    targetData.businessType
  );
  
  const examplesBlock = relevantExamples.map((ex, i) => `
--- STYLE EXAMPLE ${i + 1} ---
Context: ${ex.context}
Subject: ${ex.subject}
Body:
${ex.body}
---
`).join('\n');

  return `
You are an expert cold email copywriter. Your task is to write ${emailCount} DIFFERENT hyper-personalized cold emails for the same target.

CRITICAL CONSTRAINTS:
1. EMAIL BODY MUST BE UNDER 100 WORDS (this is non-negotiable)
2. SUBJECT LINE MUST BE 1-4 WORDS ONLY (short, punchy, intriguing)
3. Use the target's first name naturally
4. Sound human, conversational, not salesy
5. Reference specific details from their website/info
6. Make the connection between their needs and sender's offering clear
7. Each email should have a DIFFERENT angle/hook - vary the approach!

STYLE TO USE: ${style.name}
${style.promptTemplate}

STYLE GUIDELINES:
${style.guidelines.map(g => `- ${g}`).join('\n')}

STYLE EXAMPLES (for tone and structure reference):
${examplesBlock}

HIGH-QUALITY REFERENCE EMAILS (study these for length, tone, and format):
${REFERENCE_EMAILS}

TARGET INFORMATION:
- First Name: ${targetFirstName}
- Company: ${targetData.companyName}
- Website: ${targetData.url}
- What they do: ${targetData.description}
- Key details: ${targetData.keyPoints.join(', ') || 'None extracted'}
- Business type: ${targetData.businessType}
${targetData.rawContent ? `\nWebsite content:\n${targetData.rawContent.slice(0, 1500)}` : ''}
${targetLinkedInData ? `\nLinkedIn info:\n${targetLinkedInData}` : ''}
${additionalInfo ? `\nAdditional context provided:\n${additionalInfo}` : ''}

SENDER INFORMATION (the product/service being pitched):
- Company: ${senderData.companyName}
- Website: ${senderData.url}
- What they offer: ${senderData.description}
- Key services/products: ${senderData.keyPoints.join(', ') || 'None extracted'}
- Business type: ${senderData.businessType}
${senderData.rawContent ? `\nWebsite content:\n${senderData.rawContent.slice(0, 1500)}` : ''}

EMAIL INTENT (what the sender wants to achieve):
${intent}

NOW GENERATE ${emailCount} DIFFERENT EMAILS:
- Each email should have a unique angle/hook
- Address ${targetFirstName} by name
- Reference something SPECIFIC from their company/website
- Connect their situation to the sender's offering
- Keep each body UNDER 100 words
- Subject line: 1-4 words only, lowercase, no punctuation
- End with a soft, low-commitment ask

Return in this EXACT format for each email:

EMAIL 1:
SUBJECT: [1-4 word subject line]
BODY:
[email body under 100 words]

EMAIL 2:
SUBJECT: [1-4 word subject line]
BODY:
[email body under 100 words]

EMAIL 3:
SUBJECT: [1-4 word subject line]
BODY:
[email body under 100 words]

EMAIL 4:
SUBJECT: [1-4 word subject line]
BODY:
[email body under 100 words]

EMAIL 5:
SUBJECT: [1-4 word subject line]
BODY:
[email body under 100 words]
`.trim();
}

function selectRelevantExamples(
  examples: EmailExample[],
  senderType: string,
  targetType: string
): EmailExample[] {
  if (examples.length <= 2) {
    return examples;
  }
  
  const scored = examples.map(ex => ({
    example: ex,
    score: calculateRelevance(ex, senderType, targetType)
  }));
  
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map(s => s.example);
}

function calculateRelevance(
  example: EmailExample,
  senderType: string,
  targetType: string
): number {
  let score = 0;
  
  const exSenderLower = example.senderType.toLowerCase();
  const exTargetLower = example.targetType.toLowerCase();
  const senderLower = senderType.toLowerCase();
  const targetLower = targetType.toLowerCase();
  
  if (exSenderLower.includes(senderLower) || senderLower.includes(exSenderLower)) {
    score += 3;
  }
  
  if (exTargetLower.includes(targetLower) || targetLower.includes(exTargetLower)) {
    score += 3;
  }
  
  const senderWords = senderLower.split(/\s+/);
  const targetWords = targetLower.split(/\s+/);
  
  for (const word of senderWords) {
    if (exSenderLower.includes(word) && word.length > 3) {
      score += 1;
    }
  }
  
  for (const word of targetWords) {
    if (exTargetLower.includes(word) && word.length > 3) {
      score += 1;
    }
  }
  
  return score;
}

export function parseEmailResponse(response: string): { subject: string; body: string } {
  // Extract subject line
  const subjectMatch = response.match(/SUBJECT:\s*(.+?)(?:\n|$)/i);
  let subject = subjectMatch ? subjectMatch[1].trim() : 'quick question';
  
  // Clean up subject - remove quotes, ensure lowercase
  subject = subject.replace(/^["']|["']$/g, '').toLowerCase();
  
  // Limit subject to 4 words
  const subjectWords = subject.split(/\s+/);
  if (subjectWords.length > 4) {
    subject = subjectWords.slice(0, 4).join(' ');
  }
  
  // Extract body - everything after "BODY:"
  const bodyMatch = response.match(/BODY:\s*\n?([\s\S]+)/i);
  let body = bodyMatch ? bodyMatch[1].trim() : response;
  
  // Clean up any trailing artifacts
  body = body.replace(/^---+\s*$/gm, '').trim();
  
  return { subject, body };
}

export function parseMultipleEmails(response: string): { subject: string; body: string }[] {
  const emails: { subject: string; body: string }[] = [];
  
  // Split by EMAIL N: pattern
  const emailSections = response.split(/EMAIL\s*\d+:/i).filter(s => s.trim());
  
  for (const section of emailSections) {
    const subjectMatch = section.match(/SUBJECT:\s*(.+?)(?:\n|$)/i);
    const bodyMatch = section.match(/BODY:\s*\n?([\s\S]+?)(?=EMAIL\s*\d+:|$)/i);
    
    if (subjectMatch || bodyMatch) {
      let subject = subjectMatch ? subjectMatch[1].trim() : 'quick question';
      subject = subject.replace(/^["']|["']$/g, '').toLowerCase();
      
      const subjectWords = subject.split(/\s+/);
      if (subjectWords.length > 4) {
        subject = subjectWords.slice(0, 4).join(' ');
      }
      
      let body = bodyMatch ? bodyMatch[1].trim() : '';
      body = body.replace(/^---+\s*$/gm, '').trim();
      
      // Remove any trailing EMAIL markers that might have been caught
      body = body.replace(/EMAIL\s*\d+:\s*$/i, '').trim();
      
      if (body) {
        emails.push({ subject, body });
      }
    }
  }
  
  // If parsing failed, try to extract at least one email
  if (emails.length === 0) {
    const singleEmail = parseEmailResponse(response);
    if (singleEmail.body) {
      emails.push(singleEmail);
    }
  }
  
  return emails;
}
