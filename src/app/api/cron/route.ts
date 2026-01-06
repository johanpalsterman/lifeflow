// LifeFlow AI Rules Engine - Cron API
// src/app/api/cron/route.ts
// 
// Dit endpoint wordt aangeroepen door een externe cron service
// zoals Vercel Cron, Azure Functions Timer, of een eenvoudige cron job

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { processNewEmails } from '@/lib/rules-engine';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minuten max

// Optionele beveiliging met cron secret
const CRON_SECRET = process.env.CRON_SECRET;

/**
 * GET /api/cron - Scheduled email processing
 * 
 * Configureer dit in je cron service:
 * - Vercel: vercel.json met crons configuratie
 * - Azure: Timer trigger function
 * - Externe: curl https://app/api/cron?secret=xxx
 */
export async function GET(request: NextRequest) {
  try {
    // Valideer cron secret indien geconfigureerd
    if (CRON_SECRET) {
      const { searchParams } = new URL(request.url);
      const secret = searchParams.get('secret') || 
                     request.headers.get('x-cron-secret');
      
      if (secret !== CRON_SECRET) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    console.log(`[Cron] Starting scheduled email processing at ${new Date().toISOString()}`);

    // Haal alle users met actieve Google integratie op
    const integrations = await prisma.userIntegration.findMany({
      where: {
        provider: 'google',
        isActive: true,
        accessToken: { not: null },
      },
      select: { userId: true },
    });

    const results = [];
    let totalProcessed = 0;
    let totalSuccess = 0;
    let totalErrors = 0;

    // Process voor elke user
    for (const integration of integrations) {
      try {
        const result = await processNewEmails(prisma as any, integration.userId, {
          maxEmails: 50,
          sinceHours: 1, // Alleen laatste uur (voor hourly cron)
        });

        results.push({
          userId: integration.userId,
          processed: result.processedCount,
          success: result.successCount,
          errors: result.errorCount,
          skipped: result.skippedCount,
        });

        totalProcessed += result.processedCount;
        totalSuccess += result.successCount;
        totalErrors += result.errorCount;
      } catch (error) {
        console.error(`[Cron] Error processing user ${integration.userId}:`, error);
        results.push({
          userId: integration.userId,
          error: error instanceof Error ? error.message : String(error),
        });
        totalErrors++;
      }
    }

    console.log(`[Cron] Completed: ${totalProcessed} emails, ${totalSuccess} success, ${totalErrors} errors`);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        usersProcessed: integrations.length,
        totalProcessed,
        totalSuccess,
        totalErrors,
      },
      details: results,
    });
  } catch (error) {
    console.error('[Cron] Fatal error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Cron job failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cron - Manual trigger met opties
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Valideer auth
    if (CRON_SECRET) {
      const secret = body.secret || request.headers.get('x-cron-secret');
      if (secret !== CRON_SECRET) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    const {
      userId,        // Optioneel: specifieke user
      maxEmails = 50,
      sinceHours = 24,
    } = body;

    if (userId) {
      // Process alleen specifieke user
      const result = await processNewEmails(prisma as any, userId, {
        maxEmails,
        sinceHours,
      });

      return NextResponse.json({
        success: true,
        data: {
          processed: result.processedCount,
          success: result.successCount,
          errors: result.errorCount,
          skipped: result.skippedCount,
        },
      });
    }

    // Fallback naar GET behavior
    return GET(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

