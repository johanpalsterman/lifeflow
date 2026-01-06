// LifeFlow AI Rules Engine - Type Definitions
// Onderdeel van WishFlow Suite

export type TriggerType = 'email' | 'schedule' | 'manual' | 'webhook';
export type EmailCategory = 'invoice' | 'delivery' | 'event' | 'task' | 'newsletter' | 'spam' | 'personal' | 'unknown';
export type ActionType = 'create_task' | 'create_event' | 'record_invoice' | 'track_package' | 'send_notification' | 'webhook';

// Trigger configuratie
export interface RuleTrigger {
  type: TriggerType;
  category?: EmailCategory;
  conditions?: TriggerCondition[];
}

export interface TriggerCondition {
  field: 'from' | 'to' | 'subject' | 'body' | 'date';
  operator: 'contains' | 'equals' | 'starts_with' | 'ends_with' | 'regex' | 'not_contains';
  value: string;
  caseSensitive?: boolean;
}

// Action configuratie
export interface RuleAction {
  type: ActionType;
  params?: Record<string, unknown>;
  notifyUser?: boolean;
}

// Email data (geanonimiseerd voor TrustAI)
export interface EmailData {
  id: string;
  threadId: string;
  from: string;
  to: string[];
  subject: string;
  body: string;
  bodyHtml?: string;
  date: Date;
  labels?: string[];
  attachments?: AttachmentInfo[];
}

export interface AttachmentInfo {
  filename: string;
  mimeType: string;
  size: number;
}

// Geanonimiseerde versie voor AI processing
export interface AnonymizedEmail {
  id: string;
  fromDomain: string;        // alleen domein, geen naam/email
  subjectTokens: string[];   // keywords zonder PII
  bodyTokens: string[];      // keywords zonder PII
  hasAttachments: boolean;
  attachmentTypes: string[];
  dateInfo: {
    dayOfWeek: number;
    hourOfDay: number;
    isWeekend: boolean;
  };
}

// AI Classificatie resultaat
export interface EmailClassification {
  category: EmailCategory;
  confidence: number;
  extractedData: ExtractedEmailData;
  reasoning?: string;
}

export interface ExtractedEmailData {
  // Voor facturen
  amount?: number;
  currency?: string;
  dueDate?: string;
  invoiceNumber?: string;
  
  // Voor pakket tracking
  trackingNumber?: string;
  carrier?: string;
  expectedDelivery?: string;
  
  // Voor events
  eventTitle?: string;
  eventDate?: string;
  eventTime?: string;
  eventLocation?: string;
  
  // Voor taken
  taskTitle?: string;
  taskPriority?: 'low' | 'medium' | 'high';
  taskDueDate?: string;
  
  // Algemeen
  senderName?: string;
  companyName?: string;
}

// Rule execution result
export interface RuleExecutionResult {
  ruleId: string;
  ruleName: string;
  triggered: boolean;
  actionExecuted: boolean;
  actionType?: ActionType;
  createdRecordId?: string;
  error?: string;
  timestamp: Date;
}

// Batch processing result
export interface ProcessingBatchResult {
  processedCount: number;
  successCount: number;
  errorCount: number;
  skippedCount: number;
  results: EmailProcessingResult[];
  startTime: Date;
  endTime: Date;
}

export interface EmailProcessingResult {
  emailId: string;
  classification: EmailClassification;
  rulesExecuted: RuleExecutionResult[];
  error?: string;
}

// TrustAI integration
export interface TrustAIRequest {
  action: 'classify_email';
  data: AnonymizedEmail;
  options?: {
    includeReasoning?: boolean;
    minConfidence?: number;
  };
}

export interface TrustAIResponse {
  success: boolean;
  classification?: EmailClassification;
  error?: string;
  processingTime?: number;
}
