// LifeFlow AI Rules Engine - Email Processor
// Orchestreert het volledige email processing flow

import type { 
  EmailData, 
  EmailProcessingResult, 
  ProcessingBatchResult,
  EmailClassification,
} from '../../types/rules';
import { anonymizeEmail } from './email-anonymizer';
import { classifyEmailWithTrustAI } from './trustai-client';
import { executeMatchingRules } from './rule-executor';
import { fetchGmailEmails, refreshAccessToken } from './gmail-client';

// Types voor Prisma (vereenvoudigd)
interface UserIntegration {
  id: string;
  userId: string;
  provider: string;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
  isActive: boolean;
}

interface AIRule {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  trigger: unknown;
  action: unknown;
  isActive: boolean;
}

interface PrismaClient {
  userIntegration: {
    findFirst: (args: { where: Record<string, unknown> }) => Promise<UserIntegration | null>;
    update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>;
  };
  aIRule: {
    findMany: (args: { where: Record<string, unknown> }) => Promise<AIRule[]>;
  };
  processedEmail: {
    findUnique: (args: { where: { externalId: string } }) => Promise<unknown>;
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
  };
  task: {
    create: (args: { data: Record<string, unknown> }) => Promise<{ id: string }>;
  };
  event: {
    create: (args: { data: Record<string, unknown> }) => Promise<{ id: string }>;
  };
  invoice: {
    create: (args: { data: Record<string, unknown> }) => Promise<{ id: string }>;
  };
  package: {
    create: (args: { data: Record<string, unknown> }) => Promise<{ id: string }>;
  };
}

/**
 * Hoofdfunctie: Verwerkt nieuwe emails voor een gebruiker
 */
