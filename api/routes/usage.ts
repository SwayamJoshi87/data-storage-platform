import { Hono } from 'hono'
import { eq, and, isNull, sum } from 'drizzle-orm'
import { requireAuth } from '../middleware/auth'
import { db } from '../db/client'
import { files } from '../db/schema'
import { getUserByClerkId } from '../lib/db-helpers'

export const usageRouter = new Hono()

usageRouter.use('*', requireAuth)

// GET /api/usage — aggregate live storage bytes per tier for the authenticated user
usageRouter.get('/', async (c) => {
  const clerkId = c.get('userId')
  const user = await getUserByClerkId(clerkId)

  const rows = await db
    .select({ tier: files.storageTier, total: sum(files.sizeBytes) })
    .from(files)
    .where(and(eq(files.userId, user.id), isNull(files.deletedAt)))
    .groupBy(files.storageTier)

  const storageByTier: Record<string, number> = {
    hot: 0,
    warm: 0,
    cold: 0,
    frozen: 0,
  }

  for (const row of rows) {
    storageByTier[row.tier] = Number(row.total ?? 0)
  }

  const now = new Date()
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString()

  return c.json({ storageByTier, periodStart, periodEnd })
})
