import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fetchAndProcessEmails } from '@/lib/ai-email-processor';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    const integration = await prisma.userIntegration.findFirst({
      where: { provider: 'google', isActive: true },
    });

    if (!integration) {
      return NextResponse.json({
        success: false,
        error: 'Connect Gmail first',
      }, { status: 400 });
    }

    const result = await fetchAndProcessEmails(integration.userId);
    
    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Process emails error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Processing failed',
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    const integration = await prisma.userIntegration.findFirst({
      where: { provider: 'google', isActive: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        status: integration ? 'ready' : 'not_connected',
        connected: !!integration,
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Status check failed' }, { status: 500 });
  }
}
