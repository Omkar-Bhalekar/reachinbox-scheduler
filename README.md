# ReachInbox Email Scheduler

A full-stack email scheduling application built as a Software Development Intern assignment for ReachInbox.ai.

The application allows users to authenticate, compose and schedule emails, upload recipient lists, control sending delays and hourly limits, monitor scheduled/sent emails, search email records, and receive Slack notifications when an hourly sending limit is reached.

---

## Features

### Authentication
- Google OAuth authentication
- Email/password registration and login
- JWT-based backend authentication for credential users
- Protected backend API routes
- Logout support
- User profile information in the dashboard

### Email Scheduling
- Schedule emails for a future date/time
- Send emails to multiple recipients
- Upload recipient emails through CSV/text input
- Configure:
  - Start time
  - Minimum delay between emails
  - Hourly sending limit
- Scheduled and sent email views
- Individual email detail page
- Search scheduled/sent email records

### Queue Processing
- BullMQ for persistent background job processing
- Redis as BullMQ's backing store
- Delayed jobs for future scheduled emails
- Configurable worker concurrency
- Configurable minimum delay between sends
- Automatic retry with exponential backoff
- Bull Board dashboard for queue monitoring

### Rate Limiting
- Per-sender hourly email limit
- Redis-backed hourly counters
- Safe rate limiting across multiple workers
- Emails exceeding the hourly limit are not dropped
- Rate-limited emails are rescheduled for the next available hour
- Slack notification is sent when the sender reaches the hourly limit

### Persistence & Reliability
- PostgreSQL database using Prisma ORM
- Email scheduling state is persisted in PostgreSQL
- BullMQ jobs are persisted in Redis
- Scheduled jobs survive application restarts
- Job IDs are associated with database email records
- Idempotency checks prevent stale/duplicate queue jobs from sending the same email again
- Startup reconciliation restores missing scheduled queue jobs

### Email Delivery
- Ethereal SMTP is used for development/test email delivery
- Sent email metadata is stored in PostgreSQL
- Ethereal preview URLs are stored for inspection

### Search
- Elasticsearch indexing for email records
- Search by email recipient, subject and body
- PostgreSQL fallback is available if Elasticsearch search is unavailable

### Slack Integration
- Slack OAuth connection
- Slack workspace/channel information is stored for the user
- Disconnect/reconnect support
- Rate-limit notifications through Slack

---

## Architecture

```text
                         ┌─────────────────────┐
                         │      Next.js        │
                         │      Frontend       │
                         │                     │
                         │ Login / Dashboard   │
                         │ Compose / Search    │
                         └──────────┬──────────┘
                                    │
                                    │ HTTP / REST
                                    ▼
                         ┌─────────────────────┐
                         │   Express Backend   │
                         │      TypeScript     │
                         │                     │
                         │ Auth / Email APIs   │
                         │ Slack OAuth         │
                         └──────┬──────┬───────┘
                                │      │
                 ┌──────────────┘      └──────────────┐
                 ▼                                    ▼
        ┌────────────────┐                   ┌────────────────┐
        │   PostgreSQL   │                   │     Redis      │
        │                │                   │                │
        │ Users          │                   │ BullMQ Queue   │
        │ Emails         │                   │ Rate Counters  │
        │ Email State    │                   │ OAuth State    │
        └────────────────┘                   └───────┬────────┘
                                                     │
                                                     ▼
                                            ┌─────────────────┐
                                            │  BullMQ Worker  │
                                            │                 │
                                            │ Rate limiting   │
                                            │ Idempotency     │
                                            │ Delay handling  │
                                            │ SMTP delivery   │
                                            └────────┬────────┘
                                                     │
                                                     ▼
                                            ┌─────────────────┐
                                            │  Ethereal SMTP  │
                                            └─────────────────┘

                         ┌─────────────────────┐
                         │    Elasticsearch    │
                         │ Email search index  │
                         └─────────────────────┘

                         ┌─────────────────────┐
                         │        Slack        │
                         │ Rate-limit alerts   │
                         └─────────────────────┘
```

