import React, { useState, useId, useMemo } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  Sparkles,
  Clock,
  Send,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  User,
  ShieldAlert,
} from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { ScheduleBatchRequest } from '../types/contracts';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

export const ComposeModal: React.FC<ComposeModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { senders } = useAuth();
  const fileInputId = useId();

  // Form State
  const [selectedSenderId, setSelectedSenderId] = useState<string>(
    senders[0]?.id || ''
  );
  const [manualRecipientsText, setManualRecipientsText] = useState<string>('');
  const [parsedRecipients, setParsedRecipients] = useState<string[]>([]);
  const [showRecipientList, setShowRecipientList] = useState<boolean>(false);
  const [subject, setSubject] = useState<string>('Quick Partnership Proposal - ReachInbox Outreach');
  const [body, setBody] = useState<string>(
    `Hi {{name}},\n\nI came across your profile and was impressed by the work you're doing. We recently launched an automated high-throughput email outreach engine with zero clock-drift rate limiting.\n\nWould you be open to a 10-minute chat this Thursday?\n\nBest regards,\nOutreach Team`
  );
  const [startTime, setStartTime] = useState<string>('');
  const [delaySeconds, setDelaySeconds] = useState<number>(2);
  const [hourlyLimit, setHourlyLimit] = useState<number>(200);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Parse and deduplicate emails whenever manual text changes or files are loaded
  const handleExtractEmails = (text: string, append: boolean = false) => {
    const matches = text.match(EMAIL_REGEX) || [];
    const normalized = matches.map((e) => e.trim().toLowerCase());
    setParsedRecipients((prev) => {
      const combined = append ? [...prev, ...normalized] : normalized;
      return Array.from(new Set(combined));
    });
  };

  const handleManualTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setManualRecipientsText(val);
    handleExtractEmails(val, false);
  };

  // CSV / TXT File Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        handleExtractEmails(content, true);
        setManualRecipientsText((prev) => (prev ? `${prev}\n${content}` : content));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Evaluator Helper: 1-Click Generate 100 Sample Leads CSV
  const handleGenerateSampleLeads = () => {
    const domains = ['reachinbox.ai', 'acme.org', 'saasgrowth.io', 'hyperconnect.dev', 'cloudscale.co'];
    const names = [
      'alex.turner', 'sarah.connor', 'david.miller', 'emily.watson', 'james.wilson',
      'michael.brown', 'jessica.taylor', 'brian.cooper', 'laura.adams', 'robert.chen'
    ];

    const sampleEmails: string[] = [];
    for (let i = 1; i <= 100; i++) {
      const name = names[(i - 1) % names.length];
      const domain = domains[(i - 1) % domains.length];
      sampleEmails.push(`${name}.${i}@${domain}`);
    }

    const sampleCsv = sampleEmails.join(', ');
    setManualRecipientsText(sampleCsv);
    setParsedRecipients(sampleEmails);
  };

  // Schedule Estimator Math
  const estimator = useMemo(() => {
    const count = parsedRecipients.length;
    if (count === 0) return null;

    const spacingMs = delaySeconds * 1000;
    const hoursNeeded = Math.ceil(count / hourlyLimit);
    const totalDurationSeconds = Math.max(0, (count - 1) * delaySeconds);
    const durationMinutes = (totalDurationSeconds / 60).toFixed(1);

    return {
      count,
      hoursNeeded,
      totalDurationSeconds,
      durationMinutes,
      spacingMs,
    };
  }, [parsedRecipients.length, delaySeconds, hourlyLimit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const activeSenderId = selectedSenderId || senders[0]?.id;
    if (!activeSenderId) {
      setError('Please select an active Ethereal sender identity.');
      return;
    }

    if (parsedRecipients.length === 0) {
      setError('Please provide at least one valid recipient email.');
      return;
    }

    if (!subject.trim()) {
      setError('Subject line cannot be blank.');
      return;
    }

    if (!body.trim()) {
      setError('Email body cannot be blank.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: ScheduleBatchRequest = {
        senderId: activeSenderId,
        subject: subject.trim(),
        body: body.trim(),
        recipients: parsedRecipients,
        startTime: startTime ? new Date(startTime).toISOString() : new Date().toISOString(),
        delayBetweenEmailsMs: Math.max(100, delaySeconds * 1000),
        hourlyLimit: Math.max(1, hourlyLimit),
      };

      const res = await api.post('/emails/schedule', payload);
      if (res.data?.success) {
        setSuccessMessage(`Successfully scheduled ${res.data.data.totalScheduled} emails!`);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1200);
      } else {
        setError(res.data?.error || 'Failed to schedule batch.');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'An error occurred while scheduling.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-dark-surface border border-dark-border w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark-border bg-dark-surface/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Compose & Schedule Bulk Campaign</h2>
              <p className="text-xs text-dark-muted">Zero-Cron delayed queue dispatch with Redis Lua rate limiting</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-dark-muted hover:text-white hover:bg-dark-card transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1 text-sm">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-2.5 text-rose-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2.5 text-emerald-400 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* 1. From Sender */}
          <div>
            <label className="block text-xs font-semibold text-dark-muted uppercase tracking-wider mb-1.5">
              From (Sender Identity)
            </label>
            <div className="relative">
              <select
                value={selectedSenderId}
                onChange={(e) => setSelectedSenderId(e.target.value)}
                className="w-full bg-dark-bg border border-dark-border rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-500 transition-colors appearance-none"
              >
                {senders.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} &lt;{s.email}&gt; &bull; Quota: {s.maxEmailsPerHour}/hr (Used: {s.currentHourSentCount || 0})
                  </option>
                ))}
              </select>
              <User className="w-4 h-4 text-dark-muted absolute right-3.5 top-3 pointer-events-none" />
            </div>
          </div>

          {/* 2. Recipients Engine + CSV Uploader */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-dark-muted uppercase tracking-wider">
                Recipients (Emails / CSV / TXT)
              </label>
              <div className="flex items-center gap-2">
                <input
                  id={fileInputId}
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label
                  htmlFor={fileInputId}
                  className="cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-brand-400 bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/20 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload CSV / TXT</span>
                </label>
                <button
                  type="button"
                  onClick={handleGenerateSampleLeads}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Sample 100 Leads CSV</span>
                </button>
              </div>
            </div>

            <textarea
              rows={3}
              value={manualRecipientsText}
              onChange={handleManualTextChange}
              placeholder="Paste comma or newline separated email addresses, or upload a CSV lead list..."
              className="w-full bg-dark-bg border border-dark-border rounded-xl px-4 py-2.5 text-white text-xs font-mono focus:outline-none focus:border-brand-500 transition-colors"
            />

            {/* Recipient Counter Badge & Collapsible Drawer */}
            {parsedRecipients.length > 0 && (
              <div className="mt-2 bg-dark-card/60 border border-dark-border rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>{parsedRecipients.length} valid unique emails detected</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowRecipientList(!showRecipientList)}
                    className="text-xs text-dark-muted hover:text-white flex items-center gap-1"
                  >
                    <span>{showRecipientList ? 'Hide preview' : 'View preview'}</span>
                    {showRecipientList ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {showRecipientList && (
                  <div className="mt-2 pt-2 border-t border-dark-border/60 max-h-36 overflow-y-auto space-y-1 text-[11px] font-mono text-dark-muted">
                    {parsedRecipients.slice(0, 50).map((email, idx) => (
                      <div key={idx} className="line-clamp-1">{idx + 1}. {email}</div>
                    ))}
                    {parsedRecipients.length > 50 && (
                      <div className="text-brand-400 text-xs italic pt-1">
                        ...and {parsedRecipients.length - 50} more recipients
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 3. Subject */}
          <div>
            <label className="block text-xs font-semibold text-dark-muted uppercase tracking-wider mb-1.5">
              Subject Line
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g., Quick Partnership Proposal"
              className="w-full bg-dark-bg border border-dark-border rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-500 transition-colors"
            />
          </div>

          {/* 4. Body Content */}
          <div>
            <label className="block text-xs font-semibold text-dark-muted uppercase tracking-wider mb-1.5">
              Email Body (Supports multiline and variables)
            </label>
            <textarea
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full bg-dark-bg border border-dark-border rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-500 transition-colors font-sans leading-relaxed"
            />
          </div>

          {/* 5. Scheduling & Rate-Limiting Controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-dark-bg/60 p-4 rounded-xl border border-dark-border">
            {/* Start Time */}
            <div>
              <label className="block text-xs font-medium text-dark-muted mb-1">
                Start Timestamp
              </label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-dark-surface border border-dark-border rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-brand-500 transition-colors"
              />
              <span className="text-[10px] text-dark-muted/80 mt-1 block">Leave blank for Immediate</span>
            </div>

            {/* Delay Spacing */}
            <div>
              <label className="block text-xs font-medium text-dark-muted mb-1">
                Inter-Email Spacing (sec)
              </label>
              <input
                type="number"
                min={1}
                max={300}
                value={delaySeconds}
                onChange={(e) => setDelaySeconds(parseInt(e.target.value, 10) || 2)}
                className="w-full bg-dark-surface border border-dark-border rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-brand-500 transition-colors"
              />
              <span className="text-[10px] text-dark-muted/80 mt-1 block">Min gap between 2 sends</span>
            </div>

            {/* Hourly Limit */}
            <div>
              <label className="block text-xs font-medium text-dark-muted mb-1">
                Hourly Quota Limit
              </label>
              <input
                type="number"
                min={1}
                max={1000}
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(parseInt(e.target.value, 10) || 200)}
                className="w-full bg-dark-surface border border-dark-border rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-brand-500 transition-colors"
              />
              <span className="text-[10px] text-dark-muted/80 mt-1 block">Max emails allowed / hr</span>
            </div>
          </div>

          {/* 6. Live Schedule Estimator Banner */}
          {estimator && (
            <div className="p-3.5 bg-brand-500/10 border border-brand-500/20 rounded-xl flex items-start gap-3 text-xs text-brand-300">
              <Clock className="w-4 h-4 shrink-0 mt-0.5 text-brand-400" />
              <div>
                <p className="font-semibold text-white">Live Batch Dispatch Forecast</p>
                <p className="mt-0.5 leading-relaxed">
                  Scheduling <span className="font-bold text-brand-200">{estimator.count} emails</span> with{' '}
                  <span className="font-bold text-brand-200">{delaySeconds}s spacing</span> and max{' '}
                  <span className="font-bold text-brand-200">{hourlyLimit}/hr</span> quota &rarr; Dispatched across{' '}
                  <span className="font-bold text-emerald-400">{estimator.hoursNeeded} clock hour window(s)</span> (~{estimator.durationMinutes} min active spacing).
                </p>
              </div>
            </div>
          )}
        </form>

        {/* Modal Footer */}
        <div className="p-4 border-t border-dark-border bg-dark-surface/50 flex items-center justify-between">
          <div className="text-xs text-dark-muted flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-dark-muted" />
            <span>Rescheduling auto-managed by Redis Lua</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-medium text-dark-muted hover:text-white bg-dark-card hover:bg-dark-border transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || parsedRecipients.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 transition-all shadow-md shadow-brand-500/25 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Queueing Batch...' : `Schedule ${parsedRecipients.length} Emails`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComposeModal;
