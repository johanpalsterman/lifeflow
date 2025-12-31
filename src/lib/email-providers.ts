// ============================================
// EMAIL PROVIDER INTEGRATIONS
// Gmail, Outlook, IMAP + Carrier Tracking
// ============================================

import prisma from '@/lib/prisma';
import { processNewEmails, EmailMessage } from './email-parser';

// ============================================
// GMAIL INTEGRATION
// ============================================

export async function connectGmail(userId: string, authCode: string): Promise<void> {
  const { google } = await import('googleapis');
  
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/google`
  );

  const { tokens } = await oauth2Client.getToken(authCode);
  oauth2Client.setCredentials(tokens);
  
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  const profile = await gmail.users.getProfile({ userId: 'me' });
  const email = profile.data.emailAddress!;

  await prisma.emailConnection.upsert({
    where: { userId_email: { userId, email } },
    create: {
      userId,
      provider: 'gmail',
      email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    },
    update: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || undefined,
      tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    },
  });
}

export async function syncGmail(userId: string, connectionId: string): Promise<{
  processed: number;
  tasks: any[];
  errors: string[];
}> {
  const { google } = await import('googleapis');
  
  const connection = await prisma.emailConnection.findUnique({
    where: { id: connectionId },
  });

  if (!connection || connection.provider !== 'gmail') {
    throw new Error('Invalid Gmail connection');
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    access_token: connection.accessToken,
    refresh_token: connection.refreshToken,
  });

  // Refresh token if needed
  if (connection.tokenExpiresAt && connection.tokenExpiresAt < new Date()) {
    const { credentials } = await oauth2Client.refreshAccessToken();
    await prisma.emailConnection.update({
      where: { id: connectionId },
      data: {
        accessToken: credentials.access_token,
        tokenExpiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
      },
    });
    oauth2Client.setCredentials(credentials);
  }

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  // Search queries for relevant emails
  const queries = [
    'subject:(factuur OR invoice OR rekening) newer_than:7d',
    'subject:(order bevestiging OR bestelling) newer_than:7d',
    'subject:(verzending OR shipping OR bezorging) newer_than:7d',
    'from:(postnl OR dhl OR dpd OR ups) newer_than:7d',
    'from:(bol.com OR coolblue OR amazon OR zalando) newer_than:7d',
  ];

  const allEmails: EmailMessage[] = [];
  const seenIds = new Set<string>();

  for (const query of queries) {
    try {
      const response = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 50,
      });

      if (!response.data.messages) continue;

      for (const msg of response.data.messages) {
        if (seenIds.has(msg.id!)) continue;
        seenIds.add(msg.id!);

        const detail = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id!,
          format: 'full',
        });

        const headers = detail.data.payload?.headers || [];
        const getHeader = (name: string) => 
          headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

        // Decode body
        let body = '';
        const payload = detail.data.payload;
        
        if (payload?.body?.data) {
          body = Buffer.from(payload.body.data, 'base64').toString('utf-8');
        } else if (payload?.parts) {
          const textPart = payload.parts.find(p => p.mimeType === 'text/plain');
          if (textPart?.body?.data) {
            body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
          }
        }

        allEmails.push({
          id: msg.id!,
          from: getHeader('From'),
          to: getHeader('To'),
          subject: getHeader('Subject'),
          body,
          receivedAt: new Date(parseInt(detail.data.internalDate || '0')),
        });
      }
    } catch (error) {
      console.error(`Gmail query failed: ${query}`, error);
    }
  }

  const result = await processNewEmails(userId, allEmails);

  await prisma.emailConnection.update({
    where: { id: connectionId },
    data: { lastSyncAt: new Date(), lastSyncError: null },
  });

  return result;
}

// ============================================
// OUTLOOK INTEGRATION
// ============================================

export async function connectOutlook(userId: string, authCode: string): Promise<void> {
  const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      code: authCode,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/microsoft`,
      grant_type: 'authorization_code',
      scope: 'Mail.Read User.Read offline_access',
    }),
  });

  const tokens = await tokenResponse.json();

  // Get user profile
  const profileRes = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const profile = await profileRes.json();
  const email = profile.mail || profile.userPrincipalName;

  await prisma.emailConnection.upsert({
    where: { userId_email: { userId, email } },
    create: {
      userId,
      provider: 'outlook',
      email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    },
    update: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    },
  });
}