---

## Tech Stack

### Frontend
- Next.js
- React
- TypeScript
- Tailwind CSS
- NextAuth
- Axios

### Backend
- Node.js
- Express.js
- TypeScript
- Prisma
- PostgreSQL
- BullMQ
- Redis
- Elasticsearch
- Nodemailer
- JWT
- bcrypt

### Infrastructure
- Docker Compose
- PostgreSQL
- Redis
- Elasticsearch

### Integrations
- Google OAuth
- Slack OAuth
- Ethereal SMTP

---

## Project Structure

```text
reachinbox-scheduler/
│
├── backend/
│   ├── prisma/
│   │   ├── migrations/
│   │   └── schema.prisma
│   │
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── queues/
│   │   ├── services/
│   │   ├── workers/
│   │   └── index.ts
│   │
│   ├── .env.example
│   └── package.json
│
├── frontend/
│   ├── app/
│   │   ├── api/
│   │   ├── dashboard/
│   │   ├── email/
│   │   └── page.tsx
│   │
│   ├── components/
│   │   ├── email/
│   │   ├── layout/
│   │   └── ComposeModal.tsx
│   │
│   ├── lib/
│   ├── .env.example
│   └── package.json
│
├── docker-compose.yml
└── README.md
```

---

## Prerequisites

Install the following before running the application:

- Node.js 18+
- npm
- Docker Desktop
- Git

Google OAuth credentials are required for Google login.
Slack OAuth credentials are required if Slack notifications are being tested.

---

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/Omkar-Bhalekar/reachinbox-scheduler.git
cd reachinbox-scheduler
```

### 2. Start Infrastructure

The project uses Docker Compose for PostgreSQL, Redis and Elasticsearch.

From the project root:

```bash
docker compose up -d
```

Check running containers:

```bash
docker compose ps
```

The services use:

| Service       | Port |
|---------------|------|
| PostgreSQL    | 5432 |
| Redis         | 6379 |
| Elasticsearch | 9200 |

### 3. Backend Setup

```bash
cd backend
npm install
```

Create the environment file.

Windows:

```powershell
copy .env.example .env
```

Linux/macOS:

```bash
cp .env.example .env
```

Configure the required environment variables. Example:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/reachinbox"
REDIS_HOST="localhost"
REDIS_PORT="6379"

ELASTICSEARCH_NODE="http://localhost:9200"

PORT=4000
FRONTEND_URL="http://localhost:3000"

AUTH_JWT_SECRET="your-long-random-secret"

WORKER_CONCURRENCY=5
MIN_SEND_DELAY_MS=2000
MAX_EMAILS_PER_HOUR_PER_SENDER=200

ETHEREAL_USER=""
ETHEREAL_PASS=""

SLACK_CLIENT_ID=""
SLACK_CLIENT_SECRET=""
SLACK_REDIRECT_URI="http://localhost:4000/api/auth/slack/callback"
```

> Do not commit `.env` files or real credentials.

### 4. Database Setup

Generate the Prisma client:

```bash
npx prisma generate
```

Run migrations:

```bash
npx prisma migrate dev
```

The migration creates the required PostgreSQL tables and indexes.

### 5. Start the Backend

```bash
npm run dev
```

The backend runs on `http://localhost:4000`.

Health check: `http://localhost:4000/health`

Expected response:

```json
{
  "status": "ok"
}
```

### 6. Bull Board

Bull Board is available at `http://localhost:4000/admin/queues`.

It provides visibility into BullMQ jobs including:

- Waiting jobs
- Delayed jobs
- Active jobs
- Completed jobs
- Failed jobs

This is useful for observing scheduled email processing.

### 7. Frontend Setup

Open another terminal:

```bash
cd frontend
npm install
```

Create the environment file.

Windows:

```powershell
copy .env.example .env.local
```

Linux/macOS:

```bash
cp .env.example .env.local
```

Configure:

