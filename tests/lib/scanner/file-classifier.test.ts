import { describe, it, expect } from 'vitest'
import { classifyFile } from '@/lib/scanner/file-classifier'

describe('classifyFile', () => {
  describe('language detection', () => {
    it('should detect TypeScript (.ts)', () => {
      const result = classifyFile('src/lib/utils.ts', '')
      expect(result.language).toBe('typescript')
    })

    it('should detect TypeScript React (.tsx)', () => {
      const result = classifyFile('src/components/Button.tsx', '')
      expect(result.language).toBe('typescript')
    })

    it('should detect JavaScript (.js)', () => {
      const result = classifyFile('src/utils.js', '')
      expect(result.language).toBe('javascript')
    })

    it('should detect JavaScript (.jsx)', () => {
      const result = classifyFile('src/components/Button.jsx', '')
      expect(result.language).toBe('javascript')
    })

    it('should detect JavaScript (.mjs)', () => {
      const result = classifyFile('next.config.mjs', '')
      expect(result.language).toBe('javascript')
    })

    it('should detect JavaScript (.cjs)', () => {
      const result = classifyFile('tailwind.config.cjs', '')
      expect(result.language).toBe('javascript')
    })

    it('should detect JSON (.json)', () => {
      const result = classifyFile('package.json', '')
      expect(result.language).toBe('json')
    })

    it('should detect YAML (.yml)', () => {
      const result = classifyFile('.github/workflows/ci.yml', '')
      expect(result.language).toBe('yaml')
    })

    it('should detect YAML (.yaml)', () => {
      const result = classifyFile('docker-compose.yaml', '')
      expect(result.language).toBe('yaml')
    })

    it('should detect env files (.env)', () => {
      const result = classifyFile('.env', '')
      expect(result.language).toBe('env')
    })

    it('should detect env variant files (.env.local)', () => {
      const result = classifyFile('.env.local', '')
      expect(result.language).toBe('env')
    })

    it('should return "other" for unknown extensions', () => {
      const result = classifyFile('README.md', '')
      expect(result.language).toBe('other')
    })
  })

  describe('framework detection', () => {
    it('should detect Next.js from /app/ path', () => {
      const result = classifyFile('src/app/page.tsx', '')
      expect(result.framework).toBe('nextjs')
    })

    it('should detect Next.js from /pages/ path', () => {
      const result = classifyFile('src/pages/index.tsx', '')
      expect(result.framework).toBe('nextjs')
    })

    it('should detect Next.js from next.config.ts', () => {
      const result = classifyFile('next.config.ts', '')
      expect(result.framework).toBe('nextjs')
    })

    it('should detect Next.js from next.config.js', () => {
      const result = classifyFile('next.config.js', '')
      expect(result.framework).toBe('nextjs')
    })

    it('should detect Next.js from next.config.mjs', () => {
      const result = classifyFile('next.config.mjs', '')
      expect(result.framework).toBe('nextjs')
    })

    it('should detect Next.js from "use client" directive', () => {
      const result = classifyFile('src/lib/utils.ts', `'use client'`)
      expect(result.framework).toBe('nextjs')
    })

    it('should detect Next.js from "use server" directive', () => {
      const result = classifyFile('src/lib/actions.ts', `'use server'`)
      expect(result.framework).toBe('nextjs')
    })

    it('should detect Next.js from next imports', () => {
      const result = classifyFile('src/lib/utils.ts', `import { useRouter } from 'next/navigation'`)
      expect(result.framework).toBe('nextjs')
    })

    it('should detect React from .tsx files not in app/', () => {
      const result = classifyFile('src/standalone/Button.tsx', '')
      expect(result.framework).toBe('react')
    })

    it('should detect React from react imports', () => {
      const result = classifyFile('src/lib/utils.ts', `import { useState } from 'react'`)
      expect(result.framework).toBe('react')
    })

    it('should detect Node.js from /api/ path', () => {
      const result = classifyFile('src/api/handler.ts', '')
      expect(result.framework).toBe('node')
    })

    it('should detect Node.js from /server/ path', () => {
      const result = classifyFile('src/server/index.ts', '')
      expect(result.framework).toBe('node')
    })

    it('should detect Node.js from express import', () => {
      const result = classifyFile('src/lib/server.ts', `import express from 'express'`)
      expect(result.framework).toBe('node')
    })

    it('should return "unknown" for unrecognized framework', () => {
      const result = classifyFile('src/lib/math.ts', 'const add = (a: number, b: number) => a + b')
      expect(result.framework).toBe('unknown')
    })
  })

  describe('context detection', () => {
    it('should detect config context from .config.ts file', () => {
      const result = classifyFile('tailwind.config.ts', '')
      expect(result.context).toBe('config')
    })

    it('should detect config context from .env file', () => {
      const result = classifyFile('.env', '')
      expect(result.context).toBe('config')
    })

    it('should detect config context from .env.local', () => {
      const result = classifyFile('.env.local', '')
      expect(result.context).toBe('config')
    })

    it('should detect client context from "use client" directive', () => {
      const result = classifyFile('src/lib/utils.ts', `'use client'\nconst x = 1`)
      expect(result.context).toBe('client')
    })

    it('should detect server context from "use server" directive', () => {
      const result = classifyFile('src/lib/actions.ts', `'use server'\nconst x = 1`)
      expect(result.context).toBe('server')
    })

    it('should detect server context from /api/ path', () => {
      const result = classifyFile('src/api/handler.ts', '')
      expect(result.context).toBe('server')
    })

    it('should detect server context from middleware path', () => {
      const result = classifyFile('src/middleware.ts', '')
      expect(result.context).toBe('server')
    })

    it('should detect server context from app router route files', () => {
      const result = classifyFile('src/app/api/users/route.ts', '')
      expect(result.context).toBe('server')
    })

    it('should detect client context from /components/ path', () => {
      const result = classifyFile('src/components/Button.tsx', '')
      expect(result.context).toBe('client')
    })

    it('should detect client context from /hooks/ path', () => {
      const result = classifyFile('src/hooks/useAuth.ts', '')
      expect(result.context).toBe('client')
    })

    it('should detect shared context from /lib/ path', () => {
      const result = classifyFile('src/lib/helpers.ts', '')
      expect(result.context).toBe('shared')
    })

    it('should detect shared context from /utils/ path', () => {
      const result = classifyFile('src/utils/format.ts', '')
      expect(result.context).toBe('shared')
    })

    it('should detect server context for app router layout/page', () => {
      const result = classifyFile('src/app/dashboard/layout.tsx', '')
      expect(result.context).toBe('server')
    })

    it('should return "unknown" for unrecognized context', () => {
      const result = classifyFile('src/other/something.ts', '')
      expect(result.context).toBe('unknown')
    })
  })

  describe('route type detection', () => {
    it('should detect api-route from app router route file', () => {
      const result = classifyFile('src/app/api/users/route.ts', '')
      expect(result.routeType).toBe('api-route')
    })

    it('should detect api-route from pages/api/', () => {
      const result = classifyFile('src/pages/api/users.ts', '')
      expect(result.routeType).toBe('api-route')
    })

    it('should detect page from app router page file', () => {
      const result = classifyFile('src/app/dashboard/page.tsx', '')
      expect(result.routeType).toBe('page')
    })

    it('should detect component from /components/ path', () => {
      const result = classifyFile('src/components/Button.tsx', '')
      expect(result.routeType).toBe('component')
    })

    it('should detect middleware', () => {
      const result = classifyFile('src/middleware.ts', '')
      expect(result.routeType).toBe('middleware')
    })

    it('should detect library from /lib/ path', () => {
      const result = classifyFile('src/lib/utils.ts', '')
      expect(result.routeType).toBe('library')
    })

    it('should detect library from /utils/ path', () => {
      const result = classifyFile('src/utils/format.ts', '')
      expect(result.routeType).toBe('library')
    })

    it('should detect library from /helpers/ path', () => {
      const result = classifyFile('src/helpers/format.ts', '')
      expect(result.routeType).toBe('library')
    })

    it('should detect config from .config.ts file', () => {
      const result = classifyFile('tailwind.config.ts', '')
      expect(result.routeType).toBe('config')
    })

    it('should return "none" for unrecognized route type', () => {
      const result = classifyFile('src/other/something.ts', '')
      expect(result.routeType).toBe('none')
    })
  })

  describe('test detection', () => {
    it('should detect .test.ts files', () => {
      const result = classifyFile('src/lib/utils.test.ts', '')
      expect(result.isTest).toBe(true)
    })

    it('should detect .spec.ts files', () => {
      const result = classifyFile('src/lib/utils.spec.ts', '')
      expect(result.isTest).toBe(true)
    })

    it('should detect .e2e.ts files', () => {
      const result = classifyFile('src/lib/auth.e2e.ts', '')
      expect(result.isTest).toBe(true)
    })

    it('should detect __tests__/ directory', () => {
      const result = classifyFile('src/__tests__/utils.ts', '')
      expect(result.isTest).toBe(true)
    })

    it('should detect __mocks__/ directory', () => {
      const result = classifyFile('src/__mocks__/utils.ts', '')
      expect(result.isTest).toBe(true)
    })

    it('should detect tests/ directory prefix', () => {
      const result = classifyFile('tests/unit/utils.ts', '')
      expect(result.isTest).toBe(true)
    })

    it('should detect test/ directory prefix', () => {
      const result = classifyFile('test/unit/utils.ts', '')
      expect(result.isTest).toBe(true)
    })

    it('should not flag regular source files as tests', () => {
      const result = classifyFile('src/lib/utils.ts', '')
      expect(result.isTest).toBe(false)
    })
  })

  describe('filePath passthrough', () => {
    it('should include the original filePath in the result', () => {
      const result = classifyFile('src/app/page.tsx', '')
      expect(result.filePath).toBe('src/app/page.tsx')
    })
  })
})
