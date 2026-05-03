import { Hono } from 'hono';
import { Webhook } from 'svix';
import { db } from '../../db/client';
import { users } from '../../db/schema';
import { eq } from 'drizzle-orm';

const app = new Hono();

interface ClerkEmailAddress {
  email_address: string;
  id: string;
}

interface ClerkUserPayload {
  id: string;
  email_addresses: ClerkEmailAddress[];
  primary_email_address_id: string;
}

app.post('/', async (c) => {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) return c.json({ error: 'Webhook secret not configured' }, 500);

  const svixId = c.req.header('svix-id');
  const svixTimestamp = c.req.header('svix-timestamp');
  const svixSignature = c.req.header('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    return c.json({ error: 'Missing svix headers' }, 400);
  }

  const body = await c.req.text();

  let event: { type: string; data: ClerkUserPayload };
  try {
    const wh = new Webhook(secret);
    event = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as typeof event;
  } catch {
    return c.json({ error: 'Invalid signature' }, 400);
  }

  if (event.type === 'user.created' || event.type === 'user.updated') {
    const data = event.data;
    const primaryEmail = data.email_addresses.find(
      (e) => e.id === data.primary_email_address_id,
    );
    if (!primaryEmail) return c.json({ error: 'No primary email' }, 400);

    await db
      .insert(users)
      .values({
        id: data.id,
        email: primaryEmail.email_address,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: primaryEmail.email_address,
          updatedAt: new Date(),
        },
      });
  }

  if (event.type === 'user.deleted') {
    // Soft-delete is handled via cascade; hard delete if needed later.
    await db.delete(users).where(eq(users.id, event.data.id));
  }

  return c.json({ ok: true });
});

export default app;
