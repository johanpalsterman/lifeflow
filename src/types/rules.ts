// src/types/rules.ts - VERVANG VOLLEDIG
// LifeFlow AI Rules Engine - Type Definitions

// ===========================================
// TRIGGER TYPES
// ===========================================

export type TriggerType = 'email' | 'schedule' | 'manual' | 'webhook';

export type EmailCategory = 
  | 'invoice'      // Facturen
  | 'delivery'     // Pakket verzendingen
  | 'order'        // Bestellingen (NIEUW!)
  | 'event'        // Afspraken/events
  | 'task'         // Taken/verzoeken
  | 'newsletter'   // Nieuwsbrieven
  | 'spam'         // Spam/promoties
  | 'personal'     // Persoonlijke emails
  | 'unknown';     // Niet geclassificeerd

export interface EmailTrigger {
  type: 'email';
  conditions?: TriggerCondition[];
  category?: EmailCategory;
}

export interface ScheduleTrigger {
  type: 'schedule';
  cron: string; // Cron expression
}

export interface ManualTrigger {
  type: 'manual';
}

export interface WebhookTrigger {
  type: 'webhook';
  endpoint: string;
}

export type Trigger = EmailTrigger | ScheduleTrigger | ManualTrigger | WebhookTrigger;

// ===========================================
// TRIGGER CONDITIONS
// ===========================================

export type ConditionOperator = 
  | 'contains' 
  | 'equals' 
  | 'starts_with' 
  | 'ends_with' 
  | 'regex'
  | 'not_contains';

export interface TriggerCondition {
  field: 'from' | 'to' | 'subject' | 'body' | 'category' | 'domain';
  operator: ConditionOperator;
  value: string;
}

// ===========================================
// ACTION TYPES
// ===========================================

export type ActionType = 
  | 'create_task'
  | 'create_event'
  | 'record_invoice'
  | 'track_package'
  | 'track_order'      // NIEUW!
  | 'send_notification'
  | 'webhook';

export interface CreateTaskAction {
  type: 'create_task';
  params?: {
    priority?: 'low' | 'medium' | 'high';
    dueInDays?: number;
    tags?: string[];
  };
}

export interface CreateEventAction {
  type: 'create_event';
  params?: {
    calendarId?: string;
    reminder?: number; // minutes before
  };
}

export interface RecordInvoiceAction {
  type: 'record_invoice';
  params?: {
    category?: string;
    autoApprove?: boolean;
  };
}

export interface TrackPackageAction {
  type: 'track_package';
  params?: {
    notifyOnDelivery?: boolean;
  };
}

// NIEUW: Track Order Action
export interface TrackOrderAction {
  type: 'track_order';
  params?: {
    autoLinkToPackage?: boolean;  // Link automatisch aan pakket als verzonden
    reminderDays?: number;        // Herinnering na X dagen als niet verzonden
    notifyOnShipment?: boolean;   // Notificatie als bestelling verzonden wordt
  };
}

export interface SendNotificationAction {
  type: 'send_notification';
  params: {
    channel: 'email' | 'push' | 'sms';
    template?: string;
  };
}

export interface WebhookAction {
  type: 'webhook';
  params: {
    url: string;
    method?: 'GET' | 'POST' | 'PUT';
    headers?: Record<string, string>;
  };
}

export type Action = 
  | CreateTaskAction 
  | CreateEventAction 
  | RecordInvoiceAction 
  | TrackPackageAction
  | TrackOrderAction      // NIEUW!
  | SendNotificationAction 
  | WebhookAction;

// ===========================================
// RULE DEFINITION
// ===========================================

export interface AIRule {
  id: string;
  userId: string;
  name: string;
  description?: string;
  trigger: Trigger;
  action: Action;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RuleExecutionResult {
  ruleId: string;
  ruleName: string;
  triggered: boolean;
  actionExecuted: boolean;
  result?: any;
  error?: string;
  timestamp: Date;
}

// ===========================================
// EMAIL PROCESSING
// ===========================================

export interface RawEmail {
  id: string;
  threadId?: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  date: Date;
  attachments?: EmailAttachment[];
  labels?: string[];
}

export interface EmailAttachment {
  filename: string;
  mimeType: string;
  size: number;
}

export interface AnonymizedEmail {
  id: string;
  fromDomain: string;        // alleen domein, geen naam/email
  subjectTokens: string[];   // keywords zonder PII
  bodyTokens: string[];      // keywords zonder PII
  attachmentTypes: string[]; // alleen mime types
  hasAttachments: boolean;
  dateInfo: {
    dayOfWeek: number;
    hourOfDay: number;
    isWeekend: boolean;
  };
}

export interface EmailClassification {
  category: EmailCategory;
  confidence: number;
  extractedData: ExtractedEmailData;
  reasoning?: string;
}

export interface ExtractedEmailData {
  // Voor facturen
  invoiceNumber?: string;
  amount?: number;
  currency?: string;
  dueDate?: string;
  vendor?: string;
  
