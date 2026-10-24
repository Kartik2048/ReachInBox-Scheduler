import React from 'react';
import { X, ExternalLink, Clock, Send, AlertTriangle, RefreshCw, Mail, User, Shield } from 'lucide-react';
import { EmailJobDTO } from '../types/contracts';
import { format } from 'date-fns';

interface EmailDetailModalProps {
  email: EmailJobDTO | null;
  onClose: () => void;
}

export const EmailDetailModal: React.FC<EmailDetailModalProps> = ({ email, onClose }) => {
  if (!email) return null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SENT':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">SENT</span>;
      case 'RESCHEDULED':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">RESCHEDULED</span>;
      case 'PROCESSING':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-brand-500/10 text-brand-400 border border-brand-500/20 animate-pulse">PROCESSING</span>;
      case 'FAILED':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">FAILED</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">SCHEDULED</span>;
    }
  };

  const previewHref = email.etherealPreviewUrl || `/api/emails/${email.id}/preview`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-dark-surface border border-dark-border w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark-border bg-dark-surface/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white line-clamp-1">{email.subject}</h2>
              <p className="text-xs text-dark-muted">Job ID: {email.id}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {getStatusBadge(email.status)}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-dark-muted hover:text-white hover:bg-dark-card transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-4 bg-dark-bg/60 p-4 rounded-xl border border-dark-border">
            <div>
              <div className="text-xs text-dark-muted flex items-center gap-1.5 mb-1">
                <User className="w-3.5 h-3.5" /> Sender
              </div>
              <p className="text-white font-medium">{email.sender?.name || 'Sender'}</p>
              <p className="text-xs text-dark-muted">{email.sender?.email}</p>
            </div>

            <div>
              <div className="text-xs text-dark-muted flex items-center gap-1.5 mb-1">
                <Mail className="w-3.5 h-3.5" /> Recipient
              </div>
              <p className="text-white font-medium break-all">{email.recipientEmail}</p>
            </div>

            <div>
              <div className="text-xs text-dark-muted flex items-center gap-1.5 mb-1">
                <Clock className="w-3.5 h-3.5" /> Target Time
              </div>
              <p className="text-white font-medium">
                {format(new Date(email.scheduledAt), 'PPpp')}
              </p>
            </div>

            <div>
              <div className="text-xs text-dark-muted flex items-center gap-1.5 mb-1">
                <RefreshCw className="w-3.5 h-3.5" /> Effective Time
              </div>
              <p className="text-white font-medium">
                {format(new Date(email.effectiveScheduledAt), 'PPpp')}
              </p>
              {email.rescheduledCount > 0 && (
                <span className="text-xs text-amber-400">Rescheduled {email.rescheduledCount}x</span>
              )}
            </div>

            {email.sentAt && (
              <div>
                <div className="text-xs text-dark-muted flex items-center gap-1.5 mb-1">
                  <Send className="w-3.5 h-3.5" /> Dispatched At
                </div>
                <p className="text-emerald-400 font-medium">
                  {format(new Date(email.sentAt), 'PPpp')}
                </p>
              </div>
            )}

            <div>
              <div className="text-xs text-dark-muted flex items-center gap-1.5 mb-1">
                <Shield className="w-3.5 h-3.5" /> Rate Constraints
              </div>
              <p className="text-xs text-dark-text">
                Spacing: {email.delayBetweenEmailsMs}ms &bull; Quota: {email.hourlyLimit}/hr
              </p>
            </div>
          </div>

          {/* Error Message banner if failed */}
          {email.errorMessage && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-3 text-rose-400 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Dispatch Error:</p>
                <p>{email.errorMessage}</p>
              </div>
            </div>
          )}

          {/* Email Body Content */}
          <div>
            <h4 className="text-xs font-semibold text-dark-muted uppercase tracking-wider mb-2">
              Email Content
            </h4>
            <div className="bg-dark-bg p-4 rounded-xl border border-dark-border text-dark-text whitespace-pre-wrap font-sans text-sm leading-relaxed max-h-60 overflow-y-auto">
              {email.body}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-dark-border bg-dark-surface/50 flex items-center justify-between">
          <span className="text-xs text-dark-muted">
            BullMQ Job ID: {email.bullmqJobId}
          </span>
          <div className="flex items-center gap-3">
            {email.status === 'SENT' && (
              <a
                href={previewHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-brand-600 hover:bg-brand-500 transition-colors shadow-sm shadow-brand-500/20"
              >
                <span>View Ethereal Email</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-dark-muted hover:text-white bg-dark-card hover:bg-dark-border transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailDetailModal;
