import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const CRON_SECRET = process.env.CRON_SECRET;

// This endpoint can be called by a cron job (e.g., Azure Timer Trigger, Vercel Cron)
// GET /api/cron/process-emails?secret=xxx
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const secret = searchParams.get('secret');

  // Verify cron secret
  if (CRON_SECRET && secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Trigger the process-emails endpoint internally
    const baseUrl = process.env.NEXTAUTH_URL || 'https://lifeflow.wishflow.eu';
    const response = await fetch(`${baseUrl}/api/process-emails`, {
      method: 'POST',
    });

    const result = await response.json();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      result,
    });
  } catch (error) {
    console.error('Cron process-emails error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
