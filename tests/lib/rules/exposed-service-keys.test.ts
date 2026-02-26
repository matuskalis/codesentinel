import { describe, it, expect } from 'vitest'
import { exposedServiceKeysRule } from '@/lib/rules/exposed-service-keys'
import { getRulesForFile } from '@/lib/rules'
import { makeFileChange, makeClassification } from '../../helpers'

describe('exposed-service-keys', () => {
  const clientClassification = makeClassification({
    filePath: 'src/components/FirebaseProvider.tsx',
    language: 'typescript',
    framework: 'react',
    context: 'client',
    routeType: 'component',
  })

  const sharedClassification = makeClassification({
    filePath: 'src/lib/firebase.ts',
    language: 'typescript',
    framework: 'node',
    context: 'shared',
    routeType: 'library',
  })

  describe('metadata', () => {
    it('should have correct rule metadata', () => {
      expect(exposedServiceKeysRule.id).toBe('exposed-service-keys')
      expect(exposedServiceKeysRule.severity).toBe('critical')
      expect(exposedServiceKeysRule.confidence).toBe('high')
      expect(exposedServiceKeysRule.category).toBe('secrets')
      expect(exposedServiceKeysRule.version).toBe(1)
    })
  })

  describe('detection', () => {
    it('should detect firebase-admin import in client code', () => {
      const file = makeFileChange({
        filePath: 'src/components/FirebaseProvider.tsx',
        content: `import admin from 'firebase-admin'`,
      })

      const findings = exposedServiceKeysRule.run(file, clientClassification)
      expect(findings.length).toBe(1)
      expect(findings[0].ruleId).toBe('exposed-service-keys')
      expect(findings[0].severity).toBe('critical')
      expect(findings[0].title).toContain('Firebase Admin SDK import')
    })

    it('should detect service_account type field in client JSON', () => {
      const file = makeFileChange({
        filePath: 'src/components/FirebaseProvider.tsx',
        content: `const creds = { "type": "service_account", "project_id": "my-app" }`,
      })

      const findings = exposedServiceKeysRule.run(file, clientClassification)
      expect(findings.length).toBe(1)
    })

    it('should detect private_key field in shared code', () => {
      const file = makeFileChange({
        filePath: 'src/lib/firebase.ts',
        content: `const key = { "private_key": "-----BEGIN PRIVATE KEY-----..." }`,
      })

      const findings = exposedServiceKeysRule.run(file, sharedClassification)
      expect(findings.length).toBe(1)
    })

    it('should detect GCP service account email in client code', () => {
      const file = makeFileChange({
        filePath: 'src/components/FirebaseProvider.tsx',
        content: `const email = { "client_email": "firebase@my-app.iam.gserviceaccount.com" }`,
      })

      const findings = exposedServiceKeysRule.run(file, clientClassification)
      expect(findings.length).toBe(1)
    })

    it('should detect GOOGLE_APPLICATION_CREDENTIALS in shared code', () => {
      const file = makeFileChange({
        filePath: 'src/lib/firebase.ts',
        content: `const path = process.env.GOOGLE_APPLICATION_CREDENTIALS`,
      })

      const findings = exposedServiceKeysRule.run(file, sharedClassification)
      expect(findings.length).toBe(1)
    })

    it('should detect firebase-admin in shared code', () => {
      const file = makeFileChange({
        filePath: 'src/lib/firebase.ts',
        content: `import * as admin from 'firebase-admin'`,
      })

      const findings = exposedServiceKeysRule.run(file, sharedClassification)
      expect(findings.length).toBe(1)
    })
  })

  describe('safe patterns', () => {
    it('should not flag server-side firebase-admin import (via getRulesForFile filtering)', () => {
      // The rule's run() does not filter by context -- context filtering is done by
      // getRulesForFile() which checks applicableTo.contexts: ['client', 'shared'].
      // Server context should NOT include this rule in the applicable rules list.
      const serverCls = makeClassification({
        filePath: 'src/app/api/admin/route.ts',
        context: 'server',
        routeType: 'api-route',
      })

      const applicableRules = getRulesForFile(serverCls)
      const hasExposedServiceKeys = applicableRules.some(r => r.id === 'exposed-service-keys')
      expect(hasExposedServiceKeys).toBe(false)
    })

    it('should not flag test files', () => {
      const file = makeFileChange({
        filePath: 'src/components/FirebaseProvider.test.tsx',
        content: `import admin from 'firebase-admin'`,
      })
      const testCls = makeClassification({
        filePath: 'src/components/FirebaseProvider.test.tsx',
        context: 'client',
        isTest: true,
      })

      const findings = exposedServiceKeysRule.run(file, testCls)
      expect(findings.length).toBe(0)
    })

    it('should not flag comment lines', () => {
      const file = makeFileChange({
        filePath: 'src/components/FirebaseProvider.tsx',
        content: `// import admin from 'firebase-admin' -- DO NOT use on client`,
      })

      const findings = exposedServiceKeysRule.run(file, clientClassification)
      expect(findings.length).toBe(0)
    })

    it('should not flag code without service key patterns', () => {
      const file = makeFileChange({
        filePath: 'src/components/FirebaseProvider.tsx',
        content: `import { initializeApp } from 'firebase/app'`,
      })

      const findings = exposedServiceKeysRule.run(file, clientClassification)
      expect(findings.length).toBe(0)
    })
  })

  describe('edge cases', () => {
    it('should report correct line number', () => {
      const file = makeFileChange({
        filePath: 'src/components/FirebaseProvider.tsx',
        content: [
          `'use client'`,
          '',
          `import admin from 'firebase-admin'`,
        ].join('\n'),
      })

      const findings = exposedServiceKeysRule.run(file, clientClassification)
      expect(findings[0].startLine).toBe(3)
    })

    it('should have a fingerprint', () => {
      const file = makeFileChange({
        filePath: 'src/components/FirebaseProvider.tsx',
        content: `import admin from 'firebase-admin'`,
      })

      const findings = exposedServiceKeysRule.run(file, clientClassification)
      expect(findings[0].fingerprint).toBeDefined()
      expect(findings[0].fingerprint.length).toBeGreaterThan(0)
    })

    it('should only match one pattern per line', () => {
      const file = makeFileChange({
        filePath: 'src/components/FirebaseProvider.tsx',
        content: `const config = { "type": "service_account", "private_key": "..." }`,
      })

      const findings = exposedServiceKeysRule.run(file, clientClassification)
      // The break in the inner loop means only one finding per line
      expect(findings.length).toBe(1)
    })
  })
})
