// ============================================
// EMAIL TASKS API
// Process emails, manage tasks, generate standups
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { 
  parseEmail, 
  createTaskFromEmail, 
  processNewEmails,
  markTaskPaid,
  markTaskDelivered,
  snoozeTask,
  dismissTask,
  updateDeliveryStatus,
} from '@/lib/email-parser';
import { generateDailyStandup, generateWeeklySummary } from '@/lib/daily-standup';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, userId } = body;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId required' }, { status: 400 });
    }

    switch (action) {
      // ============================================
      // EMAIL PROCESSING
      // ============================================
      
      case 'parse_email':
        // Parse a single email
        return await handleParseEmail(body);

      case 'process_emails':
        // Process multiple emails and create tasks
        return await handleProcessEmails(body);

      case 'sync_inbox':
        // Sync with email provider and process new emails
        return await handleSyncInbox(body);

      // ============================================
      // TASK MANAGEMENT
      // ============================================

      case 'get_tasks':
        // Get all tasks with filters
        return await handleGetTasks(body);

      case 'get_task':
        // Get single task details
        return await handleGetTask(body);

      case 'mark_paid':
        // Mark invoice as paid
        return await handleMarkPaid(body);

      case 'mark_delivered':
        // Mark delivery as received
        return await handleMarkDelivered(body);

      case 'snooze_task':
        // Snooze a task
        return await handleSnoozeTask(body);

      case 'dismiss_task':
        // Dismiss/ignore a task
        return await handleDismissTask(body);

      case 'update_tracking':
        // Update delivery tracking status
        return await handleUpdateTracking(body);

      // ============================================
      // DAILY STANDUP
      // ============================================

      case 'get_standup':
        // Get daily standup data
        return await handleGetStandup(body);

      case 'get_weekly_summary':
        // Get weekly summary
        return await handleGetWeeklySummary(body);

      // ============================================
      // REMINDERS
      // ============================================

      case 'get_reminders':
        // Get pending reminders
        return await handleGetReminders(body);

      case 'dismiss_reminder':
        // Dismiss a reminder
        return await handleDismissReminder(body);

      default:
        return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Email Tasks API error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

// ============================================
// HANDLERS
// ============================================

async function handleParseEmail(body: any) {
  const { email } = body;
  
  const parsed = await parseEmail({
    ...email,
    receivedAt: new Date(email.receivedAt),
  });

  return NextResponse.json({ success: true, data: { parsed } });
}

async function handleProcessEmails(body: any) {
  const { userId, emails } = body;
  
  const results = await processNewEmails(
    userId,
    emails.map((e: any) => ({ ...e, receivedAt: new Date(e.receivedAt) }))
  );

  return NextResponse.json({ success: true, data: results });
}

async function handleSyncInbox(body: any) {
  const { userId, provider, accessToken } = body;
  
  // This would integrate with email providers
  // For now, return placeholder
  return NextResponse.json({
    success: true,
    data: {
      message: 'Email sync would happen here',
      supportedProviders: ['gmail', 'outlook', 'imap'],
    },
  });
}

async function handleGetTasks(body: any) {
  const { userId, category, status, limit = 50, offset = 0 } = body;

  const where: any = { userId };
  
  if (category) {
    if (category === 'invoice') {
      where.category = { in: ['invoice', 'payment_reminder'] };
    } else if (category === 'delivery') {
      where.category = { in: ['delivery', 'order_confirm', 'delivery_confirm'] };
    } else {
      where.category = category;
    }
  }
  
  if (status) {
    where.taskStatus = status;
  }

  const [tasks, total] = await Promise.all([
    prisma.emailTask.findMany({
      where,
      orderBy: [
        { taskPriority: 'desc' },
        { invoiceDueDate: 'asc' },
        { expectedDelivery: 'asc' },
      ],
      take: limit,
      skip: offset,
    }),
    prisma.emailTask.count({ where }),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      tasks,
      pagination: { total, limit, offset },
    },
  });
}

async function handleGetTask(body: any) {
  const { taskId } = body;

  const task = await prisma.emailTask.findUnique({
    where: { id: taskId },
    include: {
      reminders: true,
      trackingEvents: {
        orderBy: { timestamp: 'desc' },
      },
    },
  });

  if (!task) {
    return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: { task } });
}

async function handleMarkPaid(body: any) {
  const { taskId, paidAt } = body;
  
  await markTaskPaid(taskId, paidAt ? new Date(paidAt) : undefined);
  
  return NextResponse.json({ success: true });
}

async function handleMarkDelivered(body: any) {
  const { taskId, deliveredAt } = body;
  
  await markTaskDelivered(taskId, deliveredAt ? new Date(deliveredAt) : undefined);
  
  return NextResponse.json({ success: true });
}

async function handleSnoozeTask(body: any) {
  const { taskId, until } = body;
  
  await snoozeTask(taskId, new Date(until));
  
  return NextResponse.json({ success: true });
}

async function handleDismissTask(body: any) {
  const { taskId } = body;
  
  await dismissTask(taskId);
  
  return NextResponse.json({ success: true });
}

async function handleUpdateTracking(body: any) {
  const { taskId } = body;
  
  await updateDeliveryStatus(taskId);
  
  const task = await prisma.emailTask.findUnique({
    where: { id: taskId },
  });
  
  return NextResponse.json({ success: true, data: { task } });
}

async function handleGetStandup(body: any) {
  const { userId } = body;
  
  const standup = await generateDailyStandup(userId);
  
  return NextResponse.json({ success: true, data: { standup } });
}

async function handleGetWeeklySummary(body: any) {
  const { userId } = body;
  
  const summary = await generateWeeklySummary(userId);
  
  return NextResponse.json({ success: true, data: { summary } });
}

async function handleGetReminders(body: any) {
  const { userId } = body;

  const reminders = await prisma.taskReminder.findMany({
    where: {
      userId,
      status: 'pending',
      reminderDate: { lte: new Date() },
    },
    include: {
      emailTask: true,
    },
    orderBy: { reminderDate: 'asc' },
  });

  return NextResponse.json({ success: true, data: { reminders } });
}

async function handleDismissReminder(body: any) {
  const { reminderId } = body;

  await prisma.taskReminder.update({
    where: { id: reminderId },
    data: { status: 'dismissed' },
  });

  return NextResponse.json({ success: true });
}

// ============================================
// CRON ENDPOINT - For scheduled tasks
// ============================================

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  
  // Verify cron secret
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const action = request.nextUrl.searchParams.get('action');

  switch (action) {
    case 'update_tracking':
      // Update all delivery tracking statuses
      const deliveryTasks = await prisma.emailTask.findMany({
        where: {
          category: { in: ['delivery', 'order_confirm'] },
          taskStatus: 'pending',
          trackingNumber: { not: null },
        },
      });

      for (const task of deliveryTasks) {
        try {
          await updateDeliveryStatus(task.id);
        } catch (error) {
          console.error(`Failed to update tracking for ${task.id}:`, error);
        }
      }

      return NextResponse.json({ success: true, updated: deliveryTasks.length });

    case 'send_reminders':
      // Process due reminders
      const dueReminders = await prisma.taskReminder.findMany({
        where: {
          status: 'pending',
          reminderDate: { lte: new Date() },
        },
        include: {
          emailTask: true,
        },
      });

      // Here you would send notifications (push, email, etc.)
      console.log(`Would send ${dueReminders.length} reminders`);

      return NextResponse.json({ success: true, reminders: dueReminders.length });

    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }
}
