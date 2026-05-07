import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { vaultsRouter } from './routes/vaults'
import { filesRouter } from './routes/files'
import { retrievals } from './routes/retrievals'
import { billing } from './routes/billing'
import { usageRouter } from './routes/usage'
import { clerkWebhook } from './routes/webhooks/clerk'
import { stripeWebhook } from './routes/webhooks/stripe'

const app = new Hono()

app.use('/api/*', cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:5173'],
  credentials: true,
}))

app.get('/api/health', (c) => c.json({ ok: true }))

app.route('/api/vaults', vaultsRouter)
app.route('/api/files', filesRouter)
app.route('/api/retrievals', retrievals)
app.route('/api/billing', billing)
app.route('/api/usage', usageRouter)
app.post('/api/webhooks/clerk', clerkWebhook)
app.post('/api/webhooks/stripe', stripeWebhook)

// Vercel serverless handler
import { handle } from 'hono/vercel'
export const config = { maxDuration: 30 }
export default handle(app)