```env
NEXTAUTH_SECRET="your-nextauth-secret"

GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

NEXT_PUBLIC_BACKEND_URL="http://localhost:4000"
```

Start the frontend:

```bash
npm run dev
```

Open `http://localhost:3000`.

---

## Google OAuth Configuration

Create OAuth credentials in Google Cloud Console.

Use the following local development callback URL:

```text
http://localhost:3000/api/auth/callback/google
```

Add the corresponding client ID and client secret to `frontend/.env.local`.

The application uses NextAuth for the Google authentication flow.

## Slack OAuth Configuration

Create a Slack application and configure the OAuth redirect URL:

```text
http://localhost:4000/api/auth/slack/callback
```

The backend uses the Slack OAuth flow to associate a Slack workspace with the authenticated application user.

The required Slack permissions include:

```text
chat:write
incoming-webhook
```

After connecting Slack from the application, rate-limit notifications can be delivered to the configured Slack channel.

---

## Email Scheduling Flow

```text
User
 │
 │ Schedule email
 ▼
Next.js Frontend
 │
 │ POST /api/emails/schedule
 ▼
Express API
 │
 ├── Validate request
 ├── Create Email records
 ├── Index records in Elasticsearch
 └── Add BullMQ delayed jobs
             │
             ▼
          Redis
             │
             │ scheduled time reached
             ▼
        BullMQ Worker
             │
             ├── Idempotency check
             ├── Rate-limit check
             ├── Minimum delay enforcement
             └── SMTP delivery
                     │
                     ▼
                Ethereal SMTP
                     │
                     ▼
                PostgreSQL
```

---

## Rate Limiting

The sender hourly limit is configurable through:

```env
MAX_EMAILS_PER_HOUR_PER_SENDER=200
```

A per-request hourly limit can also be supplied when scheduling emails.

Redis maintains the hourly sending counter. The worker uses a key based on the sender and current hour:

```text
rate-limit:<sender>:<hour>
```

When the hourly limit is reached:

1. The current job is not sent.
2. The email is marked as `RATE_LIMITED`.
3. The job is scheduled for the next available hour.
4. The email is not dropped.
5. A Slack notification is sent once for that sender/hour.
6. The retry job remains persistent in BullMQ.

This allows multiple workers to share the same rate-limit state through Redis.

## Minimum Send Delay

The minimum delay between sends is configurable:

```env
MIN_SEND_DELAY_MS=2000
```

The BullMQ worker uses a limiter to enforce the configured send interval. With the value above, the worker does not continuously send emails without respecting the configured spacing.

## Worker Concurrency

Worker concurrency is configurable through:

```env
WORKER_CONCURRENCY=5
```

The value controls how many jobs the worker can process concurrently. The rate limit remains backed by Redis so multiple worker instances can coordinate against the same hourly limit.

---

## Persistence and Restart Behavior

The application does not rely on in-memory timers or `setTimeout` for scheduled email delivery. Instead, PostgreSQL and Redis/BullMQ together store the required scheduling state. This means scheduled jobs remain available when the backend process restarts.

On startup, the email service performs reconciliation for scheduled/rate-limited emails whose corresponding queue job is missing. The system also stores the BullMQ job ID on the email record.

## Idempotency

Email delivery uses a database state transition before sending. An email must be successfully claimed by the worker before the SMTP operation proceeds. This prevents stale or duplicate BullMQ jobs from processing the same database email record. The worker also verifies the expected job ID when applicable.

The implementation intentionally does not automatically reset `PROCESSING` emails after a crash, because an SMTP operation may already have occurred immediately before the process stopped. This avoids blindly resending potentially delivered emails.

> **Note:** With a normal SMTP server, PostgreSQL and BullMQ, mathematically exactly-once external email delivery cannot be guaranteed across a crash occurring precisely after SMTP accepts the message but before the database records `SENT`. The implementation therefore uses persistent state and idempotent job claiming to minimize duplicate sends.

---

## Email Search

Email records are indexed in Elasticsearch. Search supports matching against:

- Recipient email
- Subject
- Body

