import { Hono } from 'hono';
import { db } from '../db/client';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import type { AuthVariables } from '../middleware/auth';

const app = new Hono<{ Variables: AuthVariables }>();

// POST /billing/checkout  — create Stripe Checkout session
// TODO Step 9: implement Stripe checkout session creation
app.post('/checkout', async (c) => {
  return c.json({ error: 'Not implemented' }, 501);
});

// POST /billing/portal  — redirect to Stripe Customer Portal
// TODO Step 9: retrieve or create Stripe customer and return portal URL
app.post('/portal', async (c) => {
  const userId = c.get('userId');
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user?.stripeCustomerId) return c.json({ error: 'No billing account' }, 400);

  // TODO Step 9: Stripe.billingPortal.sessions.create(...)
  return c.json({ url: null });
});

// GET /billing/usage  — current period metered usage
// TODO Step 9: aggregate usage_records for current period
app.get('/usage', async (c) => {
  return c.json({ storageGbByTier: {}, retrievedGbByUrgency: {} });
});

export default app;
