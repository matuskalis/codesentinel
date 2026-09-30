# CodeSentinel fixtures

Small projects that trigger (or deliberately do not trigger) the rules. They are the regression suite for the scanner: every finding is pinned by rule, severity, confidence, file and line in `expected/`.

```
fixtures/
  next-supabase-service-key-client/   service role key in a 'use client' page
  next-stripe-webhook-no-verify/      Stripe webhook without signature check
  next-nextpublic-secret/             secrets behind NEXT_PUBLIC_ in an env file
expected/
  <fixture-name>.json                 the findings the scanner must report, nothing more
```

Each fixture has negative controls, files that must stay silent: a server route using the service key, a fixed webhook that calls `constructEvent`, a payments route that is not a webhook, the Supabase anon key and the Stripe publishable key in the env file.

Everything in here is fake and intentionally insecure. Do not copy it into a real project.

## Running

```bash
# All fixtures, prints PASS or FAIL per fixture and a recall and precision summary
pnpm fixtures

# One fixture
pnpm fixtures next-stripe-webhook-no-verify

# Through Vitest (also checks determinism and that line numbers follow the content)
pnpm test:run tests/fixtures.test.ts
```

Current result: 6 of 6 expected findings found, 0 unexpected, over 3 fixtures and 7 files.

## Dotfiles

`.env*` files cannot be committed to this repository, so a fixture stores them with an underscore and the runner restores the dot before scanning. `next-nextpublic-secret/_env.local` is scanned as `.env.local`, and that is the path `expected/next-nextpublic-secret.json` uses.

Values that look like real keys are not stored either. The file holds `{{openai-key}}` and `{{supabase-anon-jwt}}`, and `tests/fixture-runner.ts` assembles the fake values when the fixture is scanned, so secret scanners have nothing to flag in the repository. The runner copies the fixture to a temporary directory and scans it with the same file walker the CLI uses.

## Adding a fixture

1. Create a directory under `fixtures/` with minimal files that trigger the rule and files that should not.
2. Scan it and read every finding:
   ```bash
   pnpm cli:build
   node dist/codesentinel.mjs scan fixtures/your-fixture-name --json
   ```
3. Check that every finding is a true positive and every negative control is silent.
4. Write `expected/your-fixture-name.json`:
   ```json
   {
     "fixture": "your-fixture-name",
     "findings": [
       {
         "rule_id": "rule-id",
         "severity": "critical|high|medium|low",
         "confidence": "high|medium|low",
         "file": "relative/path.ts",
         "start_line": 7,
         "end_line": 7
       }
     ]
   }
   ```
5. Run `pnpm fixtures your-fixture-name`. The Vitest suite picks the new fixture up from `expected/`.

Fixtures are excluded from `tsc` (they import packages this repository does not install) and from the CI self-scan (they are intentionally vulnerable).

## Design

- Tiny files, no dependencies to install.
- Exact line numbers are pinned, and a test checks that they move when the content moves.
- Deterministic: two runs give identical findings. No timestamps, no randomness.
