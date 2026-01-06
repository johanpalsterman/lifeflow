// LifeFlow AI Rules Engine - Process Emails API
// src/app/api/process-emails/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { processNewEmails } from '@/lib/rules-engine';

export const dynamic = 'force-dynamic';

// Maximum execution time (voor Vercel/serverless)
export const maxDuration = 60;

/**
 * GET /api/process-emails - Status check
 */
export async function GET() {
  try {
    // Check voor actieve integratie
    const integration = await prisma.userIntegration.findFirst({
      where: { provider: 'google', isActive: true },
    });

    // Haal laatste processing stats op
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
      userId,
      maxEmails = 20,
      sinceHours = 24,
    } = body;

    console.log(`[ProcessEmails] Starting batch processing...`);
    console.log(`[ProcessEmails] Options: maxEmails=${maxEmails}, sinceHours=${sinceHours}`);

    // Voer processing uit
    const result = await processNewEmails(prisma as any, userId, {
      maxEmails,
      sinceHours,
    });

    console.log(`[ProcessEmails] Completed: ${result.successCount} success, ${result.errorCount} errors, ${result.skippedCount} skipped`);

    // Samenvatting van wat er is aangemaakt
    const createdRecords = {
      tasks: 0,
      events: 0,
      invoices: 0,
      packages: 0,
    };

    for (const emailResult of result.results) {
      for (const ruleResult of emailResult.rulesExecuted) {
        if (ruleResult.actionExecuted && ruleResult.createdRecordId) {
          switch (ruleResult.actionType) {
            case 'create_task':
              createdRecords.tasks++;
              break;
            case 'create_event':
              createdRecords.events++;
              break;
            case 'record_invoice':
              createdRecords.invoices++;
              break;
            case 'track_package':
              createdRecords.packages++;
              break;
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        processed: result.processedCount,
        success: result.successCount,
        errors: result.errorCount,
        skipped: result.skippedCount,
        duration: result.endTime.getTime() - result.startTime.getTime(),
        createdRecords,
        // Details per email (alleen bij kleine batches)
        details: result.processedCount <= 10 ? result.results.map(r => ({
          emailId: r.emailId,
          category: r.classification.category,
          confidence: r.classification.confidence,
          rulesTriggered: r.rulesExecuted.filter(re => re.triggered).length,
          error: r.error,
        })) : undefined,
      },
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


