// LifeFlow AI Rules Engine - Email Anonymizer
// Privacy-first: verwijdert PII voordat data naar AI gaat

import type { EmailData, AnonymizedEmail } from '../types/rules';

// PII patronen die verwijderd moeten worden
const PII_PATTERNS = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  phone: /(\+?[0-9]{1,4}[-.\s]?)?(\(?\d{2,4}\)?[-.\s]?)?\d{2,4}[-.\s]?\d{2,4}[-.\s]?\d{0,4}/g,
  iban: /[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}([A-Z0-9]?){0,16}/gi,
  creditCard: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
  bsn: /\b\d{9}\b/g, // Nederlands BSN
  postalCode: /\b\d{4}\s?[A-Z]{2}\b/gi, // NL postcode
  streetAddress: /\b\d+\s+[\w\s]+(?:straat|laan|weg|plein|dreef|singel|gracht|kade)\b/gi,
  name: /\b(?:dhr\.|mevr\.|mr\.|mrs\.|de heer|mevrouw)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g,
};

// Keywords die relevant zijn voor categorisatie (behouden)
const RELEVANT_KEYWORDS = {
  invoice: ['factuur', 'invoice', 'betaling', 'payment', 'bedrag', 'amount', 'btw', 'vat', 'rekening', 'bill'],
  delivery: ['pakket', 'package', 'bezorging', 'delivery', 'tracking', 'verzending', 'shipment', 'PostNL', 'DHL', 'DPD', 'UPS', 'GLS', 'Bol.com', 'Amazon', 'Coolblue'],
  event: ['uitnodiging', 'invitation', 'afspraak', 'appointment', 'meeting', 'vergadering', 'agenda', 'calendar', 'datum', 'date', 'tijd', 'time', 'locatie', 'location'],
  task: ['verzoek', 'request', 'actie', 'action', 'todo', 'taak', 'task', 'deadline', 'dringend', 'urgent', 'asap', 'graag', 'please'],
  newsletter: ['nieuwsbrief', 'newsletter', 'unsubscribe', 'uitschrijven', 'update', 'digest'],
};

// Carriers voor pakket tracking
const CARRIERS = ['PostNL', 'DHL', 'DPD', 'UPS', 'GLS', 'FedEx', 'TNT', 'Bol.com', 'Amazon', 'Coolblue', 'Zalando'];

/**
 * Extraheert alleen het domein uit een email adres
 */
function extractDomain(email: string): string {
  const match = email.match(/@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  return match ? match[1].toLowerCase() : 'unknown';
}

/**
 * Verwijdert alle PII uit tekst
 */
function removePII(text: string): string {
  let cleaned = text;
  
  for (const pattern of Object.values(PII_PATTERNS)) {
    cleaned = cleaned.replace(pattern, '[REMOVED]');
  }
  
  return cleaned;
}

/**
 * Extraheert relevante keywords uit tekst (zonder PII)
 */
function extractKeywords(text: string): string[] {
  const cleanedText = removePII(text.toLowerCase());
  const keywords: string[] = [];
  
  // Check voor relevante keywords per categorie
  for (const [category, words] of Object.entries(RELEVANT_KEYWORDS)) {
    for (const word of words) {
      if (cleanedText.includes(word.toLowerCase())) {
        keywords.push(`${category}:${word}`);
      }
    }
  }
  
  // Check voor carriers
  for (const carrier of CARRIERS) {
    if (cleanedText.includes(carrier.toLowerCase())) {
      keywords.push(`carrier:${carrier}`);
    }
  }
  
  // Bedragen detecteren (zonder de exacte waarden)
  if (/€\s*\d+[.,]?\d*/.test(text) || /EUR\s*\d+[.,]?\d*/.test(text)) {
    keywords.push('has:amount_eur');
  }
  
  // Tracking nummers detecteren (zonder de waarde)
  if (/\b[A-Z0-9]{10,30}\b/.test(text)) {
    keywords.push('has:tracking_code');
  }
  
  // Datums detecteren
  if (/\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/.test(text) || /\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(text)) {
    keywords.push('has:date');
  }
  
  return [...new Set(keywords)]; // Deduplicate
}

/**
 * Anonimiseert een email voor veilige AI processing
 */
export function anonymizeEmail(email: EmailData): AnonymizedEmail {
  const date = new Date(email.date);
  
  return {
    id: email.id,
    fromDomain: extractDomain(email.from),
    subjectTokens: extractKeywords(email.subject),
    bodyTokens: extractKeywords(email.body),
    hasAttachments: (email.attachments?.length ?? 0) > 0,
    attachmentTypes: email.attachments?.map(a => a.mimeType) ?? [],
    dateInfo: {
      dayOfWeek: date.getDay(),
      hourOfDay: date.getHours(),
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
    },
  };
}

/**
 * Extraheert specifieke data uit email (met PII, alleen voor lokale opslag)
 * Deze functie wordt ALLEEN lokaal gebruikt, nooit naar AI gestuurd
 */
export function extractEmailData(email: EmailData): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  const text = `${email.subject} ${email.body}`;
  
  // Bedrag extractie
  const amountMatch = text.match(/€\s*(\d+[.,]?\d*)/);
  if (amountMatch) {
    data.amount = parseFloat(amountMatch[1].replace(',', '.'));
    data.currency = 'EUR';
  }
  
  // Tracking nummer extractie
  const trackingPatterns = [
    /\b(3S[A-Z0-9]{10,18})\b/i,      // PostNL
    /\b(\d{10,20})\b/,                // DHL/DPD
    /\b(1Z[A-Z0-9]{16})\b/i,          // UPS
    /\b(JJD\d{18,22})\b/i,            // GLS
  ];
  
  for (const pattern of trackingPatterns) {
    const match = text.match(pattern);
    if (match) {
      data.trackingNumber = match[1];
      break;
    }
  }
  
  // Carrier detectie
  for (const carrier of CARRIERS) {
    if (text.toLowerCase().includes(carrier.toLowerCase())) {
      data.carrier = carrier;
      break;
    }
  }
  
  // Datum extractie (eerste datum in tekst)
  const datePatterns = [
    /(\d{1,2})[-/](\d{1,2})[-/](\d{4})/,  // DD-MM-YYYY
    /(\d{4})[-/](\d{1,2})[-/](\d{1,2})/,  // YYYY-MM-DD
  ];
  
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      data.extractedDate = match[0];
      break;
    }
  }
  
  // Tijd extractie
  const timeMatch = text.match(/(\d{1,2})[:.h](\d{2})(?:\s*(?:uur|u|h))?/i);
  if (timeMatch) {
    data.extractedTime = `${timeMatch[1]}:${timeMatch[2]}`;
  }
  
  return data;
}

/**
 * Batch anonimiseer meerdere emails
 */
export function anonymizeEmails(emails: EmailData[]): AnonymizedEmail[] {
  return emails.map(anonymizeEmail);
}
