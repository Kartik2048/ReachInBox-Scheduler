# Architecture Design

## 1. System Architecture Diagram

```mermaid
flowchart TB
    subgraph Client["Frontend (React 18 + Vite + Tailwind)"]
        UI[ReachInbox Dashboard]
        AuthUI[Google OAuth 2.0 / Reviewer Login]
        Composer[Campaign Composer & CSV Lead Engine]
        List[Real-Time Scheduled & Sent Timelines]
    end

    subgraph API_Layer["Backend API Server (Express + TypeScript)"]
        Router[REST API Endpoints /api/v1]
        AuthGuard[JWT / Google Auth Middleware]
        ZodValidator[Zod Input Validation]
        JobService[Email Scheduling Service]
    end

    subgraph Persistence["Storage & Queue Layer"]
        PG[(PostgreSQL Database\nPrisma ORM)]
        subgraph RedisInstance["Redis (Persistent Queue & Distributed Locks)"]
            BullQueue[BullMQ 'reachinbox-email-queue']
            RateLimiterKeys["Rate Limit Keys (Lua Atomic)\nrate_limit:{senderId}:{bucket}\nlast_sent_at:{senderId}"]
        end
    end

    subgraph Processing["Execution Engine (Dual-Mode Worker)"]
        Worker[BullMQ Email Worker]
        LuaEngine[Redis Lua Quota & Spacing Checker]
        SMTPClient[Nodemailer Ethereal Transport]
        FallbackEngine[Smart Port Block Fallback Viewer]
    end

    UI -->|HTTPS / JWT| Router
    Router --> AuthGuard --> ZodValidator --> JobService
    JobService -->|1. Bulk Create in Chunks of 500| PG
    JobService -->|2. Bulk Enqueue with delay| BullQueue

    BullQueue -->|Pulls Ready Job| Worker
    Worker -->|Atomic Quota & Spacing Check| LuaEngine
    LuaEngine --> RateLimiterKeys

    Worker -->|If Quota or Spacing Hit| Worker
    Worker -.->|job.moveToDelayed(nextAllowed) + DelayedError| BullQueue
    Worker -.->|Update Status: RESCHEDULED| PG

    Worker -->|If Allowed: Send Email| SMTPClient
    SMTPClient -->|Port 587 Blocked?| FallbackEngine
    SMTPClient -->|Success URL| PG
    FallbackEngine -->|Fallback Preview URL| PG
    Worker -->|Update Status: SENT / FAILED| PG
    List -->|Polls Live Status & Counters| Router
```

---

## 2. Why Zero-Cron?

In a standard scheduler, you might run a cron expression like `* * * * *` (every minute).
Here is why that architecture breaks:
1. **Resolution Gap**: If an email is scheduled for `10:00:15`, a minutely cron job will only pick it up at `10:01:00` (45 seconds late).
2. **CPU and Database Waste**: Running 60 queries an hour when there are 0 emails wastes database connections and compute cycles.
3. **Double Dispatching**: If the cron job at `10:01:00` takes 65 seconds to process 500 emails, the second cron job at `10:02:00` kicks off while the first is still running, query-locking or re-sending the same emails.

### The BullMQ Delayed Jobs Alternative
Instead of polling, BullMQ places scheduled jobs into a **Redis Sorted Set (`zset`)**:
- **Member**: Deterministic Job ID (`email-{uuid}`).
- **Score**: Millisecond timestamp of target execution (`targetTimestampMs`).
- **Wait Mechanism**: Redis worker threads use high-precision non-blocking timers. When the current UNIX time equals or exceeds the score, the job is popped atomically from the sorted set and transferred to the `wait` queue in $O(\log N)$ time.
- **Zero Clock Drift**: Execution occurs at the exact designated millisecond.

---

## 3. Data Durability & Persistence Invariants

The architecture enforces a strict two-tier durability model:
1. **PostgreSQL as Single Source of Truth**:
   - Every email job has a record in the `email_jobs` table before it is pushed to Redis.
   - Statuses follow strict enum transitions:
     $$\text{SCHEDULED} \longrightarrow \text{PROCESSING} \longrightarrow \text{SENT} \text{ or } \text{RESCHEDULED} \text{ or } \text{FAILED}$$
2. **Redis as Persistent Execution Buffer**:
   - If Redis restarts, PostgreSQL still contains the full state of every job.
   - On backend boot, `emailService.reconcileOrphanedJobs()` queries PostgreSQL for all jobs in `SCHEDULED` or `RESCHEDULED` state. If any job is missing from BullMQ (e.g., due to a Redis flush), it is immediately re-enqueued with its remaining delay:
     $$\text{delayMs} = \max(0, \text{effectiveScheduledAt} - \text{Date.now()})$$
3. **Idempotency Guard**:
   - Before any SMTP invocation, the worker checks if `emailJob.status === 'SENT'`. If already sent, it skips execution immediately, preventing duplicate sends even under crash recovery scenarios.

---

## 4. Dual-Mode Worker Architecture

To meet the requirements of single-container free-tier cloud hosts (e.g., Render Free Web Service, Koyeb), the system supports **Dual-Mode Worker Execution**:

```
                              ┌───────────────────────────────────────────────┐
                              │                 SERVER.TS                     │
                              │                                               │
     Incoming Requests ─────> │  • Express REST API Server (/api/v1)          │
                              │  • CORS, JWT & Zod Validation Middleware      │
                              │  • Healthcheck Endpoint (/api/health)         │
                              └──────────────────────┬────────────────────────┘
                                                     │
                                   RUN_WORKER_IN_API == true?
                                    /                         \
                                  YES                          NO
                                  /                             \
                ┌───────────────────────────────┐   ┌───────────────────────────────┐
                │  CO-LOCATED WORKER THREAD     │   │  STANDALONE WORKER PROCESS    │
                │  (Single Container Free PaaS) │   │  (Dedicated Local / Cloud)    │
                │  • Boots startEmailWorker()   │   │  • tsx watch email.worker.ts  │
                │  • Zero extra memory / dyno   │   │  • Decoupled scaling          │
                └───────────────────────────────┘   └───────────────────────────────┘
```
