import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { eq, and } from 'drizzle-orm'
import { requireAuth } from '../middleware/auth'
import { db } from '../db/client'
import { files } from '../db/schema'
import { getUserByClerkId } from '../lib/db-helpers'

export const filesRouter = new Hono()

filesRouter.use('*', requireAuth)

// DELETE /api/files/:id — soft delete (verifies ownership)
filesRouter.delete('/:id', async (c) => {
  const clerkId = c.get('userId')
  const user = await getUserByClerkId(clerkId)
  const fileId = c.req.param('id')

  const file = await db.query.files.findFirst({
    where: and(eq(files.id, fileId), eq(files.userId, user.id)),
  })

  if (!file) throw new HTTPException(404, { message: 'File not found' })

  await db.update(files).set({ deletedAt: new Date() }).where(eq(files.id, fileId))

  return c.json({ ok: true })
})
