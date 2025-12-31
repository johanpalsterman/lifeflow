import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'demo-user';
    const contacts = await prisma.contact.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json({ success: true, data: contacts });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch contacts' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = body.userId || 'demo-user';
    const contact = await prisma.contact.create({
      data: {
        userId,
        name: body.name,
        email: body.email || null,
        phone: body.phone || null,
        birthday: body.birthday ? new Date(body.birthday) : null,
        notes: body.notes || null,
      },
    });
    return NextResponse.json({ success: true, data: contact }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to create contact' }, { status: 500 });
  }
}
