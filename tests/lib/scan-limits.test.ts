import { describe, it, expect } from 'vitest'
import { DEFAULT_SCAN_LIMITS, shouldSkipFile } from '@/lib/scan-limits'

describe('shouldSkipFile', () => {
  describe('skips generated, vendored and binary paths', () => {
    it.each([
      'node_modules/stripe/index.ts',
      'packages/web/node_modules/stripe/index.ts',
      'dist/bundle.js',
      'packages/web/dist/index.js',
      'build/output.js',
      'apps/site/build/server.js',
      '.next/server/app/page.js',
      'coverage/lcov.json',
      'pnpm-lock.yaml',
      'apps/web/pnpm-lock.yaml',
      'package-lock.json',
      'yarn.lock',
      'public/app.min.js',
      'public/app.min.css',
      'dist-types/index.d.ts.map',
      'public/logo.svg',
      'public/fonts/inter.woff2',
      'docs/manual.pdf',
      'packages\\web\\dist\\index.js',
    ])('skips %s', filePath => {
      expect(shouldSkipFile(filePath, DEFAULT_SCAN_LIMITS)).toBe(true)
    })
  })

  describe('keeps source files whose names merely contain a skip word', () => {
    it.each([
      'src/rebuild/payments.ts',
      'scripts/build-invoices.ts',
      'src/lib/distance.ts',
      'src/app/api/distribute/route.ts',
      'src/lib/coverage-report.ts',
      'src/.nextra/config.ts',
      'src/lib/yarn.lock.ts',
      'src/lib/not-a-lockfile.json',
      'src/lib/minify.ts',
      'src/lib/app.min.ts',
      'src/lib/sourcemap.ts',
    ])('keeps %s', filePath => {
      expect(shouldSkipFile(filePath, DEFAULT_SCAN_LIMITS)).toBe(false)
    })
  })

  it('uses the limits it is given instead of the defaults', () => {
    const limits = { ...DEFAULT_SCAN_LIMITS, skipPatterns: ['generated', '*.snap'] }

    expect(shouldSkipFile('src/generated/client.ts', limits)).toBe(true)
    expect(shouldSkipFile('src/__snapshots__/app.snap', limits)).toBe(true)
    expect(shouldSkipFile('node_modules/stripe/index.ts', limits)).toBe(false)
  })
})
