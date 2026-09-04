# CodeSentinel

Deterministic security scanner for startup-stack code. Catch secrets, env leaks, and misconfigurations before they ship.

[![CI](https://github.com/matuskalis/codesentinel/actions/workflows/ci.yml/badge.svg)](https://github.com/matuskalis/codesentinel/actions/workflows/ci.yml) [![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## Quick Start

Not published to npm yet -- clone and build it:

```bash
git clone https://github.com/matuskalis/codesentinel.git
cd codesentinel
pnpm install
pnpm cli:build
node dist/codesentinel.mjs scan /path/to/your/project
```

```
  CRITICAL  hardcoded-secrets
  src/lib/stripe.ts:14
  Hardcoded Stripe secret key detected (sk_live_...)

  HIGH  stripe-no-webhook-verify
  src/app/api/webhooks/route.ts:8
  Stripe webhook handler missing signature verification

  -----------------------------------------
  2 findings | Risk score: 74/100 | HIGH
```

## Installation

CodeSentinel is not on npm yet, so there is no `npx codesentinel`. Build the
CLI from source and either call the bundle directly or link it onto your PATH:

```bash
git clone https://github.com/matuskalis/codesentinel.git
cd codesentinel
pnpm install
pnpm cli:build

# call it directly
node dist/codesentinel.mjs scan .

# or put `codesentinel` on your PATH for this checkout
pnpm link --global
codesentinel scan .
```

## CLI Usage

```bash
codesentinel scan [directory]

Options:
  --fail-on <severity>   Exit with code 1 if findings meet threshold (critical, high, medium, low)
  --json                 Output results as JSON
  --quiet                Suppress output, only set exit code
  --verbose              Show detailed scan information
  --version              Show version number
  --help                 Show help
```

### Examples

```bash
# Scan current directory
codesentinel scan .

# Scan with CI fail threshold
codesentinel scan . --fail-on high

# JSON output for scripting
codesentinel scan ./src --json

# Quiet mode for CI pipelines
codesentinel scan . --fail-on critical --quiet
```

## GitHub Action

```yaml
# .github/workflows/security.yml
name: Security Scan
on: [push, pull_request]

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: matuskalis/codesentinel@v1
        with:
          fail-on: high
```

**Inputs:**

| Input | Default | Description |
|-------|---------|-------------|
| `directory` | `.` | Directory to scan |
| `fail-on` | `high` | Fail threshold: critical, high, medium, low |

**Outputs:**

| Output | Description |
|--------|-------------|
| `findings-count` | Total number of findings |
| `risk-score` | Risk score (0-100) |
| `risk-level` | Risk level: low, medium, high, critical |

## Security Rules

| Rule | Severity | What it catches |
|------|----------|-----------------|
| `hardcoded-secrets` | Critical | Stripe, AWS, GitHub, OpenAI API keys in source code |
| `env-committed` | Critical | `.env` files with real values committed to git |
| `next-public-secret` | High | Secret keys leaked via `NEXT_PUBLIC_` env vars |
| `stripe-no-webhook-verify` | High | Stripe webhook handlers missing signature verification |
| `supabase-service-key-client` | Critical | Supabase service role key exposed in client-side code |

## How It Works

CodeSentinel uses deterministic regex-based pattern matching -- no AI, no LLMs, no guessing. Every rule is validated against 66 real-world repositories with zero false positives. Scans complete in ~42ms for typical projects. Exit codes integrate directly with CI pipelines: 0 means pass, 1 means findings above your threshold.

## CI Integration

```bash
# Any CI pipeline, against a built checkout
node dist/codesentinel.mjs scan . --fail-on high --quiet
```

This repository also ships `action.yml`, so a GitHub Actions workflow can use
it directly with `uses: matuskalis/codesentinel@main`.

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | No findings above threshold |
| `1` | Findings at or above `--fail-on` threshold |

## Development

```bash
git clone https://github.com/matuskalis/codesentinel.git
cd codesentinel
pnpm install
pnpm test:run    # Run 418 tests
pnpm cli:build   # Build CLI bundle
```

## License

MIT
