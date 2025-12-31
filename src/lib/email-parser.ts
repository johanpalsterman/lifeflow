// ============================================
// EMAIL PARSER SERVICE
// AI-powered detection of invoices & deliveries
// ============================================

import Anthropic from '@anthropic-ai/sdk';
import prisma from '@/lib/prisma';

const anthropic = new Anthropic();

// Email types we track
export type EmailCategory = 
  | 'invoice'           // Te betalen factuur
  | 'delivery'          // Levering onderweg
  | 'delivery_confirm'  // Levering bevestigd/aangekomen
  | 'payment_reminder'  // Betalingsherinnering
  | 'payment_confirm'   // Betaling bevestigd
  | 'subscription'      // Abonnement/recurring
  | 'order_confirm'     // Bestelling bevestigd
  | 'other';

export interface ParsedEmail {
  category: EmailCategory;
  confidence: number;
  
  // Extracted data
  vendor?: string;
  amount?: number;
  currency?: string;
  dueDate?: Date;
  invoiceNumber?: string;
  
  // Delivery specific
  trackingNumber?: string;
  carrier?: string;
  expectedDelivery?: Date;
  deliveryStatus?: string;
  
  // Order specific
  orderNumber?: string;
  items?: Array<{
    name: string;
    quantity: number;
    price?: number;
  }>;
  
  // Task suggestion
  suggestedTask?: {
    title: string;
    dueDate?: Date;
    priority: 'high' | 'medium' | 'low';
    category: string;
  };
  
  // Raw extraction
  summary: string;
  keyDates: Array<{ label: string; date: Date }>;
}

export interface EmailMessage {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  htmlBody?: string;
  receivedAt: Date;
  attachments?: Array<{
    filename: string;
    contentType: string;
    size: number;
  }>;
}

// ============================================
// MAIN PARSER
// ============================================

export async function parseEmail(email: EmailMessage): Promise<ParsedEmail> {
  const prompt = buildParsePrompt(email);
  
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type');
  }

  // Parse JSON response
  const jsonMatch = content.text.match(/```json\n?([\s\S]*?)\n?```/);
  if (!jsonMatch) {
    // Try parsing as direct JSON
    try {
      return JSON.parse(content.text);
    } catch {
      throw new Error('Could not parse AI response');
    }
  }

  const parsed = JSON.parse(jsonMatch[1]);
  
  // Convert date strings to Date objects
  if (parsed.dueDate) parsed.dueDate = new Date(parsed.dueDate);
  if (parsed.expectedDelivery) parsed.expectedDelivery = new Date(parsed.expectedDelivery);
  if (parsed.suggestedTask?.dueDate) parsed.suggestedTask.dueDate = new Date(parsed.suggestedTask.dueDate);
  if (parsed.keyDates) {
    parsed.keyDates = parsed.keyDates.map((kd: any) => ({
      ...kd,
      date: new Date(kd.date),
    }));
  }

  return parsed;
}

function buildParsePrompt(email: EmailMessage): string {
  const today = new Date().toISOString().split('T')[0];
  
  return `Analyseer deze email en extraheer relevante informatie voor taakbeheer.

VANDAAG: ${today}

EMAIL:
Van: ${email.from}
Aan: ${email.to}
Onderwerp: ${email.subject}
Ontvangen: ${email.receivedAt.toISOString()}

INHOUD:
${email.body}

${email.attachments?.length ? `BIJLAGEN: ${email.attachments.map(a => a.filename).join(', ')}` : ''}

---

Analyseer de email en geef een JSON response met:

1. category: Een van: 'invoice', 'delivery', 'delivery_confirm', 'payment_reminder', 'payment_confirm', 'subscription', 'order_confirm', 'other'

2. confidence: Hoe zeker ben je (0.0-1.0)

3. Voor FACTUREN (invoice/payment_reminder):
   - vendor: Naam van het bedrijf
   - amount: Bedrag (alleen getal)
   - currency: EUR, USD, etc.
   - dueDate: Vervaldatum (ISO format)
   - invoiceNumber: Factuurnummer

4. Voor LEVERINGEN (delivery/delivery_confirm):
   - vendor: Webshop/verkoper
   - trackingNumber: Track & trace code
   - carrier: Vervoerder (PostNL, DHL, etc.)
   - expectedDelivery: Verwachte leverdatum
   - deliveryStatus: 'ordered', 'shipped', 'out_for_delivery', 'delivered'
   - orderNumber: Bestelnummer
   - items: Array van bestelde items

5. suggestedTask: Voorgestelde taak
   - title: Korte taaktitel (bijv. "Betaal factuur Ziggo €45.99")
   - dueDate: Wanneer moet dit af zijn
   - priority: 'high' voor facturen bijna vervallen, 'medium' normaal, 'low' informatief
   - category: 'finance', 'delivery', 'admin'

6. summary: Korte samenvatting (1 zin)

7. keyDates: Belangrijke datums [{ label: string, date: ISO string }]

Antwoord ALLEEN met JSON, geen extra tekst:

\`\`\`json
{
  "category": "...",
  "confidence": 0.95,
  ...
}
\`\`\``;
}

// ============================================
// TASK CREATION
// ============================================

