'use client';

import { useState, useEffect } from 'react';
import { 
  Clock, Mail, CheckCircle, XCircle, Filter, Search, 
  RefreshCw, ChevronLeft, ChevronRight, Calendar,
  Package, FileText, ShoppingBag, CheckSquare, AlertTriangle
} from 'lucide-react';

interface ProcessedEmail {
  id: string;
  emailId: string;
  classification: {
    category: string;
    confidence: number;
    reasoning?: string;
  };
  rulesExecuted: Array<{
    ruleId: string;
    ruleName: string;
    triggered: boolean;
    actionExecuted: boolean;
    result?: any;
    error?: string;
  }>;
  processedAt: string;
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: any; color: string; bgColor: string }> = {
  invoice: { label: 'Factuur', icon: FileText, color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },
  delivery: { label: 'Pakket', icon: Package, color: 'text-cyan-400', bgColor: 'bg-cyan-500/20' },
  order: { label: 'Bestelling', icon: ShoppingBag, color: 'text-purple-400', bgColor: 'bg-purple-500/20' },
  event: { label: 'Afspraak', icon: Calendar, color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  task: { label: 'Taak', icon: CheckSquare, color: 'text-green-400', bgColor: 'bg-green-500/20' },
  newsletter: { label: 'Nieuwsbrief', icon: Mail, color: 'text-gray-400', bgColor: 'bg-gray-500/20' },
  spam: { label: 'Spam', icon: XCircle, color: 'text-red-400', bgColor: 'bg-red-500/20' },
  personal: { label: 'Persoonlijk', icon: Mail, color: 'text-pink-400', bgColor: 'bg-pink-500/20' },
  unknown: { label: 'Onbekend', icon: AlertTriangle, color: 'text-gray-500', bgColor: 'bg-gray-500/20' }
};

export default function HistoryPage() {
  const [emails, setEmails] = useState<ProcessedEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all'); // all, executed, skipped
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [stats, setStats] = useState<any>(null);
  
  const pageSize = 50;

  useEffect(() => {
    loadHistory();
    loadStats();
  }, [page, categoryFilter, actionFilter]);

  async function loadHistory() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString()
      });
      
      if (categoryFilter !== 'all') {
        params.set('category', categoryFilter);
      }
      
      const res = await fetch(`/api/process-emails/history?${params}`);
      const data = await res.json();
      
      if (data.success) {
        setEmails(data.data || []);
      }
    } catch (error) {
      console.error('Error loading history:', error);
    }
    setLoading(false);
  }

  async function loadStats() {
    try {
      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stats' })
      });
      
      const data = await res.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }

  function formatDateTime(dateString: string): string {
    return new Date(dateString).toLocaleString('nl-NL', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('nl-NL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  // Filter emails
  const filteredEmails = emails.filter(email => {
    if (actionFilter === 'executed') {
      return email.rulesExecuted?.some(r => r.actionExecuted);
    }
    if (actionFilter === 'skipped') {
      return !email.rulesExecuted?.some(r => r.actionExecuted);
    }
    return true;
  });

  // Group by date
  const emailsByDate = filteredEmails.reduce((acc, email) => {
    const date = formatDate(email.processedAt);
    if (!acc[date]) acc[date] = [];
    acc[date].push(email);
    return acc;
  }, {} as Record<string, ProcessedEmail[]>);

  // Count by category
  const categoryCounts = emails.reduce((acc, email) => {
    const cat = email.classification?.category || 'unknown';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Clock className="w-8 h-8 text-green-400" />
              Verwerkingsgeschiedenis
            </h1>
            <p className="text-gray-400 mt-1">
              Overzicht van alle verwerkte emails
            </p>
          </div>
          
          <button
            onClick={() => { setPage(1); loadHistory(); }}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Vernieuwen
          </button>
        </div>

        {/* Stats Summary */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <p className="text-gray-400 text-sm">Taken</p>
              <p className="text-2xl font-bold text-green-400">{stats.counts?.tasks || 0}</p>
            </div>
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <p className="text-gray-400 text-sm">Afspraken</p>
              <p className="text-2xl font-bold text-blue-400">{stats.counts?.events || 0}</p>
            </div>
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <p className="text-gray-400 text-sm">Pakketten</p>
              <p className="text-2xl font-bold text-cyan-400">{stats.counts?.packages || 0}</p>
            </div>
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <p className="text-gray-400 text-sm">Bestellingen</p>
              <p className="text-2xl font-bold text-purple-400">{stats.counts?.orders || 0}</p>
            </div>
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <p className="text-gray-400 text-sm">Facturen</p>
              <p className="text-2xl font-bold text-yellow-400">{stats.counts?.invoices || 0}</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          {/* Category Filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-gray-500 text-sm">Categorie:</span>
            <button
              onClick={() => setCategoryFilter('all')}
              className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                categoryFilter === 'all' 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              Alle ({emails.length})
            </button>
            {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
              const count = categoryCounts[key] || 0;
              if (count === 0) return null;
              
              return (
                <button
                  key={key}
                  onClick={() => setCategoryFilter(key)}
                  className={`px-3 py-1 rounded-lg text-sm transition-colors flex items-center gap-1 ${
                    categoryFilter === key 
                      ? `${config.bgColor} ${config.color}` 
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {config.label} ({count})
                </button>
              );
            })}
          </div>
          
          {/* Action Filter */}
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-sm">Status:</span>
            <button
              onClick={() => setActionFilter('all')}
              className={`px-3 py-1 rounded-lg text-sm ${
                actionFilter === 'all' ? 'bg-gray-700' : 'bg-gray-800 text-gray-400'
              }`}
            >
              Alle
            </button>
            <button
              onClick={() => setActionFilter('executed')}
              className={`px-3 py-1 rounded-lg text-sm ${
                actionFilter === 'executed' ? 'bg-green-600' : 'bg-gray-800 text-gray-400'
              }`}
            >
              Met actie
            </button>
            <button
              onClick={() => setActionFilter('skipped')}
              className={`px-3 py-1 rounded-lg text-sm ${
                actionFilter === 'skipped' ? 'bg-gray-600' : 'bg-gray-800 text-gray-400'
              }`}
            >
              Overgeslagen
            </button>
          </div>
        </div>

        {/* Email List by Date */}
        {Object.keys(emailsByDate).length === 0 && !loading ? (
          <div className="text-center py-12 text-gray-500">
            <Mail className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">Geen verwerkte emails gevonden</p>
            <p className="text-sm">Ga naar Instellingen om emails te verwerken</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(emailsByDate).map(([date, dateEmails]) => (
              <div key={date}>
                <h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {date}
                  <span className="text-gray-600">({dateEmails.length} emails)</span>
                </h3>
                
                <div className="space-y-2">
                  {dateEmails.map((email, index) => {
                    const category = email.classification?.category || 'unknown';
                    const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.unknown;
                    const Icon = config.icon;
                    const executedRule = email.rulesExecuted?.find(r => r.actionExecuted);
                    const hasAction = !!executedRule;
                    
                    return (
                      <div 
                        key={`${email.emailId}-${index}`}
                        className={`p-4 rounded-xl border transition-all ${
                          hasAction 
                            ? 'bg-gray-900 border-gray-800' 
                            : 'bg-gray-900/50 border-gray-800/50'
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          {/* Category Icon */}
                          <div className={`p-2 rounded-lg ${config.bgColor}`}>
                            <Icon className={`w-5 h-5 ${config.color}`} />
                          </div>
                          
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`font-medium ${config.color}`}>
                                {config.label}
                              </span>
                              <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-400">
                                {Math.round((email.classification?.confidence || 0) * 100)}%
                              </span>
                              {hasAction ? (
                                <span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-400 flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3" />
                                  Actie uitgevoerd
                                </span>
                              ) : (
                                <span className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-500">
                                  Overgeslagen
                                </span>
                              )}
                            </div>
                            
                            {executedRule && (
                              <p className="text-sm text-gray-300 mb-1">
                                {executedRule.ruleName}
                                {executedRule.result?.taskId && ' → Nieuwe taak'}
                                {executedRule.result?.packageId && ' → Pakket toegevoegd'}
                                {executedRule.result?.orderId && ` → Bestelling ${executedRule.result.shopName || ''}`}
                                {executedRule.result?.eventId && ' → Afspraak aangemaakt'}
                                {executedRule.result?.invoiceId && ` → Factuur ${executedRule.result.vendor || ''}`}
                              </p>
                            )}
                            
                            {email.classification?.reasoning && (
                              <p className="text-xs text-gray-600 truncate">
                                {email.classification.reasoning}
                              </p>
                            )}
                          </div>
                          
                          {/* Time */}
                          <span className="text-xs text-gray-600 whitespace-nowrap">
                            {new Date(email.processedAt).toLocaleTimeString('nl-NL', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {emails.length >= pageSize && (
          <div className="flex items-center justify-center gap-4 mt-8">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Vorige
            </button>
            <span className="text-gray-500">Pagina {page}</span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={emails.length < pageSize}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              Volgende
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
