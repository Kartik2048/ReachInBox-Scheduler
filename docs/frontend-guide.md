# Frontend Dashboard Guide

The ReachInbox frontend is built using **React 18, Vite, TypeScript, Tailwind CSS, and Lucide React**. It provides a sleek, modern dark-themed user interface matching ReachInbox brand aesthetics.

---

## 1. Authentication View (`/login`)

```
 ┌─────────────────────────────────────────────────────────────┐
 │                    ReachInbox Scheduler                     │
 │      High-throughput distributed email engine powered       │
 │            by BullMQ & Redis Lua rate limiting              │
 │                                                             │
 │            ┌──────────────────────────────────┐             │
 │            │       Sign in with Google        │             │
 │            └──────────────────────────────────┘             │
 │                                                             │
 │                 ──── EVALUATION ACCESS ────                 │
 │                                                             │
 │      ┌────────────────────────────────────────────────┐     │
 │      │ ⚡ Quick Reviewer Login (Demo Account)        │     │
 │      └────────────────────────────────────────────────┘     │
 └─────────────────────────────────────────────────────────────┘
```

1. **Google OAuth 2.0**: Uses `@react-oauth/google` to trigger real OAuth consent popups and exchange ID tokens with the backend.
2. **Reviewer Demo Mode**: Allows 1-click frictionless access without configuring Google Cloud Console, automatically provisioning 2 Ethereal SMTP senders for immediate evaluation.

---

## 2. Dashboard Shell Layout

The dashboard is structured into three distinct zones:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ReachInbox  │  [Q Search recipient or subject...]  │ [Queue Active] [User] │
├──────────────┴─────────────────────────────────────┴───────────────────────┤
│ [+ Compose]  │  [Scheduled (42)]  [Rescheduled (8)]  [Sent (150)] [Total]    │
│              ├─────────────────────────────────────────────────────────────┤
│ ⏱ Scheduled  │  Recipient & Subject    Sender   Scheduled At   Status       │
│ ✉ Sent       │  alex@acme.corp         Primary  Today 10:15am  SCHEDULED    │
│              │  sarah@cyber.ai         Primary  Today 10:15am  RESCHEDULED  │
│ ───────────  │                                                             │
│ Senders      │                                                             │
│ • Outreach 1 │                                                             │
│   14 / 200   │                                                             │
└──────────────┴─────────────────────────────────────────────────────────────┘
```

### Key UI Features

1. **Auto-Refreshed Counters**: The sidebar counters (`Scheduled`, `Sent`) and table rows poll every 3 seconds to reflect real-time status transitions (`SCHEDULED` &rarr; `PROCESSING` &rarr; `RESCHEDULED` or `SENT`) without requiring page reloads.
2. **Active Senders Card**: Displays all registered Ethereal senders alongside live hourly quota usage from Redis (`e.g., 14 / 200 this hr`).
3. **Email Preview Buttons**: Every sent email row includes a direct **"View Ethereal Email ↗"** button that opens the real Ethereal inspection URL in a new tab.

---

## 3. Compose & Bulk Scheduling Modal

Opening the **`+ Compose`** modal provides powerful cold outreach controls:

### CSV / TXT Lead Engine
- **Drag & Drop Upload**: Accepts `.csv` or `.txt` files containing recipient data.
- **Client-Side Regex Parser**: Employs `/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g` to automatically extract, lowercase, and deduplicate all emails.
- **1-Click 100 Leads Generator**: Evaluators can click **"Sample 100 Leads CSV"** to instantly generate 100 realistic leads across enterprise domains (`acme.org`, `saasgrowth.io`, etc.) for load testing.
- **Email Counter Badge**: Displays a live badge indicating `"X valid unique emails detected"` with a collapsible preview drawer.

### Live Dispatch Estimator
Before submitting, the UI dynamically calculates and displays:
> *"Scheduling 100 emails with 2s spacing and max 200/hr quota &rarr; Dispatched across 1 clock hour window(s) (~3.3 min active spacing)."*