export async function syncOutlook(userId: string, connectionId: string): Promise<{
  processed: number;
  tasks: any[];
  errors: string[];
}> {
  const connection = await prisma.emailConnection.findUnique({
    where: { id: connectionId },
  });

  if (!connection || connection.provider !== 'outlook') {
    throw new Error('Invalid Outlook connection');
  }

  let accessToken = connection.accessToken;
  
  // Refresh token if needed
  if (connection.tokenExpiresAt && connection.tokenExpiresAt < new Date()) {
    const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID!,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
        refresh_token: connection.refreshToken!,
        grant_type: 'refresh_token',
      }),
    });

    const tokens = await tokenResponse.json();
    accessToken = tokens.access_token;

    await prisma.emailConnection.update({
      where: { id: connectionId },
      data: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || connection.refreshToken,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
    });
  }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Fetch recent emails with filter
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/messages?$filter=receivedDateTime ge ${sevenDaysAgo.toISOString()}&$top=100&$orderby=receivedDateTime desc`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  const data = await response.json();
  
  const allEmails: EmailMessage[] = (data.value || [])
    .filter((msg: any) => {
      const subject = (msg.subject || '').toLowerCase();
      const from = (msg.from?.emailAddress?.address || '').toLowerCase();
      
      // Filter for relevant emails
      return (
        subject.includes('factuur') ||
        subject.includes('invoice') ||
        subject.includes('rekening') ||
        subject.includes('order') ||
        subject.includes('bestelling') ||
        subject.includes('verzending') ||
        subject.includes('shipping') ||
        subject.includes('track') ||
        from.includes('postnl') ||
        from.includes('dhl') ||
        from.includes('bol.com') ||
        from.includes('coolblue') ||
        from.includes('amazon')
      );
    })
    .map((msg: any) => ({
      id: msg.id,
      from: msg.from?.emailAddress?.address || '',
      to: msg.toRecipients?.[0]?.emailAddress?.address || '',
      subject: msg.subject || '',
      body: msg.body?.content || '',
      receivedAt: new Date(msg.receivedDateTime),
    }));

  const result = await processNewEmails(userId, allEmails);

  await prisma.emailConnection.update({
    where: { id: connectionId },
    data: { lastSyncAt: new Date(), lastSyncError: null },
  });

  return result;
}

// ============================================
// CARRIER TRACKING APIs
// ============================================

interface TrackingResult {
  status: string;
  estimatedDelivery?: Date;
  events: Array<{
    timestamp: Date;
    status: string;
    location?: string;
    description?: string;
  }>;
}

export async function trackPackage(carrier: string, trackingNumber: string): Promise<TrackingResult | null> {
  const carrierLower = carrier.toLowerCase();
  
  if (carrierLower.includes('postnl')) {
    return trackPostNL(trackingNumber);
  } else if (carrierLower.includes('dhl')) {
    return trackDHL(trackingNumber);
  } else if (carrierLower.includes('dpd')) {
    return trackDPD(trackingNumber);
  } else if (carrierLower.includes('ups')) {
    return trackUPS(trackingNumber);
  }
  
  return null;
}

async function trackPostNL(trackingNumber: string): Promise<TrackingResult | null> {
  if (!process.env.POSTNL_API_KEY) return null;

  try {
    const response = await fetch(
      `https://api.postnl.nl/shipment/v2/status/barcode/${trackingNumber}`,
      {
        headers: {
          'apikey': process.env.POSTNL_API_KEY,
        },
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const shipment = data.CurrentStatus?.Shipment;
    
    if (!shipment) return null;

    const statusMap: Record<string, string> = {
      '01': 'ordered',
      '02': 'shipped',
      '03': 'shipped',
      '04': 'out_for_delivery',
      '05': 'delivered',
      '06': 'delivered',
    };

    return {
      status: statusMap[shipment.StatusCode] || 'unknown',
      estimatedDelivery: shipment.DeliveryDate ? new Date(shipment.DeliveryDate) : undefined,
      events: (shipment.Events || []).map((e: any) => ({
        timestamp: new Date(e.TimeStamp),
        status: e.Status,
        location: e.LocationCode,
        description: e.Description,
      })),
    };
  } catch (error) {
    console.error('PostNL tracking error:', error);
    return null;
  }
}

