import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import { eq, and, isNull, desc } from 'drizzle-orm'
import { requireAuth } from '../middleware/auth'
import { getBackend } from '../storage'
import { db } from '../db/client'
import { vaults, files } from '../db/schema'
import { getUserByClerkId, buildS3Key } from '../lib/db-helpers'

export const vaultsRouter = new Hono()

vaultsRouter.use('*', requireAuth)

// ---- Schemas ---------------------------------------------------------------

const createVaultSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  defaultTier: z.enum(['hot', 'warm', 'cold', 'frozen']).default('frozen'),
})

const updateVaultSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  defaultTier: z.enum(['hot', 'warm', 'cold', 'frozen']).optional(),
})

const uploadUrlSchema = z.object({
  filename: z.string().min(1).max(1000),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  tier: z.enum(['hot', 'warm', 'cold', 'frozen']).optional(),
})

// ---- Helpers ---------------------------------------------------------------

/** Assert the vault belongs to the user and is not deleted. */
async function assertVaultOwner(vaultId: string, userId: string) {
  const vault = await db.query.vaults.findFirst({
    where: and(eq(vaults.id, vaultId), eq(vaults.userId, userId), isNull(vaults.deletedAt)),
  })
  if (!vault) throw new HTTPException(404, { message: 'Vault not found' })
  return vault
}

// ---- Vault CRUD ------------------------------------------------------------

// GET /api/vaults
vaultsRouter.get('/', async (c) => {
  const clerkId = c.get('userId')
  const user = await getUserByClerkId(clerkId)

  const rows = await db.query.vaults.findMany({
    where: and(eq(vaults.userId, user.id), isNull(vaults.deletedAt)),
    orderBy: [desc(vaults.createdAt)],
  })

  return c.json({ vaults: rows })
})

// POST /api/vaults
vaultsRouter.post('/', zValidator('json', createVaultSchema), async (c) => {
  const clerkId = c.get('userId')
  const user = await getUserByClerkId(clerkId)
  const { name, description, defaultTier } = c.req.valid('json')

  const [vault] = await db
    .insert(vaults)
    .values({ userId: user.id, name, description, defaultTier })
    .returning()

  return c.json({ vault }, 201)
})

// PATCH /api/vaults/:id
vaultsRouter.patch('/:id', zValidator('json', updateVaultSchema), async (c) => {
  const clerkId = c.get('userId')
  const user = await getUserByClerkId(clerkId)
  const vaultId = c.req.param('id')
  const updates = c.req.valid('json')

  await assertVaultOwner(vaultId, user.id)

  const [updated] = await db
    .update(vaults)
    .set({ ...updates })
    .where(eq(vaults.id, vaultId))
    .returning()

  return c.json({ vault: updated })
})

// DELETE /api/vaults/:id
vaultsRouter.delete('/:id', async (c) => {
  const clerkId = c.get('userId')
  const user = await getUserByClerkId(clerkId)
  const vaultId = c.req.param('id')

  await assertVaultOwner(vaultId, user.id)

  await db.update(vaults).set({ deletedAt: new Date() }).where(eq(vaults.id, vaultId))

  return c.json({ ok: true })
})

// ---- Vault-scoped file routes ----------------------------------------------

// GET /api/vaults/:id/files
vaultsRouter.get('/:id/files', async (c) => {
  const clerkId = c.get('userId')
  const user = await getUserByClerkId(clerkId)
  const vaultId = c.req.param('id')
  const cursor = c.req.query('cursor') ?? null
  const limit = Math.min(Number(c.req.query('limit') ?? 50), 200)

  await assertVaultOwner(vaultId, user.id)

  const rows = await db.query.files.findMany({
    where: and(
      eq(files.vaultId, vaultId),
      eq(files.userId, user.id),
      isNull(files.deletedAt),
    ),
    orderBy: [desc(files.createdAt)],
    limit: limit + 1,
    // Cursor: createdAt of the last item from previous page
    ...(cursor ? { offset: Number(cursor) } : {}),
  })

  const hasMore = rows.length > limit
  const page = hasMore ? rows.slice(0, limit) : rows
  const nextCursor = hasMore ? String(Number(cursor ?? 0) + limit) : null

  return c.json({ files: page, nextCursor })
})

// POST /api/vaults/:id/upload-url
vaultsRouter.post('/:id/upload-url', zValidator('json', uploadUrlSchema), async (c) => {
  const clerkId = c.get('userId')
  const user = await getUserByClerkId(clerkId)
  const vaultId = c.req.param('id')
  const { filename, contentType, sizeBytes, tier } = c.req.valid('json')

  const vault = await assertVaultOwner(vaultId, user.id)
  const storageTier = tier ?? vault.defaultTier

  const fileId = crypto.randomUUID()
  const s3Key = buildS3Key(clerkId, vaultId, fileId, filename)

  // Insert the file record before generating the URL — ensures the row exists
  // even if the client never completes the upload.
  const [fileRecord] = await db
    .insert(files)
    .values({
      id: fileId,
      vaultId,
      userId: user.id,
      path: filename,
      s3Key,
      sizeBytes,
      contentType,
      storageTier,
    })
    .returning()

  const backend = getBackend(storageTier)
  const uploadUrl = await backend.getPresignedUploadUrl(s3Key, contentType, 3600)

  return c.json({ fileId: fileRecord.id, uploadUrl, s3Key }, 201)
})
