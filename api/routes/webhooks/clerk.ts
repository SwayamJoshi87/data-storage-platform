import type { Context } from 'hono'

// POST /api/webhooks/clerk
// Syncs Clerk user lifecycle events into the users table.
// TODO Step 2: verify Clerk webhook signature using CLERK_WEBHOOK_SECRET
export async function clerkWebhook(c: Context) {
  const body = await c.req.json()
  const { type, data } = body

  switch (type) {
    case 'user.created':
    case 'user.updated': {
      // TODO Step 2: upsert user into DB
      // { id: data.id, email: data.email_addresses[0].email_address, plan: 'free' }
      void data
      break
    }
    case 'user.deleted': {
      // TODO Step 2: soft-delete user and their vaults
      void data
      break
    }
    case 'session.created': {
      // TODO Step 11: write audit_log entry for sign-in
      void data
      break
    }
  }

  return c.json({ ok: true })
}
