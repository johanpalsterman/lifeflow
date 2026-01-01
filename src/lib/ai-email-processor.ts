import { prisma } from '@/lib/prisma';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface EmailMessage {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  snippet: string;
  body?: string;
  receivedAt: string;
}

interface EmailAnalysis {
  category: 'task' | 'event' | 'invoice' | 'delivery' | 'newsletter' | 'spam' | 'other';
  priority: 'high' | 'medium' | 'low';
  summary: string;
  actionRequired: boolean;
  suggestedAction?: {
    type: 'create_task' | 'create_event' | 'track_package' | 'record_invoice' | 'ignore';
    title?: string;
    description?: string;
    dueDate?: string;
    amount?: number;
    trackingNumber?: string;
    carrier?: string;
  };
}

export async function analyzeEmail(email: EmailMessage): Promise<EmailAnalysis> {
  const prompt = `Analyseer deze email en geef een JSON response terug.

Email:
Van: ${email.from}
Onderwerp: ${email.subject}
Preview: ${email.snippet}
${email.body ? 'Body: ' + email.body.substring(0, 1000) : ''}

Categoriseer de email en bepaal of er actie nodig is. Antwoord ALLEEN met JSON in dit formaat:
{
  "category": "task" | "event" | "invoice" | "delivery" | "newsletter" | "spam" | "other",
  "priority": "high" | "medium" | "low",
  "summary": "korte samenvatting in het Nederlands",
  "actionRequired": true/false,
  "suggestedAction": {
    "type": "create_task" | "create_event" | "track_package" | "record_invoice" | "ignore",
    "title": "titel voor taak/event",
    "description": "beschrijving",
    "dueDate": "YYYY-MM-DD indien van toepassing",
    "amount": getal indien factuur,
    "trackingNumber": "trackingnummer indien pakket",
    "carrier": "PostNL/DHL/DPD/etc indien pakket"
  }
}

Let op:
- Facturen/rekeningen -> category: "invoice", suggestedAction.type: "record_invoice"
- Pakket tracking/leveringen -> category: "delivery", suggestedAction.type: "track_package"
- Afspraken/uitnodigingen -> category: "event", suggestedAction.type: "create_event"
- Todo's/verzoeken -> category: "task", suggestedAction.type: "create_task"
- Nieuwsbrieven -> category: "newsletter", suggestedAction.type: "ignore"
- Spam/promotie -> category: "spam", suggestedAction.type: "ignore"`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as EmailAnalysis;
      }
    }

    return {
      category: 'other',
      priority: 'low',
      summary: 'Kon email niet analyseren',
      actionRequired: false,
    };
  } catch (error) {
    console.error('AI analysis error:', error);
    return {
      category: 'other',
      priority: 'low',
      summary: 'Analyse mislukt',
      actionRequired: false,
    };
  }
}

export async function processEmailWithRules(
  userId: string,
  email: EmailMessage,
  analysis: EmailAnalysis
): Promise<{ action: string; result: any }> {
  let actionTaken = 'none';
  let result: any = null;

  if (analysis.actionRequired && analysis.suggestedAction) {
    switch (analysis.suggestedAction.type) {
      case 'create_task':
        result = await prisma.task.create({
          data: {
            userId,
            title: analysis.suggestedAction.title || analysis.summary,
            description: analysis.suggestedAction.description || 'Van: ' + email.from + '\n' + email.snippet,
            priority: analysis.priority,
            status: 'pending',
            dueDate: analysis.suggestedAction.dueDate ? new Date(analysis.suggestedAction.dueDate) : null,
          },
        });
        actionTaken = 'task_created';
        break;

      case 'create_event':
        const eventDate = analysis.suggestedAction.dueDate 
          ? new Date(analysis.suggestedAction.dueDate)
          : new Date();
        result = await prisma.event.create({
          data: {
            userId,
            title: analysis.suggestedAction.title || analysis.summary,
            description: analysis.suggestedAction.description,
            startTime: eventDate,
            endTime: new Date(eventDate.getTime() + 60 * 60 * 1000),
            eventType: 'email',
          },
        });
        actionTaken = 'event_created';
        break;

      case 'track_package':
        result = await prisma.package.create({
          data: {
            userId,
            description: analysis.suggestedAction.title || analysis.summary,
            trackingNumber: analysis.suggestedAction.trackingNumber,
            carrier: analysis.suggestedAction.carrier || 'Unknown',
            status: 'pending',
          },
        });
        actionTaken = 'package_tracked';
        break;

      default:
        actionTaken = 'ignored';
    }
  }

  return { action: actionTaken, result };
}

export async function fetchAndProcessEmails(userId: string): Promise<{
  processed: number;
  actions: { emailId: string; action: string; title?: string }[];
}> {
  const integration = await prisma.userIntegration.findFirst({
    where: { userId, provider: 'google', isActive: true },
  });

  if (!integration?.accessToken) {
    throw new Error('No Google integration found');
  }

  const messagesRes = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10&q=is:unread',
    { headers: { Authorization: 'Bearer ' + integration.accessToken } }
  );

  if (!messagesRes.ok) {
    throw new Error('Failed to fetch emails');
  }

  const messagesData = await messagesRes.json();
  const messageIds = messagesData.messages || [];

  const actions: { emailId: string; action: string; title?: string }[] = [];

  for (const msg of messageIds) {
    const detailRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/' + msg.id + '?format=full',
      { headers: { Authorization: 'Bearer ' + integration.accessToken } }
    );

    if (!detailRes.ok) continue;

    const detail = await detailRes.json();
    const headers = detail.payload?.headers || [];

    const from = headers.find((h: any) => h.name === 'From')?.value || '';
    const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';

    const email: EmailMessage = {
      id: msg.id,
      threadId: detail.threadId,
      from,
      subject,
      snippet: detail.snippet || '',
      receivedAt: new Date(parseInt(detail.internalDate)).toISOString(),
    };

    const analysis = await analyzeEmail(email);
    const result = await processEmailWithRules(userId, email, analysis);

    actions.push({
      emailId: email.id,
      action: result.action,
      title: analysis.summary,
    });
  }

  return { processed: actions.length, actions };
}
