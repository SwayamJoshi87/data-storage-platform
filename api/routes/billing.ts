import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth'

export const billing = new Hono()

billing.use('*', requireAuth)

// POST /api/billing/checkout  — create Stripe Checkout session
billing.post('/checkout', async (c) => {
  const userId = c.get('userId')
  const { plan } = await c.req.json<{ plan: string }>()
  // TODO Step 11: create Stripe Checkout session, return URL
  void userId; void plan
  return c.json({ url: null })
})

// GET /api/billing/portal  — create Stripe Customer Portal session
billing.get('/portal', async (c) => {
  const userId = c.get('userId')
  // TODO Step 11: create Stripe Customer Portal session, return URL
  void userId
  return c.json({ url: null })
})

// GET /api/usage  — current period storage + retrieval totals
billing.get('/usage', async (c) => {
  const userId = c.get('userId')
  // TODO Step 11: aggregate usage_records for current period
  void userId
  return c.json({ storageByTier: {}, retrievedByUrgency: {}, periodStart: null, periodEnd: null })
})