export async function createTaskFromEmail(
  userId: string,
  email: EmailMessage,
  parsed: ParsedEmail
): Promise<any> {
  if (!parsed.suggestedTask) {
    return null;
  }

  // Check for duplicates (same email already processed)
  const existing = await prisma.emailTask.findFirst({
    where: {
      userId,
      emailId: email.id,
    },
  });

  if (existing) {
    return existing;
  }

  // Create the task
  const task = await prisma.emailTask.create({
    data: {
      oderId: `${userId}-${email.id}`,
      userId,
      emailId: email.id,
      
      // Email info
      emailFrom: email.from,
      emailSubject: email.subject,
      emailReceivedAt: email.receivedAt,
      
      // Parsed data
      category: parsed.category,
      vendor: parsed.vendor,
      amount: parsed.amount,
      currency: parsed.currency || 'EUR',
      
      // Invoice specific
      invoiceNumber: parsed.invoiceNumber,
      invoiceDueDate: parsed.dueDate,
      
      // Delivery specific
      trackingNumber: parsed.trackingNumber,
      carrier: parsed.carrier,
      expectedDelivery: parsed.expectedDelivery,
      deliveryStatus: parsed.deliveryStatus,
      orderNumber: parsed.orderNumber,
      orderItems: parsed.items,
      
      // Task
      taskTitle: parsed.suggestedTask.title,
      taskDueDate: parsed.suggestedTask.dueDate,
      taskPriority: parsed.suggestedTask.priority,
      taskCategory: parsed.suggestedTask.category,
      taskStatus: 'pending',
      
      // Meta
      summary: parsed.summary,
      confidence: parsed.confidence,
      rawParsedData: parsed as any,
    },
  });

  // Create reminder if invoice is due soon
  if (parsed.category === 'invoice' && parsed.dueDate) {
    const daysUntilDue = Math.ceil((parsed.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilDue <= 7 && daysUntilDue > 0) {
      await createReminder(userId, task.id, {
        title: `⚠️ Factuur vervalt over ${daysUntilDue} dagen: ${parsed.vendor}`,
        date: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      });
    }
  }

  return task;
}

async function createReminder(userId: string, taskId: string, reminder: { title: string; date: Date }) {
  await prisma.taskReminder.create({
    data: {
      oderId: `${taskId}-reminder-${Date.now()}`,
      userId,
      emailTaskId: taskId,
      title: reminder.title,
      reminderDate: reminder.date,
      status: 'pending',
    },
  });
}

// ============================================
// DELIVERY TRACKING
// ============================================

export async function updateDeliveryStatus(taskId: string): Promise<void> {
  const task = await prisma.emailTask.findUnique({
    where: { id: taskId },
  });

  if (!task || !task.trackingNumber || !task.carrier) {
    return;
  }

  // In a real implementation, call carrier APIs
  // For now, simulate status update
  const status = await fetchTrackingStatus(task.carrier, task.trackingNumber);
  
  if (status && status !== task.deliveryStatus) {
    await prisma.emailTask.update({
      where: { id: taskId },
      data: {
        deliveryStatus: status,
        ...(status === 'delivered' ? { 
          taskStatus: 'completed',
          completedAt: new Date(),
        } : {}),
      },
    });

    // Add to tracking history
    await prisma.deliveryTrackingEvent.create({
      data: {
        emailTaskId: taskId,
        status,
        timestamp: new Date(),
      },
    });
  }
}

async function fetchTrackingStatus(carrier: string, trackingNumber: string): Promise<string | null> {
  // Placeholder - integrate with actual carrier APIs
  // PostNL API: https://developer.postnl.nl/
  // DHL API: https://developer.dhl.com/
  // DPD, UPS, FedEx, etc.
  
  console.log(`Would fetch status for ${carrier}: ${trackingNumber}`);
  return null;
}

// ============================================
// BATCH PROCESSING
// ============================================

export async function processNewEmails(userId: string, emails: EmailMessage[]): Promise<{
  processed: number;
  tasks: any[];
  errors: string[];
}> {
  const results = {
    processed: 0,
    tasks: [] as any[],
    errors: [] as string[],
  };

  for (const email of emails) {
    try {
      // Skip if already processed
      const existing = await prisma.emailTask.findFirst({
        where: { userId, emailId: email.id },
      });
      
      if (existing) {
        continue;
      }

      // Parse email
      const parsed = await parseEmail(email);
      
      // Skip low-confidence or 'other' category
      if (parsed.confidence < 0.7 || parsed.category === 'other') {
        continue;
      }

      // Create task
      const task = await createTaskFromEmail(userId, email, parsed);
      if (task) {
        results.tasks.push(task);
      }
      
      results.processed++;
    } catch (error) {
      results.errors.push(`Email ${email.id}: ${error}`);
    }
  }

  return results;
}

// ============================================
// MARK TASK ACTIONS
// ============================================

export async function markTaskPaid(taskId: string, paidAt?: Date): Promise<void> {
  await prisma.emailTask.update({
    where: { id: taskId },
    data: {
      taskStatus: 'completed',
      completedAt: paidAt || new Date(),
      paidAt: paidAt || new Date(),
    },
  });
}

export async function markTaskDelivered(taskId: string, deliveredAt?: Date): Promise<void> {
  await prisma.emailTask.update({
    where: { id: taskId },
    data: {
      taskStatus: 'completed',
      completedAt: deliveredAt || new Date(),
      deliveryStatus: 'delivered',
      deliveredAt: deliveredAt || new Date(),
    },
  });
}

export async function snoozeTask(taskId: string, until: Date): Promise<void> {
  await prisma.emailTask.update({
    where: { id: taskId },
    data: {
      taskStatus: 'snoozed',
      snoozedUntil: until,
    },
  });
}

export async function dismissTask(taskId: string): Promise<void> {
  await prisma.emailTask.update({
    where: { id: taskId },
    data: {
      taskStatus: 'dismissed',
      completedAt: new Date(),
    },
  });
}
