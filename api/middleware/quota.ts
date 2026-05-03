import type { MiddlewareHandler } from 'hono';
import type { AuthVariables } from './auth';

// TODO Step 9: enforce per-plan storage + retrieval quotas
export const quotaCheck: MiddlewareHandler<{ Variables: AuthVariables }> = async (_c, next) => {
  await next();
};
