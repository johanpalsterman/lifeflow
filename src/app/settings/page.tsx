'use client';

import { useState, useEffect } from 'react';

interface Rule {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  trigger: any;
  action: any;
}

interface ProcessingLog {
  emailId: string;
  classification: {
    category: string;
    confidence: number;
    reasoning?: string;
  };
  rulesExecuted: Array<{
    ruleName: string;
    triggered: boolean;
    actionExecuted: boolean;
    result?: any;
  }>;
  processedAt: string;
}

interface UserSettings {
  maxEmailsPerBatch: number;
  sinceHours: number;
}

const DEFAULT_SETTINGS: UserSettings = {
  maxEmailsPerBatch: 50,
  sinceHours: 24
};

const CATEGORY_LABELS: Record<string, { label: string; emoji: string; bgColor: string; textColor: string }> = {
  invoice: { label: 'Factuur', emoji: '📄', bgColor: 'bg-yellow-100', textColor: 'text-yellow-800' },
  delivery: { label: 'Pakket', emoji: '📦', bgColor: 'bg-cyan-100', textColor: 'text-cyan-800' },
  order: { label: 'Bestelling', emoji: '🛒', bgColor: 'bg-purple-100', textColor: 'text-purple-800' },
  event: { label: 'Afspraak', emoji: '📅', bgColor: 'bg-blue-100', textColor: 'text-blue-800' },
  task: { label: 'Taak', emoji: '✅', bgColor: 'bg-green-100', textColor: 'text-green-800' },
  newsletter: { label: 'Nieuwsbrief', emoji: '📰', bgColor: 'bg-gray-100', textColor: 'text-gray-800' },
  spam: { label: 'Spam', emoji: '🚫', bgColor: 'bg-red-100', textColor: 'text-red-800' },
  personal: { label: 'Persoonlijk', emoji: '💬', bgColor: 'bg-pink-100', textColor: 'text-pink-800' },
  unknown: { label: 'Onbekend', emoji: '❓', bgColor: 'bg-gray-100', textColor: 'text-gray-600' },
  none: { label: 'Geen match', emoji: '⏭️', bgColor: 'bg-gray-100', textColor: 'text-gray-600' }
};

const ACTION_LABELS: Record<string, string> = {
  create_task: 'Taak aanmaken',
  create_event: 'Afspraak aanmaken',
  record_invoice: 'Factuur registreren',
  track_package: 'Pakket volgen',
  track_order: 'Bestelling volgen'
};

