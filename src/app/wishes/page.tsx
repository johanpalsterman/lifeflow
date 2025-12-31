'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Lightbulb, Plus, ArrowUp, MessageCircle, Clock, CheckCircle, Award, Calendar, Brain, Sparkles, Settings, Bell, Search } from 'lucide-react';

const statusConfig: Record<string, { label: string; color: string }> = {
  new: { label: 'Nieuw', color: 'blue' },
  under_review: { label: 'In Review', color: 'amber' },
  planned: { label: 'Gepland', color: 'violet' },
  in_progress: { label: 'In Ontwikkeling', color: 'cyan' },
  completed: { label: 'Voltooid', color: 'emerald' },
};

const demoWishes = [
  { id: '1', title: 'WhatsApp Business integratie', description: 'Mogelijkheid om WhatsApp Business berichten te zien en beantwoorden', author: 'Johan V.', votes: 47, status: 'planned', category: 'integratie', comments: 12, eta: 'Q2 2025', hasVoted: true },
  { id: '2', title: 'Widget voor Apple Watch', description: 'Complicaties voor Watch met vandaag overzicht', author: 'Marie K.', votes: 35, status: 'in_progress', category: 'platform', comments: 8, eta: 'Feb 2025', hasVoted: false },
  { id: '3', title: 'Recurring taken templates', description: 'Herbruikbare templates voor terugkerende taken', author: 'Peter D.', votes: 28, status: 'under_review', category: 'productiviteit', comments: 5, hasVoted: false },
  { id: '4', title: 'Dark/Light mode schedule', description: 'Automatisch wisselen tussen dark en light mode', author: 'Lisa M.', votes: 22, status: 'completed', category: 'ui', comments: 3, completedAt: '15 dec', hasVoted: true },
  { id: '5', title: 'Spotify focus mode', description: 'Start automatisch focus playlist bij deep work', author: 'Tom B.', votes: 19, status: 'new', category: 'integratie', comments: 7, hasVoted: false },
  { id: '6', title: 'Family sharing', description: 'Deel kalender en taken met gezinsleden', author: 'Anna V.', votes: 41, status: 'planned', category: 'social', comments: 15, eta: 'Q3 2025', hasVoted: true },
  { id: '7', title: 'Siri shortcuts', description: "Siri commando's voor snelle acties", author: 'Emma L.', votes: 31, status: 'in_progress', category: 'platform', comments: 9, eta: 'Mrt 2025', hasVoted: false },
];

