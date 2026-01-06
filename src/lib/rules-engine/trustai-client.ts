// LifeFlow AI Rules Engine - TrustAI Client
// Integreert met TrustAI Gateway voor privacy-first AI processing

import type { 
  AnonymizedEmail, 
  EmailClassification, 
  EmailCategory,
  ExtractedEmailData 
} from '../types/rules';

const TRUSTAI_URL = process.env.TRUSTAI_URL || 'https://trustai.wishflow.be/api';
const TRUSTAI_API_KEY = process.env.TRUSTAI_API_KEY || '';

// Fallback classificatie wanneer TrustAI niet beschikbaar is
const KEYWORD_RULES: Record<string, EmailCategory> = {
  'invoice:': 'invoice',
  'delivery:': 'delivery',
  'carrier:': 'delivery',
  'event:': 'event',
  'task:': 'task',
  'newsletter:': 'newsletter',
};

// Bekende domeinen per categorie
const DOMAIN_CATEGORIES: Record<string, EmailCategory> = {
  // Delivery
  'postnl.nl': 'delivery',
  'dhl.com': 'delivery',
  'dpd.nl': 'delivery',
  'ups.com': 'delivery',
  'gls-group.eu': 'delivery',
  'bol.com': 'delivery',
  'amazon.com': 'delivery',
  'amazon.nl': 'delivery',
  'coolblue.nl': 'delivery',
  'zalando.nl': 'delivery',
  
  // Invoices
  'mollie.com': 'invoice',
  'stripe.com': 'invoice',
  'paypal.com': 'invoice',
  'ing.nl': 'invoice',
  'rabobank.nl': 'invoice',
  'abnamro.nl': 'invoice',
  
  // Newsletter
  'mailchimp.com': 'newsletter',
  'sendgrid.net': 'newsletter',
  'substack.com': 'newsletter',
};

/**
 * Classificeert email via TrustAI Gateway
 */
export async function classifyEmailWithTrustAI(
  anonymizedEmail: AnonymizedEmail
): Promise<EmailClassification> {
  
  // Probeer TrustAI eerst
  if (TRUSTAI_URL && TRUSTAI_API_KEY) {
    try {
      const response = await fetch(`${TRUSTAI_URL}/classify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TRUSTAI_API_KEY}`,
        },
        body: JSON.stringify({
          action: 'classify_email',
          data: anonymizedEmail,
          options: {
            includeReasoning: true,
            minConfidence: 0.6,
          },
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.classification) {
          return result.classification;
        }
      }
    } catch (error) {
      console.warn('TrustAI unavailable, falling back to local classification:', error);
    }
  }

  // Fallback naar lokale regel-gebaseerde classificatie
  return classifyEmailLocally(anonymizedEmail);
}

/**
 * Lokale classificatie als fallback (geen AI nodig)
 */
export function classifyEmailLocally(email: AnonymizedEmail): EmailClassification {
  const allTokens = [...email.subjectTokens, ...email.bodyTokens];
  const scores: Record<EmailCategory, number> = {
    invoice: 0,
    delivery: 0,
    event: 0,
    task: 0,
    newsletter: 0,
    spam: 0,
    personal: 0,
    unknown: 0,
  };

  // Score op basis van keywords
  for (const token of allTokens) {
    for (const [prefix, category] of Object.entries(KEYWORD_RULES)) {
      if (token.startsWith(prefix)) {
        scores[category] += 2;
      }
    }
    
    // Specifieke boosts
    if (token === 'has:amount_eur') scores.invoice += 3;
    if (token === 'has:tracking_code') scores.delivery += 3;
    if (token === 'has:date') {
      scores.event += 1;
      scores.task += 1;
    }
  }

  // Score op basis van domein
  const domainCategory = DOMAIN_CATEGORIES[email.fromDomain];
  if (domainCategory) {
    scores[domainCategory] += 5;
  }

  // Score op basis van attachments
  if (email.hasAttachments) {
    if (email.attachmentTypes.some(t => t.includes('pdf'))) {
      scores.invoice += 2;
    }
  }

  // Bepaal winnende categorie
  let maxScore = 0;
  let category: EmailCategory = 'unknown';
  
  for (const [cat, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      category = cat as EmailCategory;
    }
  }

  // Bereken confidence (genormaliseerd)
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const confidence = totalScore > 0 ? Math.min(maxScore / totalScore + 0.3, 0.95) : 0.5;

  return {
    category,
    confidence,
    extractedData: extractDataFromTokens(allTokens, email),
    reasoning: `Local classification based on ${allTokens.length} tokens, domain: ${email.fromDomain}`,
  };
}

/**
 * Extraheert gestructureerde data uit tokens
 */
function extractDataFromTokens(
  tokens: string[], 
  email: AnonymizedEmail
): ExtractedEmailData {
  const data: ExtractedEmailData = {};

  // Carrier detectie
  const carrierToken = tokens.find(t => t.startsWith('carrier:'));
  if (carrierToken) {
    data.carrier = carrierToken.replace('carrier:', '');
  }

  // Check voor bedrag
  if (tokens.includes('has:amount_eur')) {
    data.currency = 'EUR';
  }

  // Check voor tracking
  if (tokens.includes('has:tracking_code')) {
    // Tracking nummer zelf wordt lokaal geëxtraheerd, niet via AI
  }

  return data;
}

/**
 * Batch classificatie van meerdere emails
 */
export async function classifyEmails(
  emails: AnonymizedEmail[]
): Promise<Map<string, EmailClassification>> {
  const results = new Map<string, EmailClassification>();

  // Process in parallel met rate limiting
  const batchSize = 5;
  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);
    const classifications = await Promise.all(
      batch.map(email => classifyEmailWithTrustAI(email))
    );
    
    batch.forEach((email, index) => {
      results.set(email.id, classifications[index]);
    });
  }

  return results;
}

/**
 * Test de TrustAI connectie
 */
export async function testTrustAIConnection(): Promise<boolean> {
  if (!TRUSTAI_URL) return false;
  
  try {
    const response = await fetch(`${TRUSTAI_URL}/health`, {
      headers: TRUSTAI_API_KEY ? { 'Authorization': `Bearer ${TRUSTAI_API_KEY}` } : {},
    });
    return response.ok;
  } catch {
    return false;
  }
}
