// src/app/api/process-emails/history/route.ts
// API endpoint for email processing history

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const category = searchParams.get('category');

    const userId = request.headers.get('x-user-id') || await getDefaultUserId();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = { userId };
    
    // Filter by category if specified
    if (category) {
      where.category = category;
    }

    const [emails, total] = await Promise.all([
      prisma.processedEmail.findMany({
        where,
        orderBy: { createdAt: 'desc' },  // FIXED: use createdAt instead of processedAt
        take: limit,
        skip
      }),
      prisma.processedEmail.count({ where })
    ]);

    // Transform to expected format
    const transformedEmails = emails.map((e: any) => ({
      id: e.id,
      emailId: e.externalId,
      classification: {
        category: e.category,
        confidence: e.confidence,
        reasoning: ''
      },
      rulesExecuted: e.processedData?.rulesExecuted || [],
      processedAt: e.createdAt
    }));

    return NextResponse.json({
      success: true,
      data: transformedEmails,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('GET /api/process-emails/history error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

async function getDefaultUserId(): Promise<string | null> {
  const user = await prisma.user.findFirst();
  return user?.id || null;
}
