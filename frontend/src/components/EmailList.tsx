import React, { useState } from 'react';
import { ExternalLink, Clock, AlertCircle, RefreshCw, ChevronLeft, ChevronRight, Inbox, Eye } from 'lucide-react';
import { EmailJobDTO } from '../types/contracts';

import { format } from 'date-fns';
import EmailDetailModal from './EmailDetailModal';

interface EmailListProps {
  jobs: EmailJobDTO[];
  isLoading: boolean;
  activeTab: 'scheduled' | 'sent';
  page: number;
  totalPages: number;
  totalCount: number;
  onPageChange: (newPage: number) => void;
}

export const EmailList: React.FC<EmailListProps> = ({
  jobs,
  isLoading,
  activeTab,
  page,
  totalPages,
  totalCount,
  onPageChange,
}) => {
  const [selectedEmail, setSelectedEmail] = useState<EmailJobDTO | null>(null);

  const getStatusBadge = (job: EmailJobDTO) => {
    switch (job.status) {
      case 'SENT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            SENT
          </span>
        );
      case 'RESCHEDULED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20" title={`Delayed due to rate limits (${job.rescheduledCount}x)`}>
            <RefreshCw className="w-3 h-3 text-amber-400 animate-spin-slow" />
            RESCHEDULED {job.rescheduledCount > 0 && `(x${job.rescheduledCount})`}
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-brand-500/10 text-brand-400 border border-brand-500/20 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-ping" />
            PROCESSING
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertCircle className="w-3 h-3 text-rose-400" />
            FAILED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Clock className="w-3 h-3 text-blue-400" />
            SCHEDULED
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Table Container */}
      <div className="flex-1 overflow-x-auto overflow-y-auto min-h-0 bg-dark-surface/60 rounded-2xl border border-dark-border">
        {isLoading && jobs.length === 0 ? (
          // Skeleton Loading
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="animate-pulse flex items-center justify-between p-4 bg-dark-card/50 rounded-xl border border-dark-border/40">
                <div className="space-y-2 w-1/3">
                  <div className="h-4 bg-dark-border rounded w-3/4" />
                  <div className="h-3 bg-dark-border/60 rounded w-1/2" />
                </div>
                <div className="h-4 bg-dark-border rounded w-1/4" />
                <div className="h-6 bg-dark-border rounded-full w-24" />
              </div>
            ))}
          </div>
        ) : jobs.length === 0 ? (
          // Empty State
          <div className="flex flex-col items-center justify-center p-16 text-center text-dark-muted">
            <div className="w-16 h-16 rounded-2xl bg-dark-card flex items-center justify-center mb-4 text-dark-muted/60 border border-dark-border">
              <Inbox className="w-8 h-8" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">
              {activeTab === 'scheduled' ? 'No Scheduled Emails' : 'No Sent Emails Yet'}
            </h3>
            <p className="text-xs max-w-sm mb-6">
              {activeTab === 'scheduled'
                ? 'Click the "+ Compose" button on the left to schedule your first bulk email outreach campaign.'
                : 'Emails will appear here once dispatched by the background worker.'}
            </p>
          </div>
        ) : (
          // Data Table
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-dark-border bg-dark-bg/60 text-xs font-semibold text-dark-muted uppercase tracking-wider sticky top-0 z-10 backdrop-blur-md">
                <th className="py-3.5 px-6">Recipient & Subject</th>
                <th className="py-3.5 px-6">Sender</th>
                <th className="py-3.5 px-6">
                  {activeTab === 'scheduled' ? 'Scheduled At' : 'Sent Timestamp'}
                </th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border/60">
              {jobs.map((job) => {
                const previewHref = job.etherealPreviewUrl || `/api/emails/${job.id}/preview`;
                const dateToDisplay = activeTab === 'scheduled'
                  ? new Date(job.effectiveScheduledAt)
                  : job.sentAt ? new Date(job.sentAt) : new Date(job.updatedAt);

                return (
                  <tr
                    key={job.id}
                    onClick={() => setSelectedEmail(job)}
                    className="group hover:bg-dark-card/40 transition-colors cursor-pointer"
                  >
                    {/* Recipient & Subject */}
                    <td className="py-4 px-6 max-w-xs">
                      <div className="font-medium text-white group-hover:text-brand-300 transition-colors line-clamp-1">
                        {job.recipientEmail}
                      </div>
                      <div className="text-xs text-dark-muted line-clamp-1 mt-0.5">
                        {job.subject} &mdash; <span className="text-dark-muted/70">{job.body.substring(0, 60)}...</span>
                      </div>
                    </td>

                    {/* Sender */}
                    <td className="py-4 px-6 text-xs text-dark-text whitespace-nowrap">
                      <div className="font-medium">{job.sender?.name || 'Sender'}</div>
                      <div className="text-dark-muted text-[11px]">{job.sender?.email}</div>
                    </td>

                    {/* Timestamp */}
                    <td className="py-4 px-6 text-xs text-dark-text whitespace-nowrap">
                      <div>{format(dateToDisplay, 'MMM d, yyyy')}</div>
                      <div className="text-dark-muted text-[11px]">{format(dateToDisplay, 'hh:mm:ss a')}</div>
                    </td>

                    {/* Status Badge */}
                    <td className="py-4 px-6 whitespace-nowrap">
                      {getStatusBadge(job)}
                    </td>

                    {/* Action buttons */}
                    <td className="py-4 px-6 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        {job.status === 'SENT' && (
                          <a
                            href={previewHref}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all hover:scale-105"
                            title="Open Ethereal Email in new tab"
                          >
                            <span>Preview</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}

                        <button
                          onClick={() => setSelectedEmail(job)}
                          className="p-1.5 rounded-lg text-dark-muted hover:text-white hover:bg-dark-card transition-colors"
                          title="Inspect Email Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between py-4 px-2 text-xs text-dark-muted">
          <div>
            Showing page <span className="text-white font-medium">{page}</span> of{' '}
            <span className="text-white font-medium">{totalPages}</span> ({totalCount} total emails)
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="p-1.5 rounded-lg bg-dark-card border border-dark-border text-dark-text hover:bg-dark-border disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-medium text-white">{page}</span>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg bg-dark-card border border-dark-border text-dark-text hover:bg-dark-border disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedEmail && (
        <EmailDetailModal email={selectedEmail} onClose={() => setSelectedEmail(null)} />
      )}
    </div>
  );
};

export default EmailList;
