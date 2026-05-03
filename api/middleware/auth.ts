import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import { verifyToken } from '@clerk/backend'

export type AuthVariables = {
  userId: string
}

export const requireAuth = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw new HTTPException(401, { message: 'Missing authorization header' })
  }

  const token = authHeader.slice(7)

  let payload: Awaited<ReturnType<typeof verifyToken>>
  try {
    payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    })
  } catch {
    throw new HTTPException(401, { message: 'Invalid or expired token' })
  }

  c.set('userId', payload.sub)
  await next()
})
