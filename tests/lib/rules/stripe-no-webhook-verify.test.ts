import { describe, it, expect } from 'vitest'
import { stripeNoWebhookVerifyRule } from '@/lib/rules/stripe-no-webhook-verify'
import { makeFileChange, makeClassification } from '../../helpers'

describe('stripe-no-webhook-verify', () => {
  const classification = makeClassification({
    filePath: 'src/app/api/webhook/route.ts',
    language: 'typescript',
    framework: 'nextjs',
    context: 'server',
    routeType: 'api-route',
  })

  describe('metadata', () => {
    it('should have correct rule metadata', () => {
      expect(stripeNoWebhookVerifyRule.id).toBe('stripe-no-webhook-verify')
      expect(stripeNoWebhookVerifyRule.severity).toBe('high')
      expect(stripeNoWebhookVerifyRule.confidence).toBe('medium')
      expect(stripeNoWebhookVerifyRule.category).toBe('stripe')
      expect(stripeNoWebhookVerifyRule.version).toBe(1)
    })
  })

  describe('detection', () => {
    it('should detect Stripe webhook route without constructEvent', () => {
      const file = makeFileChange({
        filePath: 'src/app/api/webhook/route.ts',
        content: [
          `import Stripe from 'stripe'`,
          `const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)`,
          `export async function POST(req: Request) {`,
          `  const body = await req.json()`,
          `  const event = body as Stripe.Event`,
          `  // handle webhook event`,
          `  return Response.json({ received: true })`,
          `}`,
        ].join('\n'),
      })

      const findings = stripeNoWebhookVerifyRule.run(file, classification)
      expect(findings.length).toBe(1)
      expect(findings[0].ruleId).toBe('stripe-no-webhook-verify')
      expect(findings[0].severity).toBe('high')
    })

    it('should detect Stripe require() without verification in webhook path', () => {
      const file = makeFileChange({
        filePath: 'src/app/api/webhook/route.ts',
        content: [
          `const Stripe = require('stripe')`,
          `const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)`,
          `export async function POST(req) {`,
          `  const body = await req.json()`,
          `  return Response.json({ ok: true })`,
          `}`,
        ].join('\n'),
      })

      const findings = stripeNoWebhookVerifyRule.run(file, classification)
      expect(findings.length).toBe(1)
    })

    it('should detect stripe. usage with webhook handler without verification', () => {
      const file = makeFileChange({
        filePath: 'src/app/api/webhook/route.ts',
        content: [
          `export async function POST(req: Request) {`,
          `  return handleWebhook(req)`,
          `}`,
          `async function handleWebhook(req: Request) {`,
          `  const event = await req.json()`,
          `  await stripe.subscriptions.retrieve(event.data.object.id)`,
          `  return new Response('ok')`,
          `}`,
        ].join('\n'),
      })

      const findings = stripeNoWebhookVerifyRule.run(file, classification)
      expect(findings.length).toBe(1)
    })
  })

  describe('safe patterns', () => {
    it('should not flag webhook route with constructEvent verification', () => {
      const file = makeFileChange({
        filePath: 'src/app/api/webhook/route.ts',
        content: [
          `import Stripe from 'stripe'`,
          `const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)`,
          `export async function POST(req: Request) {`,
          `  const body = await req.text()`,
          `  const sig = req.headers.get('stripe-signature')!`,
          `  const event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)`,
          `  return Response.json({ received: true })`,
          `}`,
        ].join('\n'),
      })

      const findings = stripeNoWebhookVerifyRule.run(file, classification)
      expect(findings.length).toBe(0)
    })

    it('should not flag non-webhook Stripe routes', () => {
      const file = makeFileChange({
        filePath: 'src/app/api/checkout/route.ts',
        content: [
          `import Stripe from 'stripe'`,
          `const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)`,
          `export async function POST(req: Request) {`,
          `  const session = await stripe.checkout.sessions.create({})`,
          `  return Response.json({ url: session.url })`,
          `}`,
        ].join('\n'),
      })
      const checkoutCls = makeClassification({
        filePath: 'src/app/api/checkout/route.ts',
        routeType: 'api-route',
        context: 'server',
      })

      const findings = stripeNoWebhookVerifyRule.run(file, checkoutCls)
      expect(findings.length).toBe(0)
    })

    it('should not flag test files', () => {
      const file = makeFileChange({
        filePath: 'src/app/api/webhook/route.test.ts',
        content: [
          `import Stripe from 'stripe'`,
          `const stripe = new Stripe('sk_test_abc')`,
          `export async function POST(req: Request) {`,
          `  const event = await req.json()`,
          `  // handle webhook`,
          `}`,
        ].join('\n'),
      })
      const testCls = makeClassification({
        filePath: 'src/app/api/webhook/route.test.ts',
        routeType: 'api-route',
        isTest: true,
      })

      const findings = stripeNoWebhookVerifyRule.run(file, testCls)
      expect(findings.length).toBe(0)
    })

    it('should not flag non-webhook path even with webhook content', () => {
      const file = makeFileChange({
        filePath: 'src/app/api/checkout/route.ts',
        content: [
          `import Stripe from 'stripe'`,
          `const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)`,
          `export async function POST(req: Request) {`,
          `  // This creates a checkout session, webhooks handle fulfillment`,
          `  const session = await stripe.checkout.sessions.create({})`,
          `  return Response.json({ url: session.url })`,
          `}`,
        ].join('\n'),
      })
      const checkoutCls = makeClassification({
        filePath: 'src/app/api/checkout/route.ts',
        routeType: 'api-route',
        context: 'server',
      })

      const findings = stripeNoWebhookVerifyRule.run(file, checkoutCls)
      expect(findings.length).toBe(0)
    })

    it('should not flag file with stripe-signature reference', () => {
      const file = makeFileChange({
        filePath: 'src/app/api/webhook/route.ts',
        content: [
          `import Stripe from 'stripe'`,
          `const sig = req.headers.get('stripe-signature')`,
          `// handleWebhook logic here`,
        ].join('\n'),
      })

      const findings = stripeNoWebhookVerifyRule.run(file, classification)
      expect(findings.length).toBe(0)
    })
  })

  describe('edge cases', () => {
    it('should have a fingerprint', () => {
      const file = makeFileChange({
        filePath: 'src/app/api/webhook/route.ts',
        content: [
          `import Stripe from 'stripe'`,
          `export async function POST(req: Request) {`,
          `  const body = await req.json()`,
          `  // handle webhook`,
          `}`,
        ].join('\n'),
      })

      const findings = stripeNoWebhookVerifyRule.run(file, classification)
      expect(findings.length).toBe(1)
      expect(findings[0].fingerprint).toBeDefined()
      expect(findings[0].fingerprint.length).toBeGreaterThan(0)
    })

    it('should not flag file without Stripe import', () => {
      const file = makeFileChange({
        filePath: 'src/app/api/webhook/route.ts',
        content: [
          `export async function POST(req: Request) {`,
          `  const body = await req.json()`,
          `  // handle webhook event from some other service`,
          `  return Response.json({ received: true })`,
          `}`,
        ].join('\n'),
      })

      const findings = stripeNoWebhookVerifyRule.run(file, classification)
      expect(findings.length).toBe(0)
    })
  })
})