export default function SettingsPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [logs, setLogs] = useState<ProcessingLog[]>([]);
  const [gmailStatus, setGmailStatus] = useState<any>(null);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showAllLogs, setShowAllLogs] = useState(false);

  useEffect(() => {
    loadData();
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const saved = localStorage.getItem('lifeflow-settings');
      if (saved) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
      }
    } catch (e) {
      console.error('Error loading settings:', e);
    }
  }

  function saveSettings(newSettings: UserSettings) {
    setSettings(newSettings);
    localStorage.setItem('lifeflow-settings', JSON.stringify(newSettings));
  }

  async function loadData() {
    setLoading(true);
    try {
      // Load rules
      const rulesRes = await fetch('/api/rules');
      const rulesData = await rulesRes.json();
      if (rulesData.success) {
        setRules(rulesData.data || []);
      }

      // Load Gmail status
      const gmailRes = await fetch('/api/gmail');
      const gmailData = await gmailRes.json();
      if (gmailData.success) {
        setGmailStatus(gmailData.data);
      }

      // Load recent processing logs
      try {
        const logsRes = await fetch('/api/process-emails');
        const logsData = await logsRes.json();
        if (logsData.recentLogs) {
          setLogs(logsData.recentLogs || []);
        }
      } catch (e) {
        // Logs endpoint might not exist yet
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
    setLoading(false);
  }

  async function toggleRule(ruleId: string) {
    try {
      await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle', ruleId }),
      });
      setRules(rules.map(r =>
        r.id === ruleId ? { ...r, isActive: !r.isActive } : r
      ));
    } catch (error) {
      console.error('Error toggling rule:', error);
    }
  }

  async function deleteRule(ruleId: string) {
    if (!confirm('Weet je zeker dat je deze regel wilt verwijderen?')) return;
    try {
      await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', ruleId }),
      });
      setRules(rules.filter(r => r.id !== ruleId));
    } catch (error) {
      console.error('Error deleting rule:', error);
    }
  }

  async function seedDefaultRules() {
    try {
      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seed_defaults' }),
      });
      const data = await res.json();
      if (data.success) {
        loadData(); // Reload to get fresh rules
      }
    } catch (error) {
      console.error('Error seeding rules:', error);
    }
  }

  async function processEmails() {
    setProcessing(true);
    try {
      const res = await fetch('/api/process-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maxEmails: settings.maxEmailsPerBatch,
          sinceHours: settings.sinceHours
        }),
      });
      const data = await res.json();
      if (data.success) {
        // Update logs with new results
        if (data.results) {
          setLogs(prev => [...data.results, ...prev].slice(0, 100));
        }
        alert(`✅ ${data.processed || 0} emails verwerkt!\n\n` +
              `📋 Taken: ${data.createdRecords?.tasks || 0}\n` +
              `📅 Afspraken: ${data.createdRecords?.events || 0}\n` +
              `📦 Pakketten: ${data.createdRecords?.packages || 0}\n` +
              `🛒 Bestellingen: ${data.createdRecords?.orders || 0}\n` +
              `📄 Facturen: ${data.createdRecords?.invoices || 0}`);
      }
    } catch (error) {
      console.error('Error processing emails:', error);
      alert('Er ging iets mis bij het verwerken van emails.');
    }
    setProcessing(false);
  }

  async function connectGmail() {
    window.location.href = '/api/integrations/google';
  }

  function formatTime(dateString: string): string {
    return new Date(dateString).toLocaleString('nl-NL', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">Laden...</div>
      </div>
    );
  }

  const displayLogs = showAllLogs ? logs : logs.slice(0, 10);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Instellingen</h1>

      {/* Gmail Connection */}
      <section className="mb-8 bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          📧 Gmail Connectie
        </h2>
        {gmailStatus?.connected ? (
          <div className="flex items-center justify-between">
            <div>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                ✓ Verbonden
              </span>
              <p className="text-sm text-gray-500 mt-2">
                {gmailStatus.unreadCount?.toLocaleString()} ongelezen emails
              </p>
            </div>
            <button
              onClick={processEmails}
              disabled={processing}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {processing ? '⏳ Verwerken...' : '📥 Emails Verwerken'}
            </button>
          </div>
        ) : (
          <div>
            <p className="text-gray-600 mb-4">
              Verbind je Gmail account om emails automatisch te laten verwerken.
            </p>
            <button
              onClick={connectGmail}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              🔗 Gmail Verbinden
            </button>
          </div>
        )}
      </section>

      {/* Processing Settings - NIEUW! */}
      <section className="mb-8 bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          ⚙️ Verwerkingsinstellingen
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Max emails */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Maximaal aantal emails per verwerking
            </label>
            <input
              type="number"
              min="1"
              max="500"
              value={settings.maxEmailsPerBatch}
              onChange={(e) => saveSettings({ 
                ...settings, 
                maxEmailsPerBatch: parseInt(e.target.value) || 50 
              })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Hoeveel emails er maximaal per keer worden verwerkt
            </p>
          </div>
          
          {/* Since hours */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Emails van de laatste
            </label>
            <select
              value={settings.sinceHours}
              onChange={(e) => saveSettings({ 
                ...settings, 
                sinceHours: parseInt(e.target.value) 
              })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={1}>1 uur</option>
              <option value={6}>6 uur</option>
              <option value={12}>12 uur</option>
              <option value={24}>24 uur</option>
              <option value={48}>48 uur (2 dagen)</option>
              <option value={72}>72 uur (3 dagen)</option>
              <option value={168}>168 uur (1 week)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Alleen recente emails worden verwerkt
            </p>
          </div>
        </div>
      </section>

      {/* AI Rules */}
      <section className="mb-8 bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            🤖 AI Regels ({rules.length})
          </h2>
          <button
            onClick={seedDefaultRules}
            className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
          >
            + Standaard Regels
          </button>
        </div>

        {rules.length === 0 ? (
          <p className="text-gray-500">Geen regels gevonden. Klik op "Standaard Regels" om te beginnen.</p>
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => {
              const category = rule.trigger?.category || 'unknown';
              const categoryInfo = CATEGORY_LABELS[category] || CATEGORY_LABELS.unknown;
              const actionLabel = ACTION_LABELS[rule.action?.type] || rule.action?.type;
              
              return (
                <div
                  key={rule.id}
                  className={`flex items-center justify-between p-4 rounded-lg border ${
                    rule.isActive ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${rule.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                      <span className="text-lg">{categoryInfo.emoji}</span>
                      <h3 className="font-medium">{rule.name}</h3>
                    </div>
                    <p className="text-sm text-gray-600 ml-8">
                      {categoryInfo.label} → {actionLabel}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleRule(rule.id)}
                      className={`px-3 py-1 text-sm rounded ${
                        rule.isActive
                          ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {rule.isActive ? 'Uitschakelen' : 'Inschakelen'}
                    </button>
                    <button
                      onClick={() => deleteRule(rule.id)}
                      className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                    >
                      Verwijderen
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Processing Logs - VERBETERD! */}
      <section className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            📋 Verwerkingslog ({logs.length})
          </h2>
          {logs.length > 10 && (
            <button
              onClick={() => setShowAllLogs(!showAllLogs)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {showAllLogs ? 'Toon minder' : `Toon alle (${logs.length})`}
            </button>
          )}
        </div>
        
        {logs.length === 0 ? (
          <p className="text-gray-500">Geen recente verwerkingen. Klik op "Emails Verwerken" om te starten.</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {displayLogs.map((log, index) => {
              const category = log.classification?.category || 'unknown';
              const categoryInfo = CATEGORY_LABELS[category] || CATEGORY_LABELS.unknown;
              const executedRule = log.rulesExecuted?.find(r => r.triggered && r.actionExecuted);
              const confidence = Math.round((log.classification?.confidence || 0) * 100);
              
              return (
                <div
                  key={`${log.emailId}-${index}`}
                  className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100"
                >
                  {/* Category badge */}
                  <span className={`px-2 py-1 text-xs rounded-full font-medium ${categoryInfo.bgColor} ${categoryInfo.textColor} whitespace-nowrap`}>
                    {categoryInfo.emoji} {categoryInfo.label}
                  </span>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {executedRule ? (
                      <p className="text-sm text-gray-800">
                        ✓ <span className="font-medium">{executedRule.ruleName}</span>
                        {executedRule.result?.taskId && ' → Taak aangemaakt'}
                        {executedRule.result?.packageId && ' → Pakket toegevoegd'}
                        {executedRule.result?.orderId && ` → Bestelling ${executedRule.result.shopName || 'toegevoegd'}`}
                        {executedRule.result?.eventId && ' → Afspraak aangemaakt'}
                        {executedRule.result?.invoiceId && ` → Factuur ${executedRule.result.vendor || 'geregistreerd'}`}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-500">
                        Geen actie uitgevoerd
                      </p>
                    )}
                    
                    {log.classification?.reasoning && (
                      <p className="text-xs text-gray-400 truncate mt-1">
                        {log.classification.reasoning}
                      </p>
                    )}
                  </div>
                  
                  {/* Confidence & Time */}
                  <div className="text-right text-xs text-gray-400 whitespace-nowrap">
                    <div>{confidence}%</div>
                    {log.processedAt && (
                      <div>{formatTime(log.processedAt)}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
