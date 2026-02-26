# CodeSentinel - Claude Code Instructions

## Project Overview

CodeSentinel is a GitHub App that automatically scans pull requests for security vulnerabilities. It detects hardcoded secrets, SQL injection, XSS, insecure API configurations, and other security issues in startup-stack code (Next.js, Supabase, Firebase, Stripe, OpenAI).

**Key Characteristics:**
- Deterministic pattern matching (no LLM calls - zero hallucinations)
- Scans PRs automatically via GitHub webhooks
- Posts inline PR comments with fix suggestions
- Dashboard for viewing scans and managing settings

## Tech Stack

- **Next.js 15** + React 19 + TypeScript 5
- **Drizzle ORM** + PostgreSQL 16 (via postgres.js driver)
- **BullMQ** + Redis 7 (job queue)
- **@octokit/app** (GitHub App integration)
- **Pino** (structured logging)
- **Vitest** (testing - 354 tests)
- **Tailwind CSS 4** (dark theme only)
- **jose** (JWT sessions)
- **zod** (validation)

## Project Structure

```
src/
  types/index.ts           # THE source of truth for all TypeScript types
  lib/
    auth/                  # JWT sessions, OAuth flow, requireAuth middleware
    db/
      schema.ts            # Drizzle schema (10 tables)
      queries/             # Query functions organized by entity
    github/                # GitHub App setup, webhook handling, API calls
    jobs/                  # BullMQ queue setup, job producers, handlers
    rules/                 # 12 security detection rules
      index.ts             # Rule registry and applicability logic
      hardcoded-secrets.ts # Example rule
      ...
    scanner/               # Core scan engine, diff parsing, file classification
    scoring/               # Risk score calculation (0-100)
    reporting/             # PR comment formatting, inline comments
  app/
    api/                   # Next.js API routes
    (dashboard)/           # Dashboard pages (grouped route)
  components/              # UI components (custom, no external UI lib)
worker/
  index.ts                 # BullMQ worker entry point (separate process)
tests/                     # Vitest test files
```

## Key Conventions

### Types
- **Always import from @/types** - Shared type contract for entire codebase
- Types are the source of truth - do NOT duplicate type definitions
- Use `z.infer<>` from Zod schemas only where Zod is already in use

### Database
- Use `getDb()` lazy singleton from `@/lib/db`
- Use Drizzle query builder (NOT raw SQL)
- Query functions live in `src/lib/db/queries/` organized by entity
- Schema is in `src/lib/db/schema.ts` (10 tables)

### Authentication
- Use `requireAuth()` middleware on all dashboard API routes
- Session tokens stored as SHA-256 hashes in DB
- **IMPORTANT:** Webhook route (`/api/webhooks/github`) does NOT use `requireAuth()` - uses GitHub signature verification instead

### Security Rules
- Each rule implements `RuleDefinition` interface from `@/types`
- Must have a `run()` function that returns `RuleFinding[]`
- Rules are deterministic pattern matching ONLY - no LLM calls
- Test files are skipped (classification.isTest)
- Use `createFingerprint()` for deduplication

### Logging
- Use `pino` logger from `@/lib/logger`
- Create child loggers with correlation IDs for scan tracking
- Use structured logging: `logger.info({ scanId, repoId }, 'message')`

### Styling
- Tailwind CSS v4 with `@theme inline` tokens
- Dark theme only
- Custom components in `src/components/` (no shadcn or other UI libs)
- Use `clsx` and `tailwind-merge` for conditional classes

### Components
- Functional components with hooks
- Client components use `'use client'` directive
- Server components for layouts and metadata

## Important Technical Details

### Worker Architecture
- Worker runs as **separate Node.js process** (not part of Next.js)
- Started with `pnpm worker:dev` or `pnpm worker`
- Uses BullMQ to process scan jobs from Redis queue
- Must be deployed separately in production

