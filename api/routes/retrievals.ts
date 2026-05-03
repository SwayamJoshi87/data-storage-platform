import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db } from '../db/client';
import { retrievalRequests } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import type { AuthVariables } from '../middleware/auth';

const app = new Hono<{ Variables: AuthVariables }>();

const createRetrievalSchema = z.object({
  vaultId: z.string().uuid(),
  fileIds: z.array(z.string().uuid()).min(1),
  urgency: z.enum(['bulk', 'standard', 'expedited']),
});

// POST /retrievals
// TODO Step 6: trigger Step Functions state machine; calculate cost estimate
app.post('/', zValidator('json', createRetrievalSchema), async (c) => {
  const userId = c.get('userId');
  const body = c.req.valid('json');

  const [request] = await db
    .insert(retrievalRequests)
    .values({
      userId,
      vaultId: body.vaultId,
      fileIds: body.fileIds,
      urgency: body.urgency,
      status: 'requested',
    })
    .returning();

  return c.json(request, 202);
});

// GET /retrievals
app.get('/', async (c) => {
  const userId = c.get('userId');
  const rows = await db
    .select()
    .from(retrievalRequests)
    .where(eq(retrievalRequests.userId, userId));
  return c.json(rows);
});

// GET /retrievals/:id
app.get('/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');

  const [request] = await db
    .select()
    .from(retrievalRequests)
    .where(and(eq(retrievalRequests.id, id), eq(retrievalRequests.userId, userId)));

  if (!request) return c.json({ error: 'Not found' }, 404);
  return c.json(request);
});

export default app;
