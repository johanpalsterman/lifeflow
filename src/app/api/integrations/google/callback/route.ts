import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  if (!code) return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/settings?error=no_code`);

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/integrations/google/callback`, grant_type: 'authorization_code',
      }),
    });
    const tokens = await tokenRes.json();

    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: `Bearer ${tokens.access_token}` } });
    const userInfo = await userRes.json();

    let user = await prisma.user.findFirst({ where: { email: userInfo.email } });
    if (!user) user = await prisma.user.create({ data: { email: userInfo.email, name: userInfo.name } });

    await prisma.userIntegration.upsert({
      where: { userId_provider: { userId: user.id, provider: 'google' } },
      update: { accessToken: tokens.access_token, refreshToken: tokens.refresh_token || undefined, tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000), isActive: true, metadata: { email: userInfo.email } },
      create: { userId: user.id, provider: 'google', accessToken: tokens.access_token, refreshToken: tokens.refresh_token, tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000), isActive: true, scopes: ['gmail.readonly'], metadata: { email: userInfo.email } },
    });

    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/settings?success=connected`);
  } catch (error) {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/settings?error=failed`);
  }
}
