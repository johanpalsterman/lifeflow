import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/events
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const userId = searchParams.get('userId') || 'demo-user';

    const where: any = { userId };
    if (from || to) {
      where.startTime = {};
      if (from) where.startTime.gte = new Date(from);
      if (to) where.startTime.lte = new Date(to);
    }

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        orderBy: { startTime: 'asc' },
        take: limit,
        skip: offset,
      }),
      prisma.event.count({ where })
    ]);

    return NextResponse.json({
      success: true,
      data: events,
      pagination: { total, limit, offset, hasMore: offset + events.length < total }
    });
  } catch (error) {
    console.error('GET /api/events error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}

// POST /api/events
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.title || body.title.trim() === '') {
      return NextResponse.json({ success: false, error: 'Title is required' }, { status: 400 });
    }
    if (!body.startTime) {
      return NextResponse.json({ success: false, error: 'Start time is required' }, { status: 400 });
    }

    const userId = body.userId || 'demo-user';

    const event = await prisma.event.create({
      data: {
        userId,
        title: body.title.trim(),
        description: body.description || null,
        location: body.location || null,
        startTime: new Date(body.startTime),
        endTime: body.endTime ? new Date(body.endTime) : null,
        allDay: body.allDay || false,
        eventType: body.eventType || 'default',
        color: body.color || null,
        reminderMinutes: body.reminderMinutes || [],
      },
    });

    return NextResponse.json({ success: true, data: event }, { status: 201 });
  } catch (error) {
    console.error('POST /api/events error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create event' },
      { status: 500 }
    );
  }
}