async function trackDHL(trackingNumber: string): Promise<TrackingResult | null> {
  if (!process.env.DHL_API_KEY) return null;

  try {
    const response = await fetch(
      `https://api-eu.dhl.com/track/shipments?trackingNumber=${trackingNumber}`,
      {
        headers: {
          'DHL-API-Key': process.env.DHL_API_KEY,
        },
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const shipment = data.shipments?.[0];
    
    if (!shipment) return null;

    const statusMap: Record<string, string> = {
      'pre-transit': 'ordered',
      'transit': 'shipped',
      'out-for-delivery': 'out_for_delivery',
      'delivered': 'delivered',
    };

    return {
      status: statusMap[shipment.status?.statusCode] || 'unknown',
      estimatedDelivery: shipment.estimatedDeliveryDate ? new Date(shipment.estimatedDeliveryDate) : undefined,
      events: (shipment.events || []).map((e: any) => ({
        timestamp: new Date(e.timestamp),
        status: e.statusCode,
        location: e.location?.address?.addressLocality,
        description: e.description,
      })),
    };
  } catch (error) {
    console.error('DHL tracking error:', error);
    return null;
  }
}

async function trackDPD(trackingNumber: string): Promise<TrackingResult | null> {
  // DPD API integration would go here
  // https://esolutions.dpd.com/
  console.log('DPD tracking not implemented:', trackingNumber);
  return null;
}

async function trackUPS(trackingNumber: string): Promise<TrackingResult | null> {
  // UPS API integration would go here
  // https://developer.ups.com/
  console.log('UPS tracking not implemented:', trackingNumber);
  return null;
}

// ============================================
// SCHEDULED SYNC
// ============================================

export async function syncAllEmailConnections(): Promise<{
  total: number;
  success: number;
  errors: number;
}> {
  const connections = await prisma.emailConnection.findMany({
    where: { syncEnabled: true },
  });

  let success = 0;
  let errors = 0;

  for (const connection of connections) {
    try {
      if (connection.provider === 'gmail') {
        await syncGmail(connection.userId, connection.id);
      } else if (connection.provider === 'outlook') {
        await syncOutlook(connection.userId, connection.id);
      }
      success++;
    } catch (error) {
      console.error(`Sync failed for ${connection.id}:`, error);
      
      await prisma.emailConnection.update({
        where: { id: connection.id },
        data: { lastSyncError: String(error) },
      });
      errors++;
    }
  }

  return { total: connections.length, success, errors };
}

export async function updateAllDeliveryTracking(): Promise<{
  updated: number;
  errors: number;
}> {
  const deliveryTasks = await prisma.emailTask.findMany({
    where: {
      category: { in: ['delivery', 'order_confirm'] },
      taskStatus: 'pending',
      trackingNumber: { not: null },
      carrier: { not: null },
    },
  });

  let updated = 0;
  let errors = 0;

  for (const task of deliveryTasks) {
    try {
      const tracking = await trackPackage(task.carrier!, task.trackingNumber!);
      
      if (tracking && tracking.status !== task.deliveryStatus) {
        await prisma.emailTask.update({
          where: { id: task.id },
          data: {
            deliveryStatus: tracking.status,
            expectedDelivery: tracking.estimatedDelivery,
            ...(tracking.status === 'delivered' ? {
              taskStatus: 'completed',
              completedAt: new Date(),
              deliveredAt: new Date(),
            } : {}),
          },
        });

        // Log tracking event
        if (tracking.events.length > 0) {
          const latestEvent = tracking.events[0];
          await prisma.deliveryTrackingEvent.create({
            data: {
              emailTaskId: task.id,
              status: latestEvent.status,
              location: latestEvent.location,
              description: latestEvent.description,
              timestamp: latestEvent.timestamp,
            },
          });
        }

        updated++;
      }
    } catch (error) {
      console.error(`Tracking update failed for ${task.id}:`, error);
      errors++;
    }
  }

  return { updated, errors };
}
