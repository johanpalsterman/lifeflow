// src/lib/rules-engine/email-processor.ts
// Main email processing orchestrator - FIXED VERSION v3
// Compatible with existing ProcessedEmail schema

import prisma from '../prisma';
import {
  RawEmail,
  ProcessingBatchResult,
  EmailClassification
} from '../../types/rules';
import { anonymizeEmail, isOrderEmail, isShipmentEmail } from './email-anonymizer';
import { classifyEmailWithTrustAI, classifyEmailLocally } from './trustai-client';
import { executeMatchingRules } from './rule-executor';
import { fetchGmailEmails, refreshAccessToken } from './gmail-client';

// ===========================================
// MAIN PROCESSING FUNCTION
// ===========================================

export async function processNewEmails(
  userId: string,
  options: {
    maxEmails?: number;
    sinceHours?: number;
    markAsProcessed?: boolean;
    useTrustAI?: boolean;
  } = {}
): Promise<ProcessingBatchResult> {
  const {
    maxEmails = 50,
    sinceHours = 24,
    markAsProcessed = true,
    useTrustAI = false
  } = options;

  console.log('[EmailProcessor] Starting with options:', { maxEmails, sinceHours, markAsProcessed, useTrustAI });

  const result: ProcessingBatchResult = {
    processed: 0,
    success: 0,
    errors: 0,
    skipped: 0,
    results: [],
    createdRecords: {
      tasks: 0,
      events: 0,
      invoices: 0,
      packages: 0,
      orders: 0
    }
  };

  try {
    // Get user's Google integration
    const integration = await prisma.userIntegration.findFirst({
      where: {
        userId,
        provider: 'google',
        isActive: true
      },
      select: {
        id: true,
        accessToken: true,
        refreshToken: true,
        tokenExpiresAt: true
      }
    });

    if (!integration) {
      console.log('[EmailProcessor] No active Google integration for user:', userId);
      return result;
    }

    // Refresh token if needed
    let accessToken = integration.accessToken;
    if (integration.tokenExpiresAt && new Date(integration.tokenExpiresAt) < new Date()) {
      console.log('[EmailProcessor] Refreshing expired token...');
      const refreshed = await refreshAccessToken(integration.refreshToken!);
      if (refreshed) {
        accessToken = refreshed.accessToken;
        await prisma.userIntegration.update({
          where: { id: integration.id },
          data: {
            accessToken: refreshed.accessToken,
            tokenExpiresAt: refreshed.expiresAt
          }
        });
      }
    }

    // Calculate since date
    const sinceDate = new Date();
    sinceDate.setHours(sinceDate.getHours() - sinceHours);

    console.log('[EmailProcessor] Fetching emails since:', sinceDate.toISOString());

    // Fetch emails from Gmail
    const emails = await fetchGmailEmails(accessToken!, {
      maxResults: maxEmails,
      after: sinceDate,
      labelIds: ['INBOX']
    });

    if (!emails || emails.length === 0) {
      console.log('[EmailProcessor] No new emails to process');
      return result;
    }

    console.log('[EmailProcessor] Fetched', emails.length, 'emails');

    // Get user's active rules
    const rules = await prisma.aIRule.findMany({
      where: { userId, isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        trigger: true,
        action: true,
        isActive: true
      }
    });

    console.log('[EmailProcessor] Found', rules.length, 'active rules');

    // Process each email
    for (const email of emails) {
      result.processed++;

      try {
        // Check if already processed (using externalId field)
        const alreadyProcessed = await prisma.processedEmail.findFirst({
          where: { externalId: email.id, userId },
          select: { id: true }
        });

        if (alreadyProcessed) {
          result.skipped++;
          continue;
        }

        // Anonymize and classify
        const anonymized = anonymizeEmail(email);
        let classification: EmailClassification;

        // Use heuristics first for orders vs delivery
        if (isOrderEmail(email) && !isShipmentEmail(email)) {
          classification = {
            category: 'order',
            confidence: 0.9,
            extractedData: {},
            reasoning: 'Detected as order confirmation email'
          };
        } else if (isShipmentEmail(email)) {
          classification = {
            category: 'delivery',
            confidence: 0.9,
            extractedData: {},
            reasoning: 'Detected as shipment notification email'
          };
        } else {
          classification = classifyEmailLocally(anonymized);
        }

        console.log('[EmailProcessor] Email', email.id, 'classified as:', classification.category);

        // Execute matching rules
        const ruleResults = await executeMatchingRules(
          rules as any,
          email,
          classification,
          userId
        );

        // Count created records
        for (const ruleResult of ruleResults) {
          if (ruleResult.actionExecuted && ruleResult.result) {
            const res = ruleResult.result;
            if (res.taskId) result.createdRecords.tasks++;
            if (res.eventId) result.createdRecords.events++;
            if (res.invoiceId) result.createdRecords.invoices++;
            if (res.packageId) result.createdRecords.packages++;
            if (res.orderId) result.createdRecords.orders++;
          }
        }

        // Create safe rule results for storage
        const safeRuleResults = ruleResults.map(r => ({
          ruleId: r.ruleId || '',
          ruleName: r.ruleName || '',
          triggered: Boolean(r.triggered),
          actionExecuted: Boolean(r.actionExecuted),
          result: r.result ? {
            taskId: r.result.taskId || null,
            eventId: r.result.eventId || null,
            invoiceId: r.result.invoiceId || null,
            packageId: r.result.packageId || null,
            orderId: r.result.orderId || null,
            shopName: r.result.shopName || null,
            vendor: r.result.vendor || null
          } : null,
          error: r.error || null
        }));

        // Record as processed (using existing schema fields)
        if (markAsProcessed) {
          await prisma.processedEmail.create({
            data: {
              externalId: email.id,  // Gmail message ID
              userId,
              provider: 'google',
              category: classification.category,
              confidence: classification.confidence,
              rawData: {
                subject: email.subject,
                from: email.from,
                date: email.date
              },
              processedData: {
                reasoning: classification.reasoning || '',
                rulesExecuted: safeRuleResults
              }
            }
          });
        }

        result.results.push({
          id: email.id,
          emailId: email.id,
          classification: {
            category: classification.category,
            confidence: classification.confidence,
            reasoning: classification.reasoning || ''
          },
          rulesExecuted: safeRuleResults,
          processedAt: new Date()
        });

        result.success++;

      } catch (emailError: any) {
        console.error('[EmailProcessor] Error processing email:', email.id, emailError?.message || emailError);
        result.errors++;
      }
    }

    console.log('[EmailProcessor] Completed:', result);

  } catch (error: any) {
    console.error('[EmailProcessor] Fatal error:', error?.message || error);
    throw error;
  }

  return result;
}

