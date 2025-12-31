import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  return NextResponse.json({ 
    message: "Integrations API",
    available: ["google", "outlook"],
    status: "ready"
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, userId, integrationId } = body;

    if (action === 'list') {
      // Get all integrations for user (or all if no userId specified)
      const integrations = await prisma.userIntegration.findMany({
        where: userId ? { userId } : {},
        include: {
          user: {
            select: { email: true, name: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return NextResponse.json({
        success: true,
        data: {
          integrations: integrations.map(i => ({
            id: i.id,
            provider: i.provider,
            email: (i.metadata as any)?.email || i.user?.email || 'Unknown',
            connected: i.isActive,
            lastSync: i.lastSyncAt?.toISOString() || null,
          }))
        }
      });
    }

    if (action === 'disconnect' && integrationId) {
      await prisma.userIntegration.update({
        where: { id: integrationId },
        data: { isActive: false }
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ 
      success: false, 
      error: "Unknown action" 
    });
  } catch (error) {
    console.error('Integration API error:', error);
    return NextResponse.json({ 
      success: false, 
      error: "Internal error" 
    }, { status: 500 });
  }
}
