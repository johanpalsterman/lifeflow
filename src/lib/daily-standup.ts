// ============================================
// DAILY STANDUP SERVICE
// Aggregates tasks, deliveries, invoices for daily briefing
// ============================================

import prisma from '@/lib/prisma';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

export interface DailyStandupData {
  date: Date;
  greeting: string;
  
  // Summary stats
  summary: {
    pendingInvoices: number;
    totalInvoiceAmount: number;
    overdueInvoices: number;
    deliveriesExpected: number;
    tasksToday: number;
    tasksDueSoon: number;
  };
  
  // Urgent items (need attention today)
  urgent: {
    overdueInvoices: InvoiceItem[];
    dueTodayInvoices: InvoiceItem[];
    deliveriesToday: DeliveryItem[];
  };
  
  // Upcoming items
  upcoming: {
    invoices: InvoiceItem[];      // Due within 7 days
    deliveries: DeliveryItem[];   // Expected within 7 days
  };
  
  // Recently completed
  completed: {
    paidInvoices: InvoiceItem[];      // Last 7 days
    receivedDeliveries: DeliveryItem[]; // Last 7 days
  };
  
  // AI-generated briefing
  briefing: string;
  
  // Suggestions
  suggestions: string[];
}

export interface InvoiceItem {
  id: string;
  vendor: string;
  amount: number;
  currency: string;
  dueDate: Date;
  invoiceNumber?: string;
  daysUntilDue: number;
  isOverdue: boolean;
  status: string;
  emailSubject: string;
}

export interface DeliveryItem {
  id: string;
  vendor: string;
  orderNumber?: string;
  trackingNumber?: string;
  carrier?: string;
  expectedDelivery?: Date;
  status: string;
  items?: Array<{ name: string; quantity: number }>;
  daysUntilDelivery?: number;
  emailSubject: string;
}

// ============================================
// GENERATE DAILY STANDUP
// ============================================

export async function generateDailyStandup(userId: string): Promise<DailyStandupData> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const weekFromNow = new Date(today);
  weekFromNow.setDate(weekFromNow.getDate() + 7);
  
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  // Fetch all relevant tasks
  const [
    allInvoiceTasks,
    allDeliveryTasks,
    completedInvoices,
    completedDeliveries,
  ] = await Promise.all([
    // Pending invoices
    prisma.emailTask.findMany({
      where: {
        userId,
        category: { in: ['invoice', 'payment_reminder'] },
        taskStatus: { in: ['pending', 'snoozed'] },
      },
      orderBy: { invoiceDueDate: 'asc' },
    }),
    // Pending deliveries
    prisma.emailTask.findMany({
      where: {
        userId,
        category: { in: ['delivery', 'order_confirm'] },
        taskStatus: { in: ['pending', 'snoozed'] },
        deliveryStatus: { not: 'delivered' },
      },
      orderBy: { expectedDelivery: 'asc' },
    }),
    // Recently paid invoices
    prisma.emailTask.findMany({
      where: {
        userId,
        category: { in: ['invoice', 'payment_reminder'] },
        taskStatus: 'completed',
        paidAt: { gte: weekAgo },
      },
      orderBy: { paidAt: 'desc' },
    }),
    // Recently delivered
    prisma.emailTask.findMany({
      where: {
        userId,
        category: { in: ['delivery', 'order_confirm'] },
        deliveryStatus: 'delivered',
        deliveredAt: { gte: weekAgo },
      },
      orderBy: { deliveredAt: 'desc' },
    }),
  ]);

  // Process invoices
  const invoices = allInvoiceTasks.map(task => mapToInvoiceItem(task, today));
  const overdueInvoices = invoices.filter(i => i.isOverdue);
  const dueTodayInvoices = invoices.filter(i => i.daysUntilDue === 0 && !i.isOverdue);
  const upcomingInvoices = invoices.filter(i => i.daysUntilDue > 0 && i.daysUntilDue <= 7);

  // Process deliveries
  const deliveries = allDeliveryTasks.map(task => mapToDeliveryItem(task, today));
  const deliveriesToday = deliveries.filter(d => d.daysUntilDelivery === 0);
  const upcomingDeliveries = deliveries.filter(d => 
    d.daysUntilDelivery !== undefined && d.daysUntilDelivery > 0 && d.daysUntilDelivery <= 7
  );

  // Calculate totals
  const totalInvoiceAmount = invoices.reduce((sum, i) => sum + i.amount, 0);

  // Build standup data
  const standupData: DailyStandupData = {
    date: today,
    greeting: getGreeting(),
    
    summary: {
      pendingInvoices: invoices.length,
      totalInvoiceAmount,
      overdueInvoices: overdueInvoices.length,
      deliveriesExpected: deliveries.length,
      tasksToday: dueTodayInvoices.length + deliveriesToday.length,
      tasksDueSoon: upcomingInvoices.length + upcomingDeliveries.length,
    },
    
    urgent: {
      overdueInvoices,
      dueTodayInvoices,
      deliveriesToday,
    },
    
    upcoming: {
      invoices: upcomingInvoices,
      deliveries: upcomingDeliveries,
    },
    
    completed: {
      paidInvoices: completedInvoices.map(t => mapToInvoiceItem(t, today)),
      receivedDeliveries: completedDeliveries.map(t => mapToDeliveryItem(t, today)),
    },
    
    briefing: '',
    suggestions: [],
  };

  // Generate AI briefing
  standupData.briefing = await generateBriefing(standupData);
  standupData.suggestions = generateSuggestions(standupData);

  return standupData;
}

