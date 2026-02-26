# CodeSentinel

> Automated security scanning for GitHub repositories. Catch secrets, injection vulnerabilities, and misconfigurations before they ship.

CodeSentinel is a GitHub App that automatically scans pull requests for security issues in startup-stack code (Next.js, Supabase, Firebase, Stripe, OpenAI patterns). It uses deterministic pattern matching to provide reproducible, zero-hallucination security analysis.

## Features

- **12 Security Rules** - Detects hardcoded secrets, SQL injection, XSS, insecure cookies, exposed service keys, and more
- **Automatic PR Scanning** - Triggers on every pull request with inline code review comments
- **Risk Scoring** - 0-100 risk score with severity-based weighting (critical, high, medium, low)
- **Dashboard** - View scans, findings, and manage muted rules per repository
- **Deterministic Pattern Matching** - No AI hallucinations, reproducible results every time
- **Inline PR Comments** - Direct feedback on specific lines of code with fix suggestions

## Architecture

CodeSentinel consists of four main components:

- **Next.js 15 App** - Dashboard UI, API routes, and GitHub webhook handler
- **BullMQ Worker** - Asynchronous scan processing in a separate Node.js process
- **PostgreSQL 16** - Persistent storage for scans, findings, and configuration (via Drizzle ORM)
- **Redis 7** - Job queue and worker coordination

## Security Rules

| Rule ID | Severity | Description |
|---------|----------|-------------|
| `hardcoded-secrets` | Critical | Detects hardcoded API keys (Stripe, AWS, GitHub, OpenAI, SendGrid, Slack, JWT) |
| `env-committed` | Critical | Flags .env files with real values being committed |
| `sql-injection` | Critical | Identifies SQL queries built with string interpolation |
| `next-public-secret` | High | Catches secrets in NEXT_PUBLIC_ environment variables |
| `supabase-service-key-client` | High | Detects Supabase service role keys in client-side code |
| `dangerous-innerhtml` | High | Flags dangerouslySetInnerHTML with dynamic content |
| `permissive-cors` | High | Identifies overly permissive CORS configurations |
| `stripe-no-webhook-verify` | High | Detects unverified Stripe webhook handlers |
| `insecure-jwt` | High | Finds JWT implementations without proper signatures |
| `unsafe-eval` | Medium | Flags use of eval() and Function() constructor |
| `exposed-service-keys` | Medium | Catches service account keys in client bundles |
| `insecure-cookie-flags` | Medium | Identifies cookies missing Secure/HttpOnly flags |

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm (recommended) or npm
- Docker (for local PostgreSQL + Redis)

### Local Development

1. **Clone and install dependencies**

```bash
git clone <repository-url>
cd codesentinel
pnpm install
```

2. **Copy environment file**

```bash
cp .env.example .env
```

3. **Start PostgreSQL and Redis**

```bash
docker compose up -d
```

4. **Run database migrations**

```bash
pnpm db:generate
pnpm db:migrate
```

5. **Start the development server**

```bash
pnpm dev
```

6. **Start the worker** (in a separate terminal)

```bash
pnpm worker:dev
```

The dashboard will be available at `http://localhost:3000`.

### GitHub App Setup

To enable PR scanning, create and configure a GitHub App:

1. **Create a GitHub App** at `github.com/settings/apps/new`

2. **Configure Permissions**
   - **Pull requests:** Read & Write
   - **Contents:** Read-only
   - **Issues:** Write (for PR comments)

3. **Subscribe to Events**
   - `pull_request`
   - `installation`
   - `installation_repositories`

4. **Set Webhook URL**
   - URL: `https://your-domain.com/api/webhooks/github`
   - Secret: Generate a random string (e.g., `openssl rand -hex 32`)

5. **Generate Private Key**
   - Download the private key file
   - Convert to single-line format for .env:
     ```bash
     cat private-key.pem | base64
     ```

6. **Add credentials to .env**

```env
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
GITHUB_APP_WEBHOOK_SECRET=your_webhook_secret
GITHUB_APP_CLIENT_ID=Iv1.abc123
GITHUB_APP_CLIENT_SECRET=abc123def456
SESSION_SECRET=your_session_secret
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

7. **Install the app** on repositories you want to scan

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start Next.js dev server on port 3000 |
| `pnpm build` | Build production bundle |
| `pnpm start` | Start production server |
| `pnpm worker` | Run BullMQ worker (production) |
| `pnpm worker:dev` | Run worker with file watching |
| `pnpm db:generate` | Generate Drizzle migration files |
| `pnpm db:migrate` | Apply database migrations |
| `pnpm db:studio` | Open Drizzle Studio (database GUI) |
| `pnpm test` | Run tests in watch mode |
| `pnpm test:run` | Run all tests once (354 tests) |
| `pnpm typecheck` | Run TypeScript type checking |

## Testing

CodeSentinel has comprehensive test coverage with 354 tests:

```bash
# Run all tests once
pnpm test:run

# Watch mode for development
pnpm test
```

Tests cover:
- All 12 security rules with positive/negative cases
- Scan engine (file classification, diff parsing, deduplication)
- Risk scoring algorithm
- Database queries
- GitHub webhook handling

## Tech Stack

- **Frontend:** Next.js 15, React 19, TypeScript 5, Tailwind CSS 4
- **Backend:** Next.js API routes, BullMQ workers
- **Database:** PostgreSQL 16 with Drizzle ORM (postgres.js driver)
- **Queue:** BullMQ + Redis 7 (ioredis)
- **GitHub Integration:** @octokit/app, @octokit/rest, @octokit/webhooks
- **Auth:** JWT sessions with jose library
- **Logging:** Pino with structured logging
- **Testing:** Vitest
- **Validation:** Zod

## Configuration

### Scan Limits

Default limits can be configured in `src/lib/scan-limits.ts`:

- **Max files per scan:** 500 files
- **Max file size:** 512KB per file
- **Scan timeout:** 2 minutes
- **Rule timeout:** 5 seconds per rule

### Muted Rules

Rules can be muted per repository via the dashboard. Muted rules are excluded from future scans but don't affect historical findings.

## Deployment

### Environment Variables

Required environment variables for production:

```env
DATABASE_URL=postgresql://user:pass@host:5432/dbname
REDIS_URL=redis://host:6379
GITHUB_APP_ID=
GITHUB_APP_PRIVATE_KEY=
GITHUB_APP_WEBHOOK_SECRET=
GITHUB_APP_CLIENT_ID=
GITHUB_APP_CLIENT_SECRET=
SESSION_SECRET=
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### Worker Deployment

The worker must run as a separate process:

```bash
# Production worker
NODE_ENV=production pnpm worker
```

For platforms like Heroku, Railway, or Render, configure two processes:
- **web:** `pnpm start`
- **worker:** `pnpm worker`

## Contributing

Contributions are welcome! Areas for expansion:

- Additional security rules for popular frameworks
- Support for more languages (Python, Go, Ruby)
- Integration with CI/CD platforms
- SARIF export for GitHub Code Scanning

## License

MIT
