import { NextResponse } from 'next/server';
import { getStylesSummary } from '@/lib/styles';

export async function GET() {
  try {
    const styles = await getStylesSummary();
    return NextResponse.json(styles);
  } catch (error) {
    console.error('Error fetching styles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch styles' },
      { status: 500 }
    );
  }
}
