'use client';

import { useState, useEffect } from 'react';
import {
  Sun,
  Moon,
  Coffee,
  FileText,
  Package,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  ChevronRight,
  RefreshCw,
  Calendar,
  CreditCard,
  Truck,
  Bell,
  MoreVertical,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Sparkles,
  DollarSign,
  Box,
} from 'lucide-react';

interface DailyStandupData {
  date: Date;
  greeting: string;
  summary: {
    pendingInvoices: number;
    totalInvoiceAmount: number;
    overdueInvoices: number;
    deliveriesExpected: number;
    tasksToday: number;
    tasksDueSoon: number;
  };
  urgent: {
    overdueInvoices: InvoiceItem[];
    dueTodayInvoices: InvoiceItem[];
    deliveriesToday: DeliveryItem[];
  };
  upcoming: {
    invoices: InvoiceItem[];
    deliveries: DeliveryItem[];
  };
  completed: {
    paidInvoices: InvoiceItem[];
    receivedDeliveries: DeliveryItem[];
  };
  briefing: string;
  suggestions: string[];
}

interface InvoiceItem {
  id: string;
  vendor: string;
  amount: number;
  currency: string;
  dueDate: Date;
  invoiceNumber?: string;
  daysUntilDue: number;
  isOverdue: boolean;
  status: string;
  emailSubject: string;
}

