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
  action: string;
  title: string;
}

export default function SettingsPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [logs, setLogs] = useState<ProcessingLog[]>([]);
  const [gmailStatus, setGmailStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

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
      // Update local state
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
        setRules(data.data || []);
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
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success) {
        setLogs(data.data.actions || []);
        alert(`${data.data.processed} emails verwerkt!`);
      }
    } catch (error) {
      console.error('Error processing emails:', error);
    }
    setProcessing(false);
  }

  async function connectGmail() {
    window.location.href = '/api/integrations/google';
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">Laden...</div>
      </div>
    );
  }

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
                {gmailStatus.unreadCount} ongelezen emails
              </p>
            </div>
            <button
              onClick={processEmails}
              disabled={processing}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {processing ? 'Verwerken...' : '🔄 Emails Verwerken'}
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

      {/* AI Rules */}
      <section className="mb-8 bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            🤖 AI Regels
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
            {rules.map((rule) => (
              <div
                key={rule.id}
                className={`flex items-center justify-between p-4 rounded-lg border ${
                  rule.isActive ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${rule.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                    <h3 className="font-medium">{rule.name}</h3>
                  </div>
                  <p className="text-sm text-gray-600 ml-4">{rule.description}</p>
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
            ))}
          </div>
        )}
      </section>

      {/* Processing Logs */}
      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          📋 Verwerkingslog
        </h2>
        {logs.length === 0 ? (
          <p className="text-gray-500">Geen recente verwerkingen. Klik op "Emails Verwerken" om te starten.</p>
        ) : (
          <div className="space-y-2">
            {logs.map((log, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 rounded bg-gray-50"
              >
                <span className={`px-2 py-1 text-xs rounded ${
                  log.action === 'task_created' ? 'bg-blue-100 text-blue-700' :
                  log.action === 'event_created' ? 'bg-purple-100 text-purple-700' :
                  log.action === 'package_tracked' ? 'bg-orange-100 text-orange-700' :
                  log.action === 'ignored' ? 'bg-gray-100 text-gray-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {log.action === 'task_created' ? '📋 Taak' :
                   log.action === 'event_created' ? '📅 Event' :
                   log.action === 'package_tracked' ? '📦 Pakket' :
                   log.action === 'ignored' ? '⏭️ Overgeslagen' :
                   '❓ ' + log.action}
                </span>
                <span className="text-sm">{log.title || 'Geen titel'}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
