import { NextRequest, NextResponse } from 'next/server';

// Simplified version - full AI processing will be added once schema is synced
export async function POST(request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: 'Email processing endpoint ready. Connect Gmail in settings to enable.',
    processed: 0,
    results: [],
  });
}

export async function GET() {
  return NextResponse.json({
    message: 'POST to this endpoint to process emails',
    usage: 'POST /api/process-emails',
    status: 'ready',
  });
}
