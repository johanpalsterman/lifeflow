import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// POST /api/rules/seed - Create example AI rules
export async function POST(request: NextRequest) {
  try {
    const userId = 'demo-user';

    // Delete existing rules for clean slate
    await prisma.aIRule.deleteMany({ where: { userId, isSystem: false } });

    const rules = await prisma.aIRule.createMany({
      data: [
        {
          userId,
          name: 'Factuur ontvangen → Taak aanmaken',
          description: 'Maakt automatisch een taak aan wanneer een factuur binnenkomt',
          triggerCondition: {
            type: 'email_received',
            conditions: [
              { field: 'subject', operator: 'contains', value: 'factuur' }
            ]
          },
          triggerDescription: 'Email ontvangen met "factuur" in onderwerp',
          actionDefinition: {
            type: 'create_task',
            title: 'Factuur verwerken: {{sender}}',
            priority: 'high',
            dueDays: 14
          },
          actionDescription: 'Maak taak aan met deadline over 14 dagen',
          isEnabled: true,
          priority: 10
        },
        {
          userId,
          name: 'Verjaardag herinnering',
          description: 'Herinnering 7 dagen voor verjaardag van contact',
          triggerCondition: {
            type: 'birthday_upcoming',
            conditions: [
              { field: 'daysUntil', operator: 'equals', value: 7 }
            ]
          },
          triggerDescription: 'Verjaardag over 7 dagen',
          actionDefinition: {
            type: 'create_task',
            title: 'Cadeau kopen voor {{contactName}}',
            priority: 'medium',
            dueDays: 5
          },
          actionDescription: 'Maak herinnering taak aan',
          isEnabled: true,
          priority: 20
        },
        {
          userId,
          name: 'APK verlopen → Urgente taak',
          description: 'Maakt urgente taak aan wanneer APK bijna verloopt',
          triggerCondition: {
            type: 'safety_check_warning',
            conditions: [
              { field: 'checkType', operator: 'equals', value: 'vehicle' },
              { field: 'daysUntil', operator: 'lessThan', value: 30 }
            ]
          },
          triggerDescription: 'APK verloopt binnen 30 dagen',
          actionDefinition: {
            type: 'create_task',
            title: 'APK afspraak maken',
            priority: 'high',
            dueDays: 7
          },
          actionDescription: 'Maak urgente taak aan',
          isEnabled: true,
          priority: 5
        },
        {
          userId,
          name: 'Dagelijkse standup herinnering',
          description: 'Elke werkdag om 08:45 herinnering voor standup',
          triggerCondition: {
            type: 'schedule',
            conditions: [
              { field: 'time', operator: 'equals', value: '08:45' },
              { field: 'weekday', operator: 'in', value: [1, 2, 3, 4, 5] }
            ]
          },
          triggerDescription: 'Elke werkdag om 08:45',
          actionDefinition: {
            type: 'send_notification',
            title: 'Standup begint over 15 minuten',
            notificationType: 'reminder'
          },
          actionDescription: 'Stuur push notificatie',
          isEnabled: true,
          priority: 30
        },
        {
          userId,
          name: 'Backup check mislukt → Alert',
          description: 'Stuur alert wanneer backup check faalt',
          triggerCondition: {
            type: 'safety_check_failed',
            conditions: [
              { field: 'checkType', operator: 'equals', value: 'backup' }
            ]
          },
          triggerDescription: 'Backup check status wordt "failed"',
          actionDefinition: {
            type: 'send_notification',
            title: '⚠️ Backup check mislukt!',
            message: 'Controleer je backup systeem',
            notificationType: 'alert'
          },
          actionDescription: 'Stuur urgente alert',
          isEnabled: true,
          priority: 1
        },
        {
          userId,
          name: 'Pakket bezorgd → Taak afvinken',
          description: 'Automatisch bezorg-taak afvinken wanneer pakket aankomt',
          triggerCondition: {
            type: 'package_delivered',
            conditions: [
              { field: 'status', operator: 'equals', value: 'delivered' }
            ]
          },
          triggerDescription: 'Pakket status wordt "bezorgd"',
          actionDefinition: {
            type: 'update_field',
            entity: 'task',
            field: 'status',
            value: 'completed'
          },
          actionDescription: 'Markeer gerelateerde taak als voltooid',
          isEnabled: false,
          priority: 50
        },
        {
          userId,
          name: 'Hoge prioriteit taak → Slack notificatie',
          description: 'Stuur Slack bericht bij nieuwe high priority taak',
          triggerCondition: {
            type: 'task_created',
            conditions: [
              { field: 'priority', operator: 'equals', value: 'high' }
            ]
          },
          triggerDescription: 'Nieuwe taak met hoge prioriteit',
          actionDefinition: {
            type: 'webhook',
            url: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL',
            method: 'POST',
            body: {
              text: '🚨 Nieuwe urgente taak: {{title}}'
            }
          },
          actionDescription: 'Stuur naar Slack webhook',
          isEnabled: false,
          priority: 40
        },
        {
          userId,
          name: 'Weekend planning vrijdag',
          description: 'Vrijdagmiddag herinnering om weekend te plannen',
          triggerCondition: {
            type: 'schedule',
            conditions: [
              { field: 'weekday', operator: 'equals', value: 5 },
              { field: 'time', operator: 'equals', value: '16:00' }
            ]
          },
          triggerDescription: 'Elke vrijdag om 16:00',
          actionDefinition: {
            type: 'send_notification',
            title: 'Weekend planning',
            message: 'Tijd om je weekend te plannen!',
            notificationType: 'info'
          },
          actionDescription: 'Stuur vriendelijke herinnering',
          isEnabled: true,
          priority: 60
        }
      ]
    });

    // Fetch created rules to return
    const createdRules = await prisma.aIRule.findMany({
      where: { userId },
      orderBy: { priority: 'asc' }
    });

    return NextResponse.json({
      success: true,
      message: 'AI Rules created',
      data: {
        count: createdRules.length,
        rules: createdRules.map(r => ({
          id: r.id,
          name: r.name,
          isEnabled: r.isEnabled,
          priority: r.priority
        }))
      }
    });
  } catch (error) {
    console.error('POST /api/rules/seed error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to seed rules' },
      { status: 500 }
    );
  }
}
