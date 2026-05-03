import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import type { AuthVariables } from './auth'

// TODO Step 9: implement real plan limits from DB
const PLAN_LIMITS: Record<string, { storageBytes: number; retrievalsPerMonth: number }> = {
  free:     { storageBytes: 10 * 1024 ** 3,       retrievalsPerMonth: 1 },
  starter:  { storageBytes: 500 * 1024 ** 3,      retrievalsPerMonth: 10 },
  personal: { storageBytes: 2 * 1024 ** 4,        retrievalsPerMonth: 50 },
  family:   { storageBytes: 5 * 1024 ** 4,        retrievalsPerMonth: 100 },
  pro:      { storageBytes: 10 * 1024 ** 4,       retrievalsPerMonth: Infinity },
}

export const checkStorageQuota = createMiddleware<{ Variables: AuthVariables }>(async (_c, next) => {
  // TODO Step 9: query usage_records, compare to plan limit, throw 402 if over
  await next()
})

export const checkRetrievalQuota = createMiddleware<{ Variables: AuthVariables }>(async (_c, next) => {
  // TODO Step 9: query retrieval_requests count this month, compare to plan limit
  await next()
})

export const requirePlan = (...plans: string[]) =>
  createMiddleware<{ Variables: AuthVariables }>(async (_c, next) => {
    // TODO Step 9: fetch user plan from DB, reject if not in allowed list
    void plans
    await next()
  })
