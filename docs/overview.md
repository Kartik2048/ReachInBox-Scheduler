# System Overview

## 1. Executive Summary

The **ReachInbox Email Job Scheduler** is an enterprise-grade distributed background dispatching engine and management console. It is specifically engineered to handle bulk cold email outreach batches (1,000+ emails) while strictly enforcing:
1. Sender-specific hourly quotas (`MAX_EMAILS_PER_HOUR_PER_SENDER`, e.g., 200/hr).
2. Inter-email delay spacing (`MIN_DELAY_BETWEEN_EMAILS_MS`, e.g., 2000ms between consecutive dispatches from the same sender).
3. Zero-loss persistence across server restarts and process crashes.
4. Complete elimination of cron-based polling (`Zero-Cron Architecture`).

---

## 2. The Problem with Traditional Email Schedulers

Most email scheduling implementations rely on `node-cron`, `cron`, `agenda`, or `setInterval` loops that execute queries like `SELECT * FROM emails WHERE scheduled_at <= NOW() AND status = 'PENDING'`.

This naive approach introduces severe production failure modes:
1. **$O(N)$ Database Polling Bottleneck**: As tables grow into hundreds of thousands of rows, periodic polling saturates database connection pools and CPU cycles.
2. **Clock Drift & Worker Concurrency Collisions**: Multiple worker instances running cron jobs on separate machines wake up at slightly different timestamps, race to claim the same pending rows, and result in catastrophic **duplicate email sends**.
3. **Destructive Rate-Limit Handling**: When an hourly quota is hit, naive systems either mark jobs as `FAILED`, throw errors, or drop the jobs entirely.
4. **Memory Starvation on Free Hosting**: Uncontrolled in-memory queue arrays or unbounded Redis key storage exceed the strict 30MB/512MB RAM quotas of free-tier cloud platforms (e.g., Render, Upstash).

---

## 3. How ReachInbox Solves These Challenges

| Challenge | Traditional Approach | ReachInbox Solution |
| :--- | :--- | :--- |
| **Scheduling Engine** | `node-cron` or `setInterval` database polling | **BullMQ Delayed Jobs** backed by Redis Sorted Sets (`zset`). Wakeups are exact to the millisecond with $O(\log N)$ extraction. |
| **Rate Limit Evaluation** | In-memory JavaScript counters or DB locks | **Atomic Redis Lua Script** evaluating sender hourly quota and spacing in a single uninterrupted atomic operation. |
| **Over-Quota Behavior** | Job failure, dropped emails, or crash loops | **Non-Destructive `moveToDelayed()`**: BullMQ moves the job into the next hour window and throws `DelayedError()`, setting DB status to `RESCHEDULED`. |
| **Crash Durability** | Unsaved state lost on process reboot | **PostgreSQL as Source of Truth + BullMQ Stalled Recovery + Startup Reconciliation** ensuring zero lost jobs and zero duplicate dispatches. |
| **Free-Tier Limits** | Separate paid worker service required | **Dual-Mode Co-Located Worker (`RUN_WORKER_IN_API=true`)** running API and Worker within a single 512MB container. |
| **Cloud Port 587 Block** | ETIMEDOUT / ECONNREFUSED on restricted PaaS | **Smart Ethereal Fallback (`SMTP_FALLBACK_ON_PORT_BLOCK=true`)** generating MIME streams and clickable HTML browser previews (`/api/emails/:id/preview`). |

---

## 4. Hard Assignment Constraints Compliance

- [x] **Zero Cron Jobs**: Verified 0 dependencies (`node-cron`, `cron`, `agenda`) in `package.json` and 0 cron scheduling loops in source code.
- [x] **Persistence & Restart Survival**: Modeled in PostgreSQL (Prisma); unacknowledged jobs recovered via BullMQ stalled lock duration.
- [x] **Distributed Rate Limiting & Spacing**: Tracked atomically in Redis keys (`rate_limit:{senderId}:{bucket}` and `last_sent_at:{senderId}`).
- [x] **Non-Destructive Rescheduling**: Over-quota jobs execute `job.moveToDelayed()` and update DB to `RESCHEDULED`.
- [x] **Free-Tier Memory Hygiene**: Aggressive job cleanup (`removeOnComplete: 100`, `removeOnFail: 200`) and singleton Redis connections.
- [x] **Smart Ethereal Mailer**: Automatic test account provisioning and port 587 block fallback.
