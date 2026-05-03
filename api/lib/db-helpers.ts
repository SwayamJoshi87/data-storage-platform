import { HTTPException } from 'hono/http-exception'
import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { users } from '../db/schema'

export type DbUser = typeof users.$inferSelect

/** Resolve the Clerk user ID to the internal Postgres user row. Throws 404 if not found. */
export async function getUserByClerkId(clerkId: string): Promise<DbUser> {
  const user = await db.query.users.findFirst({ where: eq(users.clerkId, clerkId) })
  if (!user) throw new HTTPException(404, { message: 'User not found — ensure webhook is wired' })
  return user
}

/**
 * Build the S3 object key for a file.
 * Format: tenants/{clerkId}/vaults/{vaultId}/{fileId}/{filename}
 */
export function buildS3Key(clerkId: string, vaultId: string, fileId: string, filename: string): string {
  const safeName = filename.replace(/[^a-zA-Z0-9.\-_]/g, '_')
  return `tenants/${clerkId}/vaults/${vaultId}/${fileId}/${safeName}`
}
