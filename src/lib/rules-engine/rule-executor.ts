// LifeFlow AI Rules Engine - Rule Executor
// Evalueert rules en voert acties uit

import type { 
  EmailData, 
  EmailClassification, 
  RuleTrigger, 
  RuleAction,
  RuleExecutionResult,
  ActionType,
  TriggerCondition,
} from '../types/rules';
import { extractEmailData } from './email-anonymizer';

// Prisma types (deze komen van je schema)
interface AIRule {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  trigger: unknown; // JSON
  action: unknown;  // JSON
  isActive: boolean;
}

interface PrismaClient {
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
  aIRule: {
    update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>;
  };
}

/**
 * Evalueert of een rule moet triggeren voor een email classificatie
 */
export function shouldTrigger(
  rule: AIRule,
  classification: EmailClassification,
  email: EmailData
): boolean {
  const trigger = rule.trigger as RuleTrigger;
  
  if (!trigger || !rule.isActive) {
    return false;
  }

  // Check category match
  if (trigger.category && trigger.category !== classification.category) {
    return false;
  }

  // Check additional conditions
  if (trigger.conditions && trigger.conditions.length > 0) {
    for (const condition of trigger.conditions) {
      if (!evaluateCondition(condition, email)) {
        return false;
      }
    }
  }

  // Check minimum confidence
  const minConfidence = 0.6;
  if (classification.confidence < minConfidence) {
    return false;
  }

  return true;
}

/**
 * Evalueert een enkele trigger conditie
 */
function evaluateCondition(condition: TriggerCondition, email: EmailData): boolean {
  let fieldValue: string;
  
  switch (condition.field) {
    case 'from':
      fieldValue = email.from;
      break;
    case 'to':
      fieldValue = email.to.join(', ');
      break;
    case 'subject':
      fieldValue = email.subject;
      break;
    case 'body':
      fieldValue = email.body;
      break;
    default:
      return false;
  }

  const compareValue = condition.caseSensitive 
    ? fieldValue 
    : fieldValue.toLowerCase();
  const targetValue = condition.caseSensitive 
    ? condition.value 
    : condition.value.toLowerCase();

  switch (condition.operator) {
    case 'contains':
      return compareValue.includes(targetValue);
    case 'not_contains':
      return !compareValue.includes(targetValue);
    case 'equals':
      return compareValue === targetValue;
    case 'starts_with':
      return compareValue.startsWith(targetValue);
    case 'ends_with':
      return compareValue.endsWith(targetValue);
    case 'regex':
      try {
        const regex = new RegExp(condition.value, condition.caseSensitive ? '' : 'i');
        return regex.test(fieldValue);
      } catch {
        return false;
      }
    default:
      return false;
  }
}

/**
 * Voert de actie van een rule uit
 */
export async function executeAction(
  rule: AIRule,
  classification: EmailClassification,
  email: EmailData,
  prisma: PrismaClient
): Promise<RuleExecutionResult> {
  const action = rule.action as RuleAction;
  const extractedData = extractEmailData(email);
  const startTime = new Date();

  try {
    let createdRecordId: string | undefined;

    switch (action.type) {
      case 'create_task':
        createdRecordId = await createTask(rule.userId, email, classification, extractedData, prisma);
        break;
        
      case 'create_event':
        createdRecordId = await createEvent(rule.userId, email, classification, extractedData, prisma);
        break;
        
      case 'record_invoice':
        createdRecordId = await recordInvoice(rule.userId, email, classification, extractedData, prisma);
        break;
        
      case 'track_package':
        createdRecordId = await trackPackage(rule.userId, email, classification, extractedData, prisma);
        break;
        
      case 'send_notification':
        await sendNotification(rule.userId, email, classification, action.params);
        break;
        
      case 'webhook':
        await callWebhook(action.params?.url as string, { email, classification });
        break;
        
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }

    return {
      ruleId: rule.id,
      ruleName: rule.name,
      triggered: true,
      actionExecuted: true,
      actionType: action.type,
      createdRecordId,
      timestamp: startTime,
    };
  } catch (error) {
    return {
      ruleId: rule.id,
      ruleName: rule.name,
      triggered: true,
      actionExecuted: false,
      actionType: action.type,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: startTime,
    };
  }
}

/**
 * Maakt een taak aan op basis van email
 */
async function createTask(
  userId: string,
  email: EmailData,
  classification: EmailClassification,
  extractedData: Record<string, unknown>,
  prisma: PrismaClient
): Promise<string> {
  const task = await prisma.task.create({
    data: {
      userId,
      title: `[Email] ${email.subject.substring(0, 100)}`,
      description: `Actie vereist n.a.v. email van ${extractSenderName(email.from)}.\n\nOrigineel onderwerp: ${email.subject}`,
      priority: determinePriority(email, classification),
      status: 'pending',
      dueDate: extractedData.extractedDate ? new Date(extractedData.extractedDate as string) : null,
      sourceEmailId: email.id,
    },
  });
  
  return task.id;
}

