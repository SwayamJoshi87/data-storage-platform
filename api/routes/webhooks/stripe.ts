import { Hono } from 'hono';

const app = new Hono();

// TODO Step 9: verify Stripe-Signature header, handle subscription events:
//   checkout.session.completed  → set user.stripeCustomerId + stripeSubscriptionId + plan
//   customer.subscription.updated → sync plan change
//   customer.subscription.deleted → downgrade to 'free'
//   invoice.payment_failed       → flag account for dunning
app.post('/', async (c) => {
  return c.json({ received: true });
});

export default app;