interface DeliveryItem {
  id: string;
  vendor: string;
  orderNumber?: string;
  trackingNumber?: string;
  carrier?: string;
  expectedDelivery?: Date;
  status: string;
  items?: Array<{ name: string; quantity: number }>;
  daysUntilDelivery?: number;
  emailSubject: string;
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function DailyStandupPage() {
  const [standup, setStandup] = useState<DailyStandupData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadStandup();
  }, []);

  const loadStandup = async () => {
    try {
      const res = await fetch('/api/email-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_standup', userId: 'current-user' }),
      });
      const data = await res.json();
      if (data.success) {
        setStandup(data.data.standup);
      }
    } catch (error) {
      console.error('Failed to load standup:', error);
    }
    setLoading(false);
  };

  const refresh = async () => {
    setRefreshing(true);
    await loadStandup();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <GreetingIcon />
              Daily Standup
            </h1>
            <p className="text-slate-400 mt-1">
              {new Date().toLocaleDateString('nl-NL', { 
                weekday: 'long', 
                day: 'numeric', 
                month: 'long' 
              })}
            </p>
          </div>
          <button
            onClick={refresh}
            disabled={refreshing}
            className="p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* AI Briefing */}
        {standup?.briefing && (
          <div className="p-6 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-2xl border border-white/10">
            <div className="flex items-start gap-3">
              <Sparkles className="w-6 h-6 text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-lg">{standup.briefing}</p>
            </div>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4">
          <SummaryCard
            icon={FileText}
            label="Openstaand"
            value={standup?.summary.pendingInvoices || 0}
            subValue={`€${(standup?.summary.totalInvoiceAmount || 0).toFixed(0)}`}
            color="blue"
          />
          <SummaryCard
            icon={AlertTriangle}
            label="Verlopen"
            value={standup?.summary.overdueInvoices || 0}
            color="red"
            alert={standup?.summary.overdueInvoices ? standup.summary.overdueInvoices > 0 : false}
          />
          <SummaryCard
            icon={Package}
            label="Onderweg"
            value={standup?.summary.deliveriesExpected || 0}
            color="green"
          />
          <SummaryCard
            icon={Clock}
            label="Vandaag"
            value={standup?.summary.tasksToday || 0}
            subValue={`${standup?.summary.tasksDueSoon || 0} deze week`}
            color="yellow"
          />
        </div>

        {/* Urgent Section */}
        {(standup?.urgent.overdueInvoices.length || standup?.urgent.dueTodayInvoices.length || standup?.urgent.deliveriesToday.length) ? (
          <section>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              Vraagt Aandacht
            </h2>
            
            {/* Overdue Invoices */}
            {standup?.urgent.overdueInvoices.map(invoice => (
              <InvoiceCard key={invoice.id} invoice={invoice} urgent onAction={loadStandup} />
            ))}

            {/* Due Today */}
            {standup?.urgent.dueTodayInvoices.map(invoice => (
              <InvoiceCard key={invoice.id} invoice={invoice} onAction={loadStandup} />
            ))}

            {/* Deliveries Today */}
            {standup?.urgent.deliveriesToday.map(delivery => (
              <DeliveryCard key={delivery.id} delivery={delivery} today onAction={loadStandup} />
            ))}
          </section>
        ) : null}

        {/* Two Column Layout */}
        <div className="grid grid-cols-2 gap-6">
          {/* Upcoming Invoices */}
          <section className="bg-white/[0.02] rounded-2xl border border-white/5 p-4">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-400" />
              Komende Facturen
            </h2>
            
            {standup?.upcoming.invoices.length === 0 ? (
              <p className="text-slate-500 text-sm py-4 text-center">
                Geen facturen deze week 🎉
              </p>
            ) : (
              <div className="space-y-2">
                {standup?.upcoming.invoices.map(invoice => (
                  <InvoiceRow key={invoice.id} invoice={invoice} onAction={loadStandup} />
                ))}
              </div>
            )}
          </section>

          {/* Upcoming Deliveries */}
          <section className="bg-white/[0.02] rounded-2xl border border-white/5 p-4">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Truck className="w-5 h-5 text-green-400" />
              Verwachte Leveringen
            </h2>
            
            {standup?.upcoming.deliveries.length === 0 ? (
              <p className="text-slate-500 text-sm py-4 text-center">
                Geen leveringen verwacht
              </p>
            ) : (
              <div className="space-y-2">
                {standup?.upcoming.deliveries.map(delivery => (
                  <DeliveryRow key={delivery.id} delivery={delivery} onAction={loadStandup} />
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Suggestions */}
        {standup?.suggestions && standup.suggestions.length > 0 && (
          <section className="bg-white/[0.02] rounded-2xl border border-white/5 p-4">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-yellow-400" />
              Suggesties
            </h2>
            <div className="space-y-2">
              {standup.suggestions.map((suggestion, i) => (
                <p key={i} className="text-slate-300 text-sm py-2 border-b border-white/5 last:border-0">
                  {suggestion}
                </p>
              ))}
            </div>
          </section>
        )}

        {/* Recently Completed */}
        {(standup?.completed.paidInvoices.length || standup?.completed.receivedDeliveries.length) ? (
          <section className="opacity-60 hover:opacity-100 transition-opacity">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              Recent Afgerond
            </h2>
            
            <div className="grid grid-cols-2 gap-4">
              {standup?.completed.paidInvoices.slice(0, 3).map(invoice => (
                <div key={invoice.id} className="p-3 bg-white/[0.02] rounded-xl flex items-center justify-between">
                  <div>
                    <p className="font-medium">{invoice.vendor}</p>
                    <p className="text-xs text-slate-500">Betaald</p>
                  </div>
                  <span className="text-green-400">€{invoice.amount.toFixed(2)}</span>
                </div>
              ))}
              
              {standup?.completed.receivedDeliveries.slice(0, 3).map(delivery => (
                <div key={delivery.id} className="p-3 bg-white/[0.02] rounded-xl flex items-center justify-between">
                  <div>
                    <p className="font-medium">{delivery.vendor}</p>
                    <p className="text-xs text-slate-500">Ontvangen</p>
                  </div>
                  <Package className="w-5 h-5 text-green-400" />
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

// ============================================
// SUB COMPONENTS
// ============================================

function GreetingIcon() {
  const hour = new Date().getHours();
  if (hour < 6) return <Moon className="w-8 h-8 text-indigo-400" />;
  if (hour < 12) return <Coffee className="w-8 h-8 text-orange-400" />;
  if (hour < 18) return <Sun className="w-8 h-8 text-yellow-400" />;
  return <Moon className="w-8 h-8 text-indigo-400" />;
}

function SummaryCard({ icon: Icon, label, value, subValue, color, alert }: {
  icon: any;
  label: string;
  value: number;
  subValue?: string;
  color: 'blue' | 'red' | 'green' | 'yellow';
  alert?: boolean;
}) {
  const colors = {
    blue: 'from-blue-500/20 to-blue-500/5 border-blue-500/20',
    red: 'from-red-500/20 to-red-500/5 border-red-500/20',
    green: 'from-green-500/20 to-green-500/5 border-green-500/20',
    yellow: 'from-yellow-500/20 to-yellow-500/5 border-yellow-500/20',
  };

  const iconColors = {
    blue: 'text-blue-400',
    red: 'text-red-400',
    green: 'text-green-400',
    yellow: 'text-yellow-400',
  };

  return (
    <div className={`p-4 rounded-2xl bg-gradient-to-br ${colors[color]} border ${alert ? 'animate-pulse' : ''}`}>
      <Icon className={`w-6 h-6 ${iconColors[color]} mb-2`} />
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-sm text-slate-400">{label}</p>
      {subValue && <p className="text-xs text-slate-500 mt-1">{subValue}</p>}
    </div>
  );
}

function InvoiceCard({ invoice, urgent, onAction }: { invoice: InvoiceItem; urgent?: boolean; onAction: () => void }) {
  const [loading, setLoading] = useState(false);

  const handleMarkPaid = async () => {
    setLoading(true);
    await fetch('/api/email-tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_paid', taskId: invoice.id }),
    });
    setLoading(false);
    onAction();
  };

  const handleSnooze = async (days: number) => {
    setLoading(true);
    const until = new Date();
    until.setDate(until.getDate() + days);
    await fetch('/api/email-tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'snooze_task', taskId: invoice.id, until: until.toISOString() }),
    });
    setLoading(false);
    onAction();
  };

  return (
    <div className={`p-4 rounded-xl mb-3 border ${
      urgent 
        ? 'bg-red-500/10 border-red-500/30' 
        : 'bg-white/[0.02] border-white/5'
    }`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{invoice.vendor}</h3>
            {invoice.isOverdue && (
              <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full">
                {Math.abs(invoice.daysUntilDue)} dagen te laat
              </span>
            )}
            {!invoice.isOverdue && invoice.daysUntilDue === 0 && (
              <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">
                Vandaag
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400 mt-1">{invoice.emailSubject}</p>
          {invoice.invoiceNumber && (
            <p className="text-xs text-slate-500 mt-1">Factuur: {invoice.invoiceNumber}</p>
          )}
        </div>
        
        <div className="text-right">
          <p className={`text-2xl font-bold ${invoice.isOverdue ? 'text-red-400' : ''}`}>
            €{invoice.amount.toFixed(2)}
          </p>
          <p className="text-xs text-slate-500">
            {new Date(invoice.dueDate).toLocaleDateString('nl-NL')}
          </p>
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <button
          onClick={handleMarkPaid}
          disabled={loading}
          className="flex-1 py-2 px-4 bg-green-500/20 text-green-400 rounded-lg text-sm font-medium hover:bg-green-500/30 transition-colors flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          Betaald
        </button>
        <button
          onClick={() => handleSnooze(3)}
          disabled={loading}
          className="py-2 px-4 bg-white/5 rounded-lg text-sm hover:bg-white/10 transition-colors"
        >
          +3 dagen
        </button>
        <button
          onClick={() => handleSnooze(7)}
          disabled={loading}
          className="py-2 px-4 bg-white/5 rounded-lg text-sm hover:bg-white/10 transition-colors"
        >
          +7 dagen
        </button>
      </div>
    </div>
  );
}

function InvoiceRow({ invoice, onAction }: { invoice: InvoiceItem; onAction: () => void }) {
  const [loading, setLoading] = useState(false);

  const handleMarkPaid = async () => {
    setLoading(true);
    await fetch('/api/email-tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_paid', taskId: invoice.id }),
    });
    setLoading(false);
    onAction();
  };

  return (
    <div className="flex items-center justify-between p-3 bg-white/[0.02] rounded-xl hover:bg-white/[0.04] transition-colors">
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{invoice.vendor}</p>
        <p className="text-xs text-slate-500">
          {invoice.daysUntilDue === 1 ? 'Morgen' : `Over ${invoice.daysUntilDue} dagen`}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-semibold">€{invoice.amount.toFixed(2)}</span>
        <button
          onClick={handleMarkPaid}
          disabled={loading}
          className="p-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

function DeliveryCard({ delivery, today, onAction }: { delivery: DeliveryItem; today?: boolean; onAction: () => void }) {
  const [loading, setLoading] = useState(false);

  const handleMarkDelivered = async () => {
    setLoading(true);
    await fetch('/api/email-tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_delivered', taskId: delivery.id }),
    });
    setLoading(false);
    onAction();
  };

  const statusColors: Record<string, string> = {
    ordered: 'bg-slate-500/20 text-slate-400',
    shipped: 'bg-blue-500/20 text-blue-400',
    out_for_delivery: 'bg-yellow-500/20 text-yellow-400',
    delivered: 'bg-green-500/20 text-green-400',
  };

  const statusLabels: Record<string, string> = {
    ordered: 'Besteld',
    shipped: 'Onderweg',
    out_for_delivery: 'In bezorging',
    delivered: 'Bezorgd',
  };

  return (
    <div className={`p-4 rounded-xl mb-3 border ${
      today 
        ? 'bg-green-500/10 border-green-500/30' 
        : 'bg-white/[0.02] border-white/5'
    }`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{delivery.vendor}</h3>
            <span className={`px-2 py-0.5 text-xs rounded-full ${statusColors[delivery.status] || statusColors.ordered}`}>
              {statusLabels[delivery.status] || delivery.status}
            </span>
          </div>
          
          {delivery.items && delivery.items.length > 0 && (
            <p className="text-sm text-slate-400 mt-1">
              {delivery.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
            </p>
          )}
          
          <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
            {delivery.carrier && <span>{delivery.carrier}</span>}
            {delivery.trackingNumber && (
              <span className="font-mono">{delivery.trackingNumber}</span>
            )}
          </div>
        </div>
        
        <div className="text-right">
          <Package className="w-8 h-8 text-green-400" />
          {delivery.expectedDelivery && (
            <p className="text-xs text-slate-500 mt-1">
              {new Date(delivery.expectedDelivery).toLocaleDateString('nl-NL')}
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <button
          onClick={handleMarkDelivered}
          disabled={loading}
          className="flex-1 py-2 px-4 bg-green-500/20 text-green-400 rounded-lg text-sm font-medium hover:bg-green-500/30 transition-colors flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          Ontvangen
        </button>
        {delivery.trackingNumber && (
          <button
            className="py-2 px-4 bg-white/5 rounded-lg text-sm hover:bg-white/10 transition-colors flex items-center gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            Track
          </button>
        )}
      </div>
    </div>
  );
}

function DeliveryRow({ delivery, onAction }: { delivery: DeliveryItem; onAction: () => void }) {
  const [loading, setLoading] = useState(false);

  const handleMarkDelivered = async () => {
    setLoading(true);
    await fetch('/api/email-tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_delivered', taskId: delivery.id }),
    });
    setLoading(false);
    onAction();
  };

  return (
    <div className="flex items-center justify-between p-3 bg-white/[0.02] rounded-xl hover:bg-white/[0.04] transition-colors">
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{delivery.vendor}</p>
        <p className="text-xs text-slate-500">
          {delivery.daysUntilDelivery === 1 ? 'Morgen' : 
           delivery.daysUntilDelivery === undefined ? 'Datum onbekend' :
           `Over ${delivery.daysUntilDelivery} dagen`}
        </p>
      </div>
      <div className="flex items-center gap-3">
        {delivery.carrier && (
          <span className="text-xs text-slate-500">{delivery.carrier}</span>
        )}
        <button
          onClick={handleMarkDelivered}
          disabled={loading}
          className="p-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
