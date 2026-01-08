// src/app/api/rules/route.ts - VERVANG VOLLEDIG
// API endpoints for AI Rules management

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { 
  anonymizeEmail, 
  extractEmailData 
} from '@/lib/rules-engine';
import { 
  classifyEmailLocally,
  classifyEmailWithTrustAI 
} from '@/lib/rules-engine';
import { 
  shouldTrigger 
} from '@/lib/rules-engine';
import { RawEmail } from '@/types/rules';

// ===========================================
// GET - List all rules
// ===========================================

export async function GET(request: NextRequest) {
  try {
    // Get user from session (simplified - you may have auth middleware)
    const userId = request.headers.get('x-user-id') || await getDefaultUserId();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const rules = await prisma.aIRule.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    
    // Add execution stats
    const rulesWithStats = rules.map(rule => ({
      ...rule,
      trigger: rule.trigger as any,
      action: rule.action as any,
      stats: {
        executionCount: 0 // TODO: Track this in separate table
      }
    }));
    
    return NextResponse.json({ 
      success: true, 
      data: rulesWithStats,
      meta: {
        total: rules.length,
        active: rules.filter(r => r.isActive).length
      }
    });
    
  } catch (error) {
    console.error('GET /api/rules error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// ===========================================
// POST - Create, update, or action on rules
// ===========================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;
    
    const userId = request.headers.get('x-user-id') || await getDefaultUserId();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    switch (action) {
      case 'create':
        return await createRule(body, userId);
        
      case 'update':
        return await updateRule(body, userId);
        
      case 'toggle':
        return await toggleRule(body.ruleId, userId);
        
      case 'delete':
        return await deleteRule(body.ruleId, userId);
        
      case 'test':
        return await testClassification(body, userId);
        
      case 'seed_defaults':
        return await seedDefaultRules(userId);
        
      case 'stats':
        return await getStats(userId);
        
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
    
  } catch (error) {
    console.error('POST /api/rules error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// ===========================================
// HELPER FUNCTIONS
// ===========================================

async function getDefaultUserId(): Promise<string | null> {
  // Get first user or create default
  const user = await prisma.user.findFirst();
  if (user) return user.id;
  
  // Create default user if none exists
  const newUser = await prisma.user.create({
    data: {
      email: 'default@lifeflow.local',
      name: 'Default User'
    }
  });
  
  return newUser.id;
}

async function createRule(body: any, userId: string) {
  const { name, description, trigger, action: ruleAction } = body;
  
  const rule = await prisma.aIRule.create({
    data: {
      userId,
      name,
      description,
      trigger,
      action: ruleAction,
      isActive: true
    }
  });
  
  return NextResponse.json({ success: true, data: rule });
}

async function updateRule(body: any, userId: string) {
  const { ruleId, name, description, trigger, action: ruleAction, isActive } = body;
  
  const rule = await prisma.aIRule.update({
    where: { id: ruleId, userId },
    data: {
      name,
      description,
      trigger,
      action: ruleAction,
      isActive
    }
  });
  
  return NextResponse.json({ success: true, data: rule });
}

async function toggleRule(ruleId: string, userId: string) {
  const rule = await prisma.aIRule.findFirst({
    where: { id: ruleId, userId }
  });
  
  if (!rule) {
    return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
  }
  
  const updated = await prisma.aIRule.update({
    where: { id: ruleId },
    data: { isActive: !rule.isActive }
  });
  
  return NextResponse.json({ success: true, data: updated });
}

async function deleteRule(ruleId: string, userId: string) {
  await prisma.aIRule.delete({
    where: { id: ruleId, userId }
  });
  
  return NextResponse.json({ success: true });
}

async function testClassification(body: any, userId: string) {
  const { testEmail } = body;
  
  // Create a mock RawEmail
  const rawEmail: RawEmail = {
    id: 'test-' + Date.now(),
    from: testEmail.from || 'test@example.com',
    to: testEmail.to || 'user@example.com',
    subject: testEmail.subject || 'Test Email',
    body: testEmail.body || '',
    date: new Date()
  };
  
  // Anonymize and classify
  const anonymized = anonymizeEmail(rawEmail);
  const classification = await classifyEmailWithTrustAI(anonymized);
  
  // Get user's rules
  const rules = await prisma.aIRule.findMany({
    where: { userId, isActive: true }
  });
  
  // Check which rules would trigger
  const matchingRules = rules.filter(rule => 
    shouldTrigger(rule as any, rawEmail, classification)
  );
  
  return NextResponse.json({
    success: true,
    data: {
      classification,
      matchingRules: matchingRules.map(r => ({
        ruleId: r.id,
        ruleName: r.name,
        triggered: true,
        actionExecuted: false, // Test mode - don't execute
        timestamp: new Date()
      })),
      allRules: rules.map(r => ({
        ruleId: r.id,
        ruleName: r.name,
        triggered: matchingRules.some(m => m.id === r.id),
        actionExecuted: false,
        timestamp: new Date()
      }))
    }
  });
}

async function seedDefaultRules(userId: string) {
  // Check if user already has rules
  const existingRules = await prisma.aIRule.count({
    where: { userId }
  });
  
  if (existingRules > 0) {
    return NextResponse.json({ 
      success: true, 
      message: 'Rules already exist',
      data: [] 
    });
  }
  
  // Create default rules including ORDER rule
  const defaultRules = [
    {
      userId,
      name: 'Facturen herkennen',
      description: 'Maak automatisch een factuur aan',
      trigger: { type: 'email', category: 'invoice' },
      action: { type: 'record_invoice' },
      isActive: true
    },
    {
      userId,
      name: 'Pakket tracking',
      description: 'Volg pakketten automatisch',
      trigger: { type: 'email', category: 'delivery' },
      action: { type: 'track_package' },
      isActive: true
    },
    {
      userId,
      name: 'Bestellingen volgen',  // NEW!
      description: 'Volg bestellingen automatisch en krijg herinneringen',
      trigger: { type: 'email', category: 'order' },
      action: { 
        type: 'track_order',
        params: {
          autoLinkToPackage: true,
          reminderDays: 7,
          notifyOnShipment: true
        }
      },
      isActive: true
    },
    {
      userId,
      name: 'Afspraken uit email',
      description: 'Maak agenda items aan',
      trigger: { type: 'email', category: 'event' },
      action: { type: 'create_event' },
      isActive: true
    },
    {
      userId,
      name: 'Taken uit verzoeken',
      description: 'Maak taken aan uit emails',
      trigger: { type: 'email', category: 'task' },
      action: { type: 'create_task' },
      isActive: true
    }
  ];
  
  const created = await prisma.aIRule.createMany({
    data: defaultRules
  });
  
  // Fetch created rules
  const rules = await prisma.aIRule.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' }
  });
  
  return NextResponse.json({ success: true, data: rules });
}

async function getStats(userId: string) {
  // Get counts for different record types
  const [tasks, events, invoices, packages, orders, rules] = await Promise.all([
    prisma.task.count({ where: { userId } }),
    prisma.event.count({ where: { userId } }),
    prisma.invoice.count({ where: { userId } }),
    prisma.package.count({ where: { userId } }),
    prisma.order.count({ where: { userId } }),
    prisma.aIRule.count({ where: { userId } })
  ]);
  
  // Get order status breakdown
  const ordersByStatus = await prisma.order.groupBy({
    by: ['status'],
    where: { userId },
    _count: { status: true }
  });
  
  return NextResponse.json({
    success: true,
    data: {
      counts: {
        tasks,
        events,
        invoices,
        packages,
        orders,
        rules
      },
      ordersByStatus: ordersByStatus.reduce((acc, item) => {
        acc[item.status] = item._count.status;
        return acc;
      }, {} as Record<string, number>)
    }
  });
}
