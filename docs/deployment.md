# Deployment & Cloud Setup Guide

## 1. Local Development Setup

### Prerequisites
- Node.js 18+ & npm
- Docker & Docker Compose (or local PostgreSQL 15 & Redis 7)

### Step 1: Start Infrastructure
```bash
# Start PostgreSQL 15 and Redis 7 Alpine
docker compose up -d
```

### Step 2: Configure & Start Backend
```bash
cd backend
cp .env.example .env

# Install dependencies & generate Prisma client
npm install
npx prisma generate
npx prisma migrate dev --name init

# Run verification suite
npm run verify

# Start development server
npm run dev
```

### Step 3: Configure & Start Frontend
```bash
cd ../frontend
cp .env.example .env

npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 2. Free-Tier Cloud Deployment Guide

The system is optimized for zero-cost hosting on popular developer cloud platforms:

| Layer | Provider | Free Tier Limits | ReachInbox Optimization |
| :--- | :--- | :--- | :--- |
| **Backend API + Worker** | Render | 512 MB RAM, 1 Web Service | Dual-Mode Worker (`RUN_WORKER_IN_API=true`) runs API & Worker in 1 process. |
| **Frontend UI** | Vercel | Unlimited bandwidth / SPA | Built with Vite; SPA rewrites handled in `vercel.json`. |
| **Queue & Cache** | Upstash Redis | 256 MB / 10k cmds/day | Memory hygiene (`removeOnComplete: 100`, `removeOnFail: 200`). |
| **Relational Database** | Neon / Supabase | 500 MB PostgreSQL | Indexed queries and connection-pooled Prisma Client. |

---

## 3. Render Backend Deployment (`render.yaml`)

1. Connect your repository to [Render.com](https://render.com).
2. Create a new **Blueprint** and point to `render.yaml`.
3. Set the following environment variables in the Render dashboard:
   - `DATABASE_URL`: Connection string from Neon or Supabase PostgreSQL (`postgresql://...`).
   - `REDIS_URL`: Connection string from Upstash Redis (`rediss://default:...@...upstash.io:6379`).
   - `JWT_SECRET`: Random 32-character string.
   - `FRONTEND_URL`: URL of your deployed Vercel frontend.
   - `RUN_WORKER_IN_API`: `true` (enables worker co-location).
   - `SMTP_FALLBACK_ON_PORT_BLOCK`: `true` (catches outbound port 587 blocks).

---

## 4. Vercel Frontend Deployment

1. Import the `/frontend` directory in [Vercel](https://vercel.com).
2. Set Framework Preset to **Vite**.
3. Set the following Environment Variables:
   - `VITE_API_BASE_URL`: Your Render backend API URL (e.g., `https://reachinbox-backend.onrender.com/api`).
   - `VITE_GOOGLE_CLIENT_ID`: Your Google OAuth 2.0 Client ID (optional if using 1-click Reviewer Demo Login).
4. Deploy! The included `frontend/vercel.json` automatically ensures client-side routing works without 404s.
