# CodeSentinel Fixtures

Deterministic test fixtures for security rule validation. Each fixture is a minimal, self-contained project that triggers (or intentionally does not trigger) specific rules.

## Structure

```
fixtures/
  next-supabase-service-key-client/   # Fixture 1: service role key in client code
  next-stripe-webhook-no-verify/      # Fixture 2: Stripe webhook without signature check
  next-nextpublic-secret/             # Fixture 3: secrets exposed via NEXT_PUBLIC_ prefix
expected/
  next-supabase-service-key-client.json
  next-stripe-webhook-no-verify.json
  next-nextpublic-secret.json
```

## Running

```bash
# Run all fixtures (compare against expected output)
LOG_LEVEL=silent npx tsx scripts/run-fixtures.ts

# Run a single fixture
LOG_LEVEL=silent npx tsx scripts/run-fixtures.ts next-stripe-webhook-no-verify

# Run via Vitest (includes determinism + line-offset tests)
pnpm test:run -- tests/fixtures.test.ts
```

## Adding a new fixture

1. Create a directory under `fixtures/` with minimal files that trigger (and don't trigger) the rule
2. Run the scanner to see actual output:
   ```bash
   LOG_LEVEL=silent npx tsx scripts/validate-scanner.ts fixtures/your-fixture-name
   ```
3. Verify every finding is a true positive and every negative control produces zero findings
4. Create `expected/your-fixture-name.json` with the schema:
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
5. Run `LOG_LEVEL=silent npx tsx scripts/run-fixtures.ts your-fixture-name` to verify PASS
6. The Vitest test auto-discovers new fixtures from `expected/*.json`

## Updating expected outputs

When a rule changes behavior intentionally:

1. Run the scanner on the affected fixture to see new output
2. Verify every finding is correct
3. Update the corresponding `expected/*.json`
4. Run the full suite to confirm: `LOG_LEVEL=silent npx tsx scripts/run-fixtures.ts`

## Design principles

- **Tiny files**: each fixture file is under 20 lines. No dependencies to install.
- **Exact line numbers**: expected output pins start_line/end_line. The regression test verifies line offsets shift correctly when content changes.
- **Negative controls**: every fixture includes files that should NOT trigger the rule (server-side usage, fixed versions, benign variables).
- **Deterministic**: running twice produces identical output. No timestamps, no randomness.
