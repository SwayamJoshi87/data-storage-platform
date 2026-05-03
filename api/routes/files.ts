import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth'
import { checkStorageQuota } from '../middleware/quota'

export const files = new Hono()

files.use('*', requireAuth)

const uploadUrlSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string(),
  sizeBytes: z.number().positive(),
  tier: z.enum(['hot', 'warm', 'cold', 'frozen']).optional(),
})

// GET /api/vaults/:vaultId/files  (mounted under /api/files but accessed via vault router)
// TODO Step 4: this route is also registered on the vaults router as /api/vaults/:id/files
files.get('/vaults/:vaultId/files', async (c) => {
  const userId = c.get('userId')
  const { vaultId } = c.req.param()
  const cursor = c.req.query('cursor')
  const limit = Number(c.req.query('limit') ?? 50)
  // TODO Step 4: query files from DB, verify vault ownership, paginate
  void userId; void vaultId; void cursor; void limit
  return c.json({ files: [], nextCursor: null })
})

// POST /api/vaults/:vaultId/upload-url
files.post('/vaults/:vaultId/upload-url', zValidator('json', uploadUrlSchema), checkStorageQuota, async (c) => {
  const userId = c.get('userId')
  const { vaultId } = c.req.param()
  const body = c.req.valid('json')
  // TODO Step 4: create file record in DB, generate presigned S3 upload URL
  void userId; void vaultId; void body
  return c.json({ fileId: null, uploadUrl: null, fields: {} }, 201)
})

// DELETE /api/files/:id
files.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.param()
  // TODO Step 4: soft delete file, verify ownership
  void userId; void id
  return c.json({ ok: true })
})
