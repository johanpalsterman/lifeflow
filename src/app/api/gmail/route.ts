import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const integration = await prisma.userIntegration.findFirst({ where: { provider: 'google', isActive: true } });
    if (!integration?.accessToken) {
      return NextResponse.json({ success: true, data: { connected: false, unreadCount: 0, emails: [] } });
    }
    return NextResponse.json({ success: true, data: { connected: true, unreadCount: 0, emails: [] } });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Gmail error' }, { status: 500 });
  }
}
