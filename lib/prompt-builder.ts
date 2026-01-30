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
  transformedWhatWeDo?: string;
}

// Cold Email Offer Principles - transforms services into compelling offers
const OFFER_PRINCIPLES = `
=== OFFER VS SERVICE (CRITICAL) ===
A SERVICE is what you are: "We run ads", "We do SEO", "We do lead generation"
An OFFER is what happens when they hire you: "5 qualified calls in 30 days or you don't pay"

NEVER write emails that just mention a service. ALWAYS present an OFFER with:
1. SPECIFIC OUTCOME: What exactly will they get? (5 new clients, 10 qualified calls)
2. CLEAR TIMEFRAME: When? (in 30 days, within 60 days)
3. MECHANISM: HOW you deliver it - this makes it believable
4. PROOF: Who else you've helped (if available)
5. RISK REVERSAL: What if it doesn't work? (or you don't pay)

=== THE MECHANISM IS EVERYTHING ===
Cold traffic does NOT believe the result until they understand the METHOD.

BAD (no mechanism):
- "We book 10 meetings a month"
- "We get you leads"
- "We help you scale with AI"

GOOD (includes mechanism):
- "We book meetings by using Clay to target companies hiring SDRs"
- "We build a custom lead magnet, drive traffic through cold email, and nurture replies through a 5-touch sequence"
- "Our AI agent calls 100 leads daily and transfers the live answers to your reps"

=== TWO TYPES OF COLD OFFERS ===
If you can't sell the RESULT, sell the INFORMATION:

RESULT OFFER (needs more trust):
"We'll get you 10 leads in 30 days"

INFO OFFER (low friction, high curiosity):
"Report on 5 things competitors are doing to steal your leads"
"See your competitors' live ads + their estimated spend"

=== FRONT-END VS BACK-END ===
Front-end offers get the call (low friction, high curiosity)
Back-end offers close the sale (requires trust)

For cold email, always use FRONT-END style offers.
`;

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
  const { style, targetData, senderData, intent, targetFirstName, targetLinkedInData, additionalInfo, emailCount = 5, transformedWhatWeDo } = input;
  
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

${OFFER_PRINCIPLES}

CRITICAL CONSTRAINTS:
1. EMAIL BODY MUST BE 80-100 WORDS EXACTLY (no more, no less - this is non-negotiable)
2. SUBJECT LINE MUST BE 1-3 WORDS ONLY (short, punchy, intriguing)
3. Personalization in the FIRST LINE - reference something specific about them
4. Call out a challenge they face
5. Offer a perspective on "a better way"
6. Interest-based, low friction CTA (don't ask for time - ask if they're open to learning more)
7. Each email should have a DIFFERENT angle/hook - vary the approach!

STYLE RULES:
- Minimize "I, we, our" language - focus on THEM
- Zero marketing jargon - write the way you speak
- Professional but not overly formal
- Plenty of white space (no big chunks of text)
- Sound human, conversational, not salesy

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
${transformedWhatWeDo ? `
CORE VALUE PROPOSITION (USE THIS AS THE FOUNDATION):
"${transformedWhatWeDo}"

This is the specific outcome the sender delivers - use this language and framing in the emails.
Focus on this outcome, not generic service descriptions.
` : ''}

${senderData.caseStudies && senderData.caseStudies.length > 0 ? `
VERIFIED CASE STUDIES (FROM SENDER'S WEBSITE - YOU MAY REFERENCE ONLY THESE):
${senderData.caseStudies.map((cs, i) => `${i + 1}. ${cs.company}: ${cs.result}`).join('\n')}
` : `
NO CASE STUDIES FOUND ON WEBSITE - DO NOT MAKE UP ANY CASE STUDIES OR STATISTICS.
`}
${senderData.testimonials && senderData.testimonials.length > 0 ? `
VERIFIED TESTIMONIALS (FROM SENDER'S WEBSITE - YOU MAY REFERENCE ONLY THESE):
${senderData.testimonials.map((t, i) => `${i + 1}. "${t.quote}" - ${t.author}${t.company ? `, ${t.company}` : ''}`).join('\n')}
` : `
NO TESTIMONIALS FOUND ON WEBSITE - DO NOT MAKE UP ANY TESTIMONIALS OR REVIEWS.
`}

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

EMAIL INTENT (what the sender wants to achieve):
${intent}

NOW GENERATE ${emailCount} DIFFERENT EMAILS:
- Each email MUST be 80-100 words (count carefully - no exceptions)
- Each email should have a unique angle/hook
- Personalize the FIRST LINE with something specific about ${targetFirstName} or their company
- Call out a challenge they face, then offer a better way
- Minimize "I, we, our" - focus on them
- Subject line: 1-3 words only, lowercase, no punctuation
- End with interest-based CTA (e.g., "Open to learning more?" - don't ask for time)

Return in this EXACT format for each email:

EMAIL 1:
SUBJECT: [1-3 words, lowercase]
BODY:
[80-100 words - personalized first line, challenge + better way, soft CTA]

EMAIL 2:
SUBJECT: [1-3 words, lowercase]
BODY:
[80-100 words - personalized first line, challenge + better way, soft CTA]

EMAIL 3:
SUBJECT: [1-3 words, lowercase]
BODY:
[80-100 words - personalized first line, challenge + better way, soft CTA]

EMAIL 4:
SUBJECT: [1-3 words, lowercase]
BODY:
[80-100 words - personalized first line, challenge + better way, soft CTA]

EMAIL 5:
SUBJECT: [1-3 words, lowercase]
BODY:
[80-100 words - personalized first line, challenge + better way, soft CTA]
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
