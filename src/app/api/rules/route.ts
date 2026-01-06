// LifeFlow AI Rules Engine - API Route
// src/app/api/rules/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/rules - Haal alle rules op
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    // Bepaal user ID
    let effectiveUserId = userId;
    if (!effectiveUserId) {
      const integration = await prisma.userIntegration.findFirst({
        where: { provider: 'google', isActive: true },
      });
      effectiveUserId = integration?.userId || 'demo-user';
    }

    const rules = await prisma.aIRule.findMany({
      where: { userId: effectiveUserId },
      orderBy: { createdAt: 'desc' },
    });

    // Voeg stats toe per rule
    const rulesWithStats = await Promise.all(
      rules.map(async (rule) => {
        const executions = await prisma.processedEmail.count({
          where: {
            userId: effectiveUserId,
            processedData: {
              path: ['rulesExecuted'],
              array_contains: [{ ruleId: rule.id, triggered: true }],
            },
          },
        });

        return {
          ...rule,
          stats: {
            executionCount: executions,
          },
        };
      })
    );

    return NextResponse.json({ 
      success: true, 
      data: rulesWithStats,
      meta: {
        total: rules.length,
        active: rules.filter(r => r.isActive).length,
      },
    });
  } catch (error) {
    console.error('GET /api/rules error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch rules' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/rules - Diverse rule acties
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    // Bepaal user ID
    let userId = body.userId;
    if (!userId) {
      const integration = await prisma.userIntegration.findFirst({
        where: { provider: 'google', isActive: true },
      });
      userId = integration?.userId || 'demo-user';
    }

    switch (action) {
      // ============ CREATE ============
      case 'create': {
        const newRule = await prisma.aIRule.create({
          data: {
            userId,
            name: body.name,
            description: body.description || null,
            trigger: body.trigger || { type: 'email' },
            action: body.ruleAction || { type: 'create_task' },
            isActive: body.isActive ?? true,
          },
        });
        return NextResponse.json({ success: true, data: newRule });
      }

      // ============ UPDATE ============
      case 'update': {
        if (!body.ruleId) {
          return NextResponse.json(
            { success: false, error: 'ruleId required' },
            { status: 400 }
          );
        }

        const updatedRule = await prisma.aIRule.update({
          where: { id: body.ruleId },
          data: {
            ...(body.name && { name: body.name }),
            ...(body.description !== undefined && { description: body.description }),
            ...(body.trigger && { trigger: body.trigger }),
            ...(body.ruleAction && { action: body.ruleAction }),
            ...(body.isActive !== undefined && { isActive: body.isActive }),
          },
        });
        return NextResponse.json({ success: true, data: updatedRule });
      }

      // ============ TOGGLE ============
      case 'toggle': {
        if (!body.ruleId) {
          return NextResponse.json(
            { success: false, error: 'ruleId required' },
            { status: 400 }
          );
        }

        const rule = await prisma.aIRule.findUnique({
          where: { id: body.ruleId },
        });

        if (!rule) {
          return NextResponse.json(
            { success: false, error: 'Rule not found' },
            { status: 404 }
          );
        }

        const toggled = await prisma.aIRule.update({
          where: { id: body.ruleId },
          data: { isActive: !rule.isActive },
        });

        return NextResponse.json({ 
          success: true, 
          data: toggled,
          message: `Rule ${toggled.isActive ? 'activated' : 'deactivated'}`,
        });
      }

      // ============ DELETE ============
      case 'delete': {
        if (!body.ruleId) {
          return NextResponse.json(
            { success: false, error: 'ruleId required' },
            { status: 400 }
          );
        }

        await prisma.aIRule.delete({
          where: { id: body.ruleId },
        });

        return NextResponse.json({ success: true, message: 'Rule deleted' });
      }

      // ============ TEST ============
      case 'test': {
        // Import dynamisch om circulaire deps te voorkomen
        const { testEmailProcessing } = await import('@/lib/rules-engine');
        
        const testEmail = body.testEmail || {
          from: 'test@postnl.nl',
          subject: 'Uw pakket is onderweg - 3STEST123456789',
          body: 'Uw pakket wordt morgen bezorgd. Tracking: 3STEST123456789',
        };

        const result = await testEmailProcessing(prisma, userId, testEmail);

        return NextResponse.json({
          success: true,
          data: {
            classification: result.classification,
            matchingRules: result.rulesExecuted.filter(r => r.triggered),
            allRules: result.rulesExecuted,
          },
        });
      }

      // ============ SEED DEFAULTS ============
      case 'seed_defaults': {
        const defaultRules = [
          {
            name: 'Facturen herkennen',
            description: 'Herkent facturen en registreert ze automatisch',
            trigger: { type: 'email', category: 'invoice' },
            action: { type: 'record_invoice', notifyUser: true },
          },
          {
            name: 'Pakket tracking',
            description: 'Volgt pakketten automatisch op basis van tracking emails',
            trigger: { type: 'email', category: 'delivery' },
            action: { type: 'track_package', notifyUser: true },
          },
          {
            name: 'Afspraken uit email',
            description: 'Maakt agenda items aan uit uitnodigingen',
            trigger: { type: 'email', category: 'event' },
            action: { type: 'create_event', notifyUser: false },
          },
          {
            name: 'Taken uit verzoeken',
            description: 'Maakt taken aan uit emails met actie-verzoeken',
            trigger: { type: 'email', category: 'task' },
            action: { type: 'create_task', notifyUser: false },
          },
        ];

        const created = [];
        for (const r of defaultRules) {
          const exists = await prisma.aIRule.findFirst({
            where: { userId, name: r.name },
          });

          if (!exists) {
            const rule = await prisma.aIRule.create({
              data: { userId, ...r, isActive: true },
            });
            created.push(rule);
          }
        }

        const allRules = await prisma.aIRule.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json({
          success: true,
          data: allRules,
          message: `${created.length} new rules created`,
        });
      }

      // ============ GET STATS ============
      case 'stats': {
        const { getProcessingStats } = await import('@/lib/rules-engine');
        const stats = await getProcessingStats(prisma, userId, body.days || 7);
        return NextResponse.json({ success: true, data: stats });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('POST /api/rules error:', error);
    return NextResponse.json(
      { success: false, error: 'Operation failed', details: String(error) },
      { status: 500 }
    );
  }
}


