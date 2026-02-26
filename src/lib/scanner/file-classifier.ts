import type { FileClassification } from '@/types'

export function classifyFile(filePath: string, content: string): FileClassification {
  const matchPath = filePath.startsWith('/') ? filePath : '/' + filePath
  return {
    filePath,
    language: detectLanguage(filePath),
    framework: detectFramework(matchPath, content),
    context: detectContext(matchPath, content),
    routeType: detectRouteType(matchPath),
    isTest: detectIsTest(filePath),
  }
}

function detectLanguage(filePath: string): FileClassification['language'] {
  if (/\.(ts|tsx)$/.test(filePath)) return 'typescript'
  if (/\.(js|jsx|mjs|cjs)$/.test(filePath)) return 'javascript'
  if (/\.json$/.test(filePath)) return 'json'
  if (/\.(ya?ml)$/.test(filePath)) return 'yaml'
  if (/\.env/.test(filePath)) return 'env'
  return 'other'
}

function detectFramework(filePath: string, content: string): FileClassification['framework'] {
  // Next.js indicators
  if (filePath.includes('/app/') || filePath.includes('/pages/')) return 'nextjs'
  if (filePath.endsWith('/next.config.ts') || filePath.endsWith('/next.config.js') || filePath.endsWith('/next.config.mjs')) return 'nextjs'
  if (content.includes("from 'next") || content.includes('from "next')) return 'nextjs'
  if (content.includes("'use client'") || content.includes('"use client"')) return 'nextjs'
  if (content.includes("'use server'") || content.includes('"use server"')) return 'nextjs'

  // React indicators
  if (content.includes("from 'react") || content.includes('from "react')) return 'react'
  if (/\.(tsx|jsx)$/.test(filePath)) return 'react'

  // Node indicators
  if (filePath.includes('/api/') || filePath.includes('/server/')) return 'node'
  if (content.includes('require(') || content.includes("from 'express") || content.includes("from 'fastify")) return 'node'

  return 'unknown'
}

function detectContext(filePath: string, content: string): FileClassification['context'] {
  // Config files
  if (/\.(config|rc)\.(ts|js|mjs|cjs|json)$/.test(filePath)) return 'config'
  if (filePath.endsWith('.env') || filePath.includes('.env.')) return 'config'

  // Explicit client
  if (content.includes("'use client'") || content.includes('"use client"')) return 'client'

  // Explicit server
  if (content.includes("'use server'") || content.includes('"use server"')) return 'server'

  // Path-based server detection
  if (filePath.includes('/api/') || filePath.includes('/server/') || filePath.includes('middleware')) return 'server'
  if (filePath.match(/\/app\/.*\/route\.(ts|js)$/)) return 'server'

  // Path-based client detection
  if (filePath.includes('/components/') || filePath.includes('/hooks/')) return 'client'

  // Next.js layouts/pages are server by default in app router
  if (filePath.match(/\/app\/.*\/(layout|page|loading|error|not-found)\.(tsx|jsx)$/)) return 'server'

  // Shared/lib
  if (filePath.includes('/lib/') || filePath.includes('/utils/') || filePath.includes('/shared/')) return 'shared'

  return 'unknown'
}

function detectRouteType(filePath: string): FileClassification['routeType'] {
  if (filePath.match(/\/app\/.*\/route\.(ts|js)$/) || filePath.match(/\/pages\/api\//)) return 'api-route'
  if (filePath.match(/\/app\/.*\/page\.(tsx|jsx|ts|js)$/) || filePath.match(/\/pages\/(?!api\/)/)) return 'page'
  if (filePath.includes('/components/')) return 'component'
  if (filePath.includes('middleware.') || filePath.match(/\/middleware\//)) return 'middleware'
  if (filePath.includes('/lib/') || filePath.includes('/utils/') || filePath.includes('/helpers/')) return 'library'
  if (/\.(config|rc)\.(ts|js|mjs|cjs|json)$/.test(filePath)) return 'config'
  return 'none'
}

function detectIsTest(filePath: string): boolean {
  return /\.(test|spec|e2e)\.(ts|tsx|js|jsx)$/.test(filePath) ||
    filePath.includes('__tests__') ||
    filePath.includes('__mocks__') ||
    filePath.startsWith('tests/') ||
    filePath.startsWith('test/')
}
