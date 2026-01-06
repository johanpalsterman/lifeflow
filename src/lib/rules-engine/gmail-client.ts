// LifeFlow AI Rules Engine - Gmail Client
// Haalt emails op via Gmail API met OAuth2

import type { EmailData, AttachmentInfo } from '../../types/rules';

interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  payload: {
    headers: Array<{ name: string; value: string }>;
    body?: { data?: string; size: number };
    parts?: Array<{
      mimeType: string;
      filename?: string;
      body?: { data?: string; size: number; attachmentId?: string };
      parts?: Array<{
        mimeType: string;
        body?: { data?: string };
      }>;
    }>;
  };
  internalDate: string;
}

/**
 * Haalt emails op uit Gmail
 */
export async function fetchGmailEmails(
  accessToken: string,
  options: {
    maxResults?: number;
    query?: string;
    after?: Date;
    labelIds?: string[];
  } = {}
): Promise<EmailData[]> {
  const { maxResults = 20, query, after, labelIds } = options;
  
  // Bouw query string
  let q = query || '';
  if (after) {
    const afterTimestamp = Math.floor(after.getTime() / 1000);
    q += ` after:${afterTimestamp}`;
  }
  
  // Haal message IDs op
  const listParams = new URLSearchParams({
    maxResults: maxResults.toString(),
    ...(q && { q: q.trim() }),
    ...(labelIds && { labelIds: labelIds.join(',') }),
  });

  const listResponse = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?${listParams}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!listResponse.ok) {
    throw new Error(`Gmail API error: ${listResponse.status} ${listResponse.statusText}`);
  }

  const listData = await listResponse.json();
  const messages = listData.messages || [];

  // Haal volledige message data op
  const emails: EmailData[] = [];
  
  for (const msg of messages) {
    try {
      const email = await fetchGmailMessage(accessToken, msg.id);
      if (email) {
        emails.push(email);
      }
    } catch (error) {
      console.error(`Failed to fetch message ${msg.id}:`, error);
    }
  }

  return emails;
}

/**
 * Haalt een enkele Gmail message op
 */
async function fetchGmailMessage(
  accessToken: string,
  messageId: string
): Promise<EmailData | null> {
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch message: ${response.status}`);
  }

  const message: GmailMessage = await response.json();
  return parseGmailMessage(message);
}

/**
 * Parst een Gmail message naar EmailData
 */
function parseGmailMessage(message: GmailMessage): EmailData {
  const headers = message.payload.headers;
  
  const getHeader = (name: string): string => {
    const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
    return header?.value || '';
  };

  // Extract body
  let body = '';
  let bodyHtml = '';
  
  if (message.payload.body?.data) {
    body = decodeBase64(message.payload.body.data);
  } else if (message.payload.parts) {
    const textPart = findPart(message.payload.parts, 'text/plain');
    const htmlPart = findPart(message.payload.parts, 'text/html');
    
    if (textPart?.body?.data) {
      body = decodeBase64(textPart.body.data);
    }
    if (htmlPart?.body?.data) {
      bodyHtml = decodeBase64(htmlPart.body.data);
      // Als geen plain text, strip HTML tags
      if (!body) {
        body = stripHtml(bodyHtml);
      }
    }
  }

  // Extract attachments
  const attachments: AttachmentInfo[] = [];
  if (message.payload.parts) {
    for (const part of message.payload.parts) {
      if (part.filename && part.body?.attachmentId) {
        attachments.push({
          filename: part.filename,
          mimeType: part.mimeType,
          size: part.body.size || 0,
        });
      }
    }
  }

  // Parse To header (kan meerdere adressen bevatten)
  const toHeader = getHeader('To');
  const toAddresses = toHeader
    .split(',')
    .map(addr => addr.trim())
    .filter(addr => addr.length > 0);

  return {
    id: message.id,
    threadId: message.threadId,
    from: getHeader('From'),
    to: toAddresses,
    subject: getHeader('Subject'),
    body,
    bodyHtml,
    date: new Date(parseInt(message.internalDate)),
    labels: message.labelIds,
    attachments,
  };
}

/**
 * Zoekt een specifiek MIME type in message parts
 */
function findPart(
  parts: GmailMessage['payload']['parts'],
  mimeType: string
): GmailMessage['payload']['parts'][0] | undefined {
  for (const part of parts || []) {
    if (part.mimeType === mimeType) {
      return part;
    }
    // Check nested parts (multipart messages)
    if (part.parts) {
      const nested = findPart(part.parts as GmailMessage['payload']['parts'], mimeType);
      if (nested) return nested;
    }
  }
  return undefined;
}

/**
 * Decodeert base64url encoded string
 */
function decodeBase64(encoded: string): string {
  // Gmail gebruikt base64url encoding
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  try {
    return Buffer.from(base64, 'base64').toString('utf-8');
  } catch {
    return '';
  }
}

/**
 * Verwijdert HTML tags uit string
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Markeert een email als gelezen
 */
export async function markAsRead(
  accessToken: string,
  messageId: string
): Promise<void> {
  await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        removeLabelIds: ['UNREAD'],
      }),
    }
  );
}

/**
 * Voegt een label toe aan een email
 */
export async function addLabel(
  accessToken: string,
  messageId: string,
  labelId: string
): Promise<void> {
  await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        addLabelIds: [labelId],
      }),
    }
  );
}

/**
 * Haalt het Gmail profiel op (voor email adres)
 */
export async function getGmailProfile(
  accessToken: string
): Promise<{ emailAddress: string; messagesTotal: number }> {
  const response = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/profile',
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to get profile: ${response.status}`);
  }

  return response.json();
}

/**
 * Refresht een OAuth access token
 */
export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<{ accessToken: string; expiresAt: Date }> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${response.status}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