### Scan Flow
1. GitHub webhook received at `/api/webhooks/github`
2. Webhook handler validates signature and enqueues scan job
3. Worker picks up job from Redis queue
4. Worker fetches PR diff from GitHub API
5. Scanner classifies files and applies applicable rules
6. Findings saved to DB, risk score calculated
7. Reporter posts PR comment with summary and inline comments

### Scan Limits
- Max 500 files per scan
- Max 512KB per file
- 2-minute timeout for entire scan
- 5-second timeout per rule execution
- Skip patterns: node_modules, .git, dist, build, .next, etc.

### Rate Limiting
- API routes have in-memory rate limiting
- **Resets on server restart** - not persisted to Redis

## Commands

```bash
# Development
pnpm dev              # Next.js dev server on port 3000
pnpm worker:dev       # Worker with file watching

# Database
pnpm db:generate      # Generate Drizzle migrations
pnpm db:migrate       # Apply migrations
pnpm db:studio        # Open Drizzle Studio (DB GUI)

# Testing
pnpm test:run         # Run all tests (354 tests)
pnpm test             # Watch mode

# Production
pnpm build            # Build Next.js
pnpm start            # Start production server
pnpm worker           # Start production worker

# Type checking
pnpm typecheck        # Run TypeScript compiler (no emit)

# Services
docker compose up -d  # Start PostgreSQL + Redis
```

## Environment Variables

See `.env.example` for full list. Key vars:

- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `GITHUB_APP_ID` - GitHub App ID
- `GITHUB_APP_PRIVATE_KEY` - Private key (newlines as `\n`)
- `GITHUB_APP_WEBHOOK_SECRET` - Webhook signature secret
- `GITHUB_APP_CLIENT_ID` - OAuth client ID
- `GITHUB_APP_CLIENT_SECRET` - OAuth client secret
- `SESSION_SECRET` - JWT signing secret
- `NEXT_PUBLIC_APP_URL` - Public URL for OAuth callback

## Common Patterns

### Adding a New Security Rule

1. Create file in `src/lib/rules/my-rule.ts`
2. Implement `RuleDefinition` interface
3. Export the rule constant
4. Add to `allRules` array in `src/lib/rules/index.ts`
5. Add tests in `tests/rules/my-rule.test.ts`

### Database Queries

```typescript
import { getDb } from '@/lib/db'
import { scans, findings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

const db = getDb()
const scan = await db.query.scans.findFirst({
  where: eq(scans.id, scanId),
  with: { findings: true }
})
```

### Logging in Scans

```typescript
import { logger } from '@/lib/logger'

const scanLogger = logger.child({ scanId, repoId })
scanLogger.info('Starting scan')
scanLogger.error({ error }, 'Scan failed')
```

## Testing Notes

- 354 tests total across rules, scanner, scoring, and integration
- Use Vitest for all tests
- Mock GitHub API calls with test fixtures
- Rule tests should have positive and negative cases
- Database tests use in-memory SQLite (configured in test setup)

## Codebase Patterns to Follow

- **Descriptive variable names** over comments
- **Small, focused functions** (single responsibility)
- **Early returns** to reduce nesting
- **Type safety** - prefer explicit types over `any`
- **Error handling** - always wrap external calls in try/catch with logging

## What NOT to Do

- Don't add LLM/AI calls to rules (defeats reproducibility)
- Don't bypass `requireAuth()` on dashboard API routes
- Don't use raw SQL (use Drizzle query builder)
- Don't hardcode magic numbers (use constants)
- Don't commit .env files (use .env.example)
- Don't use Tailwind utility classes in components that already use inline styles (check first)

## Known Quirks

- Session tokens are SHA-256 hashed before storage
- Fingerprints are created from rule ID + file path + snippet hash
- Risk score uses weighted severity (critical=10, high=7, medium=4, low=2)
- PR comments are upserted (update existing comment if found)
- Worker graceful shutdown requires SIGTERM handling
