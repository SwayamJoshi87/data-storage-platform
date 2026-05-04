import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, and, inArray, isNull } from 'drizzle-orm'
import { HTTPException } from 'hono/http-exception'
import { requireAuth } from '../middleware/auth'
import { checkRetrievalQuota } from '../middleware/quota'
import { db } from '../db/client'
import { files, retrievalRequests } from '../db/schema'
import { getUserByClerkId } from '../lib/db-helpers'
import { getBackend } from '../storage'

export const retrievals = new Hono()

retrievals.use('*', requireAuth)

// Retrieval pricing: $/GB
const COST_PER_GB: Record<string, number> = {
  bulk:      0.0025,
  standard:  0.01,
  expedited: 0.03,
}

const createSchema = z.object({
  fileIds: z.array(z.string().uuid()).min(1).max(100),
  urgency: z.enum(['bulk', 'standard', 'expedited']),
})

// POST /api/retrievals — initiate Glacier restore for one or more cold/frozen files
retrievals.post('/', zValidator('json', createSchema), checkRetrievalQuota, async (c) => {
  const clerkId = c.get('userId')
  const user = await getUserByClerkId(clerkId)
  const { fileIds, urgency } = c.req.valid('json')

  // Verify ownership + non-deleted
  const owned = await db.query.files.findMany({
    where: and(
      inArray(files.id, fileIds),
      eq(files.userId, user.id),
      isNull(files.deletedAt),
    ),
  })
  if (owned.length !== fileIds.length) {
    throw new HTTPException(404, { message: 'One or more files not found' })
  }

  // Only cold/frozen require retrieval
  const hotWarm = owned.filter((f) => f.storageTier === 'hot' || f.storageTier === 'warm')
  if (hotWarm.length > 0) {
    throw new HTTPException(400, { message: 'Only cold and frozen files require retrieval' })
  }

  // Cost estimate
  const totalBytes = owned.reduce((s, f) => s + f.sizeBytes, 0)
  const estimatedCostCents = Math.ceil((totalBytes / 1024 ** 3) * COST_PER_GB[urgency] * 100)

  const [retrieval] = await db.insert(retrievalRequests).values({
    userId: user.id,
    vaultId: owned[0].vaultId,
    fileIds,
    urgency,
    status: 'initiated',
    estimatedCostCents,
  }).returning()

  // Fire restore jobs; ignore "already restored" errors (409)
  await Promise.allSettled(
    owned.map((file) => getBackend(file.storageTier).initiateRetrieval(file.s3Key, urgency)),
  )

  const [updated] = await db.update(retrievalRequests)
    .set({ status: 'polling', updatedAt: new Date() })
    .where(eq(retrievalRequests.id, retrieval.id))
    .returning()

  return c.json({ retrieval: updated }, 201)
})

// GET /api/retrievals — list retrieval requests for authenticated user
retrievals.get('/', async (c) => {
  const clerkId = c.get('userId')
  const user = await getUserByClerkId(clerkId)
  const statusFilter = c.req.query('status')

  const rows = await db.query.retrievalRequests.findMany({
    where: statusFilter
      ? and(
          eq(retrievalRequests.userId, user.id),
          eq(retrievalRequests.status, statusFilter as Parameters<typeof eq>[1]),
        )
      : eq(retrievalRequests.userId, user.id),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
    limit: 100,
  })

  return c.json({ retrievals: rows })
})

// GET /api/retrievals/:id — check status, auto-promote to ready if S3 restore complete
retrievals.get('/:id', async (c) => {
  const clerkId = c.get('userId')
  const user = await getUserByClerkId(clerkId)
  const { id } = c.req.param()

  const retrieval = await db.query.retrievalRequests.findFirst({
    where: and(eq(retrievalRequests.id, id), eq(retrievalRequests.userId, user.id)),
  })
  if (!retrieval) throw new HTTPException(404, { message: 'Retrieval not found' })

  if (retrieval.status === 'polling') {
    const filesToPoll = await db.query.files.findMany({
      where: inArray(files.id, retrieval.fileIds),
    })

    const statuses = await Promise.all(
      filesToPoll.map((f) => getBackend(f.storageTier).pollRetrieval(f.s3Key)),
    )

    if (statuses.every((s) => s === 'ready')) {
      // All files restored — generate 24-hour presigned download URLs
      const urlMap: Record<string, string> = {}
      await Promise.all(
        filesToPoll.map(async (file) => {
          urlMap[file.id] = await getBackend(file.storageTier).getPresignedDownloadUrl(
            file.s3Key,
            24 * 3600,
          )
        }),
      )

      const [done] = await db.update(retrievalRequests)
        .set({
          status: 'ready',
          // For single-file retrievals store URL directly; multi-file stored as JSON object
          downloadUrl: filesToPoll.length === 1
            ? urlMap[filesToPoll[0].id]
            : JSON.stringify(urlMap),
          readyAt: new Date(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          updatedAt: new Date(),
        })
        .where(eq(retrievalRequests.id, id))
        .returning()

      return c.json({ retrieval: done })
    }
  }

  return c.json({ retrieval })
})
