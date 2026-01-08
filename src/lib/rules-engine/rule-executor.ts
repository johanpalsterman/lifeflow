// src/lib/rules-engine/rule-executor.ts - VERVANG VOLLEDIG
// Executes matched rules and creates records

import { 
  AIRule, 
  RuleExecutionResult, 
  EmailClassification,
  RawEmail,
  ExtractedEmailData,
  TriggerCondition,
  Action,
  OrderStatus
} from '../../types/rules';
import { extractEmailData } from './email-anonymizer';
import prisma from '../prisma';

// ===========================================
// TRIGGER EVALUATION
// ===========================================

/**
 * Check if a condition matches
 */
function evaluateCondition(condition: TriggerCondition, email: RawEmail, classification: EmailClassification): boolean {
  let fieldValue = '';
  
  switch (condition.field) {
    case 'from':
      fieldValue = email.from.toLowerCase();
      break;
    case 'to':
      fieldValue = email.to.toLowerCase();
      break;
    case 'subject':
      fieldValue = email.subject.toLowerCase();
      break;
    case 'body':
      fieldValue = email.body.toLowerCase();
      break;
    case 'category':
      fieldValue = classification.category;
      break;
    case 'domain':
      const match = email.from.match(/@([a-zA-Z0-9.-]+)/);
      fieldValue = match ? match[1].toLowerCase() : '';
      break;
  }
  
  const compareValue = condition.value.toLowerCase();
  
  switch (condition.operator) {
    case 'contains':
      return fieldValue.includes(compareValue);
    case 'equals':
      return fieldValue === compareValue;
    case 'starts_with':
      return fieldValue.startsWith(compareValue);
    case 'ends_with':
      return fieldValue.endsWith(compareValue);
    case 'regex':
      try {
        const regex = new RegExp(condition.value, 'i');
        return regex.test(fieldValue);
      } catch {
        return false;
      }
    case 'not_contains':
      return !fieldValue.includes(compareValue);
    default:
      return false;
  }
}

/**
 * Check if a rule should trigger for this email
 */
export function shouldTrigger(
  rule: AIRule, 
  email: RawEmail, 
  classification: EmailClassification
): boolean {
  const trigger = rule.trigger;
  
  // Only handle email triggers
  if (trigger.type !== 'email') {
    return false;
  }
  
  // Check category match (most common)
  if (trigger.category && trigger.category !== classification.category) {
    return false;
  }
  
  // Check additional conditions
  if (trigger.conditions && trigger.conditions.length > 0) {
    for (const condition of trigger.conditions) {
      if (!evaluateCondition(condition, email, classification)) {
        return false;
      }
    }
  }
  
  return true;
}

// ===========================================
// ACTION EXECUTION
// ===========================================

/**
 * Execute a rule action
 */
