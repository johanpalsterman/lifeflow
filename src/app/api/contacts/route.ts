import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/contacts
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const favorites = searchParams.get('favorites') === 'true';
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const userId = searchParams.get('userId') || 'demo-user';

    const where: any = { userId };
    if (favorites) where.isFavorite = true;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        orderBy: { name: 'asc' },
        take: limit,
        skip: offset,
      }),
      prisma.contact.count({ where })
    ]);

    return NextResponse.json({
      success: true,
      data: contacts,
      pagination: { total, limit, offset, hasMore: offset + contacts.length < total }
    });
  } catch (error) {
    console.error('GET /api/contacts error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch contacts' }, { status: 500 });
  }
}

// POST /api/contacts
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.name || body.name.trim() === '') {
      return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 });
    }

    const userId = body.userId || 'demo-user';

    const contact = await prisma.contact.create({
      data: {
        userId,
        name: body.name.trim(),
        email: body.email || null,
        phone: body.phone || null,
        birthday: body.birthday ? new Date(body.birthday) : null,
        isFavorite: body.isFavorite || false,
      },
    });

    return NextResponse.json({ success: true, data: contact }, { status: 201 });
  } catch (error) {
    console.error('POST /api/contacts error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create contact' }, { status: 500 });
  }
}


