import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'demo-user';
    const events = await prisma.event.findMany({
      where: { userId },
      orderBy: { startTime: 'asc' },
    });
    return NextResponse.json({ success: true, data: events });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch events' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = body.userId || 'demo-user';
    const event = await prisma.event.create({
      data: {
        userId,
        title: body.title,
        description: body.description || null,
        startTime: new Date(body.startTime),
        endTime: body.endTime ? new Date(body.endTime) : null,
        eventType: body.eventType || 'general',
        location: body.location || null,
        color: body.color || null,
      },
    });
    return NextResponse.json({ success: true, data: event }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to create event' }, { status: 500 });
  }
}
