import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST() {
  try {
    const userId = 'demo-user';
    let user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) user = await prisma.user.create({ data: { id: userId, email: 'demo@lifeflow.app', name: 'Johan' } });

    return NextResponse.json({ success: true, message: 'Demo user created', userId });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
