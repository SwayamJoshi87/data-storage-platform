import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { clerkAuth } from './middleware/auth';
import vaultsRouter from './routes/vaults';
import filesRouter from './routes/files';
import retrievalsRouter from './routes/retrievals';
import billingRouter from './routes/billing';
import clerkWebhook from './routes/webhooks/clerk';
import stripeWebhook from './routes/webhooks/stripe';

const app = new Hono();

app.use(
  '*',
  cors({
    origin: process.env.VITE_APP_URL ?? 'http://localhost:5173',
    allowHeaders: ['Authorization', 'Content-Type'],
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  }),
);

// Public webhook endpoints (signature-verified internally)
app.route('/webhooks/clerk', clerkWebhook);
app.route('/webhooks/stripe', stripeWebhook);

// Authenticated routes
app.use('/vaults/*', clerkAuth);
app.use('/retrievals/*', clerkAuth);
app.use('/billing/*', clerkAuth);

app.route('/vaults', vaultsRouter);
app.route('/vaults', filesRouter); // /vaults/:vaultId/files + /vaults/:vaultId/upload-url
app.route('/retrievals', retrievalsRouter);
app.route('/billing', billingRouter);

app.get('/health', (c) => c.json({ ok: true }));

export default app;
