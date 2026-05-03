import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { vaults } from './routes/vaults'
import { files } from './routes/files'
import { retrievals } from './routes/retrievals'
import { billing } from './routes/billing'
import { clerkWebhook } from './routes/webhooks/clerk'
import { stripeWebhook } from './routes/webhooks/stripe'

const app = new Hono()

app.use('/api/*', cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:5173'],
  credentials: true,
}))

app.get('/api/health', (c) => c.json({ ok: true }))

app.route('/api/vaults', vaults)
app.route('/api/files', files)
app.route('/api/retrievals', retrievals)
app.route('/api/billing', billing)
app.post('/api/webhooks/clerk', clerkWebhook)
app.post('/api/webhooks/stripe', stripeWebhook)

export default app
