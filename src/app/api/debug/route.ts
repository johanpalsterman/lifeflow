import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? 'SET' : 'UNDEFINED',
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'UNDEFINED',
    NODE_ENV: process.env.NODE_ENV || 'UNDEFINED',
  });
}
