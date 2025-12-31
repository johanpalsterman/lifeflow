import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/rules - Get all rules for user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'demo-user';
    const categoryId = searchParams.get('categoryId');

    const where: any = { userId };
    if (categoryId) where.categoryId = categoryId;

    const rules = await prisma.aIRule.findMany({
      where,
      include: {
        category: true,
        _count: {
          select: { executions: true }
        }
      },
      orderBy: [
        { isSystem: 'desc' },
        { priority: 'asc' },
        { createdAt: 'desc' }
      ]
    });

    return NextResponse.json({
      success: true,
      data: rules
    });
  } catch (error) {
    console.error('GET /api/rules error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch rules' },
      { status: 500 }
    );
  }
}

// POST /api/rules - Create new rule
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.name || !body.triggerCondition || !body.actionDefinition) {
      return NextResponse.json(
        { success: false, error: 'name, triggerCondition, and actionDefinition are required' },
        { status: 400 }
      );
    }

    const userId = body.userId || 'demo-user';

    const rule = await prisma.aIRule.create({
      data: {
        userId,
        name: body.name,
        description: body.description || null,
        categoryId: body.categoryId || null,
        triggerCondition: body.triggerCondition,
        triggerDescription: body.triggerDescription || null,
        actionDefinition: body.actionDefinition,
        actionDescription: body.actionDescription || null,
        isEnabled: body.isEnabled ?? true,
        isSystem: false,
        priority: body.priority || 100
      }
    });

    return NextResponse.json({
      success: true,
      data: rule
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/rules error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create rule' },
      { status: 500 }
    );
  }
}