export async function processNewEmails(
  prisma: PrismaClient,
  userId?: string,
  options: {
    maxEmails?: number;
    sinceHours?: number;
  } = {}
): Promise<ProcessingBatchResult> {
  const startTime = new Date();
  const results: EmailProcessingResult[] = [];
  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  try {
    // 1. Haal actieve Google integratie op
    const integration = await prisma.userIntegration.findFirst({
      where: {
        ...(userId && { userId }),
        provider: 'google',
        isActive: true,
      },
    });

    if (!integration || !integration.accessToken) {
      return {
        processedCount: 0,
        successCount: 0,
        errorCount: 0,
        skippedCount: 0,
        results: [],
        startTime,
        endTime: new Date(),
      };
    }

    // 2. Refresh token indien nodig
    let accessToken = integration.accessToken;
    if (integration.tokenExpiresAt && integration.tokenExpiresAt < new Date()) {
      if (integration.refreshToken) {
        const clientId = process.env.GOOGLE_CLIENT_ID!;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
        
        const newTokens = await refreshAccessToken(
          integration.refreshToken,
          clientId,
          clientSecret
        );
        
        accessToken = newTokens.accessToken;
        
        await prisma.userIntegration.update({
          where: { id: integration.id },
          data: {
            accessToken: newTokens.accessToken,
            tokenExpiresAt: newTokens.expiresAt,
          },
        });
      }
    }

    // 3. Haal emails op
    const sinceDate = new Date();
    sinceDate.setHours(sinceDate.getHours() - (options.sinceHours || 24));
    
    const emails = await fetchGmailEmails(accessToken, {
      maxResults: options.maxEmails || 20,
      after: sinceDate,
      labelIds: ['INBOX'],
    });

    // 4. Haal actieve rules op
    const rules = await prisma.aIRule.findMany({
      where: {
        userId: integration.userId,
        isActive: true,
      },
    });

    // 5. Verwerk elke email
    for (const email of emails) {
      try {
        // Check of al verwerkt
        const existing = await prisma.processedEmail.findUnique({
          where: { externalId: email.id },
        });

        if (existing) {
          skippedCount++;
          continue;
        }

        // Verwerk email
        const result = await processEmail(
          email,
          rules,
          integration.userId,
          prisma
        );

        results.push(result);

        if (result.error) {
          errorCount++;
        } else {
          successCount++;
        }
      } catch (error) {
        errorCount++;
        results.push({
          emailId: email.id,
          classification: {
            category: 'unknown',
            confidence: 0,
            extractedData: {},
          },
          rulesExecuted: [],
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      processedCount: emails.length,
      successCount,
      errorCount,
      skippedCount,
      results,
      startTime,
      endTime: new Date(),
    };
  } catch (error) {
    return {
      processedCount: 0,
      successCount: 0,
      errorCount: 1,
      skippedCount: 0,
      results: [{
        emailId: 'batch',
        classification: { category: 'unknown', confidence: 0, extractedData: {} },
        rulesExecuted: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      }],
      startTime,
      endTime: new Date(),
    };
  }
}

/**
 * Verwerkt een enkele email
 */
async function processEmail(
  email: EmailData,
  rules: AIRule[],
  userId: string,
  prisma: PrismaClient
): Promise<EmailProcessingResult> {
  // 1. Anonimiseer email voor AI
  const anonymized = anonymizeEmail(email);

  // 2. Classificeer via TrustAI (of lokale fallback)
  const classification = await classifyEmailWithTrustAI(anonymized);

  // 3. Voer matching rules uit
  const rulesExecuted = await executeMatchingRules(
    rules,
    classification,
    email,
    prisma as any
  );

  // 4. Sla verwerkte email op
  await prisma.processedEmail.create({
    data: {
      externalId: email.id,
      userId,
      provider: 'google',
      category: classification.category,
      confidence: classification.confidence,
      rawData: {
        from: email.from,
        subject: email.subject,
        date: email.date.toISOString(),
        labels: email.labels,
      },
      processedData: {
        classification,
        rulesExecuted: rulesExecuted.map(r => ({
          ruleId: r.ruleId,
          ruleName: r.ruleName,
          triggered: r.triggered,
          actionExecuted: r.actionExecuted,
          createdRecordId: r.createdRecordId,
        })),
      },
    },
  });

  return {
    emailId: email.id,
    classification,
    rulesExecuted,
  };
}

/**
 * Test email processing met een mock email
 */
export async function testEmailProcessing(
  prisma: PrismaClient,
  userId: string,
  testEmail: Partial<EmailData>
): Promise<EmailProcessingResult> {
  const email: EmailData = {
    id: `test-${Date.now()}`,
    threadId: `test-thread-${Date.now()}`,
    from: testEmail.from || 'test@example.com',
    to: testEmail.to || ['user@example.com'],
    subject: testEmail.subject || 'Test Email',
    body: testEmail.body || 'This is a test email body',
    date: testEmail.date || new Date(),
    labels: testEmail.labels || ['INBOX'],
    attachments: testEmail.attachments || [],
  };

  const rules = await prisma.aIRule.findMany({
    where: { userId, isActive: true },
  });

  // Anonimiseer en classificeer
  const anonymized = anonymizeEmail(email);
  const classification = await classifyEmailWithTrustAI(anonymized);

  // Check welke rules zouden triggeren (zonder uit te voeren)
  const { shouldTrigger } = await import('./rule-executor');
  const mockResults = rules.map(rule => ({
    ruleId: rule.id,
    ruleName: rule.name,
    triggered: shouldTrigger(rule, classification, email),
    actionExecuted: false,
    timestamp: new Date(),
  }));

  return {
    emailId: email.id,
    classification,
    rulesExecuted: mockResults,
  };
}

/**
 * Geeft statistieken over verwerkte emails
 */
export async function getProcessingStats(
  prisma: any,
  userId: string,
  days: number = 7
): Promise<{
  totalProcessed: number;
  byCategory: Record<string, number>;
  byDay: Array<{ date: string; count: number }>;
  rulesTriggered: number;
}> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const processed = await prisma.processedEmail.findMany({
    where: {
      userId,
      createdAt: { gte: since },
    },
    select: {
      category: true,
      createdAt: true,
      processedData: true,
    },
  });

  const byCategory: Record<string, number> = {};
  const byDayMap: Record<string, number> = {};
  let rulesTriggered = 0;

  for (const email of processed) {
    // Count by category
    byCategory[email.category] = (byCategory[email.category] || 0) + 1;

    // Count by day
    const day = email.createdAt.toISOString().split('T')[0];
    byDayMap[day] = (byDayMap[day] || 0) + 1;

    // Count rules triggered
    const data = email.processedData as any;
    if (data?.rulesExecuted) {
      rulesTriggered += data.rulesExecuted.filter((r: any) => r.triggered).length;
    }
  }

  const byDay = Object.entries(byDayMap)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    totalProcessed: processed.length,
    byCategory,
    byDay,
    rulesTriggered,
  };
}

