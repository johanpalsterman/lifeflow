import { prisma } from '@/lib/prisma';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface EmailToProcess {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  timestamp: Date;
}

interface ProcessedEmail {
  type: 'delivery' | 'invoice' | 'task' | 'birthday' | 'event' | 'ignore';
  confidence: number;
  data: {
    title?: string;
    description?: string;
    carrier?: string;
    trackingNumber?: string;
    expectedDate?: string;
    amount?: number;
    dueDate?: string;
    invoiceType?: 'payable' | 'receivable';
    priority?: 'low' | 'medium' | 'high';
    eventDate?: string;
    contactName?: string;
  };
}

export async function analyzeEmail(email: EmailToProcess): Promise<ProcessedEmail> {
  const prompt = `Analyze this email and categorize it. Return JSON only.

Email:
From: ${email.from}
Subject: ${email.subject}
Preview: ${email.snippet}

Categories:
- "delivery": Package tracking, shipping notifications (PostNL, DHL, Bol.com, Amazon, Coolblue, etc.)
- "invoice": Bills, invoices, payment requests, subscriptions
- "task": Action items, requests, things to do
- "event": Calendar invites, appointments, meetings
- "birthday": Birthday reminders
- "ignore": Newsletters, marketing, spam, notifications that need no action

Return this exact JSON format:
{
  "type": "delivery|invoice|task|event|birthday|ignore",
  "confidence": 0.0-1.0,
  "data": {
    "title": "short title",
    "description": "brief description",
    "carrier": "PostNL/DHL/etc (only for delivery)",
    "trackingNumber": "if found (only for delivery)",
    "expectedDate": "YYYY-MM-DD if mentioned",
    "amount": 123.45 (only for invoice, number without currency),
    "dueDate": "YYYY-MM-DD (for invoice/task)",
    "invoiceType": "payable|receivable (only for invoice)",
    "priority": "low|medium|high (for task)",
    "eventDate": "YYYY-MM-DD (for event)",
    "contactName": "name (for birthday)"
  }
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('AI analysis error:', error);
  }

  return { type: 'ignore', confidence: 0, data: {} };
}

export async function processEmailsForUser(userId: string) {
  // Get user's Google integration
  const integration = await prisma.userIntegration.findFirst({
    where: { userId, provider: 'google', isActive: true },
  });

  if (!integration?.accessToken) {
    return { processed: 0, error: 'No active Google integration' };
  }

  // Fetch recent unread emails
  const messagesResponse = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10&q=is:unread',
    { headers: { Authorization: `Bearer ${integration.accessToken}` } }
  );
  const messagesData = await messagesResponse.json();

  if (!messagesData.messages) {
    return { processed: 0, results: [] };
  }

  const results = [];

  for (const msg of messagesData.messages) {
    // Check if already processed
    const existing = await prisma.processedEmail.findUnique({
      where: { externalId: msg.id },
    });

    if (existing) continue;

    // Fetch email details
    const detailResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
      { headers: { Authorization: `Bearer ${integration.accessToken}` } }
    );
    const detail = await detailResponse.json();

    const headers = detail.payload?.headers || [];
    const from = headers.find((h: any) => h.name === 'From')?.value || '';
    const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
    const snippet = detail.snippet || '';

    // Analyze with AI
    const analysis = await analyzeEmail({
      id: msg.id,
      from,
      subject,
      snippet,
      timestamp: new Date(parseInt(detail.internalDate)),
    });

    // Store processed email
    await prisma.processedEmail.create({
      data: {
        externalId: msg.id,
        userId,
        provider: 'google',
        category: analysis.type,
        confidence: analysis.confidence,
        rawData: { from, subject, snippet },
        processedData: analysis.data,
      },
    });

    // Create items based on analysis
    if (analysis.confidence >= 0.7) {
      switch (analysis.type) {
        case 'delivery':
          await prisma.package.create({
            data: {
              userId,
              carrier: analysis.data.carrier || 'Unknown',
              trackingNumber: analysis.data.trackingNumber,
              description: analysis.data.title || subject,
              status: 'in_transit',
              expectedDelivery: analysis.data.expectedDate 
                ? new Date(analysis.data.expectedDate) 
                : null,
              sourceEmailId: msg.id,
            },
          });
          break;

        case 'invoice':
          await prisma.invoice.create({
            data: {
              userId,
              description: analysis.data.title || subject,
              amount: analysis.data.amount || 0,
              type: analysis.data.invoiceType || 'payable',
              status: 'pending',
              dueDate: analysis.data.dueDate 
                ? new Date(analysis.data.dueDate) 
                : null,
              sourceEmailId: msg.id,
            },
          });
          break;

        case 'task':
          await prisma.task.create({
            data: {
              userId,
              title: analysis.data.title || subject,
              description: analysis.data.description,
              priority: analysis.data.priority || 'medium',
              status: 'pending',
              dueDate: analysis.data.dueDate 
                ? new Date(analysis.data.dueDate) 
                : null,
              sourceEmailId: msg.id,
            },
          });
          break;

        case 'event':
          await prisma.event.create({
            data: {
              userId,
              title: analysis.data.title || subject,
              description: analysis.data.description,
              startTime: analysis.data.eventDate 
                ? new Date(analysis.data.eventDate) 
                : new Date(),
              eventType: 'email',
              sourceEmailId: msg.id,
            },
          });
          break;
      }
    }

    results.push({ id: msg.id, analysis });
  }

  return { processed: results.length, results };
}
