/**
 * ==============================================================================
 * REACHINBOX EMAIL JOB SCHEDULER - SHARED CONTRACTS & DTO SPECIFICATIONS
 * Stage A: Contract Lock
 * ==============================================================================
 */

export type JobStatus = 'SCHEDULED' | 'RESCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
}

export interface AuthResponse {
  token: string;
  user: UserProfile;
}

export interface SenderDTO {
  id: string;
  userId: string;
  name: string;
  email: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  maxEmailsPerHour: number;
  createdAt: string;
}

export interface CreateSenderRequest {
  name: string;
  email: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  maxEmailsPerHour?: number;
}

export interface ScheduleBatchRequest {
  senderId: string;
  subject: string;
  body: string;
  recipients: string[];
  startTime: string; // ISO 8601 string
  delayBetweenEmailsMs: number;
  hourlyLimit: number;
}

export interface ScheduleBatchResponse {
  batchId: string;
  totalScheduled: number;
  firstScheduledAt: string;
  lastScheduledAt: string;
}

export interface EmailJobDTO {
  id: string;
  batchId: string;
  userId: string;
  senderId: string;
  sender?: SenderDTO;
  recipientEmail: string;
  subject: string;
  body: string;
  status: JobStatus;
  scheduledAt: string;
  effectiveScheduledAt: string;
  sentAt?: string | null;
  bullmqJobId: string;
  etherealMessageId?: string | null;
  etherealPreviewUrl?: string | null;
  rescheduledCount: number;
  attempts: number;
  errorMessage?: string | null;
  delayBetweenEmailsMs: number;
  hourlyLimit: number;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStatsDTO {
  scheduledCount: number;
  rescheduledCount: number;
  sentCount: number;
  failedCount: number;
}

export interface BullMQEmailPayload {
  emailJobId: string;
  senderId: string;
  userId: string;
  delayBetweenEmailsMs: number;
  hourlyLimit: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  reason?: 'HOURLY_LIMIT_REACHED' | 'MIN_SPACING_DELAY';
  waitMs: number;
  nextAllowedTimestampMs: number;
  currentHourCount: number;
}

export interface EmailBatchDTO {
  id: string;
  userId: string;
  senderId: string;
  sender?: SenderDTO;
  subject: string;
  body: string;
  totalEmails: number;
  startTime: string;
  delayBetweenEmailsMs: number;
  hourlyLimit: number;
  createdAt: string;
  jobs?: EmailJobDTO[];
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}
