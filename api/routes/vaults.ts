import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db } from '../db/client';
import { vaults } from '../db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import type { AuthVariables } from '../middleware/auth';

const app = new Hono<{ Variables: AuthVariables }>();

const createVaultSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  defaultTier: z.enum(['hot', 'warm', 'cold', 'frozen']).default('frozen'),
});

const updateVaultSchema = createVaultSchema.partial();

// GET /vaults
app.get('/', async (c) => {
  const userId = c.get('userId');
  const rows = await db
    .select()
    .from(vaults)
    .where(and(eq(vaults.userId, userId), isNull(vaults.deletedAt)));
  return c.json(rows);
});

// POST /vaults
app.post('/', zValidator('json', createVaultSchema), async (c) => {
  const userId = c.get('userId');
  const body = c.req.valid('json');

  const [vault] = await db
    .insert(vaults)
    .values({ ...body, userId })
    .returning();

  return c.json(vault, 201);
});

// GET /vaults/:id
app.get('/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');

  const [vault] = await db
    .select()
    .from(vaults)
    .where(and(eq(vaults.id, id), eq(vaults.userId, userId), isNull(vaults.deletedAt)));

  if (!vault) return c.json({ error: 'Not found' }, 404);
  return c.json(vault);
});

// PATCH /vaults/:id
app.patch('/:id', zValidator('json', updateVaultSchema), async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const body = c.req.valid('json');

  const [vault] = await db
    .update(vaults)
    .set({ ...body, updatedAt: new Date() })
    .where(and(eq(vaults.id, id), eq(vaults.userId, userId), isNull(vaults.deletedAt)))
    .returning();

  if (!vault) return c.json({ error: 'Not found' }, 404);
  return c.json(vault);
});

// DELETE /vaults/:id  (soft delete)
app.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');

  const [vault] = await db
    .update(vaults)
    .set({ deletedAt: new Date() })
    .where(and(eq(vaults.id, id), eq(vaults.userId, userId), isNull(vaults.deletedAt)))
    .returning();

  if (!vault) return c.json({ error: 'Not found' }, 404);
  return c.json({ ok: true });
});

export default app;
