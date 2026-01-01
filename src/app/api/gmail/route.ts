import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Find active Google integration
    const integration = await prisma.userIntegration.findFirst({
      where: { provider: 'google', isActive: true },
    });

    if (!integration?.accessToken) {
      return NextResponse.json({
        success: true,
        data: { connected: false, unreadCount: 0, emails: [] }
      });
    }

    let accessToken = integration.accessToken;

    // Refresh token if expired
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
                accessToken,
                tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
              },
            });
          } else {
            // Token refresh failed - mark as disconnected
            await prisma.userIntegration.update({
              where: { id: integration.id },
              data: { isActive: false },
            });
            return NextResponse.json({
              success: true,
              data: { connected: false, unreadCount: 0, emails: [], error: 'Token expired, please reconnect' }
            });
          }
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
          return NextResponse.json({
            success: true,
            data: { connected: false, unreadCount: 0, emails: [], error: 'Token refresh failed' }
          });
        }
      }
    }

    // Get unread count from INBOX label
    let unreadCount = 0;
    try {
      const inboxRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels/INBOX', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (inboxRes.ok) {
        const inboxData = await inboxRes.json();
        unreadCount = inboxData.messagesUnread || 0;
      }
    } catch (e) {
      console.error('Failed to get inbox stats:', e);
    }

    // Get recent unread emails
    const emails: any[] = [];
    try {
      const messagesRes = await fetch(
        'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10&q=is:unread',
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (messagesRes.ok) {
        const messagesData = await messagesRes.json();
        const messageIds = (messagesData.messages || []).slice(0, 10);

        // Fetch details for each message
        for (const msg of messageIds) {
          try {
            const detailRes = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
              { headers: { Authorization: `Bearer ${accessToken}` } }
            );

            if (detailRes.ok) {
              const detail = await detailRes.json();
              const headers = detail.payload?.headers || [];

              const from = headers.find((h: any) => h.name === 'From')?.value || '';
              const subject = headers.find((h: any) => h.name === 'Subject')?.value || '(geen onderwerp)';

              // Extract sender name from "Name <email@domain.com>" format
              const fromMatch = from.match(/^([^<]+)</);
              const senderName = fromMatch
                ? fromMatch[1].trim().replace(/"/g, '')
                : from.split('@')[0];

              // Calculate relative time
              const receivedAt = parseInt(detail.internalDate);
              const minutesAgo = Math.floor((Date.now() - receivedAt) / 60000);
              let timeLabel: string;
              if (minutesAgo < 1) {
                timeLabel = 'nu';
              } else if (minutesAgo < 60) {
                timeLabel = `${minutesAgo} min`;
              } else if (minutesAgo < 1440) {
                timeLabel = `${Math.floor(minutesAgo / 60)} uur`;
              } else {
                timeLabel = `${Math.floor(minutesAgo / 1440)}d`;
              }

              emails.push({
                id: msg.id,
                threadId: detail.threadId,
                from: senderName,
                fromEmail: from,
                subject,
                snippet: detail.snippet || '',
                time: timeLabel,
                receivedAt: new Date(receivedAt).toISOString(),
                important: detail.labelIds?.includes('IMPORTANT') || false,
                starred: detail.labelIds?.includes('STARRED') || false,
                labels: detail.labelIds || [],
              });
            }
          } catch (detailError) {
            console.error(`Failed to fetch message ${msg.id}:`, detailError);
          }
        }
      }
    } catch (e) {
      console.error('Failed to fetch messages:', e);
    }

    // Update last sync time
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
        lastSync: new Date().toISOString(),
      }
    });

  } catch (error) {
    console.error('Gmail API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Gmail error'
    }, { status: 500 });
  }
}

// POST - Mark email as read, archive, etc.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, messageId } = body;

    const integration = await prisma.userIntegration.findFirst({
      where: { provider: 'google', isActive: true },
    });

    if (!integration?.accessToken) {
      return NextResponse.json({ success: false, error: 'Not connected' }, { status: 401 });
    }

    const accessToken = integration.accessToken;

    switch (action) {
      case 'markRead':
        await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ removeLabelIds: ['UNREAD'] }),
          }
        );
        return NextResponse.json({ success: true });

      case 'archive':
        await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ removeLabelIds: ['INBOX'] }),
          }
        );
        return NextResponse.json({ success: true });

      case 'star':
        await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ addLabelIds: ['STARRED'] }),
          }
        );
        return NextResponse.json({ success: true });

      default:
        return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Gmail POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 });
  }
}