The API also provides a PostgreSQL fallback if Elasticsearch is unavailable.

---

## Authentication Architecture

There are two authentication paths.

### Google

```text
Google OAuth
     ↓
NextAuth
     ↓
Frontend session
     ↓
Backend Google identity headers
```

### Email / Password

```text
Email + Password
       ↓
Express
       ↓
bcrypt password verification
       ↓
JWT
       ↓
Frontend session
       ↓
Bearer token
       ↓
Protected backend API
```

Passwords are stored as bcrypt hashes rather than plaintext.

---

## Main API Endpoints

### Health

```text
GET /health
```

### Authentication

```text
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/whoami
```

### Slack

```text
POST /api/auth/slack/connect
GET  /api/auth/slack/callback
POST /api/auth/slack/disconnect
```

### Emails

```text
POST /api/emails/schedule
GET  /api/emails
GET  /api/emails/search
GET  /api/emails/:id
```

Protected endpoints require authentication.

---

## Database Model

### User

Stores:

- User identity
- Google account information
- Password hash
- Slack integration information
- User email records

### Email

Stores scheduling and delivery information including:

- Recipient
- Subject
- Body
- Sender
- Scheduled time
- Status
- Job ID
- Sent time
- Preview information
- User association

Email status values:

```text
SCHEDULED
PROCESSING
SENT
FAILED
RATE_LIMITED
```

---

## Testing the Scheduler

A simple local test:

1. Start Docker services.
2. Start the backend.
3. Start the frontend.
4. Register/login.
5. Open Compose.
6. Add one or more recipients.
7. Enter a subject and body.
8. Select a future start time.
9. Configure the delay and hourly limit.
10. Click Schedule.
11. Open Bull Board at `http://localhost:4000/admin/queues`.
12. Observe the job as delayed.
13. When the scheduled time is reached, the worker processes the job.
14. Verify the email moves from Scheduled to Sent.
15. Open the Ethereal preview URL to inspect the delivered test email.

## Testing Rate Limiting

Configure:

```env
MAX_EMAILS_PER_HOUR_PER_SENDER=2
```

Then schedule four emails for the same sender. Expected behavior:

```text
Email 1 → SENT
Email 2 → SENT
Email 3 → RATE_LIMITED → next hour
Email 4 → RATE_LIMITED → next hour
```

The rate-limited emails remain persisted and are not discarded. A Slack notification is generated when the sender reaches the hourly limit.

---

## Useful Commands

### Backend

```bash
npm install                 # Install dependencies
npm run dev                 # Development server
npm run type-check          # Type checking
npx prisma generate         # Generate Prisma client
npx prisma migrate dev      # Run database migrations
npx prisma migrate status   # Migration status
```

### Frontend

```bash
npm install                 # Install dependencies
npm run dev                 # Development server
npm run build               # Production build
```

### Docker

```bash
docker compose up -d        # Start services
docker compose ps           # View services
docker compose logs         # View logs
docker compose down         # Stop services
```

---

## Environment Variables

### Backend

| Variable                         | Purpose                               |
|----------------------------------|---------------------------------------|
| `DATABASE_URL`                   | PostgreSQL connection                 |
| `REDIS_HOST`                     | Redis hostname                        |
| `REDIS_PORT`                     | Redis port                            |
| `ELASTICSEARCH_NODE`             | Elasticsearch URL                     |
| `PORT`                           | Backend port                          |
| `FRONTEND_URL`                   | Frontend origin                       |
| `AUTH_JWT_SECRET`                | Backend JWT signing secret            |
| `WORKER_CONCURRENCY`             | BullMQ worker concurrency             |
| `MIN_SEND_DELAY_MS`              | Minimum delay between sends           |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | Default hourly sender limit           |
| `ETHEREAL_USER`                  | Optional persistent Ethereal username |
| `ETHEREAL_PASS`                  | Optional persistent Ethereal password |
| `SLACK_CLIENT_ID`                | Slack OAuth client ID                 |
| `SLACK_CLIENT_SECRET`            | Slack OAuth client secret             |
| `SLACK_REDIRECT_URI`             | Slack OAuth callback                  |