export async function executeAction(
  action: Action,
  email: RawEmail,
  classification: EmailClassification,
  userId: string
): Promise<{ success: boolean; result?: any; error?: string }> {
  
  // Extract data from email (local only, contains PII)
  const extractedData = extractEmailData(email);
  
  try {
    switch (action.type) {
      case 'create_task':
        return await createTask(email, extractedData, userId, action.params);
        
      case 'create_event':
        return await createEvent(email, extractedData, userId, action.params);
        
      case 'record_invoice':
        return await recordInvoice(email, extractedData, userId, action.params);
        
      case 'track_package':
        return await trackPackage(email, extractedData, userId, action.params);
        
      case 'track_order':
        return await trackOrder(email, extractedData, userId, action.params);
        
      case 'send_notification':
        return await sendNotification(email, extractedData, userId, action.params);
        
      case 'webhook':
        return await callWebhook(email, extractedData, action.params);
        
      default:
        return { success: false, error: `Unknown action type: ${(action as any).type}` };
    }
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// ===========================================
// ACTION IMPLEMENTATIONS
// ===========================================

async function createTask(
  email: RawEmail,
  data: ExtractedEmailData,
  userId: string,
  params?: any
): Promise<{ success: boolean; result?: any; error?: string }> {
  try {
    const task = await prisma.task.create({
      data: {
        userId,
        title: data.taskDescription || email.subject.substring(0, 100),
        description: `Van: ${email.from}\n\nOrigineel onderwerp: ${email.subject}`,
        priority: params?.priority || detectPriority(email),
        status: 'TODO',
        dueDate: params?.dueInDays 
          ? new Date(Date.now() + params.dueInDays * 24 * 60 * 60 * 1000)
          : undefined,
        sourceEmailId: email.id
      }
    });
    
    return { success: true, result: { taskId: task.id, title: task.title } };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function createEvent(
  email: RawEmail,
  data: ExtractedEmailData,
  userId: string,
  params?: any
): Promise<{ success: boolean; result?: any; error?: string }> {
  try {
    const event = await prisma.event.create({
      data: {
        userId,
        title: data.eventTitle || email.subject.substring(0, 100),
        description: `Van: ${email.from}`,
        startDate: data.eventDate ? new Date(data.eventDate) : new Date(),
        location: data.eventLocation,
        sourceEmailId: email.id
      }
    });
    
    return { success: true, result: { eventId: event.id, title: event.title } };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function recordInvoice(
  email: RawEmail,
  data: ExtractedEmailData,
  userId: string,
  params?: any
): Promise<{ success: boolean; result?: any; error?: string }> {
  try {
    const invoice = await prisma.invoice.create({
      data: {
        userId,
        invoiceNumber: data.invoiceNumber || `AUTO-${Date.now()}`,
        vendor: data.vendor || extractVendor(email.from),
        amount: data.amount || 0,
        currency: data.currency || 'EUR',
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        status: params?.autoApprove ? 'APPROVED' : 'PENDING',
        sourceEmailId: email.id
      }
    });
    
    return { success: true, result: { invoiceId: invoice.id, vendor: invoice.vendor } };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function trackPackage(
  email: RawEmail,
  data: ExtractedEmailData,
  userId: string,
  params?: any
): Promise<{ success: boolean; result?: any; error?: string }> {
  try {
    // Check if package already exists
    if (data.trackingNumber) {
      const existing = await prisma.package.findFirst({
        where: { trackingNumber: data.trackingNumber, userId }
      });
      
      if (existing) {
        // Update existing package
        await prisma.package.update({
          where: { id: existing.id },
          data: { 
            status: 'IN_TRANSIT',
            updatedAt: new Date()
          }
        });
        return { success: true, result: { packageId: existing.id, updated: true } };
      }
    }
    
    const pkg = await prisma.package.create({
      data: {
        userId,
        trackingNumber: data.trackingNumber || `UNKNOWN-${Date.now()}`,
        carrier: data.carrier || 'Unknown',
        status: 'IN_TRANSIT',
        description: email.subject.substring(0, 200),
        expectedDelivery: data.expectedDelivery ? new Date(data.expectedDelivery) : undefined,
        sourceEmailId: email.id
      }
    });
    
    return { success: true, result: { packageId: pkg.id, carrier: pkg.carrier } };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * NEW: Track Order action
 */
async function trackOrder(
  email: RawEmail,
  data: ExtractedEmailData,
  userId: string,
  params?: any
): Promise<{ success: boolean; result?: any; error?: string }> {
  try {
    const shopName = data.shopName || extractVendor(email.from);
    const orderNumber = data.orderNumber;
    
    // Check if order already exists (by order number or similar email)
    if (orderNumber) {
      const existing = await prisma.order.findFirst({
        where: { 
          orderNumber, 
          userId,
          shopName
        }
      });
      
      if (existing) {
        // Update existing order status
        const newStatus = mapOrderStatus(data.orderStatus);
        const updateData: any = { 
          status: newStatus,
          updatedAt: new Date()
        };
        
        // Update additional fields based on status
        if (newStatus === 'SHIPPED' && data.trackingNumber) {
          updateData.shippedDate = new Date();
          updateData.trackingNumber = data.trackingNumber;
          
          // Create linked package if tracking number found
          if (params?.autoLinkToPackage !== false) {
            const pkg = await prisma.package.create({
              data: {
                userId,
                trackingNumber: data.trackingNumber,
                carrier: data.carrier || 'Unknown',
                status: 'IN_TRANSIT',
                description: `Order ${orderNumber} van ${shopName}`,
                sourceEmailId: email.id
              }
            });
            updateData.packageId = pkg.id;
          }
        }
        
        if (newStatus === 'DELIVERED') {
          updateData.deliveredDate = new Date();
        }
        
        if (data.isPaid) {
          updateData.isPaid = true;
        }
        
        await prisma.order.update({
          where: { id: existing.id },
          data: updateData
        });
        
        return { 
          success: true, 
          result: { 
            orderId: existing.id, 
            updated: true, 
            newStatus,
            shopName 
          } 
        };
      }
    }
    
    // Create new order
    const order = await prisma.order.create({
      data: {
        userId,
        shopName,
        orderNumber: orderNumber || undefined,
        productName: data.productName || email.subject.substring(0, 100),
        status: mapOrderStatus(data.orderStatus) as any,
        amount: data.orderAmount || data.amount,
        currency: data.currency || 'EUR',
        isPaid: data.isPaid || false,
        orderDate: new Date(email.date),
        trackingNumber: data.trackingNumber,
        sourceEmailId: email.id
      }
    });
    
    return { 
      success: true, 
      result: { 
        orderId: order.id, 
        shopName: order.shopName,
        orderNumber: order.orderNumber,
        status: order.status
      } 
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function sendNotification(
  email: RawEmail,
  data: ExtractedEmailData,
  userId: string,
  params: any
): Promise<{ success: boolean; result?: any; error?: string }> {
  // TODO: Implement actual notification sending
  console.log(`Would send ${params.channel} notification to user ${userId}`);
  return { success: true, result: { channel: params.channel, scheduled: true } };
}

async function callWebhook(
  email: RawEmail,
  data: ExtractedEmailData,
  params: any
): Promise<{ success: boolean; result?: any; error?: string }> {
  try {
    const response = await fetch(params.url, {
      method: params.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...params.headers
      },
      body: JSON.stringify({
        email: {
          id: email.id,
          subject: email.subject,
          from: email.from,
          date: email.date
        },
        extractedData: data
      })
    });
    
    return { 
      success: response.ok, 
      result: { statusCode: response.status } 
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// ===========================================
// HELPER FUNCTIONS
// ===========================================

function detectPriority(email: RawEmail): string {
  const text = `${email.subject} ${email.body}`.toLowerCase();
  
  if (text.includes('urgent') || text.includes('dringend') || text.includes('asap')) {
    return 'HIGH';
  }
  if (text.includes('belangrijk') || text.includes('important')) {
    return 'MEDIUM';
  }
  return 'LOW';
}

function extractVendor(from: string): string {
  const match = from.match(/@([a-zA-Z0-9.-]+)/);
  if (match) {
    const domain = match[1].split('.')[0];
    return domain.charAt(0).toUpperCase() + domain.slice(1);
  }
  return 'Unknown';
}

function mapOrderStatus(status?: string): OrderStatus {
  if (!status) return 'ORDERED';
  
  const statusMap: Record<string, OrderStatus> = {
    'ORDERED': 'ORDERED',
    'AWAITING_PAYMENT': 'AWAITING_PAYMENT',
    'PAID': 'PAID',
    'PROCESSING': 'PROCESSING',
    'SHIPPED': 'SHIPPED',
    'DELIVERED': 'DELIVERED',
    'CANCELLED': 'CANCELLED',
    'RETURNED': 'RETURNED'
  };
  
  return statusMap[status] || 'ORDERED';
}

// ===========================================
// EXECUTE MATCHING RULES
// ===========================================

/**
 * Execute all matching rules for an email
 */
export async function executeMatchingRules(
  rules: AIRule[],
  email: RawEmail,
  classification: EmailClassification,
  userId: string
): Promise<RuleExecutionResult[]> {
  const results: RuleExecutionResult[] = [];
  
  for (const rule of rules) {
    if (!rule.isActive) continue;
    
    const triggered = shouldTrigger(rule, email, classification);
    
    if (triggered) {
      const actionResult = await executeAction(
        rule.action,
        email,
        classification,
        userId
      );
      
      results.push({
        ruleId: rule.id,
        ruleName: rule.name,
        triggered: true,
        actionExecuted: actionResult.success,
        result: actionResult.result,
        error: actionResult.error,
        timestamp: new Date()
      });
      
      // Update rule execution count
      try {
        await prisma.aIRule.update({
          where: { id: rule.id },
          data: { updatedAt: new Date() }
        });
      } catch (e) {
        // Ignore update errors
      }
    } else {
      results.push({
        ruleId: rule.id,
        ruleName: rule.name,
        triggered: false,
        actionExecuted: false,
        timestamp: new Date()
      });
    }
  }
  
  return results;
}