// ============================================
// HELPERS
// ============================================

function mapToInvoiceItem(task: any, today: Date): InvoiceItem {
  const dueDate = task.invoiceDueDate ? new Date(task.invoiceDueDate) : null;
  let daysUntilDue = 999;
  let isOverdue = false;

  if (dueDate) {
    const diffTime = dueDate.getTime() - today.getTime();
    daysUntilDue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    isOverdue = daysUntilDue < 0;
  }

  return {
    id: task.id,
    vendor: task.vendor || 'Onbekend',
    amount: task.amount || 0,
    currency: task.currency || 'EUR',
    dueDate: dueDate || new Date(),
    invoiceNumber: task.invoiceNumber,
    daysUntilDue,
    isOverdue,
    status: task.taskStatus,
    emailSubject: task.emailSubject,
  };
}

function mapToDeliveryItem(task: any, today: Date): DeliveryItem {
  const expectedDelivery = task.expectedDelivery ? new Date(task.expectedDelivery) : null;
  let daysUntilDelivery: number | undefined;

  if (expectedDelivery) {
    const diffTime = expectedDelivery.getTime() - today.getTime();
    daysUntilDelivery = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  return {
    id: task.id,
    vendor: task.vendor || 'Onbekend',
    orderNumber: task.orderNumber,
    trackingNumber: task.trackingNumber,
    carrier: task.carrier,
    expectedDelivery: expectedDelivery || undefined,
    status: task.deliveryStatus || 'unknown',
    items: task.orderItems,
    daysUntilDelivery,
    emailSubject: task.emailSubject,
  };
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Goedemorgen';
  if (hour < 18) return 'Goedemiddag';
  return 'Goedenavond';
}

function generateSuggestions(data: DailyStandupData): string[] {
  const suggestions: string[] = [];

  if (data.urgent.overdueInvoices.length > 0) {
    suggestions.push(`⚠️ Je hebt ${data.urgent.overdueInvoices.length} verlopen factuur/facturen. Betaal deze zo snel mogelijk om extra kosten te voorkomen.`);
  }

  if (data.summary.totalInvoiceAmount > 500) {
    suggestions.push(`💰 Totaal €${data.summary.totalInvoiceAmount.toFixed(2)} aan openstaande facturen. Overweeg een betaalschema.`);
  }

  if (data.urgent.deliveriesToday.length > 0) {
    suggestions.push(`📦 ${data.urgent.deliveriesToday.length} pakket(ten) worden vandaag verwacht. Zorg dat je thuis bent of regel een afleverpunt.`);
  }

  const snoozedInvoices = data.upcoming.invoices.filter(i => i.status === 'snoozed');
  if (snoozedInvoices.length > 0) {
    suggestions.push(`😴 ${snoozedInvoices.length} uitgestelde facturen komen binnenkort weer op je radar.`);
  }

  return suggestions;
}

async function generateBriefing(data: DailyStandupData): Promise<string> {
  const prompt = `Genereer een korte, vriendelijke daily briefing (max 3 zinnen) in het Nederlands voor iemand met:

- ${data.urgent.overdueInvoices.length} verlopen facturen (€${data.urgent.overdueInvoices.reduce((s, i) => s + i.amount, 0).toFixed(2)})
- ${data.urgent.dueTodayInvoices.length} facturen vandaag te betalen
- ${data.summary.pendingInvoices} totaal openstaande facturen (€${data.summary.totalInvoiceAmount.toFixed(2)})
- ${data.urgent.deliveriesToday.length} pakketten verwacht vandaag
- ${data.summary.deliveriesExpected} pakketten onderweg

${data.urgent.overdueInvoices.length > 0 ? `Verlopen: ${data.urgent.overdueInvoices.map(i => `${i.vendor} €${i.amount}`).join(', ')}` : ''}
${data.urgent.deliveriesToday.length > 0 ? `Vandaag: ${data.urgent.deliveriesToday.map(d => d.vendor).join(', ')}` : ''}

Houd het positief maar informatief. Begin met "${data.greeting}!"`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      return content.text;
    }
  } catch (error) {
    console.error('Failed to generate briefing:', error);
  }

  // Fallback briefing
  let briefing = `${data.greeting}! `;
  
  if (data.urgent.overdueInvoices.length > 0) {
    briefing += `Let op: ${data.urgent.overdueInvoices.length} factuur/facturen zijn verlopen. `;
  }
  
  if (data.urgent.deliveriesToday.length > 0) {
    briefing += `Vandaag ${data.urgent.deliveriesToday.length} pakket(ten) verwacht. `;
  }
  
  if (data.summary.pendingInvoices > 0) {
    briefing += `Totaal €${data.summary.totalInvoiceAmount.toFixed(2)} aan openstaande facturen.`;
  }

  return briefing;
}

