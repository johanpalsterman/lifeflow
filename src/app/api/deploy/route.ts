import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key');
  if (key === process.env.DEPLOY_SECRET) return NextResponse.json({ success: true, status: 'running' });
  return NextResponse.json({ app: 'LifeFlow', status: 'running' });
}
