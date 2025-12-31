import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  return NextResponse.json({ message: 'Integrations API', available: ['google'] });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (body.action === 'list') {
      const integrations = await prisma.userIntegration.findMany();
      return NextResponse.json({ success: true, data: { integrations: integrations.map(i => ({ id: i.id, provider: i.provider, connected: i.isActive })) } });
    }
    return NextResponse.json({ success: false, error: 'Unknown action' });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Error' }, { status: 500 });
  }
}
