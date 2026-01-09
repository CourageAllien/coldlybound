import { promises as fs } from 'fs';
import path from 'path';
import { EmailStyle, EmailStyleSummary } from './types';

const STYLES_DIR = path.join(process.cwd(), 'data', 'styles');

// Expert-inspired styles that should appear first (in order)
const PRIORITY_STYLES = [
  'show-me-you-know-me',      // Samantha McKenna
  'poke-the-bear',            // Josh Braun
  'the-research-rabbit-hole', // Jordan Crawford
  'the-hundred-million-template', // Alex Berman
  'the-one-liner',            // Jed Mahrle
  'the-basho-sequence',       // Justin Michael
  'the-anti-pitch',           // Kellen Casebeer
  'the-trigger-event',        // Patrick Spychalski
  'the-challenger',           // Jen Allen-Knuth
  'the-data-driven',          // Will Allred
  'the-personalized-video',   // Eric Nowoslawski
  'the-ten-thirty-ten',       // Kyle Coleman
  'the-helpful-expert',       // Mohan Muthoo
  'the-relevance-engine',     // Yurii Veremchuk
];

export async function getAllStyles(): Promise<EmailStyle[]> {
  try {
    const files = await fs.readdir(STYLES_DIR);
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    
    const styles = await Promise.all(
      jsonFiles.map(async (file) => {
        const filePath = path.join(STYLES_DIR, file);
        const content = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(content) as EmailStyle;
      })
    );
    
    // Filter only active styles
    const activeStyles = styles.filter(style => style.isActive);
    
    // Sort with priority styles first, then alphabetically
    return activeStyles.sort((a, b) => {
      const aPriority = PRIORITY_STYLES.indexOf(a.slug);
      const bPriority = PRIORITY_STYLES.indexOf(b.slug);
      
      // If both are priority styles, sort by their priority order
      if (aPriority !== -1 && bPriority !== -1) {
        return aPriority - bPriority;
      }
      // Priority styles come first
      if (aPriority !== -1) return -1;
      if (bPriority !== -1) return 1;
      // Non-priority styles sort alphabetically
      return a.name.localeCompare(b.name);
    });
  } catch (error) {
    console.error('Error loading styles:', error);
    return [];
  }
}

export async function getStyleBySlug(slug: string): Promise<EmailStyle | null> {
  try {
    const filePath = path.join(STYLES_DIR, `${slug}.json`);
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as EmailStyle;
  } catch (error) {
    console.error(`Error loading style ${slug}:`, error);
    return null;
  }
}

export async function getStylesSummary(): Promise<EmailStyleSummary[]> {
  const styles = await getAllStyles();
  
  return styles.map(style => ({
    id: style.id,
    name: style.name,
    slug: style.slug,
    description: style.description,
    bestFor: style.bestFor,
    tone: style.tone,
  }));
}

export function getStyleSummary(style: EmailStyle): EmailStyleSummary {
  return {
    id: style.id,
    name: style.name,
    slug: style.slug,
    description: style.description,
    bestFor: style.bestFor,
    tone: style.tone,
  };
}