export default function WishesPage() {
  const [wishes, setWishes] = useState(demoWishes);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [sortBy, setSortBy] = useState('votes');

  const filteredWishes = wishes
    .filter(w => selectedStatus === 'all' || w.status === selectedStatus)
    .sort((a, b) => sortBy === 'votes' ? b.votes - a.votes : 0);

  const handleVote = (id: string) => {
    setWishes(wishes.map(w => w.id === id ? { ...w, hasVoted: !w.hasVoted, votes: w.hasVoted ? w.votes - 1 : w.votes + 1 } : w));
  };

  const totalVotes = wishes.reduce((sum, w) => sum + w.votes, 0);
  const completedCount = wishes.filter(w => w.status === 'completed').length;
  const inProgressCount = wishes.filter(w => w.status === 'in_progress').length;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl" />
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
              <Link href="/rules" className="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 flex items-center gap-2">
                <Brain className="w-4 h-4" /> AI Rules
              </Link>
              <Link href="/wishes" className="px-4 py-2 rounded-lg bg-white/10 text-white flex items-center gap-2">
                <Lightbulb className="w-4 h-4" /> Wish Board
              </Link>
            </nav>
            <div className="flex items-center gap-2">
              <button className="p-2 rounded-lg hover:bg-white/5"><Search className="w-5 h-5 text-slate-400" /></button>
              <button className="p-2 rounded-lg hover:bg-white/5"><Bell className="w-5 h-5 text-slate-400" /></button>
              <Link href="/settings" className="p-2 rounded-lg hover:bg-white/5"><Settings className="w-5 h-5 text-slate-400" /></Link>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-violet-500 flex items-center justify-center text-sm font-bold ml-2">J</div>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                <Lightbulb className="w-5 h-5" />
              </div>
              Wish Board
            </h2>
            <p className="text-slate-400 mt-1">Stem op features en deel je ideeën</p>
          </div>
          <button className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-600 font-medium hover:opacity-90 flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nieuw Idee
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
            <p className="text-sm text-slate-500">Totaal</p>
            <p className="text-2xl font-semibold">{wishes.length}</p>
          </div>
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
            <p className="text-sm text-slate-500">Stemmen</p>
            <p className="text-2xl font-semibold text-amber-400">{totalVotes}</p>
          </div>
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
            <p className="text-sm text-slate-500">In ontwikkeling</p>
            <p className="text-2xl font-semibold text-cyan-400">{inProgressCount}</p>
          </div>
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
            <p className="text-sm text-slate-500">Voltooid</p>
            <p className="text-2xl font-semibold text-emerald-400">{completedCount}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {['all', 'new', 'under_review', 'planned', 'in_progress', 'completed'].map((status) => (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={`px-4 py-2 rounded-xl whitespace-nowrap transition-all ${
                  selectedStatus === status
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-white/[0.02] border border-white/5 text-slate-400 hover:bg-white/[0.04]'
                }`}
              >
                {status === 'all' ? 'Alle' : statusConfig[status]?.label || status}
              </button>
            ))}
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none"
          >
            <option value="votes">Meeste stemmen</option>
            <option value="newest">Nieuwste</option>
          </select>
        </div>

        {/* Wishes List */}
        <div className="space-y-4">
          {filteredWishes.map((wish, index) => {
            const status = statusConfig[wish.status];
            const isTopVoted = index === 0 && sortBy === 'votes';

            return (
              <div
                key={wish.id}
                className={`p-6 rounded-2xl border transition-all bg-white/[0.02] hover:bg-white/[0.04] ${
                  isTopVoted ? 'border-amber-500/30' : 'border-white/5'
                }`}
              >
                <div className="flex gap-4">
                  {/* Vote */}
                  <div className="flex flex-col items-center">
                    <button
                      onClick={() => handleVote(wish.id)}
                      className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center transition-all ${
                        wish.hasVoted
                          ? 'bg-amber-500/20 border border-amber-500/50 text-amber-400'
                          : 'bg-white/5 border border-white/10 text-slate-400 hover:border-amber-500/30'
                      }`}
                    >
                      <ArrowUp className={`w-5 h-5 ${wish.hasVoted ? 'fill-current' : ''}`} />
                      <span className="text-sm font-bold">{wish.votes}</span>
                    </button>
                    {isTopVoted && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-amber-400">
                        <Award className="w-3 h-3" /> Top
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-lg">{wish.title}</h3>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        status.color === 'blue' ? 'bg-blue-500/20 text-blue-400' :
                        status.color === 'amber' ? 'bg-amber-500/20 text-amber-400' :
                        status.color === 'violet' ? 'bg-violet-500/20 text-violet-400' :
                        status.color === 'cyan' ? 'bg-cyan-500/20 text-cyan-400' :
                        'bg-emerald-500/20 text-emerald-400'
                      }`}>
                        {status.label}
                      </span>
                    </div>
                    <p className="text-slate-400 mb-4">{wish.description}</p>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-slate-500">{wish.author}</span>
                      <span className="text-slate-500 flex items-center gap-1">
                        <MessageCircle className="w-4 h-4" /> {wish.comments}
                      </span>
                      <span className="px-2 py-0.5 text-xs rounded-full bg-slate-500/20 text-slate-400">{wish.category}</span>
                      {wish.eta && (
                        <span className="text-cyan-400 flex items-center gap-1">
                          <Clock className="w-4 h-4" /> {wish.eta}
                        </span>
                      )}
                      {wish.completedAt && (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCircle className="w-4 h-4" /> {wish.completedAt}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Floating AI Button */}
      <button className="fixed bottom-8 right-8 w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-violet-500/25 hover:scale-105 transition-transform z-50">
        <Sparkles className="w-6 h-6" />
      </button>
    </div>
  );
}
