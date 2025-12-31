import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'demo-user';
    const tasks = await prisma.task.findMany({
      where: { userId },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
      take: 50,
    });
    return NextResponse.json({ success: true, data: tasks });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch tasks' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = body.userId || 'demo-user';
    const task = await prisma.task.create({
      data: {
        userId,
        title: body.title,
        description: body.description || null,
        priority: body.priority || 'medium',
        status: 'pending',
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
      },
    });
    return NextResponse.json({ success: true, data: task }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to create task' }, { status: 500 });
  }
}
