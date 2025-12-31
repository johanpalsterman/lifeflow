'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Brain, Calendar, Sparkles, Settings, Bell, Search, Lightbulb,
  Plus, Zap, Mail, Gift, Car, Shield, Clock, Webhook, ChevronRight,
  ToggleLeft, ToggleRight, Trash2, Loader2
} from 'lucide-react';

interface AIRule {
  id: string;
  name: string;
  description: string | null;
  triggerDescription: string | null;
  actionDescription: string | null;
  isEnabled: boolean;
  priority: number;
  executionsCount: number;
  lastExecutedAt: string | null;
}

export default function RulesPage() {
  const [rules, setRules] = useState<AIRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const fetchRules = async () => {
    try {
      const res = await fetch('/api/rules?userId=demo-user');
      const json = await res.json();
      if (json.success) {
        setRules(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch rules:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const toggleRule = async (ruleId: string, currentEnabled: boolean) => {
    try {
      await fetch(`/api/rules/${ruleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled: !currentEnabled })
      });
      fetchRules();
    } catch (err) {
      console.error('Failed to toggle rule:', err);
    }
  };

  const seedRules = async () => {
    setSeeding(true);
    try {
      await fetch('/api/rules/seed', { method: 'POST' });
      await fetchRules();
    } catch (err) {
      console.error('Failed to seed rules:', err);
    } finally {
      setSeeding(false);
    }
  };

  const getTriggerIcon = (description: string | null) => {
    if (!description) return Zap;
    if (description.includes('Email')) return Mail;
    if (description.includes('Verjaardag')) return Gift;
    if (description.includes('APK') || description.includes('vehicle')) return Car;
    if (description.includes('Backup') || description.includes('check')) return Shield;
    if (description.includes('werkdag') || description.includes('vrijdag') || description.includes('schedule')) return Clock;
    if (description.includes('webhook') || description.includes('Slack')) return Webhook;
    return Zap;
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-black/20 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-semibold">LifeFlow</h1>
                <p className="text-xs text-slate-500">Personal Command Center</p>
              </div>
            </div>

            <nav className="flex items-center gap-1 bg-white/[0.02] rounded-xl p-1 border border-white/5">
              <Link href="/dashboard" className="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Dashboard
              </Link>
              <Link href="/rules" className="px-4 py-2 rounded-lg bg-white/10 text-white flex items-center gap-2">
                <Brain className="w-4 h-4" /> AI Rules
              </Link>
              <Link href="/wishes" className="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 flex items-center gap-2">
                <Lightbulb className="w-4 h-4" /> Wish Board
              </Link>
            </nav>

            <div className="flex items-center gap-2">
              <button className="p-2 rounded-lg hover:bg-white/5"><Search className="w-5 h-5 text-slate-400" /></button>
              <button className="p-2 rounded-lg hover:bg-white/5 relative">
                <Bell className="w-5 h-5 text-slate-400" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full" />
              </button>
              <Link href="/settings" className="p-2 rounded-lg hover:bg-white/5"><Settings className="w-5 h-5 text-slate-400" /></Link>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-violet-500 flex items-center justify-center text-sm font-bold ml-2">J</div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-4xl mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-semibold mb-1">AI Rules</h2>
            <p className="text-slate-400">Automatiseer je workflow met slimme regels</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={seedRules}
              disabled={seeding}
              className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition-colors flex items-center gap-2"
            >
              {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              Voorbeelden laden
            </button>
            <button className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-600 text-white font-medium hover:from-blue-600 hover:to-violet-700 transition-all flex items-center gap-2">
              <Plus className="w-4 h-4" /> Nieuwe regel
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
            <p className="text-3xl font-semibold">{rules.length}</p>
            <p className="text-sm text-slate-500">Totaal regels</p>
          </div>
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
            <p className="text-3xl font-semibold text-emerald-400">{rules.filter(r => r.isEnabled).length}</p>
            <p className="text-sm text-slate-500">Actief</p>
          </div>
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
            <p className="text-3xl font-semibold text-blue-400">{rules.reduce((sum, r) => sum + r.executionsCount, 0)}</p>
            <p className="text-sm text-slate-500">Uitvoeringen</p>
          </div>
        </div>

        {/* Rules List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : rules.length === 0 ? (
          <div className="text-center py-12">
            <Brain className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Geen regels</h3>
            <p className="text-slate-500 mb-6">Maak je eerste AI regel of laad voorbeelden</p>
            <button
              onClick={seedRules}
              disabled={seeding}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-violet-600 text-white font-medium"
            >
              {seeding ? 'Laden...' : 'Voorbeelden laden'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => {
              const TriggerIcon = getTriggerIcon(rule.triggerDescription);
              return (
                <div
                  key={rule.id}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    rule.isEnabled
                      ? 'bg-white/[0.02] border-white/10 hover:border-white/20'
                      : 'bg-white/[0.01] border-white/5 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      rule.isEnabled ? 'bg-violet-500/20' : 'bg-slate-500/20'
                    }`}>
                      <TriggerIcon className={`w-5 h-5 ${rule.isEnabled ? 'text-violet-400' : 'text-slate-500'}`} />
                    </div>
                    
                    <div className="flex-1">
                      <h3 className="font-medium">{rule.name}</h3>
                      <p className="text-sm text-slate-500">{rule.description}</p>
                    </div>

                    <div className="flex items-center gap-4">
                      {rule.executionsCount > 0 && (
                        <span className="text-xs text-slate-500">
                          {rule.executionsCount}x uitgevoerd
                        </span>
                      )}
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleRule(rule.id, rule.isEnabled);
                        }}
                        className="p-1"
                      >
                        {rule.isEnabled ? (
                          <ToggleRight className="w-8 h-8 text-emerald-400" />
                        ) : (
                          <ToggleLeft className="w-8 h-8 text-slate-600" />
                        )}
                      </button>
                      
                      <ChevronRight className="w-5 h-5 text-slate-600" />
                    </div>
                  </div>

                  {/* Trigger → Action flow */}
                  <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-3 text-sm">
                    <span className="px-2 py-1 rounded bg-blue-500/10 text-blue-400">
                      {rule.triggerDescription || 'Trigger'}
                    </span>
                    <span className="text-slate-600">→</span>
                    <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400">
                      {rule.actionDescription || 'Action'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Floating AI Button */}
      <button className="fixed bottom-8 right-8 w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-violet-500/25 hover:scale-105 transition-transform z-50">
        <Sparkles className="w-6 h-6" />
      </button>
    </div>
  );
}
