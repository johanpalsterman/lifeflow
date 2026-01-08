// src/lib/rules-engine/trustai-client.ts - VERVANG VOLLEDIG
// TrustAI Gateway client for AI-powered email classification

import { 
  AnonymizedEmail, 
  EmailClassification, 
  EmailCategory,
  KNOWN_SHOPS 
} from '../../types/rules';

const TRUSTAI_URL = process.env.TRUSTAI_URL || 'https://trustai.wishflow.be/api';
const TRUSTAI_API_KEY = process.env.TRUSTAI_API_KEY;

// ===========================================
// DOMAIN SCORING
// ===========================================

// Domains strongly associated with specific categories
const DOMAIN_CATEGORY_HINTS: Record<string, EmailCategory> = {
  // Delivery/shipping
  'postnl.nl': 'delivery',
  'postnl.post': 'delivery',
  'dhl.com': 'delivery',
  'dhl.nl': 'delivery',
  'dhlparcel.nl': 'delivery',
  'ups.com': 'delivery',
  'dpd.nl': 'delivery',
  'gls-group.eu': 'delivery',
  'fedex.com': 'delivery',
  
  // Invoices/billing
  'mollie.com': 'invoice',
  'stripe.com': 'invoice',
  'paypal.com': 'invoice',
  'ing.nl': 'invoice',
  'rabobank.nl': 'invoice',
  'abn.nl': 'invoice',
  'billit.be': 'invoice',
  'peppol.eu': 'invoice',
  
  // Events/calendar
  'calendly.com': 'event',
  'eventbrite.com': 'event',
  'meetup.com': 'event',
  
  // Tasks/productivity
  'asana.com': 'task',
  'trello.com': 'task',
  'notion.so': 'task',
  'todoist.com': 'task',
  
  // Newsletters
  'mailchimp.com': 'newsletter',
  'sendgrid.net': 'newsletter',
  'substack.com': 'newsletter',
};

// Add shop domains as order hints
for (const shop of Object.values(KNOWN_SHOPS)) {
  for (const domain of shop.domains) {
    DOMAIN_CATEGORY_HINTS[domain] = 'order';
  }
}

// ===========================================
// KEYWORD SCORING
// ===========================================

const KEYWORD_SCORES: Record<EmailCategory, Record<string, number>> = {
  invoice: {
    'factuur': 10, 'invoice': 10, 'rekening': 8, 'betaling': 7,
    'payment': 7, 'bedrag': 6, 'btw': 8, 'vat': 8, 'totaal': 5,
    'te betalen': 9, 'vervaldatum': 8, 'incasso': 7
  },
  delivery: {
    'verzonden': 10, 'shipped': 10, 'onderweg': 9, 'tracking': 10,
    'pakket': 8, 'package': 8, 'bezorgd': 9, 'delivered': 9,
    'levering': 7, 'koerier': 8, 'afhaalpunt': 9, 'volg je pakket': 10
  },
  order: {
    'bestelling': 10, 'order': 8, 'besteld': 9, 'bevestiging': 7,
    'winkelwagen': 8, 'aankoop': 8, 'purchase': 8, 'betaal nu': 9,
    'wacht op betaling': 10, 'bestelbevestiging': 10, 'in behandeling': 8,
    'wordt verwerkt': 8, 'bedankt voor je bestelling': 10
  },
  event: {
    'afspraak': 10, 'appointment': 10, 'meeting': 9, 'vergadering': 9,
    'uitnodiging': 8, 'invitation': 8, 'agenda': 7, 'datum': 5,
    'locatie': 6, 'reservering': 8, 'booking': 8
  },
  task: {
    'actie': 7, 'todo': 9, 'taak': 9, 'task': 9, 'verzoek': 8,
    'request': 8, 'deadline': 9, 'urgent': 10, 'belangrijk': 7,
    'opvolging': 8, 'follow-up': 8, 'graag': 6, 'kun je': 7
  },
  newsletter: {
    'nieuwsbrief': 10, 'newsletter': 10, 'uitschrijven': 9,
    'unsubscribe': 9, 'aanbieding': 7, 'korting': 7, 'promo': 8
  },
  spam: {
    'won': 8, 'winner': 9, 'lottery': 10, 'prize': 9, 'gratis': 6,
    'click here': 8, 'limited time': 8, 'act now': 9
  },
  personal: {
    'hoi': 7, 'hey': 6, 'hallo': 5, 'groeten': 7, 'bedankt': 5,
    'fijn weekend': 9, 'tot snel': 8, 'liefs': 9
  },
  unknown: {}
};

// ===========================================
// LOCAL CLASSIFICATION
// ===========================================

/**
 * Classify email locally without AI (fallback)
 */
