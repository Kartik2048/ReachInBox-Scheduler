# ReachInbox Job Scheduler Documentation Index

Welcome to the comprehensive technical documentation for the **ReachInbox Full-Stack Email Job Scheduler**. This system implements a high-throughput, distributed email engine built on a **Zero-Cron Architecture** using Node.js, Express, TypeScript, BullMQ, Redis, PostgreSQL (Prisma), Nodemailer (Ethereal), React 18, and Tailwind CSS.

---

## Documentation Sections

| Section | Document | Description |
| :--- | :--- | :--- |
| **1. System Overview** | [overview.md](./overview.md) | High-level system overview, problem statement, key constraints, and core guarantees. |
| **2. Architecture Design** | [architecture.md](./architecture.md) | In-depth architectural blueprint, component interaction, and Mermaid dataflow diagrams. |
| **3. Rate Limiting & Rescheduling** | [rate-limiting.md](./rate-limiting.md) | Mathematical mechanics of the atomic Redis Lua rate-limiter, inter-email spacing, and BullMQ `moveToDelayed()` state machine. |
| **4. REST API Reference** | [api-reference.md](./api-reference.md) | Full API specification covering Auth, Senders, Email Scheduling, Timeline Queries, and Metrics endpoints. |
| **5. Frontend Dashboard Guide** | [frontend-guide.md](./frontend-guide.md) | UI walkthrough covering the CSV lead engine, sample lead generator, live dispatch estimator, and real-time tabs. |
| **6. Deployment & Cloud Setup** | [deployment.md](./deployment.md) | Step-by-step deployment guide for Render (Free Web Service), Vercel, Upstash Redis, and Neon/Supabase PostgreSQL. |
| **7. Testing & Verification Suite** | [verification-and-testing.md](./verification-and-testing.md) | Automated audit and test suite documentation, including the 4-stage test runner and Python test tooling. |

---

## Quick Navigation

- Looking to spin up the system locally? See the [Deployment & Setup Guide](./deployment.md#local-development-setup).
- Want to inspect the Zero-Cron mathematical proof? See [Architecture Design](./architecture.md#why-zero-cron).
- Want to view the exact Redis Lua script? See [Rate Limiting & Rescheduling](./rate-limiting.md#the-atomic-lua-script).
- Need to test endpoints via cURL or Postman? See [API Reference](./api-reference.md).
