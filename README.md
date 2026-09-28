# ReachInbox Email Scheduler

A production-grade email scheduler service and dashboard built with **Express, BullMQ, Redis, PostgreSQL, Elasticsearch, and Next.js 14**.

## Architecture Overview

### Scheduling (no cron)
Scheduling is done entirely with **BullMQ delayed jobs**. When a batch is submitted, each recipient becomes its own `Email` row in Postgres (status `SCHEDULED`) and its own BullMQ job (`emailQueue.add(..., { delay, jobId: email.id })`). The worker sits idle until each job's delay elapses — there is no polling loop and no cron process anywhere in the codebase.

### Persistence & restart resilience
- **Redis AOF** (`--appendonly yes`) is enabled in `docker-compose.yml`, so queued/delayed jobs survive a Redis restart.
- **Boot reconciliation** (`EmailService.reconcileOnBoot`, called from `index.ts` on startup): queries every `Email` row still in `SCHEDULED`/`PROCESSING` and re-enqueues any whose BullMQ job is missing. This is the real safety net — it means correctness doesn't depend purely on Redis's own persistence; the Postgres rows are the source of truth and the queue is reconciled against them on every boot.
- **Idempotency:** each job is added with `jobId = email.id` (BullMQ no-ops on a duplicate id). More importantly, the worker only "claims" a row with `prisma.email.updateMany({ where: { id, status: { notIn: ['SENT'] } }, data: { status: 'PROCESSING' } })` — if `claimed.count === 0`, the email was already sent and the worker returns immediately. That guard is what actually prevents a double-send, not just the jobId.

### Rate limiting & concurrency
- **Per-sender hourly limit:** a Redis counter keyed `rate-limit:{senderEmail}:{YYYY-MM-DDTHH}`, incremented atomically per attempt with a 1-hour TTL. Safe across any number of worker processes since the count lives in Redis, not memory.
- **Configurable, not hardcoded:** `MAX_EMAILS_PER_HOUR_PER_SENDER` is the env default; the Compose form's "Hourly Limit" field overrides it per sender at schedule time (stored as `senderlimit:{senderEmail}` in Redis, read by the worker on every send — no redeploy needed).
- **On limit hit:** the job is **not** failed or dropped. The email's status flips to `RATE_LIMITED`, and a fresh job is enqueued with a delay to the top of the next hour. The original job completes normally (a no-op from BullMQ's point of view); the retry carries the send forward.
- **Min delay between sends:** enforced worker-wide via BullMQ's `limiter: { max: 1, duration: MIN_SEND_DELAY_MS }` (default 2000ms).
- **Concurrency:** `WORKER_CONCURRENCY` (default 5) controls how many jobs the worker processes in parallel.
- **Trade-off:** the min-delay limiter is global across all senders, not per-sender — a reasonable simplification for the assignment's scope, worth calling out explicitly.

