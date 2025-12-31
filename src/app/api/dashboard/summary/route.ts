import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/dashboard/summary
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'demo-user';

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [eventsToday, openTasks, activePackages, contacts, safetyChecks] = await Promise.all([
      prisma.event.findMany({
        where: { userId, startTime: { gte: today, lt: tomorrow } },
        orderBy: { startTime: 'asc' },
        take: 10
      }),
      prisma.task.findMany({
        where: { userId, status: { in: ['pending', 'in_progress'] } },
        orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }],
        take: 10
      }),
      prisma.package.findMany({
        where: { userId, status: { notIn: ['delivered', 'cancelled'] } },
        orderBy: { estimatedDelivery: 'asc' },
        take: 5
      }),
      prisma.contact.findMany({
        where: { userId, birthday: { not: null } },
        select: { id: true, name: true, birthday: true, avatarUrl: true }
      }),
      prisma.safetyCheck.findMany({
        where: { userId, isEnabled: true },
        orderBy: { nextCheckAt: 'asc' }
      })
    ]);

    // Calculate upcoming birthdays
    const birthdaysWithDays = contacts
      .map(contact => {
        if (!contact.birthday) return null;
        const birthday = new Date(contact.birthday);
        const thisYear = new Date(today.getFullYear(), birthday.getMonth(), birthday.getDate());
        if (thisYear < today) thisYear.setFullYear(thisYear.getFullYear() + 1);
        const daysUntil = Math.ceil((thisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return daysUntil <= 30 ? { ...contact, daysUntil } : null;
      })
      .filter(Boolean)
      .sort((a: any, b: any) => a.daysUntil - b.daysUntil)
      .slice(0, 5);

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          eventsToday: eventsToday.length,
          openTasks: openTasks.length,
          activePackages: activePackages.length
        },
        eventsToday,
        tasks: openTasks,
        packages: activePackages,
        birthdays: birthdaysWithDays,
        safetyChecks
      }
    });
  } catch (error) {
    console.error('GET /api/dashboard/summary error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch dashboard summary' },
      { status: 500 }
    );
  }
}