/**
 * Maakt een event aan op basis van email
 */
async function createEvent(
  userId: string,
  email: EmailData,
  classification: EmailClassification,
  extractedData: Record<string, unknown>,
  prisma: PrismaClient
): Promise<string> {
  const eventDate = extractedData.extractedDate 
    ? new Date(extractedData.extractedDate as string)
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Default: 1 week

  const event = await prisma.event.create({
    data: {
      userId,
      title: classification.extractedData.eventTitle || email.subject.substring(0, 100),
      description: `Afspraak uit email van ${extractSenderName(email.from)}`,
      startTime: eventDate,
      eventType: 'email',
      location: classification.extractedData.eventLocation || null,
      sourceEmailId: email.id,
    },
  });
  
  return event.id;
}

/**
 * Registreert een factuur op basis van email
 */
async function recordInvoice(
  userId: string,
  email: EmailData,
  classification: EmailClassification,
  extractedData: Record<string, unknown>,
  prisma: PrismaClient
): Promise<string> {
  const invoice = await prisma.invoice.create({
    data: {
      userId,
      description: `Factuur van ${extractSenderName(email.from)}: ${email.subject.substring(0, 100)}`,
      amount: (extractedData.amount as number) || 0,
      type: 'payable',
      status: 'pending',
      dueDate: extractedData.extractedDate ? new Date(extractedData.extractedDate as string) : null,
      sourceEmailId: email.id,
      metadata: {
        currency: extractedData.currency || 'EUR',
        invoiceNumber: classification.extractedData.invoiceNumber,
        senderEmail: email.from,
      },
    },
  });
  
  return invoice.id;
}

/**
 * Registreert een pakket voor tracking
 */
async function trackPackage(
  userId: string,
  email: EmailData,
  classification: EmailClassification,
  extractedData: Record<string, unknown>,
  prisma: PrismaClient
): Promise<string> {
  const pkg = await prisma.package.create({
    data: {
      userId,
      carrier: (extractedData.carrier as string) || classification.extractedData.carrier || 'Onbekend',
      trackingNumber: (extractedData.trackingNumber as string) || null,
      description: `Pakket: ${email.subject.substring(0, 100)}`,
      status: 'pending',
      expectedDelivery: extractedData.extractedDate ? new Date(extractedData.extractedDate as string) : null,
      sourceEmailId: email.id,
    },
  });
  
  return pkg.id;
}

/**
 * Stuurt een notificatie (placeholder - implementeer met je notificatie service)
 */
async function sendNotification(
  userId: string,
  email: EmailData,
  classification: EmailClassification,
  params?: Record<string, unknown>
): Promise<void> {
  // TODO: Implementeer met je notificatie service (push, email, SMS)
  console.log(`[Notification] User ${userId}: New ${classification.category} email - ${email.subject}`);
}

/**
 * Roept een externe webhook aan
 */
async function callWebhook(
  url: string,
  payload: Record<string, unknown>
): Promise<void> {
  if (!url) throw new Error('Webhook URL not configured');
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  
  if (!response.ok) {
    throw new Error(`Webhook failed: ${response.status}`);
  }
}

/**
 * Helper: Extract sender naam uit email adres
 */
function extractSenderName(from: string): string {
  // "Johan Palsterman <johan@example.com>" -> "Johan Palsterman"
  const match = from.match(/^([^<]+)</);
  if (match) return match[1].trim();
  
  // "johan@example.com" -> "johan"
  const emailMatch = from.match(/^([^@]+)@/);
  return emailMatch ? emailMatch[1] : from;
}

/**
 * Helper: Bepaal prioriteit op basis van email content
 */
function determinePriority(email: EmailData, classification: EmailClassification): string {
  const text = `${email.subject} ${email.body}`.toLowerCase();
  
  // Hoge prioriteit keywords
  if (/dringend|urgent|asap|spoedgeval|belangrijk|important|deadline/.test(text)) {
    return 'high';
  }
  
  // Facturen zijn meestal medium-high
  if (classification.category === 'invoice') {
    return 'medium';
  }
  
  return 'medium';
}

/**
 * Voert alle matching rules uit voor een email
 */
export async function executeMatchingRules(
  rules: AIRule[],
  classification: EmailClassification,
  email: EmailData,
  prisma: PrismaClient
): Promise<RuleExecutionResult[]> {
  const results: RuleExecutionResult[] = [];
  
  for (const rule of rules) {
    if (shouldTrigger(rule, classification, email)) {
      const result = await executeAction(rule, classification, email, prisma);
      results.push(result);
    } else {
      results.push({
        ruleId: rule.id,
        ruleName: rule.name,
        triggered: false,
        actionExecuted: false,
        timestamp: new Date(),
      });
    }
  }
  
  return results;
}
