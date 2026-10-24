/**
 * Helper utilities for consistent Redis key namespaces across Workers and APIs.
 */

export function getUtcHourBucket(date: Date = new Date()): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}-${hh}`;
}

export function getRateLimitKey(senderId: string, date: Date = new Date()): string {
  return `rate_limit:${senderId}:${getUtcHourBucket(date)}`;
}

export function getLastSentKey(senderId: string): string {
  return `last_sent_at:${senderId}`;
}
