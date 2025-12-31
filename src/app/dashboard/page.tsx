'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { 
  Calendar, CheckCircle2, Mail, Package, CreditCard, Gift, Shield, 
  Sparkles, Brain, Lightbulb, Settings, Bell, Search, Car,
  TrendingUp, TrendingDown, AlertCircle, MessageSquare, Loader2, Circle, X, Flag, Plus
} from 'lucide-react';

interface Task {
  id: string;
  title: string;
  priority: string;
  status: string;
  dueDate: string | null;
}

interface Event {
  id: string;
  title: string;
  startTime: string;
  endTime: string | null;
  eventType: string;
  location: string | null;
  color: string | null;
}

interface Contact {
  id: string;
  name: string;
  daysUntil: number;
}

interface SafetyCheck {
  id: string;
  name: string;
  checkType: string;
  status: string;
  nextCheckAt: string | null;
}

interface DashboardData {
  stats: {
    eventsToday: number;
    openTasks: number;
    activePackages: number;
  };
  eventsToday: Event[];
  tasks: Task[];
  packages: any[];
  birthdays: Contact[];
  safetyChecks: SafetyCheck[];
}

// AddTaskModal Component
function AddTaskModal({ isOpen, onClose, onAdd }: { 
  isOpen: boolean; 
  onClose: () => void; 
  onAdd: (task: { title: string; priority: string; dueDate: string | null }) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    try {
      await onAdd({ title: title.trim(), priority, dueDate: dueDate || null });
      setTitle('');
      setPriority('medium');
      setDueDate('');
      onClose();
    } catch (err) {
      console.error('Failed to add task:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md mx-4 p-6 rounded-2xl bg-[#12121a] border border-white/10 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Nieuwe taak</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-2">Titel</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Wat moet er gebeuren?"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-blue-500 focus:outline-none text-white placeholder-slate-500"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-2">Prioriteit</label>
            <div className="flex gap-2">
              {[
                { value: 'low', label: 'Laag', activeColor: 'bg-slate-500/20 text-slate-300 border-slate-500/50 ring-slate-500' },
                { value: 'medium', label: 'Medium', activeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/50 ring-blue-500' },
                { value: 'high', label: 'Hoog', activeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/50 ring-rose-500' },
              ].map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value)}
                  className={`flex-1 px-3 py-2 rounded-lg border transition-all flex flex-col items-center ${
                    priority === p.value 
                      ? `${p.activeColor} ring-2 ring-offset-2 ring-offset-[#12121a]`
                      : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                  }`}
                >
                  <Flag className={`w-4 h-4 mb-1 ${priority === p.value ? '' : 'opacity-50'}`} />
                  <span className="text-xs">{p.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-2">Deadline</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-blue-500 focus:outline-none text-white [color-scheme:dark]"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10 hover:text-white transition-colors">
              Annuleren
            </button>
            <button
              type="submit"
              disabled={!title.trim() || loading}
              className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-violet-600 text-white font-medium hover:from-blue-600 hover:to-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? 'Toevoegen...' : 'Toevoegen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// AddEventModal Component
function AddEventModal({ isOpen, onClose, onAdd }: {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (event: { title: string; startTime: string; endTime: string | null; eventType: string; location: string | null }) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [eventType, setEventType] = useState('work');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    try {
      const startDateTime = `${date}T${startTime}:00`;
      const endDateTime = endTime ? `${date}T${endTime}:00` : null;
      await onAdd({ title: title.trim(), startTime: startDateTime, endTime: endDateTime, eventType, location: location || null });
      setTitle('');
      setStartTime('09:00');
      setEndTime('10:00');
      setEventType('work');
      setLocation('');
      onClose();
    } catch (err) {
      console.error('Failed to add event:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md mx-4 p-6 rounded-2xl bg-[#12121a] border border-white/10 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Nieuwe afspraak</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-2">Titel</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Meeting, afspraak, etc."
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-blue-500 focus:outline-none text-white placeholder-slate-500"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-2">Type</label>
            <div className="flex gap-2">
              {[
                { value: 'work', label: 'Werk', color: 'bg-blue-500/20 text-blue-300 border-blue-500/50' },
                { value: 'social', label: 'Sociaal', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50' },
                { value: 'health', label: 'Gezondheid', color: 'bg-violet-500/20 text-violet-300 border-violet-500/50' },
              ].map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setEventType(t.value)}
                  className={`flex-1 px-3 py-2 rounded-lg border transition-all text-sm ${
                    eventType === t.value ? t.color : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-2">Datum</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-blue-500 focus:outline-none text-white [color-scheme:dark]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Start</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-blue-500 focus:outline-none text-white [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Eind</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-blue-500 focus:outline-none text-white [color-scheme:dark]"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-2">Locatie (optioneel)</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Waar?"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-blue-500 focus:outline-none text-white placeholder-slate-500"
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10 hover:text-white transition-colors">
              Annuleren
            </button>
            <button
              type="submit"
              disabled={!title.trim() || loading}
              className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-violet-600 text-white font-medium hover:from-blue-600 hover:to-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? 'Toevoegen...' : 'Toevoegen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/summary?userId=demo-user');
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        setError(null);
      } else {
        setError(json.error || 'Failed to fetch data');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const dataInterval = setInterval(fetchData, 30000);
    return () => clearInterval(dataInterval);
  }, [fetchData]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const toggleTask = async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      fetchData();
    } catch (err) {
      console.error('Failed to update task:', err);
    }
  };

  const addTask = async (task: { title: string; priority: string; dueDate: string | null }) => {
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...task, userId: 'demo-user' })
    });
    fetchData();
  };

  const addEvent = async (event: { title: string; startTime: string; endTime: string | null; eventType: string; location: string | null }) => {
    await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...event, userId: 'demo-user' })
    });
    fetchData();
  };

  const formatTime = (d: Date) => d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  const formatDate = (d: Date) => d.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
  
  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Goedemorgen';
    if (hour < 18) return 'Goedemiddag';
    return 'Goedenavond';
  };

  const formatEventTime = (startTime: string, endTime: string | null) => {
    const start = new Date(startTime);
    const time = start.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
    if (endTime) {
      const end = new Date(endTime);
      const duration = Math.round((end.getTime() - start.getTime()) / 60000);
      return duration >= 60 ? `${time} · ${Math.round(duration / 60)}h` : `${time} · ${duration}m`;
    }
    return time;
  };

  const getDueDateLabel = (dueDate: string | null) => {
    if (!dueDate) return null;
    const due = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDateOnly = new Date(due);
    dueDateOnly.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((dueDateOnly.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { label: 'Overdue', color: 'bg-rose-500/20 text-rose-400' };
    if (diffDays === 0) return { label: 'Vandaag', color: 'bg-amber-500/20 text-amber-400' };
    if (diffDays === 1) return { label: 'Morgen', color: 'bg-blue-500/20 text-blue-400' };
    if (diffDays <= 7) return { label: due.toLocaleDateString('nl-NL', { weekday: 'long' }), color: 'bg-slate-500/20 text-slate-400' };
    return { label: due.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }), color: 'bg-slate-500/20 text-slate-400' };
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'work': return 'bg-blue-500';
      case 'social': return 'bg-emerald-500';
      case 'health': return 'bg-violet-500';
      default: return 'bg-slate-500';
    }
  };

  const getSafetyIcon = (checkType: string) => {
    switch (checkType) {
      case 'vehicle': return Car;
      case 'backup': return CheckCircle2;
      case 'security': return Shield;
      default: return Shield;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Modals */}
      <AddTaskModal isOpen={showAddTask} onClose={() => setShowAddTask(false)} onAdd={addTask} />
      <AddEventModal isOpen={showAddEvent} onClose={() => setShowAddEvent(false)} onAdd={addEvent} />

      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />
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
              <Link href="/dashboard" className="px-4 py-2 rounded-lg bg-white/10 text-white flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Dashboard
              </Link>
              <Link href="/rules" className="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 flex items-center gap-2">
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
      <main className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        {/* Time and greeting */}
        <div className="mb-8">
          <p className="text-slate-500 text-sm">{formatDate(currentTime)}</p>
          <div className="flex items-baseline gap-4">
            <h2 className="text-4xl font-light tracking-tight">{formatTime(currentTime)}</h2>
            <span className="text-slate-400">{getGreeting()}, Johan</span>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">{error}</div>
        )}

        {/* Quick stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Events vandaag', value: data?.stats.eventsToday ?? 0, icon: Calendar, color: 'blue' },
            { label: 'Open taken', value: data?.stats.openTasks ?? 0, icon: CheckCircle2, color: 'emerald' },
            { label: 'Ongelezen', value: 12, icon: Mail, color: 'violet' },
            { label: 'Leveringen', value: data?.stats.activePackages ?? 0, icon: Package, color: 'amber' },
          ].map((stat) => (
            <div key={stat.label} className="group p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all cursor-pointer">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform ${
                stat.color === 'blue' ? 'bg-blue-500/10' : stat.color === 'emerald' ? 'bg-emerald-500/10' : stat.color === 'violet' ? 'bg-violet-500/10' : 'bg-amber-500/10'
              }`}>
                <stat.icon className={`w-5 h-5 ${
                  stat.color === 'blue' ? 'text-blue-400' : stat.color === 'emerald' ? 'text-emerald-400' : stat.color === 'violet' ? 'text-violet-400' : 'text-amber-400'
                }`} />
              </div>
              <p className="text-2xl font-semibold">{stat.value}</p>
              <p className="text-sm text-slate-500">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-3 gap-6">
          {/* Left column */}
          <div className="col-span-2 space-y-6">
            {/* Today's Schedule */}
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-medium flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-400" /> Vandaag
                </h3>
                <button onClick={() => setShowAddEvent(true)} className="text-sm text-slate-400 hover:text-white flex items-center gap-1">
                  <Plus className="w-4 h-4" /> Toevoegen
                </button>
              </div>
              <div className="space-y-3">
                {data?.eventsToday && data.eventsToday.length > 0 ? (
                  data.eventsToday.map((event) => (
                    <div key={event.id} className="group flex items-center gap-4 p-4 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 hover:border-white/10 transition-all cursor-pointer">
                      <div className={`w-1 h-12 rounded-full ${getEventTypeColor(event.eventType)}`} />
                      <div className="flex-1">
                        <p className="font-medium">{event.title}</p>
                        <p className="text-sm text-slate-500">
                          {formatEventTime(event.startTime, event.endTime)}
                          {event.location && ` · ${event.location}`}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-500 text-sm">Geen events vandaag</p>
                )}
              </div>
            </div>

            {/* Tasks */}
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Taken
                </h3>
                <button onClick={() => setShowAddTask(true)} className="text-sm text-slate-400 hover:text-white flex items-center gap-1">
                  <Plus className="w-4 h-4" /> Nieuwe taak
                </button>
              </div>
              <div className="space-y-2">
                {data?.tasks && data.tasks.length > 0 ? (
                  data.tasks.map((task) => {
                    const dueLabel = getDueDateLabel(task.dueDate);
                    return (
                      <div key={task.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.02] group cursor-pointer">
                        <button onClick={() => toggleTask(task.id, task.status)} className="flex-shrink-0">
                          {task.status === 'completed' ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          ) : (
                            <Circle className="w-5 h-5 text-slate-600 group-hover:text-slate-400" />
                          )}
                        </button>
                        <span className={`flex-1 ${task.status === 'completed' ? 'line-through text-slate-500' : ''}`}>
                          {task.title}
                        </span>
                        {task.priority === 'high' && (
                          <span className="px-2 py-0.5 text-xs rounded bg-rose-500/20 text-rose-400">!</span>
                        )}
                        {dueLabel && (
                          <span className={`px-2 py-0.5 text-xs rounded ${dueLabel.color}`}>{dueLabel.label}</span>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-slate-500 text-sm">Geen taken</p>
                )}
              </div>
            </div>

            {/* Financial */}
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5">
              <h3 className="font-medium mb-4 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-cyan-400" /> Financieel
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm text-emerald-400">Te ontvangen</span>
                  </div>
                  <p className="text-2xl font-semibold text-emerald-300">€3.500</p>
                </div>
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingDown className="w-4 h-4 text-rose-400" />
                    <span className="text-sm text-rose-400">Te betalen</span>
                  </div>
                  <p className="text-2xl font-semibold text-rose-300">€1.240</p>
                </div>
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                    <span className="text-sm text-amber-400">Overdue</span>
                  </div>
                  <p className="text-2xl font-semibold text-amber-300">1</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            {/* Inbox Preview */}
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-medium flex items-center gap-2">
                  <Mail className="w-4 h-4 text-cyan-400" /> Inbox
                </h3>
                <span className="px-2 py-0.5 text-xs rounded-full bg-cyan-500/20 text-cyan-400">12 nieuw</span>
              </div>
              <div className="space-y-2">
                {[
                  { from: 'PostNL', subject: 'Pakket wordt vandaag bezorgd', time: '10 min', icon: Package, important: true },
                  { from: 'Marie', subject: 'Nog steeds op voor zaterdag?', time: '25 min', icon: MessageSquare },
                  { from: 'KBC Bank', subject: 'Nieuwe factuur beschikbaar', time: '1 uur', icon: Mail, important: true },
                ].map((msg, i) => (
                  <div key={i} className="p-3 rounded-xl hover:bg-white/[0.02] transition-colors cursor-pointer">
                    <div className="flex items-center gap-2 mb-1">
                      <msg.icon className="w-3 h-3 text-slate-500" />
                      <span className="text-sm font-medium">{msg.from}</span>
                      {msg.important && <span className="w-2 h-2 bg-amber-400 rounded-full" />}
                      <span className="text-xs text-slate-600 ml-auto">{msg.time}</span>
                    </div>
                    <p className="text-sm text-slate-400 truncate">{msg.subject}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Packages */}
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5">
              <h3 className="font-medium mb-4 flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-400" /> Leveringen
              </h3>
              <div className="space-y-3">
                {data?.packages && data.packages.length > 0 ? (
                  data.packages.map((pkg: any) => (
                    <div key={pkg.id} className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-amber-400">{pkg.carrier}</span>
                        <span className="px-2 py-0.5 text-xs rounded-full bg-cyan-500/20 text-cyan-400">{pkg.status}</span>
                      </div>
                      <p className="text-sm mb-1">{pkg.description}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-500 text-sm">Geen leveringen</p>
                )}
              </div>
            </div>

            {/* Safety Checks */}
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5">
              <h3 className="font-medium mb-4 flex items-center gap-2">
                <Shield className="w-4 h-4 text-rose-400" /> Safety Check
              </h3>
              <div className="space-y-2">
                {data?.safetyChecks && data.safetyChecks.length > 0 ? (
                  data.safetyChecks.map((check) => {
                    const Icon = getSafetyIcon(check.checkType);
                    const isWarning = check.status === 'warning';
                    return (
                      <div key={check.id} className={`p-3 rounded-xl ${isWarning ? 'bg-amber-500/5 border border-amber-500/20' : 'bg-emerald-500/5 border border-emerald-500/20'}`}>
                        <div className="flex items-center gap-2">
                          <Icon className={`w-4 h-4 ${isWarning ? 'text-amber-400' : 'text-emerald-400'}`} />
                          <span className="text-sm">{check.name}</span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-slate-500 text-sm">Geen checks</p>
                )}
              </div>
            </div>

            {/* Birthdays */}
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5">
              <h3 className="font-medium mb-4 flex items-center gap-2">
                <Gift className="w-4 h-4 text-pink-400" /> Verjaardagen
              </h3>
              <div className="space-y-2">
                {data?.birthdays && data.birthdays.length > 0 ? (
                  data.birthdays.map((b) => (
                    <div key={b.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/[0.02]">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center text-xs font-bold">
                          {b.name.charAt(0)}
                        </div>
                        <span>{b.name}</span>
                      </div>
                      <span className={`text-xs ${b.daysUntil <= 7 ? 'text-pink-400' : 'text-slate-500'}`}>{b.daysUntil}d</span>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-500 text-sm">Geen verjaardagen binnenkort</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* WishFlow Banner */}
        <div className="mt-8 p-6 rounded-2xl bg-gradient-to-r from-blue-600/20 via-violet-600/20 to-emerald-600/20 border border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium mb-1">WishFlow Integraties</h3>
              <p className="text-sm text-slate-400">Verbonden met TrustAI, FlowEngine & Board of Directors</p>
            </div>
            <div className="flex gap-2">
              {['TrustAI', 'FlowEngine', 'BoD'].map((product) => (
                <div key={product} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full" />
                  {product}
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Floating AI Button */}
      <button className="fixed bottom-8 right-8 w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-violet-500/25 hover:scale-105 transition-transform z-50">
        <Sparkles className="w-6 h-6" />
      </button>
    </div>
  );
}
