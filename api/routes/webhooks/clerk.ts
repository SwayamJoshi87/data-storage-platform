import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { Webhook } from 'svix'
import { db } from '../../db/client'
import { users } from '../../db/schema'
import { eq } from 'drizzle-orm'

interface ClerkEmailAddress {
  email_address: string
  id: string
}

interface ClerkUserPayload {
  id: string
  email_addresses: ClerkEmailAddress[]
  primary_email_address_id: string
}

// POST /api/webhooks/clerk
export async function clerkWebhook(c: Context) {
  const secret = process.env.CLERK_WEBHOOK_SECRET
  if (!secret) throw new HTTPException(500, { message: 'CLERK_WEBHOOK_SECRET not configured' })

  const svixId = c.req.header('svix-id')
  const svixTimestamp = c.req.header('svix-timestamp')
  const svixSignature = c.req.header('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    throw new HTTPException(400, { message: 'Missing svix headers' })
  }

  const rawBody = await c.req.text()

  const wh = new Webhook(secret)
  let event: { type: string; data: ClerkUserPayload }
  try {
    event = wh.verify(rawBody, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as { type: string; data: ClerkUserPayload }
  } catch {
    throw new HTTPException(400, { message: 'Invalid webhook signature' })
  }

  const { type, data } = event

  switch (type) {
    case 'user.created':
    case 'user.updated': {
      const primaryEmail = data.email_addresses.find(
        (e) => e.id === data.primary_email_address_id,
      )?.email_address ?? data.email_addresses[0]?.email_address ?? ''

      await db
        .insert(users)
        .values({ clerkId: data.id, email: primaryEmail, plan: 'free' })
        .onConflictDoUpdate({
          target: users.clerkId,
          set: { email: primaryEmail, updatedAt: new Date() },
        })
      break
    }

    case 'user.deleted': {
      // Soft-delete: mark vaults deleted via cascade handled at query time
      await db.delete(users).where(eq(users.clerkId, data.id))
      break
    }

    case 'session.created': {
      // TODO Step 11: write audit_log entry for sign-in
      break
    }
  }

  return c.json({ ok: true })
}
