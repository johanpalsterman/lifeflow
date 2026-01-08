// src/lib/rules-engine/email-anonymizer.ts - VERVANG VOLLEDIG
// Privacy-first email processing - removes all PII before AI classification

import { 
  RawEmail, 
  AnonymizedEmail, 
  ExtractedEmailData,
  EmailCategory,
  KNOWN_SHOPS
} from '../../types/rules';

// ===========================================
// PII PATTERNS TO REMOVE
// ===========================================

const PII_PATTERNS = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  phone: /(\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{2,4}[-.\s]?\d{2,4}/g,
  iban: /[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}([A-Z0-9]?){0,16}/g,
  creditCard: /\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}/g,
  bsn: /\b\d{9}\b/g,
  postalCode: /\b\d{4}\s?[A-Z]{2}\b/gi,
  streetAddress: /\b\d+\s+[\w\s]+(?:straat|laan|weg|plein|singel|gracht|kade|dreef|hof|steeg|pad)\b/gi,
  dutchName: /\b(?:van|de|het|der|den|ter)\s+[A-Z][a-z]+\b/g,
};

// ===========================================
// KEYWORDS PER CATEGORY
// ===========================================

const CATEGORY_KEYWORDS: Record<EmailCategory, string[]> = {
  invoice: [
    'factuur', 'invoice', 'rekening', 'betaling', 'payment', 'bedrag', 'amount',
    'btw', 'vat', 'totaal', 'total', 'te betalen', 'due', 'vervaldatum', 'incasso'
  ],
  delivery: [
    'verzonden', 'shipped', 'onderweg', 'bezorgd', 'delivered', 'tracking',
    'pakket', 'package', 'levering', 'delivery', 'postcode', 'afhaalpunt',
    'bezorging', 'koerier', 'courier', 'trace', 'volg je pakket'
  ],
  order: [
    'bestelling', 'order', 'besteld', 'ordered', 'bevestiging', 'confirmation',
    'winkelwagen', 'cart', 'aankoop', 'purchase', 'betaal nu', 'pay now',
    'wacht op betaling', 'awaiting payment', 'bedankt voor je bestelling',
    'thank you for your order', 'bestelbevestiging', 'order confirmed',
    'je bestelling is ontvangen', 'we hebben je bestelling ontvangen',
    'voltooien', 'complete your order', 'afrekenen', 'checkout',
    'in behandeling', 'processing', 'wordt verwerkt', 'being processed'
  ],
  event: [
    'afspraak', 'appointment', 'meeting', 'vergadering', 'uitnodiging',
    'invitation', 'agenda', 'calendar', 'datum', 'date', 'tijd', 'time',
    'locatie', 'location', 'aanwezig', 'attend', 'reservering', 'booking'
  ],
  task: [
    'actie', 'action', 'todo', 'taak', 'task', 'verzoek', 'request',
    'deadline', 'urgent', 'belangrijk', 'important', 'herinnering', 'reminder',
    'opvolging', 'follow-up', 'graag', 'please', 'kun je', 'could you'
  ],
  newsletter: [
    'nieuwsbrief', 'newsletter', 'abonnement', 'subscription', 'uitschrijven',
    'unsubscribe', 'update', 'aanbieding', 'offer', 'korting', 'discount',
    'actie', 'sale', 'promo'
  ],
  spam: [
    'spam', 'junk', 'won', 'winner', 'lottery', 'prize', 'free', 'gratis',
    'click here', 'klik hier', 'limited time', 'act now', 'urgent action'
  ],
  personal: [
    'hoi', 'hey', 'hallo', 'beste', 'lieve', 'groeten', 'regards',
    'bedankt', 'thanks', 'fijn weekend', 'tot snel', 'liefs'
  ],
  unknown: []
};

// ===========================================
// CARRIER DETECTION
// ===========================================

