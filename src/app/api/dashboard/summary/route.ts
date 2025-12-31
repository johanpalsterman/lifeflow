import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // Get first user (for now, since we don't have auth sessions)
    const user = await prisma.user.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'No user found',
      });
    }

    const userId = user.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get stats
    const [
      eventsToday,
      openTasks,
      activePackages,
      pendingInvoicesPayable,
      pendingInvoicesReceivable,
      overdueInvoices,
    ] = await Promise.all([
      prisma.event.count({
        where: {
          userId,
          startTime: { gte: today, lt: tomorrow },
        },
      }),
      prisma.task.count({
        where: {
          userId,
          status: { not: 'completed' },
        },
      }),
      prisma.package.count({
        where: {
          userId,
          status: { not: 'delivered' },
        },
      }),
      prisma.invoice.aggregate({
        where: {
          userId,
          type: 'payable',
          status: 'pending',
        },
        _sum: { amount: true },
      }),
      prisma.invoice.aggregate({
        where: {
          userId,
          type: 'receivable',
          status: 'pending',
        },
        _sum: { amount: true },
      }),
      prisma.invoice.count({
        where: {
          userId,
          status: 'pending',
          dueDate: { lt: today },
        },
      }),
    ]);

    // Get today's events
    const eventsList = await prisma.event.findMany({
      where: {
        userId,
        startTime: { gte: today, lt: tomorrow },
      },
      orderBy: { startTime: 'asc' },
    });

    // Get open tasks (limit 10)
    const tasksList = await prisma.task.findMany({
      where: {
        userId,
        status: { not: 'completed' },
      },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
      take: 10,
    });

    // Get active packages
    const packagesList = await prisma.package.findMany({
      where: {
        userId,
        status: { not: 'delivered' },
      },
      orderBy: { expectedDelivery: 'asc' },
      take: 5,
    });

    // Get upcoming birthdays (next 30 days)
    const contacts = await prisma.contact.findMany({
      where: {
        userId,
        birthday: { not: null },
      },
    });

    const birthdaysList = contacts
      .map((contact) => {
        if (!contact.birthday) return null;
        const bday = new Date(contact.birthday);
        const thisYear = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
        if (thisYear < today) {
          thisYear.setFullYear(thisYear.getFullYear() + 1);
        }
        const daysUntil = Math.ceil((thisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return { id: contact.id, name: contact.name, daysUntil };
      })
      .filter((b) => b && b.daysUntil <= 30)
      .sort((a, b) => a!.daysUntil - b!.daysUntil)
      .slice(0, 5);

    // Get safety checks
    const safetyChecksList = await prisma.safetyCheck.findMany({
      where: { userId },
      orderBy: { nextCheckAt: 'asc' },
    });

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          eventsToday,
          openTasks,
          activePackages,
        },
        financial: {
          toReceive: pendingInvoicesReceivable._sum.amount || 0,
          toPay: pendingInvoicesPayable._sum.amount || 0,
          overdue: overdueInvoices,
        },
        eventsToday: eventsList.map((e) => ({
          id: e.id,
          title: e.title,
          startTime: e.startTime.toISOString(),
          endTime: e.endTime?.toISOString() || null,
          eventType: e.eventType,
          location: e.location,
          color: e.color,
        })),
        tasks: tasksList.map((t) => ({
          id: t.id,
          title: t.title,
          priority: t.priority,
          status: t.status,
          dueDate: t.dueDate?.toISOString() || null,
        })),
        packages: packagesList.map((p) => ({
          id: p.id,
          carrier: p.carrier,
          description: p.description,
          status: p.status,
          expectedDelivery: p.expectedDelivery?.toISOString() || null,
        })),
        birthdays: birthdaysList,
        safetyChecks: safetyChecksList.map((s) => ({
          id: s.id,
          name: s.name,
          checkType: s.checkType,
          status: s.status,
          nextCheckAt: s.nextCheckAt?.toISOString() || null,
        })),
      },
    });
  } catch (error) {
    console.error('Dashboard summary error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
