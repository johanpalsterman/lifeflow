import { NextRequest, NextResponse } from 'next/server';

const DEPLOY_SECRET = process.env.DEPLOY_SECRET || 'lf-deploy-2025-secret';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const key = searchParams.get('key');
  const action = searchParams.get('action');

  // Info without key
  if (!key) {
    return NextResponse.json({
      app: 'LifeFlow',
      version: process.env.APP_VERSION || 'v1.0.0',
      status: 'running',
      endpoints: {
        status: '/api/deploy?key=YOUR_KEY&action=status',
        info: '/api/deploy?key=YOUR_KEY&action=info',
      }
    });
  }

  // Verify secret key
  if (key !== DEPLOY_SECRET) {
    return NextResponse.json(
      { success: false, error: 'Invalid key' },
      { status: 401 }
    );
  }

  if (action === 'status') {
    return NextResponse.json({
      success: true,
      app: 'LifeFlow',
      version: process.env.APP_VERSION || 'v1.0.0',
      status: 'running',
      timestamp: new Date().toISOString(),
      uptime: process.uptime ? `${Math.floor(process.uptime())}s` : 'unknown',
    });
  }

  if (action === 'info') {
    return NextResponse.json({
      success: true,
      app: 'LifeFlow',
      version: process.env.APP_VERSION || 'v1.0.0',
      environment: process.env.NODE_ENV || 'production',
      features: [
        'Gmail Integration',
        'Task Management',
        'Event Calendar',
        'AI Rules Engine',
        'Safety Checks',
      ],
      timestamp: new Date().toISOString(),
    });
  }

  if (action === 'deploy') {
    // For Azure Container Apps, we can't directly trigger a redeploy from the app itself
    // But we can return info about how to deploy
    return NextResponse.json({
      success: true,
      message: 'Deploy request received',
      app: 'LifeFlow',
      instruction: 'Use Azure CLI: az containerapp update --name lifeflow --resource-group lifeflow-rg --image <new-image>',
      timestamp: new Date().toISOString(),
    });
  }

  return NextResponse.json({
    success: true,
    app: 'LifeFlow',
    availableActions: ['status', 'info', 'deploy'],
    usage: '/api/deploy?key=YOUR_KEY&action=status',
  });
}
