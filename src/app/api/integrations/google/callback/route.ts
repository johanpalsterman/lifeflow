import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const error = request.nextUrl.searchParams.get('error');
  const baseUrl = process.env.NEXTAUTH_URL || 'https://lifeflow.wishflow.eu';

  // Handle OAuth errors
  if (error) {
    console.error('OAuth error:', error);
    return NextResponse.redirect(`${baseUrl}/settings?error=${error}`);
  }

  if (!code) {
    return NextResponse.redirect(`${baseUrl}/settings?error=no_code`);
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${baseUrl}/api/integrations/google/callback`,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenRes.json();

    if (!tokens.access_token) {
      console.error('Token exchange failed:', tokens);
      return NextResponse.redirect(`${baseUrl}/settings?error=token_exchange_failed`);
    }

    // Get user info from Google
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo = await userRes.json();

    if (!userInfo.email) {
      console.error('Failed to get user email:', userInfo);
      return NextResponse.redirect(`${baseUrl}/settings?error=no_email`);
    }

    // Find or create user
    let user = await prisma.user.findFirst({
      where: { email: userInfo.email },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: userInfo.email,
          name: userInfo.name || userInfo.email.split('@')[0],
        },
      });
      console.log('Created new user:', user.id);
    }

    // Upsert the integration
    await prisma.userIntegration.upsert({
      where: {
        userId_provider: {
          userId: user.id,
          provider: 'google',
        },
      },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || undefined,
        tokenExpiresAt: new Date(Date.now() + (tokens.expires_in || 3600) * 1000),
        isActive: true,
        scopes: ['gmail.readonly', 'userinfo.email'],
        metadata: {
          email: userInfo.email,
          name: userInfo.name,
          picture: userInfo.picture,
          connectedAt: new Date().toISOString(),
        },
        lastSyncAt: new Date(),
      },
      create: {
        userId: user.id,
        provider: 'google',
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: new Date(Date.now() + (tokens.expires_in || 3600) * 1000),
        isActive: true,
        scopes: ['gmail.readonly', 'userinfo.email'],
        metadata: {
          email: userInfo.email,
          name: userInfo.name,
          picture: userInfo.picture,
          connectedAt: new Date().toISOString(),
        },
      },
    });

    console.log('Google integration saved for user:', user.id);

    return NextResponse.redirect(`${baseUrl}/settings?success=google_connected`);
  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect(`${baseUrl}/settings?error=oauth_failed`);
  }
}
