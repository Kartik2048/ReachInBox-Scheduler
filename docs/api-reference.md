# REST API Reference

All API requests (except `/api/health`, `/api/auth/google`, `/api/auth/demo`, and `/api/emails/:id/preview`) require the standard JWT authorization header:
```http
Authorization: Bearer <token>
Content-Type: application/json
```

---

## 1. System Health

### `GET /api/health`
Lightweight endpoint designed for cloud keep-alive pingers (e.g. UptimeRobot, Render health checks).

**Response (200 OK):**
```json
{
  "status": "ok",
  "uptime": 124.58,
  "timestamp": "2026-10-24T18:30:00.000Z"
}
```

---

## 2. Authentication

### `POST /api/auth/google`
Authenticates a user via Google OAuth 2.0 credential. On first login, automatically provisions **2 Ethereal SMTP sender accounts**.

**Request:**
```json
{
  "credential": "<Google_ID_Token_From_React_OAuth>"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "c1f7b7e2-4113-4a11-b4f1-93e18a36ef01",
      "email": "alex.user@gmail.com",
      "name": "Alex User",
      "avatarUrl": "https://lh3.googleusercontent.com/a/..."
    },
    "senders": [
      {
        "id": "d8e3b2a1-...",
        "name": "Primary Outreach",
        "email": "outreach.demo1@ethereal.email",
        "smtpHost": "smtp.ethereal.email",
        "smtpPort": 587,
        "maxEmailsPerHour": 200
      }
    ]
  }
}
```

### `POST /api/auth/demo`
Reviewer 1-click evaluation login without requiring a Google Cloud Client ID.

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsIn...",
    "user": {
      "id": "demo-eval-user-id",
      "email": "reviewer.demo@reachinbox.ai",
      "name": "ReachInbox Reviewer",
      "avatarUrl": "https://api.dicebear.com/7.x/bottts/svg?seed=ReachInboxDemo"
    },
    "senders": [...]
  }
}
```

---

## 3. Senders Management

### `GET /api/senders`
Returns all Ethereal SMTP sender accounts belonging to the authenticated user, including current-hour Redis usage.

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "e9b5f4c2-...",
      "userId": "c1f7b7e2-...",
      "name": "Primary Outreach",
      "email": "outreach.1@ethereal.email",
      "smtpHost": "smtp.ethereal.email",
      "smtpPort": 587,
      "maxEmailsPerHour": 200,
      "currentHourSentCount": 14,
      "createdAt": "2026-10-24T18:00:00.000Z"
    }
  ]
}
```

### `POST /api/senders`
Provisions a new Ethereal SMTP account on demand.

**Request:**
```json
{
  "name": "Secondary Alias",
  "maxEmailsPerHour": 250
}
```

---

## 4. Email Batch Scheduling & Timelines

### `POST /api/emails/schedule`
Schedules a bulk batch of emails with smart upfront staggering and chunked persistence.

**Request:**
```json
{
  "senderId": "e9b5f4c2-...",
  "subject": "Partnership Opportunity",
  "body": "Hi {{name}},\n\nWould love to connect regarding our new platform.",
  "recipients": [
    "lead1@acme.corp",
    "lead2@growth.io",
    "founder3@saas.com"
  ],
  "startTime": "2026-10-24T19:00:00.000Z",
  "delayBetweenEmailsMs": 2000,
  "hourlyLimit": 200
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "batchId": "b1a2c3d4-...",
    "totalScheduled": 3,
    "firstScheduledAt": "2026-10-24T19:00:00.000Z",
    "lastScheduledAt": "2026-10-24T19:00:04.000Z"
  },
  "message": "Successfully scheduled 3 emails."
}
```

### `GET /api/emails/scheduled`
Returns active jobs (`SCHEDULED`, `RESCHEDULED`, `PROCESSING`) ordered by `effectiveScheduledAt ASC`.

**Query Parameters:**
- `page` (optional, default `1`)
- `limit` (optional, default `50`)
- `search` (optional, filters by recipient or subject)

### `GET /api/emails/sent`
Returns completed and failed jobs (`SENT`, `FAILED`) ordered by `sentAt DESC`.

### `GET /api/emails/stats`
Aggregates live counters for dashboard metrics cards.

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "scheduledCount": 42,
    "rescheduledCount": 8,
    "sentCount": 150,
    "failedCount": 0
  }
}
```

### `GET /api/emails/:id/preview`
Renders an interactive HTML preview of the email in the browser. Accessible publicly to allow evaluators to inspect test messages even when outbound port 587 is blocked by free cloud PaaS hosts.
