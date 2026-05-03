import type { Context } from 'hono'

// POST /api/webhooks/stripe
// Handles Stripe billing lifecycle events.
// TODO Step 11: verify Stripe webhook signature using STRIPE_WEBHOOK_SECRET
export async function stripeWebhook(c: Context) {
  const body = await c.req.json()
  const { type, data } = body

  switch (type) {
    case 'checkout.session.completed': {
      // TODO Step 11: update users.plan + users.stripe_customer_id
      void data
      break
    }
    case 'customer.subscription.updated': {
      // TODO Step 11: sync plan change
      void data
      break
    }
    case 'customer.subscription.deleted': {
      // TODO Step 11: downgrade to free plan
      void data
      break
    }
    case 'invoice.payment_failed': {
      // TODO Step 11: flag account, trigger payment-failed email
      void data
      break
    }
  }

  return c.json({ ok: true })
}
