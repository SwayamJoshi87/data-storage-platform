import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth'
import { checkRetrievalQuota } from '../middleware/quota'

export const retrievals = new Hono()

retrievals.use('*', requireAuth)

const createRetrievalSchema = z.object({
  fileIds: z.array(z.string().uuid()).min(1),
  urgency: z.enum(['bulk', 'standard', 'expedited']),
})

// POST /api/retrievals
retrievals.post('/', zValidator('json', createRetrievalSchema), checkRetrievalQuota, async (c) => {
  const userId = c.get('userId')
  const body = c.req.valid('json')
  // TODO Step 9: validate ownership, estimate cost, insert DB row, start Step Functions execution
  void userId; void body
  return c.json({ retrieval: null }, 201)
})

// GET /api/retrievals
retrievals.get('/', async (c) => {
  const userId = c.get('userId')
  const status = c.req.query('status')
  // TODO Step 9: list retrieval requests for user
  void userId; void status
  return c.json({ retrievals: [] })
})

// GET /api/retrievals/:id
retrievals.get('/:id', async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.param()
  // TODO Step 9: return retrieval status + download URL if ready
  void userId; void id
  return c.json({ retrieval: null })
})