// ============================================
// SCHEDULED STANDUP EMAIL
// ============================================

export async function sendDailyStandupEmail(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.email) return;

  const standup = await generateDailyStandup(userId);
  
  // Generate email HTML
  const html = generateStandupEmailHtml(standup);
  
  // Send via your email provider
  // await sendEmail({ to: user.email, subject: `Daily Standup - ${formatDate(standup.date)}`, html });
  
  console.log('Would send daily standup email to:', user.email);
}

function generateStandupEmailHtml(data: DailyStandupData): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; }
    .card { background: rgba(255,255,255,0.05); border-radius: 12px; padding: 20px; margin: 16px 0; }
    .urgent { border-left: 4px solid #ef4444; }
    .delivery { border-left: 4px solid #3b82f6; }
    h1 { color: #fff; }
    h2 { color: #94a3b8; font-size: 14px; text-transform: uppercase; }
    .amount { font-size: 24px; font-weight: bold; color: #fff; }
    .overdue { color: #ef4444; }
    .item { padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.1); }
    .item:last-child { border-bottom: none; }
    .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; }
    .badge-red { background: rgba(239,68,68,0.2); color: #ef4444; }
    .badge-yellow { background: rgba(234,179,8,0.2); color: #eab308; }
    .badge-green { background: rgba(34,197,94,0.2); color: #22c55e; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📋 Daily Standup</h1>
    <p>${data.briefing}</p>
    
    ${data.urgent.overdueInvoices.length > 0 ? `
    <div class="card urgent">
      <h2>⚠️ Verlopen Facturen</h2>
      ${data.urgent.overdueInvoices.map(inv => `
        <div class="item">
          <strong>${inv.vendor}</strong>
          <span class="amount overdue">€${inv.amount.toFixed(2)}</span>
          <span class="badge badge-red">${Math.abs(inv.daysUntilDue)} dagen te laat</span>
        </div>
      `).join('')}
    </div>
    ` : ''}
    
    ${data.urgent.dueTodayInvoices.length > 0 ? `
    <div class="card">
      <h2>📅 Vandaag Te Betalen</h2>
      ${data.urgent.dueTodayInvoices.map(inv => `
        <div class="item">
          <strong>${inv.vendor}</strong>
          <span class="amount">€${inv.amount.toFixed(2)}</span>
        </div>
      `).join('')}
    </div>
    ` : ''}
    
    ${data.urgent.deliveriesToday.length > 0 ? `
    <div class="card delivery">
      <h2>📦 Leveringen Vandaag</h2>
      ${data.urgent.deliveriesToday.map(del => `
        <div class="item">
          <strong>${del.vendor}</strong>
          ${del.carrier ? `<span class="badge badge-green">${del.carrier}</span>` : ''}
          ${del.trackingNumber ? `<br><small>Track: ${del.trackingNumber}</small>` : ''}
        </div>
      `).join('')}
    </div>
    ` : ''}
    
    <div class="card">
      <h2>📊 Overzicht</h2>
      <p>Openstaande facturen: <strong>${data.summary.pendingInvoices}</strong> (€${data.summary.totalInvoiceAmount.toFixed(2)})</p>
      <p>Pakketten onderweg: <strong>${data.summary.deliveriesExpected}</strong></p>
    </div>
    
    ${data.suggestions.length > 0 ? `
    <div class="card">
      <h2>💡 Suggesties</h2>
      ${data.suggestions.map(s => `<p>${s}</p>`).join('')}
    </div>
    ` : ''}
  </div>
</body>
</html>
  `;
}

// ============================================
// WEEKLY SUMMARY
// ============================================

export async function generateWeeklySummary(userId: string): Promise<{
  weekStart: Date;
  weekEnd: Date;
  invoicesPaid: number;
  amountPaid: number;
  deliveriesReceived: number;
  upcomingInvoices: number;
  upcomingAmount: number;
}> {
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - 7);
  
  const [paidInvoices, receivedDeliveries, upcomingInvoices] = await Promise.all([
    prisma.emailTask.findMany({
      where: {
        userId,
        category: { in: ['invoice', 'payment_reminder'] },
        paidAt: { gte: weekStart, lte: today },
      },
    }),
    prisma.emailTask.count({
      where: {
        userId,
        category: { in: ['delivery', 'order_confirm'] },
        deliveredAt: { gte: weekStart, lte: today },
      },
    }),
    prisma.emailTask.findMany({
      where: {
        userId,
        category: { in: ['invoice', 'payment_reminder'] },
        taskStatus: 'pending',
      },
    }),
  ]);

  return {
    weekStart,
    weekEnd: today,
    invoicesPaid: paidInvoices.length,
    amountPaid: paidInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0),
    deliveriesReceived: receivedDeliveries,
    upcomingInvoices: upcomingInvoices.length,
    upcomingAmount: upcomingInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0),
  };
}
