import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Mail,
  Clock,
  Send,
  Plus,
  Search,
  LogOut,
  User,
  Zap,
  Activity,
  Layers,
} from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { EmailJobDTO, DashboardStatsDTO } from '../types/contracts';
import EmailList from '../components/EmailList';
import ComposeModal from '../components/ComposeModal';

export const DashboardPage: React.FC = () => {
  const { user, senders, logout, refreshSenders, createSender } = useAuth();

  // Navigation & Search State
  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Email List & Stats Data
  const [jobs, setJobs] = useState<EmailJobDTO[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [stats, setStats] = useState<DashboardStatsDTO>({
    scheduledCount: 0,
    rescheduledCount: 0,
    sentCount: 0,
    failedCount: 0,
  });

  // Compose Modal State
  const [isComposeOpen, setIsComposeOpen] = useState<boolean>(false);
  const [isAddingSender, setIsAddingSender] = useState<boolean>(false);

  // Debounced search query
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch emails for current tab
  const fetchEmails = useCallback(
    async (showLoadingSpinner: boolean = false) => {
      if (showLoadingSpinner) setIsLoading(true);
      try {
        const endpoint = activeTab === 'scheduled' ? '/emails/scheduled' : '/emails/sent';
        const res = await api.get(endpoint, {
          params: {
            page,
            limit: 25,
            search: searchQuery.trim() || undefined,
          },
        });

        if (res.data?.success) {
          setJobs(res.data.data.jobs || []);
          setTotalCount(res.data.data.total || 0);
          setTotalPages(res.data.data.totalPages || 1);
        }
      } catch (err) {
        console.error('Error fetching emails:', err);
      } finally {
        if (showLoadingSpinner) setIsLoading(false);
      }
    },
    [activeTab, page, searchQuery]
  );

  // Fetch dashboard stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/emails/stats');
      if (res.data?.success) {
        setStats(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }, []);

  // Initial and reactive fetch on tab/page change
  useEffect(() => {
    fetchEmails(true);
    fetchStats();
    refreshSenders();
  }, [fetchEmails, fetchStats, refreshSenders]);

  // Real-time auto-refresh polling every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchEmails(false);
      fetchStats();
      refreshSenders();
    }, 3000);

    return () => clearInterval(interval);
  }, [fetchEmails, fetchStats, refreshSenders]);

  // Search input handler with 300ms debounce
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    setPage(1);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      fetchEmails(false);
    }, 300);
  };

  const handleAddSenderClick = async () => {
    setIsAddingSender(true);
    try {
      const customName = `Outreach Alias ${senders.length + 1}`;
      await createSender(customName);
    } catch (err: any) {
      alert(err.message || 'Failed to create new Ethereal sender.');
    } finally {
      setIsAddingSender(false);
    }
  };

  const scheduledTabCount = stats.scheduledCount + stats.rescheduledCount;
  const sentTabCount = stats.sentCount + stats.failedCount;

  return (
    <div className="flex h-screen bg-dark-bg text-dark-text overflow-hidden font-sans">
      {/* 1. Left Sidebar */}
      <aside className="w-64 bg-dark-surface/90 border-r border-dark-border flex flex-col justify-between p-4 z-20">
        <div className="space-y-6">
          {/* Brand Heading */}
          <div className="flex items-center gap-3 px-2 pt-1">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-emerald-500 flex items-center justify-center shadow-md shadow-brand-500/20 text-white">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-tight text-white">ReachInbox</h1>
              <p className="text-[11px] text-dark-muted font-medium">Job Scheduler</p>
            </div>
          </div>

          {/* Primary Action Button: Compose */}
          <button
            onClick={() => setIsComposeOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 transition-all shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Compose</span>
          </button>

          {/* Navigation Links with Live Badge Counters */}
          <nav className="space-y-1.5 text-xs font-semibold">
            {/* Scheduled Tab */}
            <button
              onClick={() => {
                setActiveTab('scheduled');
                setPage(1);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                activeTab === 'scheduled'
                  ? 'bg-brand-600/15 text-brand-300 border border-brand-500/30'
                  : 'text-dark-muted hover:text-white hover:bg-dark-card/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4" />
                <span>Scheduled</span>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                  activeTab === 'scheduled'
                    ? 'bg-brand-500 text-white shadow-sm'
                    : 'bg-dark-card text-dark-muted'
                }`}
              >
                {scheduledTabCount}
              </span>
            </button>

            {/* Sent Tab */}
            <button
              onClick={() => {
                setActiveTab('sent');
                setPage(1);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                activeTab === 'sent'
                  ? 'bg-emerald-600/15 text-emerald-300 border border-emerald-500/30'
                  : 'text-dark-muted hover:text-white hover:bg-dark-card/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Send className="w-4 h-4" />
                <span>Sent</span>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                  activeTab === 'sent'
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'bg-dark-card text-dark-muted'
                }`}
              >
                {sentTabCount}
              </span>
            </button>
          </nav>
        </div>

        {/* Active Senders Widget in Sidebar Bottom */}
        <div className="bg-dark-bg/80 border border-dark-border rounded-xl p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-dark-muted uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              Active Senders
            </span>
            <span className="text-[10px] text-dark-muted">Redis Quotas</span>
          </div>

          <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
            {senders.map((s) => (
              <div key={s.id} className="text-[11px] bg-dark-card/60 p-2 rounded-lg border border-dark-border/40">
                <div className="font-semibold text-white line-clamp-1">{s.name}</div>
                <div className="text-[10px] text-dark-muted line-clamp-1">{s.email}</div>
                <div className="flex items-center justify-between mt-1 text-[10px]">
                  <span className="text-dark-muted">This hour:</span>
                  <span className="font-mono font-semibold text-brand-300">
                    {s.currentHourSentCount || 0} / {s.maxEmailsPerHour}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleAddSenderClick}
            disabled={isAddingSender}
            className="w-full py-1.5 px-2 rounded-lg bg-dark-card hover:bg-dark-border text-[11px] font-medium text-dark-text hover:text-white border border-dark-border/60 transition-colors flex items-center justify-center gap-1 disabled:opacity-50 cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>{isAddingSender ? 'Provisioning...' : '+ Add Ethereal Sender'}</span>
          </button>
        </div>
      </aside>

      {/* 2. Main Content View */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-dark-surface/60 border-b border-dark-border flex items-center justify-between px-6 backdrop-blur-md z-10">
          {/* Search Bar */}
          <div className="relative w-80">
            <Search className="w-4 h-4 text-dark-muted absolute left-3.5 top-3 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search by recipient or subject..."
              className="w-full bg-dark-bg/80 border border-dark-border rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-dark-muted focus:outline-none focus:border-brand-500 transition-colors"
            />
          </div>

          {/* Right Header: System Status & User Profile */}
          <div className="flex items-center gap-4">
            {/* Live Engine Status Indicator */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>BullMQ Queue Active</span>
            </div>

            {/* User Profile Pill */}
            {user && (
              <div className="flex items-center gap-3 pl-3 border-l border-dark-border/60">
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    className="w-8 h-8 rounded-full border border-dark-border"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-brand-600/30 border border-brand-500/40 flex items-center justify-center text-brand-300 text-xs font-bold">
                    <User className="w-4 h-4" />
                  </div>
                )}
                <div className="hidden md:block text-left">
                  <div className="text-xs font-semibold text-white line-clamp-1">{user.name}</div>
                  <div className="text-[10px] text-dark-muted line-clamp-1">{user.email}</div>
                </div>
              </div>
            )}

            {/* Logout Action */}
            <button
              onClick={logout}
              title="Sign Out"
              className="p-2 rounded-xl text-dark-muted hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Dashboard Content & Email Table */}
        <main className="flex-1 p-6 overflow-hidden flex flex-col">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 shrink-0">
            <div className="bg-dark-surface/60 border border-dark-border rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-dark-muted uppercase tracking-wider">Scheduled</p>
                <p className="text-2xl font-bold text-white mt-0.5">{stats.scheduledCount}</p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-dark-surface/60 border border-dark-border rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-dark-muted uppercase tracking-wider">Rescheduled</p>
                <p className="text-2xl font-bold text-amber-400 mt-0.5">{stats.rescheduledCount}</p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <Zap className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-dark-surface/60 border border-dark-border rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-dark-muted uppercase tracking-wider">Sent (Delivered)</p>
                <p className="text-2xl font-bold text-emerald-400 mt-0.5">{stats.sentCount}</p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <Send className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-dark-surface/60 border border-dark-border rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-dark-muted uppercase tracking-wider">Total Handled</p>
                <p className="text-2xl font-bold text-brand-300 mt-0.5">
                  {stats.scheduledCount + stats.rescheduledCount + stats.sentCount + stats.failedCount}
                </p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-brand-500/10 text-brand-400 flex items-center justify-center">
                <Layers className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Table Component */}
          <div className="flex-1 min-h-0">
            <EmailList
              jobs={jobs}
              isLoading={isLoading}
              activeTab={activeTab}
              page={page}
              totalPages={totalPages}
              totalCount={totalCount}
              onPageChange={(newPage) => setPage(newPage)}
            />
          </div>
        </main>
      </div>

      {/* Compose Modal */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onSuccess={() => {
          fetchEmails(true);
          fetchStats();
        }}
      />
    </div>
  );
};

export default DashboardPage;