// ===========================================
// TEST FUNCTION
// ===========================================

export async function testEmailProcessing(
  userId: string,
  testEmails: RawEmail[]
): Promise<ProcessingBatchResult> {
  const result: ProcessingBatchResult = {
    processed: 0,
    success: 0,
    errors: 0,
    skipped: 0,
    results: [],
    createdRecords: { tasks: 0, events: 0, invoices: 0, packages: 0, orders: 0 }
  };

  const rules = await prisma.aIRule.findMany({
    where: { userId, isActive: true },
    select: {
      id: true,
      name: true,
      trigger: true,
      action: true
    }
  });

  for (const email of testEmails) {
    result.processed++;

    const anonymized = anonymizeEmail(email);
    let classification: EmailClassification;

    if (isOrderEmail(email) && !isShipmentEmail(email)) {
      classification = {
        category: 'order',
        confidence: 0.9,
        extractedData: {},
        reasoning: 'Detected as order confirmation'
      };
    } else if (isShipmentEmail(email)) {
      classification = {
        category: 'delivery',
        confidence: 0.9,
        extractedData: {},
        reasoning: 'Detected as shipment notification'
      };
    } else {
      classification = classifyEmailLocally(anonymized);
    }

    const matchingRules = rules.filter(rule => {
      const trigger = rule.trigger as any;
      return trigger?.category === classification.category;
    });

    result.results.push({
      id: email.id,
      emailId: email.id,
      classification: {
        category: classification.category,
        confidence: classification.confidence,
        reasoning: classification.reasoning || ''
      },
      rulesExecuted: matchingRules.map(r => ({
        ruleId: r.id,
        ruleName: r.name,
        triggered: true,
        actionExecuted: false,
        timestamp: new Date()
      })),
      processedAt: new Date()
    });

    result.success++;
  }

  return result;
}

// ===========================================
// STATS FUNCTION
// ===========================================

export async function getProcessingStats(userId: string) {
  const [totalProcessed, last24h, orderStats] = await Promise.all([
    prisma.processedEmail.count({ where: { userId } }),
    prisma.processedEmail.count({
      where: {
        userId,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }
    }),
    prisma.order.groupBy({
      by: ['status'],
      where: { userId },
      _count: { status: true }
    })
  ]);

  return {
    totalProcessed,
    last24h,
    orderStats: orderStats.reduce((acc, item) => {
      acc[item.status] = item._count.status;
      return acc;
    }, {} as Record<string, number>)
  };
}
