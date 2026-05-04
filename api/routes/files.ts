import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { eq, and } from 'drizzle-orm'
import { requireAuth } from '../middleware/auth'
import { db } from '../db/client'
import { files } from '../db/schema'
import { getUserByClerkId } from '../lib/db-helpers'
import { getBackend } from '../storage'

export const filesRouter = new Hono()

filesRouter.use('*', requireAuth)

// GET /api/files/:id/download-url — presigned 1-hour download URL
filesRouter.get('/:id/download-url', async (c) => {
  const clerkId = c.get('userId')
  const user = await getUserByClerkId(clerkId)
  const fileId = c.req.param('id')

  const file = await db.query.files.findFirst({
    where: and(eq(files.id, fileId), eq(files.userId, user.id)),
  })

  if (!file) throw new HTTPException(404, { message: 'File not found' })

  const backend = getBackend(file.storageTier)
  const url = await backend.getPresignedDownloadUrl(file.s3Key, 3600)

  await db
    .update(files)
    .set({ lastAccessedAt: new Date() })
    .where(eq(files.id, fileId))

  return c.json({ url, expiresIn: 3600 })
})

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
