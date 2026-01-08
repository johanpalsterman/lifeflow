// LifeFlow AI Rules Engine - Process Emails API
// src/app/api/process-emails/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { processNewEmails } from '@/lib/rules-engine';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/process-emails - Status check
 */
export async function GET() {
  try {
    const integration = await prisma.userIntegration.findFirst({
      where: { provider: 'google', isActive: true },
    });

    const lastProcessed = await prisma.processedEmail.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    const todayCount = await prisma.processedEmail.count({
      where: {
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    });

    return NextResponse.json({
      success: true,
      status: 'ready',
      data: {
        hasActiveIntegration: !!integration,
        lastProcessedAt: lastProcessed?.createdAt || null,
        processedToday: todayCount,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, status: 'error', error: String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/process-emails - Start email processing
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    const {
      maxEmails = 50,
      sinceHours = 24,
    } = body;

    console.log(`[ProcessEmails] Starting batch processing...`);
    console.log(`[ProcessEmails] Options: maxEmails=${maxEmails}, sinceHours=${sinceHours}`);

    // Get default user if not specified
    let userId = body.userId;
    if (!userId) {
      const user = await prisma.user.findFirst();
      userId = user?.id;
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'No user found' },
        { status: 400 }
      );
    }

    // FIXED: processNewEmails takes only userId and options (no prisma)
    const result = await processNewEmails(userId, {
      maxEmails,
      sinceHours,
    });

    console.log(`[ProcessEmails] Completed: ${result.success} success, ${result.errors} errors, ${result.skipped} skipped`);

    return NextResponse.json({
      success: true,
      processed: result.processed,
      successCount: result.success,
      errors: result.errors,
      skipped: result.skipped,
      createdRecords: result.createdRecords,
      results: result.results.slice(0, 20), // Limit results for response size
    });
  } catch (error) {
    console.error('[ProcessEmails] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Email processing failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
