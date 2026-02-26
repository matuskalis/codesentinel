import Stripe from 'stripe'
import { headers } from 'next/headers'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(req: Request) {
  const body = await req.text()
  const headersList = await headers()
  const sig = headersList.get('stripe-signature')!

  const event = stripe.webhooks.constructEvent(body, sig, webhookSecret)

  switch (event.type) {
    case 'checkout.session.completed':
      break
  }

  return Response.json({ received: true })
}
