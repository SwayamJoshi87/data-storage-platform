/**
 * Smoke-test script: insert and query a user + vault row.
 * Run after `drizzle-kit migrate` to verify the DB is wired correctly.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... npx tsx api/db/seed.ts
 */
import { db } from './client'
import { users, vaults } from './schema'
import { eq } from 'drizzle-orm'

async function main() {
  console.log('🌱 Seeding test data...')

  // Upsert a test user (same pattern as the Clerk webhook handler)
  const [user] = await db
    .insert(users)
    .values({
      clerkId: 'seed_test_clerk_id',
      email: 'seed@example.com',
      plan: 'free',
    })
    .onConflictDoUpdate({
      target: users.clerkId,
      set: { email: 'seed@example.com', updatedAt: new Date() },
    })
    .returning()

  console.log('✅ User upserted:', user.id, user.email)

  // Create a test vault
  const [vault] = await db
    .insert(vaults)
    .values({
      userId: user.id,
      name: 'Test Vault',
      description: 'Created by seed script',
      defaultTier: 'frozen',
    })
    .returning()

  console.log('✅ Vault created:', vault.id, vault.name)

  // Query back using relational API
  const result = await db.query.users.findFirst({
    where: eq(users.clerkId, 'seed_test_clerk_id'),
    with: { vaults: true },
  })

  console.log('✅ Relational query:', JSON.stringify(result, null, 2))

  // Clean up
  await db.delete(vaults).where(eq(vaults.id, vault.id))
  await db.delete(users).where(eq(users.id, user.id))
  console.log('✅ Cleaned up test rows')
  console.log('\n🎉 Database connection and schema verified successfully!')
}

main().catch((err) => {
  console.error('❌ Seed failed:', err)
  process.exit(1)
})
