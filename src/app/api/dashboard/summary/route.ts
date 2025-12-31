import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const user = await prisma.user.findFirst({ orderBy: { createdAt: 'desc' } });
    if (!user) return NextResponse.json({ success: false, error: 'No user' });

    const userId = user.id;
    const today = new Date(); today.setHours(0,0,0,0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

    const [eventsToday, openTasks, activePackages] = await Promise.all([
      prisma.event.count({ where: { userId, startTime: { gte: today, lt: tomorrow } } }),
      prisma.task.count({ where: { userId, status: { not: 'completed' } } }),
      prisma.package.count({ where: { userId, status: { not: 'delivered' } } }),
    ]);

    const eventsList = await prisma.event.findMany({ where: { userId, startTime: { gte: today, lt: tomorrow } }, orderBy: { startTime: 'asc' } });
    const tasksList = await prisma.task.findMany({ where: { userId, status: { not: 'completed' } }, orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }], take: 10 });
    const safetyChecks = await prisma.safetyCheck.findMany({ where: { userId } });

    return NextResponse.json({
      success: true,
      data: {
        stats: { eventsToday, openTasks, activePackages },
        eventsToday: eventsList.map(e => ({ id: e.id, title: e.title, startTime: e.startTime.toISOString(), eventType: e.eventType })),
        tasks: tasksList.map(t => ({ id: t.id, title: t.title, priority: t.priority, status: t.status })),
        safetyChecks: safetyChecks.map(s => ({ id: s.id, name: s.name, checkType: s.checkType, status: s.status })),
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Dashboard error' }, { status: 500 });
  }
}