### Slack notifications
Real Slack OAuth v2 (`incoming-webhook` + `chat:write` scopes). "Connect Slack" redirects to Slack's authorize URL with the backend user id as `state`; the callback exchanges the code and stores the resulting `incoming_webhook.url` on the `User` row. The worker POSTs to that webhook the moment a sender's hourly limit is hit (deduped to once per sender per hour window via a `SETNX` guard, so a 500-email batch doesn't spam 500 Slack messages). If a user hasn't connected Slack, `notifyRateLimitHit` is a silent no-op — never a crash — and connecting later works on the very next rate-limit hit with no redeploy.

### Search
Every schedule/status change is upserted into an `emails` Elasticsearch index. `GET /api/emails/search?q=` runs a `multi_match` across subject/body/recipient. If Elasticsearch is unreachable, the search endpoint transparently falls back to a Postgres `ILIKE` query rather than failing outright — and indexing failures never block the send/schedule path itself.

### Auth
Google login is real OAuth via **NextAuth** on the frontend (no mock user). The backend doesn't re-implement Google's OAuth dance; instead, the frontend forwards the already-verified profile (`googleId`, `email`, `name`, `avatar`) as headers on every API call, and `middleware/auth.ts` upserts the matching `User` row and attaches `req.user`. This keeps the OAuth surface in one place while still giving the backend a stable internal `userId` for every request.

**Known limitation:** `/admin/queues` (Bull Board) is left open, and `/api/auth/slack/connect` takes a plain `uid` query param instead of the header-based auth. Both are because a normal browser navigation (an `<a href>` or a typed URL) can't carry custom headers — only `fetch`/`axios` calls can. A production version would put these behind real session cookies; this is documented here rather than silently left broken.

---

## Setup & Installation

### 1. Start infrastructure
```bash
docker compose up -d
```
Spins up PostgreSQL 16 (5432), Redis 7 with AOF persistence (6379), and Elasticsearch 8.15 (9200).

### 2. Backend
```bash
cd backend
npm install
cp .env.example .env
# fill in SLACK_CLIENT_ID / SLACK_CLIENT_SECRET (see below); everything else has a working local default
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```
Runs on `http://localhost:4000`. Bull Board dashboard: `http://localhost:4000/admin/queues`.

### 3. Frontend
```bash
cd frontend
npm install
cp .env.example .env.local
# fill in GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET and NEXTAUTH_SECRET (openssl rand -base64 32)
npm run dev
```
Runs on `http://localhost:3000`.

### 4. Google OAuth setup
Google Cloud Console → APIs & Services → Credentials → OAuth Client ID (Web application) → Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`.

### 5. Slack app setup
api.slack.com/apps → Create New App → OAuth & Permissions → add `incoming-webhook` and `chat:write` scopes → Redirect URL: `http://localhost:4000/api/auth/slack/callback` → copy the Client ID/Secret into `backend/.env`.

### 6. Ethereal Email
No setup needed — if `ETHEREAL_USER`/`ETHEREAL_PASS` are left blank, the worker auto-provisions a fresh Ethereal test account on first send and logs the preview URL for each sent message.

---

## Features Implemented

### Backend
- [x] BullMQ delayed-job scheduling (no cron)
- [x] Restart persistence via Redis AOF + boot-time reconciliation against Postgres
- [x] Idempotent sends (DB-level claim guard, not just BullMQ jobId dedup)
- [x] Redis-backed per-sender hourly rate limiting, configurable via env or per-request override, safe across multiple workers
- [x] Rate-limited jobs delayed to next hour window, never dropped
- [x] Configurable worker concurrency and minimum inter-send delay
- [x] Real Slack OAuth + live webhook notification on rate-limit hit, deduped per hour, silent no-op if not connected
- [x] Elasticsearch indexing + search endpoint, with Postgres fallback if ES is down
- [x] Live Bull Board dashboard at `/admin/queues`
- [x] Bulk CSV recipient scheduling with per-recipient send-time staggering

### Frontend
- [x] Real Google OAuth login (NextAuth), redirect to dashboard
- [x] Header with name/email/avatar + logout
- [x] Scheduled / Sent tabs with live data, loading and empty states
- [x] Compose modal: subject, body, CSV upload with detected-recipient count, start time, delay, hourly limit
- [x] One-click Slack connect
- [x] Reusable UI components (Button, Table, EmptyState, Spinner)

---

## Assumptions, shortcuts & trade-offs

- **Single Ethereal transporter**, not one real SMTP account per sender — multiple "senders" are distinguished logically (by `senderEmail` string and independent rate-limit counters), but all mail physically routes through one auto-provisioned Ethereal account. Documented here rather than standing up N fake mailboxes for a test assignment.
- **Min-send-delay limiter is global**, not per-sender (see Rate limiting section above).
- **`/admin/queues` has no auth** in this build (see Known limitation above).
- **No figma reference was available** at build time, so the dashboard/compose layout follows the written spec (header, tabs, compose modal, tables with the exact columns requested) rather than a pixel-matched design.
- **`RATE_LIMITED` rows are excluded from boot reconciliation** — they're expected to already have an active delayed retry job in Redis (protected by AOF). A row could theoretically be orphaned if Redis data is lost *and* a restart happens mid-rate-limit-delay; acceptable for this scope, called out rather than silently glossed over.

---

## Demo Video Checklist
1. Log in with Google → redirected to dashboard.
2. Click "Connect Slack" → complete OAuth → redirected back.
3. Compose: upload a CSV of ~5 emails, set hourly limit to 2, start time to "now", schedule.
4. Watch `/admin/queues` — jobs move from delayed → active → completed.
5. Refresh the dashboard — 2 emails show `SENT` (click through to the Ethereal preview URL logged in the backend console), remaining 3 show `RATE_LIMITED`, and a Slack message lands in the connected channel.
6. Stop the backend (`Ctrl+C`), wait, restart it — console prints `Reconciliation: re-enqueued N orphaned email(s)`; remaining emails still fire at their scheduled time.
