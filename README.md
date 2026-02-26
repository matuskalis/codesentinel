# CodeSentinel

Deterministic security scanner for startup-stack code. Catch secrets, env leaks, and misconfigurations before they ship.

[![npm version](https://img.shields.io/npm/v/codesentinel.svg)](https://www.npmjs.com/package/codesentinel) [![license](https://img.shields.io/npm/l/codesentinel.svg)](LICENSE) [![CI](https://github.com/matuskalis/codesentinel/actions/workflows/ci.yml/badge.svg)](https://github.com/matuskalis/codesentinel/actions/workflows/ci.yml)

## Quick Start

```bash
npx codesentinel scan .
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

```bash
# Run without installing
npx codesentinel scan .

# Or install globally
npm install -g codesentinel
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
# Any CI pipeline
npx codesentinel scan . --fail-on high --quiet
```

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
