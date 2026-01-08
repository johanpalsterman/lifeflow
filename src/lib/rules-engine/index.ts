// src/lib/rules-engine/index.ts - VERVANG VOLLEDIG
// LifeFlow AI Rules Engine - Main Export

// Types
export * from '../../types/rules';

// Core modules
export { 
  anonymizeEmail, 
  anonymizeEmails, 
  extractEmailData,
  isOrderEmail,
  isShipmentEmail
} from './email-anonymizer';

export { 
  classifyEmailWithTrustAI, 
  classifyEmailLocally, 
  classifyEmailsBatch,
  testTrustAIConnection 
} from './trustai-client';

export { 
  shouldTrigger, 
  executeAction, 
  executeMatchingRules 
} from './rule-executor';

export { 
  fetchGmailEmails, 
  markAsRead, 
  addLabel, 
  getGmailProfile, 
  refreshAccessToken 
} from './gmail-client';

export { 
  processNewEmails, 
  testEmailProcessing, 
  getProcessingStats 
} from './email-processor';
