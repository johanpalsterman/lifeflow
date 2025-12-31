import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// POST /api/seed
export async function POST() {
  try {
    const userId = 'demo-user';

    // Create demo user
    let user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          id: userId,
          email: 'johan@lifeflow.demo',
          name: 'Johan',
        }
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Demo tasks
    const tasks = [
      { id: 'task-1', title: 'Factuur versturen naar KBC', priority: 'high', days: 0 },
      { id: 'task-2', title: 'Backup controleren', priority: 'medium', days: 0 },
      { id: 'task-3', title: 'APK garage bellen', priority: 'low', days: 1 },
      { id: 'task-4', title: 'Presentatie voorbereiden', priority: 'high', days: 3 },
      { id: 'task-5', title: 'Boodschappen doen', priority: 'low', days: 5 },
    ];

    for (const t of tasks) {
      const dueDate = new Date(today);
      dueDate.setDate(dueDate.getDate() + t.days);
      await prisma.task.upsert({
        where: { id: t.id },
        update: {},
        create: { 
          id: t.id, 
          userId, 
          title: t.title, 
          priority: t.priority, 
          dueDate, 
          status: 'pending'
        }
      });
    }

    // Demo events
    const events = [
      { id: 'event-1', title: 'Team standup', hour: 9, duration: 30, type: 'work', color: '#3B82F6' },
      { id: 'event-2', title: 'Lunch met Peter', hour: 12, duration: 60, type: 'social', color: '#10B981', location: 'De Markten' },
      { id: 'event-3', title: 'Tandarts controle', hour: 15, duration: 45, type: 'health', color: '#8B5CF6', location: 'Tandartspraktijk' },
    ];

    for (const e of events) {
      const startTime = new Date(today);
      startTime.setHours(e.hour, 0, 0, 0);
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + e.duration);
      await prisma.event.upsert({
        where: { id: e.id },
        update: {},
        create: { 
          id: e.id, 
          userId, 
          title: e.title, 
          startTime, 
          endTime, 
          eventType: e.type, 
          color: e.color, 
          location: e.location || null
        }
      });
    }

    // Demo contacts
    const contacts = [
      { id: 'contact-1', name: 'Marie', daysUntilBirthday: 5 },
      { id: 'contact-2', name: 'Peter', daysUntilBirthday: 11 },
      { id: 'contact-3', name: 'Mama', daysUntilBirthday: 20 },
    ];

    for (const c of contacts) {
      const birthday = new Date(1990, today.getMonth(), today.getDate() + c.daysUntilBirthday);
      await prisma.contact.upsert({
        where: { id: c.id },
        update: {},
        create: { 
          id: c.id, 
          userId, 
          name: c.name, 
          birthday
        }
      });
    }

    // Demo safety checks
    const checks = [
      { id: 'safety-1', checkType: 'vehicle', name: 'APK Keuring', status: 'warning', nextDays: 42 },
      { id: 'safety-2', checkType: 'backup', name: 'Server Backup', status: 'ok', nextDays: null },
      { id: 'safety-3', checkType: 'security', name: 'Alarm Systeem', status: 'ok', nextDays: null },
    ];

    for (const s of checks) {
      const nextCheckAt = s.nextDays ? new Date(today.getTime() + s.nextDays * 24 * 60 * 60 * 1000) : null;
      await prisma.safetyCheck.upsert({
        where: { id: s.id },
        update: {},
        create: { 
          id: s.id, 
          userId, 
          checkType: s.checkType, 
          name: s.name, 
          status: s.status, 
          nextCheckAt
        }
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Demo data created',
      data: { userId, tasks: tasks.length, events: events.length, contacts: contacts.length, checks: checks.length }
    });
  } catch (error) {
    console.error('POST /api/seed error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
