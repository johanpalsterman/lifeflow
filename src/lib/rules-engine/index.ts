// LifeFlow AI Rules Engine - Main Export
// src/lib/rules-engine/index.ts

// Types
export * from '../types/rules';

// Core modules
export { anonymizeEmail, anonymizeEmails, extractEmailData } from './email-anonymizer';
export { classifyEmailWithTrustAI, classifyEmailLocally, testTrustAIConnection } from './trustai-client';
export { shouldTrigger, executeAction, executeMatchingRules } from './rule-executor';
export { fetchGmailEmails, markAsRead, addLabel, getGmailProfile, refreshAccessToken } from './gmail-client';
export { processNewEmails, testEmailProcessing, getProcessingStats } from './email-processor';
