import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth'

export const vaults = new Hono()

vaults.use('*', requireAuth)

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

// GET /api/vaults
vaults.get('/', async (c) => {
  const userId = c.get('userId')
  // TODO Step 4: query vaults from DB where user_id = userId and deleted_at is null
  void userId
  return c.json({ vaults: [] })
})

// POST /api/vaults
vaults.post('/', zValidator('json', createVaultSchema), async (c) => {
  const userId = c.get('userId')
  const body = c.req.valid('json')
  // TODO Step 4: insert vault into DB, return created record
  void userId; void body
  return c.json({ vault: null }, 201)
})

// PATCH /api/vaults/:id
vaults.patch('/:id', zValidator('json', updateVaultSchema), async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.param()
  const body = c.req.valid('json')
  // TODO Step 4: update vault, verify ownership
  void userId; void id; void body
  return c.json({ vault: null })
})

// DELETE /api/vaults/:id
vaults.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.param()
  // TODO Step 4: soft delete (set deleted_at), verify ownership
  void userId; void id
  return c.json({ ok: true })
})
