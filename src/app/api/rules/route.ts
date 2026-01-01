import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const integration = await prisma.userIntegration.findFirst({
      where: { provider: 'google', isActive: true },
    });
    const userId = integration?.userId || 'demo-user';

    const rules = await prisma.aIRule.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: rules });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch rules' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    const integration = await prisma.userIntegration.findFirst({
      where: { provider: 'google', isActive: true },
    });
    const userId = integration?.userId || 'demo-user';

    switch (action) {
      case 'create':
        const newRule = await prisma.aIRule.create({
          data: {
            userId,
            name: body.name,
            description: body.description,
            trigger: body.trigger || {},
            action: body.ruleAction || {},
            isActive: true,
          },
        });
        return NextResponse.json({ success: true, data: newRule });

      case 'toggle':
        const rule = await prisma.aIRule.findUnique({ where: { id: body.ruleId } });
        if (rule) {
          await prisma.aIRule.update({
            where: { id: body.ruleId },
            data: { isActive: !rule.isActive },
          });
        }
        return NextResponse.json({ success: true });

      case 'delete':
        await prisma.aIRule.delete({ where: { id: body.ruleId } });
        return NextResponse.json({ success: true });

      case 'seed_defaults':
        const defaultRules = [
          { name: 'Facturen herkennen', description: 'Maak automatisch een factuur aan', trigger: { category: 'invoice' }, action: { type: 'record_invoice' } },
          { name: 'Pakket tracking', description: 'Volg pakketten automatisch', trigger: { category: 'delivery' }, action: { type: 'track_package' } },
          { name: 'Afspraken uit email', description: 'Maak agenda items aan', trigger: { category: 'event' }, action: { type: 'create_event' } },
          { name: 'Taken uit verzoeken', description: 'Maak taken aan uit emails', trigger: { category: 'task' }, action: { type: 'create_task' } },
        ];

        for (const r of defaultRules) {
          const exists = await prisma.aIRule.findFirst({ where: { userId, name: r.name } });
          if (!exists) {
            await prisma.aIRule.create({ data: { userId, ...r, isActive: true } });
          }
        }
        
        const allRules = await prisma.aIRule.findMany({ where: { userId } });
        return NextResponse.json({ success: true, data: allRules });

      default:
        return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Rules error:', error);
    return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 });
  }
}
