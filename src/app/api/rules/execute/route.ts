import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// POST /api/rules/execute - Execute matching rules for a trigger
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { triggerType, triggerData, userId } = body;

    if (!triggerType || !userId) {
      return NextResponse.json(
        { success: false, error: 'triggerType and userId are required' },
        { status: 400 }
      );
    }

    // Find matching rules
    const rules = await prisma.aIRule.findMany({
      where: {
        userId,
        isEnabled: true,
        triggerCondition: {
          path: ['type'],
          equals: triggerType
        }
      },
      orderBy: { priority: 'asc' }
    });

    const results = [];

    for (const rule of rules) {
      const trigger = rule.triggerCondition as any;
      const action = rule.actionDefinition as any;
      
      // Check if trigger conditions match
      if (evaluateTrigger(trigger, triggerData)) {
        // Execute the action
        const result = await executeAction(action, triggerData, userId);
        
        // Log execution
        await prisma.ruleExecution.create({
          data: {
            ruleId: rule.id,
            triggerData: triggerData,
            actionResult: result,
            status: result.success ? 'success' : 'failed',
            errorMessage: result.error || null,
            executionTimeMs: result.executionTimeMs
          }
        });

        // Update rule stats
        await prisma.aIRule.update({
          where: { id: rule.id },
          data: {
            executionsCount: { increment: 1 },
            lastExecutedAt: new Date()
          }
        });

        results.push({
          ruleId: rule.id,
          ruleName: rule.name,
          ...result
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        rulesEvaluated: rules.length,
        rulesExecuted: results.length,
        results
      }
    });
  } catch (error) {
    console.error('POST /api/rules/execute error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to execute rules' },
      { status: 500 }
    );
  }
}

// Evaluate if trigger conditions match
function evaluateTrigger(trigger: any, data: any): boolean {
  if (!trigger.conditions) return true;

  for (const condition of trigger.conditions) {
    const value = getNestedValue(data, condition.field);
    
    switch (condition.operator) {
      case 'equals':
        if (value !== condition.value) return false;
        break;
      case 'contains':
        if (!String(value).toLowerCase().includes(String(condition.value).toLowerCase())) return false;
        break;
      case 'greaterThan':
        if (!(value > condition.value)) return false;
        break;
      case 'lessThan':
        if (!(value < condition.value)) return false;
        break;
      case 'exists':
        if (value === undefined || value === null) return false;
        break;
      case 'matches':
        if (!new RegExp(condition.value).test(String(value))) return false;
        break;
    }
  }
  
  return true;
}

// Get nested value from object
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((o, k) => o?.[k], obj);
}

// Execute an action
async function executeAction(action: any, triggerData: any, userId: string): Promise<any> {
  const startTime = Date.now();
  
  try {
    switch (action.type) {
      case 'create_task':
        return await createTaskAction(action, triggerData, userId, startTime);
      
      case 'create_event':
        return await createEventAction(action, triggerData, userId, startTime);
      
      case 'send_notification':
        return await sendNotificationAction(action, triggerData, userId, startTime);
      
      case 'update_field':
        return await updateFieldAction(action, triggerData, userId, startTime);
      
      case 'webhook':
        return await webhookAction(action, triggerData, startTime);
      
      default:
        return {
          success: false,
          error: `Unknown action type: ${action.type}`,
          executionTimeMs: Date.now() - startTime
        };
    }
  } catch (error) {
    return {
      success: false,
      error: String(error),
      executionTimeMs: Date.now() - startTime
    };
  }
}

// Action: Create a task
async function createTaskAction(action: any, triggerData: any, userId: string, startTime: number) {
  const title = interpolateTemplate(action.title || 'New Task', triggerData);
  const description = action.description ? interpolateTemplate(action.description, triggerData) : null;
  
  const task = await prisma.task.create({
    data: {
      userId,
      title,
      description,
      priority: action.priority || 'medium',
      status: 'pending',
      dueDate: action.dueDays ? new Date(Date.now() + action.dueDays * 24 * 60 * 60 * 1000) : null,
      tags: action.tags || [],
      reminderMinutes: action.reminderMinutes || []
    }
  });

  return {
    success: true,
    action: 'create_task',
    result: { taskId: task.id, title: task.title },
    executionTimeMs: Date.now() - startTime
  };
}

// Action: Create an event
async function createEventAction(action: any, triggerData: any, userId: string, startTime: number) {
  const title = interpolateTemplate(action.title || 'New Event', triggerData);
  const startTime_ = action.startTime ? new Date(action.startTime) : new Date();
  
  const event = await prisma.event.create({
    data: {
      userId,
      title,
      startTime: startTime_,
      endTime: action.durationMinutes 
        ? new Date(startTime_.getTime() + action.durationMinutes * 60 * 1000)
        : null,
      eventType: action.eventType || 'default',
      location: action.location || null,
      reminderMinutes: action.reminderMinutes || [15]
    }
  });

  return {
    success: true,
    action: 'create_event',
    result: { eventId: event.id, title: event.title },
    executionTimeMs: Date.now() - startTime
  };
}

// Action: Send notification
async function sendNotificationAction(action: any, triggerData: any, userId: string, startTime: number) {
  const title = interpolateTemplate(action.title || 'Notification', triggerData);
  const message = action.message ? interpolateTemplate(action.message, triggerData) : null;
  
  const notification = await prisma.notification.create({
    data: {
      userId,
      type: action.notificationType || 'info',
      title,
      message,
      actionUrl: action.actionUrl || null,
      actionLabel: action.actionLabel || null
    }
  });

  return {
    success: true,
    action: 'send_notification',
    result: { notificationId: notification.id },
    executionTimeMs: Date.now() - startTime
  };
}

// Action: Update a field
async function updateFieldAction(action: any, triggerData: any, userId: string, startTime: number) {
  const { entity, entityId, field, value } = action;
  
  // Validate entity type
  const allowedEntities = ['task', 'event', 'contact'];
  if (!allowedEntities.includes(entity)) {
    return {
      success: false,
      error: `Invalid entity: ${entity}`,
      executionTimeMs: Date.now() - startTime
    };
  }

  // Dynamic update based on entity type
  const prismaModel = (prisma as any)[entity];
  const updated = await prismaModel.update({
    where: { id: entityId },
    data: { [field]: value }
  });

  return {
    success: true,
    action: 'update_field',
    result: { entity, entityId, field, newValue: value },
    executionTimeMs: Date.now() - startTime
  };
}

// Action: Call webhook
async function webhookAction(action: any, triggerData: any, startTime: number) {
  const response = await fetch(action.url, {
    method: action.method || 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(action.headers || {})
    },
    body: JSON.stringify({
      ...triggerData,
      ...(action.body || {})
    })
  });

  return {
    success: response.ok,
    action: 'webhook',
    result: { 
      status: response.status,
      statusText: response.statusText
    },
    executionTimeMs: Date.now() - startTime
  };
}

// Interpolate template strings with data
function interpolateTemplate(template: string, data: any): string {
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
    const value = getNestedValue(data, path);
    return value !== undefined ? String(value) : match;
  });
}
