import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function analyzeEmail(email: { from: string; subject: string; snippet: string }) {
  const prompt = `Analyze this email and categorize it. Return JSON only, no other text.

Email:
From: ${email.from}
Subject: ${email.subject}
Preview: ${email.snippet}

Categories:
- "delivery": Package tracking, shipping notifications (PostNL, DHL, Bol.com, Amazon, Coolblue, etc.)
- "invoice": Bills, invoices, payment requests, subscriptions
- "task": Action items, requests, things to do
- "event": Calendar invites, appointments, meetings
- "ignore": Newsletters, marketing, spam, notifications that need no action

Return ONLY this JSON format, nothing else:
{
  "type": "delivery|invoice|task|event|ignore",
  "confidence": 0.8,
  "data": {
    "title": "short title",
    "description": "brief description",
    "carrier": "PostNL/DHL/etc",
    "trackingNumber": "if found",
    "expectedDate": "YYYY-MM-DD",
    "amount": 123.45,
    "dueDate": "YYYY-MM-DD",
    "invoiceType": "payable|receivable",
    "priority": "low|medium|high"
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

export async function POST(request: NextRequest) {
  try {
    // Get first active Google integration
    const integration = await prisma.userIntegration.findFirst({
      where: { provider: 'google', isActive: true },
      include: { user: true },
    });

    if (!integration?.accessToken) {
      return NextResponse.json({
        success: false,
        error: 'No active Google integration',
      });
    }

    const userId = integration.userId;

    // Check/refresh token
    let accessToken = integration.accessToken;
    if (integration.tokenExpiresAt && new Date(integration.tokenExpiresAt) < new Date()) {
      if (integration.refreshToken) {
        const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            refresh_token: integration.refreshToken,
            grant_type: 'refresh_token',
          }),
        });
        const tokens = await refreshResponse.json();
        if (tokens.access_token) {
          accessToken = tokens.access_token;
          await prisma.userIntegration.update({
            where: { id: integration.id },
            data: {
              accessToken: tokens.access_token,
              tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
            },
          });
        }
      }
    }

    // Fetch recent unread emails
    const messagesResponse = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10&q=is:unread',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const messagesData = await messagesResponse.json();

    if (!messagesData.messages) {
      return NextResponse.json({
        success: true,
        processed: 0,
        message: 'No unread emails',
      });
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
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const detail = await detailResponse.json();

      const headers = detail.payload?.headers || [];
      const from = headers.find((h: any) => h.name === 'From')?.value || '';
      const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
      const snippet = detail.snippet || '';

      // Analyze with AI
      const analysis = await analyzeEmail({ from, subject, snippet });

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
                trackingNumber: analysis.data.trackingNumber || null,
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
                description: analysis.data.description || null,
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
                description: analysis.data.description || null,
                startTime: analysis.data.expectedDate
                  ? new Date(analysis.data.expectedDate)
                  : new Date(),
                eventType: 'email',
                sourceEmailId: msg.id,
              },
            });
            break;
        }
      }

      results.push({
        id: msg.id,
        subject,
        type: analysis.type,
        confidence: analysis.confidence,
        created: analysis.confidence >= 0.7 ? analysis.type : null,
      });
    }

    // Update last sync
    await prisma.userIntegration.update({
      where: { id: integration.id },
      data: { lastSyncAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
    });
  } catch (error) {
    console.error('Process emails error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'POST to this endpoint to process emails',
    usage: 'POST /api/process-emails',
  });
}