  // Voor pakketten
  trackingNumber?: string;
  carrier?: string;
  expectedDelivery?: string;
  
  // Voor bestellingen (NIEUW!)
  orderNumber?: string;
  shopName?: string;
  productName?: string;
  orderStatus?: string;
  orderAmount?: number;
  isPaid?: boolean;
  
  // Voor events
  eventDate?: string;
  eventTime?: string;
  eventLocation?: string;
  eventTitle?: string;
  
  // Voor taken
  taskDescription?: string;
  taskDeadline?: string;
  taskPriority?: string;
}

// ===========================================
// PROCESSING RESULTS
// ===========================================

export interface ProcessedEmail {
  id: string;
  emailId: string;
  classification: EmailClassification;
  rulesExecuted: RuleExecutionResult[];
  processedAt: Date;
}

export interface ProcessingBatchResult {
  processed: number;
  success: number;
  errors: number;
  skipped: number;
  results: ProcessedEmail[];
  createdRecords: {
    tasks: number;
    events: number;
    invoices: number;
    packages: number;
    orders: number;    // NIEUW!
  };
}

// ===========================================
// ORDER TYPES (NIEUW!)
// ===========================================

export type OrderStatus = 
  | 'ORDERED'
  | 'AWAITING_PAYMENT'
  | 'PAID'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'RETURNED';

export interface Order {
  id: string;
  userId: string;
  shopName: string;
  orderNumber?: string;
  productName?: string;
  status: OrderStatus;
  amount?: number;
  currency: string;
  isPaid: boolean;
  orderDate: Date;
  expectedDate?: Date;
  shippedDate?: Date;
  deliveredDate?: Date;
  trackingNumber?: string;
  packageId?: string;
  sourceEmailId?: string;
  notes?: string;
  reminderSent: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ===========================================
// KNOWN SHOPS (voor order detectie)
// ===========================================

export const KNOWN_SHOPS: Record<string, { name: string; domains: string[] }> = {
  aliexpress: {
    name: 'AliExpress',
    domains: ['aliexpress.com', 'mail.aliexpress.com', 'alimail.alibaba.com']
  },
  amazon: {
    name: 'Amazon',
    domains: ['amazon.nl', 'amazon.de', 'amazon.com', 'amazon.co.uk', 'amazon.fr']
  },
  bol: {
    name: 'Bol.com',
    domains: ['bol.com', 'mail.bol.com']
  },
  coolblue: {
    name: 'Coolblue',
    domains: ['coolblue.nl', 'coolblue.be']
  },
  mediamarkt: {
    name: 'MediaMarkt',
    domains: ['mediamarkt.nl', 'mediamarkt.be', 'mediamarkt.de']
  },
  zalando: {
    name: 'Zalando',
    domains: ['zalando.nl', 'zalando.be', 'zalando.de']
  },
  hm: {
    name: 'H&M',
    domains: ['hm.com', 'email.hm.com']
  },
  banggood: {
    name: 'Banggood',
    domains: ['banggood.com', 'email.banggood.com']
  },
  wish: {
    name: 'Wish',
    domains: ['wish.com', 'email.wish.com']
  },
  temu: {
    name: 'Temu',
    domains: ['temu.com', 'mail.temu.com']
  },
  shein: {
    name: 'Shein',
    domains: ['shein.com', 'sheinmail.com']
  },
  ikea: {
    name: 'IKEA',
    domains: ['ikea.com', 'ikea.nl', 'ikea.be']
  },
  action: {
    name: 'Action',
    domains: ['action.nl', 'action.be']
  },
  kruidvat: {
    name: 'Kruidvat',
    domains: ['kruidvat.nl', 'kruidvat.be']
  },
  wehkamp: {
    name: 'Wehkamp',
    domains: ['wehkamp.nl']
  },
  fonq: {
    name: 'Fonq',
    domains: ['fonq.nl', 'fonq.be']
  }
};