export function classifyEmailLocally(email: AnonymizedEmail): EmailClassification {
  const scores: Record<EmailCategory, number> = {
    invoice: 0,
    delivery: 0,
    order: 0,
    event: 0,
    task: 0,
    newsletter: 0,
    spam: 0,
    personal: 0,
    unknown: 0
  };
  
  // Domain-based scoring (high weight)
  const domainCategory = DOMAIN_CATEGORY_HINTS[email.fromDomain];
  if (domainCategory) {
    scores[domainCategory] += 30;
  }
  
  // Check if domain contains known shop name
  for (const shop of Object.values(KNOWN_SHOPS)) {
    if (shop.domains.some(d => email.fromDomain.includes(d) || d.includes(email.fromDomain))) {
      scores.order += 25;
      break;
    }
  }
  
  // Keyword scoring for subject
  const allTokens = [...email.subjectTokens, ...email.bodyTokens];
  
  for (const [category, keywords] of Object.entries(KEYWORD_SCORES)) {
    for (const token of allTokens) {
      const score = keywords[token.toLowerCase()];
      if (score) {
        scores[category as EmailCategory] += score;
      }
    }
  }
  
  // Differentiate between order and delivery
  // If we have both, check which keywords are stronger
  if (scores.order > 0 && scores.delivery > 0) {
    const deliveryKeywords = ['verzonden', 'shipped', 'tracking', 'onderweg', 'bezorgd'];
    const orderKeywords = ['bestelling', 'bevestiging', 'betaal', 'wacht op'];
    
    const hasDeliveryKeywords = allTokens.some(t => deliveryKeywords.includes(t.toLowerCase()));
    const hasOrderKeywords = allTokens.some(t => orderKeywords.some(k => t.toLowerCase().includes(k)));
    
    if (hasDeliveryKeywords && !hasOrderKeywords) {
      scores.delivery += 15;
    } else if (hasOrderKeywords && !hasDeliveryKeywords) {
      scores.order += 15;
    }
  }
  
  // Find highest scoring category
  let maxScore = 0;
  let bestCategory: EmailCategory = 'unknown';
  
  for (const [category, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      bestCategory = category as EmailCategory;
    }
  }
  
  // Calculate confidence (0-1)
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const confidence = totalScore > 0 ? Math.min(maxScore / totalScore + 0.3, 0.95) : 0.1;
  
  return {
    category: bestCategory,
    confidence,
    extractedData: {},
    reasoning: `Local classification based on ${allTokens.length} tokens, domain: ${email.fromDomain}`
  };
}

// ===========================================
// TRUSTAI CLASSIFICATION
// ===========================================

/**
 * Classify email using TrustAI Gateway
 */
export async function classifyEmailWithTrustAI(email: AnonymizedEmail): Promise<EmailClassification> {
  // If no API key or URL, fall back to local
  if (!TRUSTAI_API_KEY || !TRUSTAI_URL) {
    console.log('TrustAI not configured, using local classification');
    return classifyEmailLocally(email);
  }
  
  try {
    const prompt = `Classify this email into one of these categories:
- invoice: Bills, payments, financial documents
- delivery: Package shipments, tracking updates
- order: Order confirmations, purchase receipts (NOT yet shipped)
- event: Appointments, meetings, calendar items
- task: Action requests, to-do items
- newsletter: Marketing, promotional content
- spam: Unwanted, suspicious emails
- personal: Personal correspondence
- unknown: Cannot determine

Email data:
- From domain: ${email.fromDomain}
- Subject keywords: ${email.subjectTokens.join(', ')}
- Body keywords: ${email.bodyTokens.join(', ')}
- Has attachments: ${email.hasAttachments}
- Attachment types: ${email.attachmentTypes.join(', ')}

IMPORTANT: Distinguish between 'order' (new purchase, not yet shipped) and 'delivery' (package in transit or delivered).

Respond with JSON only:
{
  "category": "category_name",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`;

    const response = await fetch(`${TRUSTAI_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TRUSTAI_API_KEY}`
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        model: 'claude-3-haiku',
        max_tokens: 200,
        temperature: 0.1
      })
    });

    if (!response.ok) {
      console.error('TrustAI error:', response.status);
      return classifyEmailLocally(email);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || result.content;
    
    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        category: parsed.category as EmailCategory,
        confidence: parsed.confidence || 0.8,
        extractedData: {},
        reasoning: parsed.reasoning || 'TrustAI classification'
      };
    }
    
    // Fallback to local if parsing fails
    return classifyEmailLocally(email);
    
  } catch (error) {
    console.error('TrustAI classification error:', error);
    return classifyEmailLocally(email);
  }
}

/**
 * Test TrustAI connection
 */
export async function testTrustAIConnection(): Promise<{ connected: boolean; error?: string }> {
  if (!TRUSTAI_API_KEY || !TRUSTAI_URL) {
    return { connected: false, error: 'TrustAI not configured' };
  }
  
  try {
    const response = await fetch(`${TRUSTAI_URL}/health`, {
      headers: { 'Authorization': `Bearer ${TRUSTAI_API_KEY}` }
    });
    
    return { connected: response.ok };
  } catch (error) {
    return { connected: false, error: String(error) };
  }
}

/**
 * Batch classify emails (with rate limiting)
 */
export async function classifyEmailsBatch(
  emails: AnonymizedEmail[],
  useTrustAI: boolean = true
): Promise<Map<string, EmailClassification>> {
  const results = new Map<string, EmailClassification>();
  
  // Process in parallel with limit of 5 concurrent
  const batchSize = 5;
  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);
    const promises = batch.map(async (email) => {
      const classification = useTrustAI 
        ? await classifyEmailWithTrustAI(email)
        : classifyEmailLocally(email);
      return { id: email.id, classification };
    });
    
    const batchResults = await Promise.all(promises);
    for (const { id, classification } of batchResults) {
      results.set(id, classification);
    }
    
    // Small delay between batches to avoid rate limiting
    if (i + batchSize < emails.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return results;
}
