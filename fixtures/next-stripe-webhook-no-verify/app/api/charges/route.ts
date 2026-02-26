import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(req: Request) {
  const { amount } = await req.json()

  const charge = await stripe.charges.create({
    amount,
    currency: 'usd',
    source: 'tok_visa',
  })

  return Response.json(charge)
}
