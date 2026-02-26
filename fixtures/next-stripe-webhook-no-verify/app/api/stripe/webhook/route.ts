import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(req: Request) {
  const body = await req.json()
  const event = body as Stripe.Event

  switch (event.type) {
    case 'checkout.session.completed':
      break
  }

  return Response.json({ received: true })
}