### Frontend

| Variable                  | Purpose                     |
|---------------------------|-----------------------------|
| `NEXTAUTH_SECRET`         | NextAuth session secret     |
| `GOOGLE_CLIENT_ID`        | Google OAuth client ID      |
| `GOOGLE_CLIENT_SECRET`    | Google OAuth client secret  |
| `NEXT_PUBLIC_BACKEND_URL` | Backend API URL             |

---

## Assumptions and Trade-offs

**Ethereal SMTP** — Ethereal is used instead of a production email provider because this assignment requires a safe fake SMTP environment for testing.

**Queue-based scheduling** — BullMQ delayed jobs are used instead of cron or in-memory timers so scheduling survives application restarts.

**Redis rate limiting** — Redis provides shared atomic state for hourly sender limits, allowing multiple worker instances to coordinate.

**PostgreSQL as source of truth** — Email state is persisted in PostgreSQL. Redis/BullMQ handles background execution rather than being the primary source of email state.

**Elasticsearch** — Used for efficient email search while PostgreSQL remains the persistent database.

**SMTP delivery semantics** — External SMTP delivery cannot provide absolute exactly-once semantics across every possible process crash boundary. The implementation uses database state transitions and job identity checks to prevent duplicate processing wherever possible.

---

## Assignment Requirement Mapping

| Requirement                | Implementation                        |
|----------------------------|---------------------------------------|
| TypeScript backend         | Express + TypeScript                  |
| React/Next.js frontend     | Next.js + React + TypeScript          |
| PostgreSQL/MySQL           | PostgreSQL + Prisma                   |
| BullMQ                     | BullMQ email queue                    |
| Redis                      | Queue persistence + rate limiting     |
| No cron                    | BullMQ delayed jobs                   |
| Persistent scheduling      | PostgreSQL + Redis/BullMQ             |
| Worker concurrency         | `WORKER_CONCURRENCY`                  |
| Minimum send delay         | `MIN_SEND_DELAY_MS`                   |
| Hourly sender limit        | Redis-backed rate limiting            |
| Rate-limit rescheduling    | BullMQ retry/delayed job              |
| Slack notification         | Slack OAuth + webhook notification    |
| Elasticsearch search       | Email indexing/search                 |
| Ethereal SMTP              | Nodemailer + Ethereal                 |
| Idempotency                | Database claim + job ID validation    |
| Queue monitoring           | Bull Board                            |
| Google OAuth               | NextAuth Google provider              |
| Email/password auth        | bcrypt + JWT                          |
| Scheduled/Sent views       | Dashboard tabs                        |
| CSV/text recipients        | Compose interface                     |
| Email detail view          | `/email/[id]`                         |
| Search                     | Elasticsearch-backed API              |
| Loading/empty/error UX     | Frontend state handling               |

---

## Demo Flow

For a short demonstration:

1. Login/register.
2. Show the dashboard.
3. Open Compose.
4. Add multiple recipients.
5. Configure start time, delay and hourly limit.
6. Schedule the emails.
7. Open Bull Board and show delayed jobs.
8. Wait for processing.
9. Show emails moving to Sent.
10. Open an email detail page.
11. Demonstrate search.
12. Demonstrate a low hourly limit and show rate-limited emails.
13. Show the corresponding Slack notification.
14. Restart the backend and demonstrate that persistent scheduled jobs are not lost.

---

## Security Notes

- Secrets are stored in environment variables.
- `.env` and `.env.local` files are ignored by Git.
- Passwords are hashed with bcrypt.
- Backend credential authentication uses signed JWTs.
- Slack access tokens are stored server-side.
- OAuth credentials should never be committed to the repository.

---

## Repository

GitHub: https://github.com/Omkar-Bhalekar/reachinbox-scheduler

## Author

**Omkar Bhalekar**
Software Development Intern Assignment — ReachInbox.ai
