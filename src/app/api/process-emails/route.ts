import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ success: true, message: 'Email processing ready', processed: 0 });
}

export async function GET() {
  return NextResponse.json({ status: 'ready' });
}
