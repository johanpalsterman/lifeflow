import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // Get first active Google integration (for now, since we don't have auth sessions)
    const integration = await prisma.userIntegration.findFirst({
      where: {
        provider: 'google',
        isActive: true,
      },
      orderBy: { updatedAt: 'desc' }
    });

    if (!integration || !integration.accessToken) {
      return NextResponse.json({
        success: true,
        data: {
          connected: false,
          unreadCount: 0,
          emails: [],
        },
      });
    }

    // Check if token is expired and refresh if needed
    let accessToken = integration.accessToken;
    if (integration.tokenExpiresAt && new Date(integration.tokenExpiresAt) < new Date()) {
      if (integration.refreshToken) {
        try {
          const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: process.env.GOOGLE_CLIENT_ID!,
              client_secret: process.env.GOOGLE_CLIENT_SECRET!,
              refresh_token: integration.refreshToken,
              grant_type: 'refresh_token',
            }),
          });

          const tokens = await refreshResponse.json();
          if (tokens.access_token) {
            accessToken = tokens.access_token;
            await prisma.userIntegration.update({
              where: { id: integration.id },
              data: {
                accessToken: tokens.access_token,
                tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
              },
            });
          }
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
        }
      }
    }

    // Fetch unread count from Gmail
    const unreadResponse = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/labels/INBOX',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    
    if (!unreadResponse.ok) {
      const errorText = await unreadResponse.text();
      console.error('Gmail API error:', errorText);
      return NextResponse.json({
        success: false,
        error: 'Gmail API error',
        details: errorText
      }, { status: 500 });
    }
    
    const inboxData = await unreadResponse.json();
    const unreadCount = inboxData.messagesUnread || 0;

    // Fetch recent unread emails
    const messagesResponse = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5&q=is:unread',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    const messagesData = await messagesResponse.json();

    const emails = [];
    if (messagesData.messages) {
      for (const msg of messagesData.messages.slice(0, 5)) {
        try {
          const detailResponse = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`,
            {
              headers: { Authorization: `Bearer ${accessToken}` },
            }
          );
          const detail = await detailResponse.json();

          const headers = detail.payload?.headers || [];
          const from = headers.find((h: any) => h.name === 'From')?.value || 'Unknown';
          const subject = headers.find((h: any) => h.name === 'Subject')?.value || 'No subject';

          // Parse sender name
          const fromMatch = from.match(/^([^<]+)</);
          const senderName = fromMatch ? fromMatch[1].trim().replace(/"/g, '') : from.split('@')[0];

          // Calculate time ago
          const timestamp = parseInt(detail.internalDate);
          const minutesAgo = Math.floor((Date.now() - timestamp) / 60000);
          let timeAgo = '';
          if (minutesAgo < 60) {
            timeAgo = `${minutesAgo} min`;
          } else if (minutesAgo < 1440) {
            timeAgo = `${Math.floor(minutesAgo / 60)} uur`;
          } else {
            timeAgo = `${Math.floor(minutesAgo / 1440)}d`;
          }

          emails.push({
            id: msg.id,
            from: senderName,
            subject,
            time: timeAgo,
            important: detail.labelIds?.includes('IMPORTANT') || false,
          });
        } catch (msgError) {
          console.error('Failed to fetch message details:', msgError);
        }
      }
    }

    // Update last sync
    await prisma.userIntegration.update({
      where: { id: integration.id },
      data: { lastSyncAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      data: {
        connected: true,
        unreadCount,
        emails,
        email: (integration.metadata as any)?.email || 'Unknown',
      },
    });
  } catch (error) {
    console.error('Gmail API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch emails',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
