import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'

export type AuthVariables = {
  userId: string
}

// TODO Step 2: replace stub with real Clerk JWT verification
// import { createClerkClient } from '@clerk/backend'
// const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })

export const requireAuth = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw new HTTPException(401, { message: 'Missing authorization header' })
  }

  // Stub: wire real Clerk verification in Step 2
  const token = authHeader.slice(7)
  if (!token) throw new HTTPException(401, { message: 'Invalid token' })

  // TODO: verify token with Clerk and extract userId
  c.set('userId', 'stub-user-id')

  await next()
})
