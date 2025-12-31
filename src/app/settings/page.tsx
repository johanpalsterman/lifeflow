'use client';

import { useState, useEffect } from 'react';

interface Integration {
  id: string;
  provider: string;
  email: string;
  connected: boolean;
  lastSync?: string;
}

export default function SettingsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadIntegrations();
  }, []);

  const loadIntegrations = async () => {
    try {
      const res = await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list' }),
      });
      const data = await res.json();
      if (data.success) {
        setIntegrations(data.data.integrations || []);
      }
    } catch (error) {
      console.error('Failed to load integrations:', error);
    }
    setLoading(false);
  };

  const connectGoogle = () => {
    window.location.href = '/api/integrations/google';
  };

  const connectOutlook = () => {
    window.location.href = '/api/integrations/outlook';
  };

  const disconnect = async (id: string) => {
    try {
      await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect', integrationId: id }),
      });
      loadIntegrations();
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Settings</h1>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Email Integrations</h2>
          <p className="text-slate-400 mb-6">
            Connect your email accounts to automatically track invoices and deliveries.
          </p>

          <div className="space-y-4">
            <div className="p-4 bg-white/5 rounded-xl border border-white/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                    <span className="text-red-400 font-bold">G</span>
                  </div>
                  <div>
                    <h3 className="font-medium">Google / Gmail</h3>
                    <p className="text-sm text-slate-400">Sync emails from Gmail</p>
                  </div>
                </div>
                <button
                  onClick={connectGoogle}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                >
                  Connect
                </button>
              </div>
            </div>

            <div className="p-4 bg-white/5 rounded-xl border border-white/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                    <span className="text-blue-400 font-bold">O</span>
                  </div>
                  <div>
                    <h3 className="font-medium">Microsoft Outlook</h3>
                    <p className="text-sm text-slate-400">Sync emails from Outlook</p>
                  </div>
                </div>
                <button
                  onClick={connectOutlook}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                >
                  Connect
                </button>
              </div>
            </div>
          </div>
        </section>

        {integrations.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold mb-4">Connected Accounts</h2>
            <div className="space-y-3">
              {integrations.map((integration) => (
                <div
                  key={integration.id}
                  className="p-4 bg-white/5 rounded-xl border border-white/10 flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium">{integration.email}</p>
                    <p className="text-sm text-slate-400">
                      {integration.provider} - Last sync: {integration.lastSync || 'Never'}
                    </p>
                  </div>
                  <button
                    onClick={() => disconnect(integration.id)}
                    className="px-3 py-1 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}