const CARRIER_PATTERNS: Record<string, { name: string; patterns: RegExp[]; domains: string[] }> = {
  postnl: {
    name: 'PostNL',
    patterns: [/3S[A-Z0-9]{13}/i, /JVGL[A-Z0-9]{16}/i],
    domains: ['postnl.nl', 'postnl.post']
  },
  dhl: {
    name: 'DHL',
    patterns: [/JJD\d{18}/i, /\d{10,22}/],
    domains: ['dhl.com', 'dhl.nl', 'dhlparcel.nl']
  },
  ups: {
    name: 'UPS',
    patterns: [/1Z[A-Z0-9]{16}/i],
    domains: ['ups.com']
  },
  dpd: {
    name: 'DPD',
    patterns: [/\d{14}/],
    domains: ['dpd.nl', 'dpd.com']
  },
  gls: {
    name: 'GLS',
    patterns: [/\d{11,12}/],
    domains: ['gls-group.eu', 'gls.nl']
  },
  fedex: {
    name: 'FedEx',
    patterns: [/\d{12,22}/],
    domains: ['fedex.com']
  }
};

// ===========================================
// ORDER NUMBER PATTERNS
// ===========================================

const ORDER_PATTERNS: Record<string, RegExp[]> = {
  aliexpress: [/\b\d{15,20}\b/, /order.*?(\d{15,20})/i],
  amazon: [/\b\d{3}-\d{7}-\d{7}\b/, /order.*?(\d{3}-\d{7}-\d{7})/i],
  bol: [/\b\d{10}\b/, /bestelnummer.*?(\d{10})/i],
  coolblue: [/\b\d{8}\b/, /ordernummer.*?(\d{8})/i],
  generic: [/(?:order|bestelling|bestelnummer|ordernummer)[:\s#]*([A-Z0-9-]{6,20})/i]
};

// ===========================================
// MAIN FUNCTIONS
// ===========================================

/**
 * Remove all PII from email text
 */
function removePII(text: string): string {
  let cleaned = text;
  
  for (const pattern of Object.values(PII_PATTERNS)) {
    cleaned = cleaned.replace(pattern, '[REMOVED]');
  }
  
  return cleaned;
}

/**
 * Extract domain from email address
 */
function extractDomain(email: string): string {
  const match = email.match(/@([a-zA-Z0-9.-]+)/);
  return match ? match[1].toLowerCase() : 'unknown';
}

/**
 * Extract relevant keywords based on category hints
 */
function extractKeywords(text: string, category?: EmailCategory): string[] {
  const cleanedText = removePII(text.toLowerCase());
  const words = cleanedText.split(/\s+/);
  
  const relevantKeywords = new Set<string>();
  
  // Add category-specific keywords found in text
  const categories = category ? [category] : Object.keys(CATEGORY_KEYWORDS) as EmailCategory[];
  
  for (const cat of categories) {
    const keywords = CATEGORY_KEYWORDS[cat];
    for (const keyword of keywords) {
      if (cleanedText.includes(keyword.toLowerCase())) {
        relevantKeywords.add(keyword.toLowerCase());
      }
    }
  }
  
  // Add shop names found
  for (const shop of Object.values(KNOWN_SHOPS)) {
    if (cleanedText.includes(shop.name.toLowerCase())) {
      relevantKeywords.add(shop.name.toLowerCase());
    }
  }
  
  // Add carrier names found
  for (const carrier of Object.values(CARRIER_PATTERNS)) {
    if (cleanedText.includes(carrier.name.toLowerCase())) {
      relevantKeywords.add(carrier.name.toLowerCase());
    }
  }
  
  return Array.from(relevantKeywords).slice(0, 20); // Max 20 keywords
}

/**
 * Anonymize a single email - removes all PII, keeps only classification-relevant data
 */
export function anonymizeEmail(email: RawEmail): AnonymizedEmail {
  const date = new Date(email.date);
  
  return {
    id: email.id,
    fromDomain: extractDomain(email.from),
    subjectTokens: extractKeywords(email.subject),
    bodyTokens: extractKeywords(email.body),
    attachmentTypes: email.attachments?.map(a => a.mimeType) || [],
    hasAttachments: (email.attachments?.length || 0) > 0,
    dateInfo: {
      dayOfWeek: date.getDay(),
      hourOfDay: date.getHours(),
      isWeekend: date.getDay() === 0 || date.getDay() === 6
    }
  };
}

/**
 * Anonymize multiple emails
 */
export function anonymizeEmails(emails: RawEmail[]): AnonymizedEmail[] {
  return emails.map(anonymizeEmail);
}

/**
 * Detect shop from email domain
 */
function detectShop(domain: string): { key: string; name: string } | null {
  for (const [key, shop] of Object.entries(KNOWN_SHOPS)) {
    if (shop.domains.some(d => domain.includes(d) || d.includes(domain))) {
      return { key, name: shop.name };
    }
  }
  return null;
}

/**
 * Detect carrier from email domain and content
 */
function detectCarrier(domain: string, text: string): { name: string; trackingNumber?: string } | null {
  for (const [key, carrier] of Object.entries(CARRIER_PATTERNS)) {
    // Check domain
    if (carrier.domains.some(d => domain.includes(d))) {
      // Try to find tracking number
      for (const pattern of carrier.patterns) {
        const match = text.match(pattern);
        if (match) {
          return { name: carrier.name, trackingNumber: match[0] };
        }
      }
      return { name: carrier.name };
    }
    
    // Check patterns in text
    for (const pattern of carrier.patterns) {
      const match = text.match(pattern);
      if (match) {
        return { name: carrier.name, trackingNumber: match[0] };
      }
    }
  }
  return null;
}

/**
 * Extract order number from email
 */
function extractOrderNumber(text: string, shopKey?: string): string | null {
  // Try shop-specific patterns first
  if (shopKey && ORDER_PATTERNS[shopKey]) {
    for (const pattern of ORDER_PATTERNS[shopKey]) {
      const match = text.match(pattern);
      if (match) {
        return match[1] || match[0];
      }
    }
  }
  
  // Try generic pattern
  for (const pattern of ORDER_PATTERNS.generic) {
    const match = text.match(pattern);
    if (match) {
      return match[1] || match[0];
    }
  }
  
  return null;
}

/**
 * Detect order status from email content
 */
function detectOrderStatus(text: string): string {
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('wacht op betaling') || lowerText.includes('awaiting payment') || lowerText.includes('betaal nu')) {
    return 'AWAITING_PAYMENT';
  }
  if (lowerText.includes('betaling ontvangen') || lowerText.includes('payment received') || lowerText.includes('betaald')) {
    return 'PAID';
  }
  if (lowerText.includes('verzonden') || lowerText.includes('shipped') || lowerText.includes('onderweg')) {
    return 'SHIPPED';
  }
  if (lowerText.includes('afgeleverd') || lowerText.includes('delivered') || lowerText.includes('bezorgd')) {
    return 'DELIVERED';
  }
  if (lowerText.includes('geannuleerd') || lowerText.includes('cancelled') || lowerText.includes('canceled')) {
    return 'CANCELLED';
  }
  if (lowerText.includes('in behandeling') || lowerText.includes('processing') || lowerText.includes('wordt verwerkt')) {
    return 'PROCESSING';
  }
  
  return 'ORDERED';
}

/**
 * Extract structured data from original email (for local use only - contains PII)
 */
export function extractEmailData(email: RawEmail): ExtractedEmailData {
  const fullText = `${email.subject} ${email.body}`;
  const domain = extractDomain(email.from);
  const data: ExtractedEmailData = {};
  
  // Detect shop
  const shop = detectShop(domain);
  if (shop) {
    data.shopName = shop.name;
    data.orderNumber = extractOrderNumber(fullText, shop.key) || undefined;
  }
  
  // Detect carrier and tracking
  const carrier = detectCarrier(domain, fullText);
  if (carrier) {
    data.carrier = carrier.name;
    data.trackingNumber = carrier.trackingNumber;
  }
  
  // Detect order status
  const orderStatus = detectOrderStatus(fullText);
  data.orderStatus = orderStatus;
  
  // Check if paid
  const lowerText = fullText.toLowerCase();
  data.isPaid = lowerText.includes('betaald') || 
                lowerText.includes('paid') || 
                lowerText.includes('betaling ontvangen') ||
                lowerText.includes('payment received');
  
  // Extract amounts
  const amountMatch = fullText.match(/[€$]\s*(\d+[.,]\d{2})/);
  if (amountMatch) {
    data.amount = parseFloat(amountMatch[1].replace(',', '.'));
    data.currency = amountMatch[0].includes('€') ? 'EUR' : 'USD';
    data.orderAmount = data.amount;
  }
  
  // Extract invoice number
  const invoiceMatch = fullText.match(/(?:factuur|invoice)[:\s#]*([A-Z0-9-]+)/i);
  if (invoiceMatch) {
    data.invoiceNumber = invoiceMatch[1];
  }
  
  // Extract vendor (for invoices)
  if (!data.shopName) {
    // Try to get company name from domain
    const domainParts = domain.split('.');
    if (domainParts.length > 0) {
      data.vendor = domainParts[0].charAt(0).toUpperCase() + domainParts[0].slice(1);
    }
  }
  
  // Extract dates
  const datePatterns = [
    /(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/,
    /(\d{1,2}\s+(?:jan|feb|mrt|apr|mei|jun|jul|aug|sep|okt|nov|dec)[a-z]*\s+\d{4})/i
  ];
  
  for (const pattern of datePatterns) {
    const match = fullText.match(pattern);
    if (match) {
      // Could be delivery date, due date, or event date depending on context
      if (lowerText.includes('levering') || lowerText.includes('delivery') || lowerText.includes('bezorg')) {
        data.expectedDelivery = match[1];
      } else if (lowerText.includes('verval') || lowerText.includes('due')) {
        data.dueDate = match[1];
      } else if (lowerText.includes('afspraak') || lowerText.includes('meeting') || lowerText.includes('event')) {
        data.eventDate = match[1];
      }
      break;
    }
  }
  
  // Extract event details
  const timeMatch = fullText.match(/(\d{1,2}[:.]\d{2})\s*(?:uur|u|h)?/i);
  if (timeMatch) {
    data.eventTime = timeMatch[1];
  }
  
  const locationMatch = fullText.match(/(?:locatie|location|adres|address)[:\s]*([^\n,]+)/i);
  if (locationMatch) {
    data.eventLocation = locationMatch[1].trim();
  }
  
  // Extract product name for orders
  const productMatch = fullText.match(/(?:product|artikel|item)[:\s]*([^\n]+)/i);
  if (productMatch) {
    data.productName = productMatch[1].trim().substring(0, 100);
  }
  
  // Extract task description
  if (lowerText.includes('verzoek') || lowerText.includes('request') || lowerText.includes('graag')) {
    const lines = fullText.split('\n').filter(l => l.trim());
    if (lines.length > 0) {
      data.taskDescription = lines[0].substring(0, 200);
    }
  }
  
  return data;
}

/**
 * Check if email is likely an order confirmation
 */
export function isOrderEmail(email: RawEmail): boolean {
  const domain = extractDomain(email.from);
  const fullText = `${email.subject} ${email.body}`.toLowerCase();
  
  // Check if from known shop
  const shop = detectShop(domain);
  if (shop) {
    // Check for order keywords
    const orderKeywords = ['bestelling', 'order', 'bevestiging', 'confirmation', 'bedankt voor'];
    return orderKeywords.some(kw => fullText.includes(kw));
  }
  
  // Check for generic order patterns
  const orderPatterns = [
    /bedankt voor je bestelling/i,
    /thank you for your order/i,
    /bestelbevestiging/i,
    /order confirm/i,
    /je bestelling.*ontvangen/i
  ];
  
  return orderPatterns.some(p => p.test(fullText));
}

/**
 * Check if email is a shipment notification (different from order)
 */
export function isShipmentEmail(email: RawEmail): boolean {
  const fullText = `${email.subject} ${email.body}`.toLowerCase();
  
  const shipmentKeywords = [
    'verzonden', 'shipped', 'onderweg', 'tracking', 
    'volg je pakket', 'track your', 'bezorging'
  ];
  
  return shipmentKeywords.some(kw => fullText.includes(kw));
}
