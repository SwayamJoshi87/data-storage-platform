import {
  pgTable, text, timestamp, integer, bigint, boolean, jsonb, pgEnum, uuid
} from 'drizzle-orm/pg-core'

// TODO Step 3: full schema wired up with relations and indexes

export const planEnum = pgEnum('plan', ['free', 'starter', 'personal', 'family', 'pro'])
export const tierEnum = pgEnum('tier', ['hot', 'warm', 'cold', 'frozen'])
export const urgencyEnum = pgEnum('urgency', ['bulk', 'standard', 'expedited'])
export const retrievalStatusEnum = pgEnum('retrieval_status', [
  'requested', 'validated', 'initiated', 'polling', 'ready',
  'notification_sent', 'completed', 'expired',
])

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  clerkId: text('clerk_id').notNull().unique(),
  email: text('email').notNull(),
  plan: planEnum('plan').notNull().default('free'),
  stripeCustomerId: text('stripe_customer_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const vaults = pgTable('vaults', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  description: text('description'),
  defaultTier: tierEnum('default_tier').notNull().default('frozen'),
  holdUntil: timestamp('hold_until'),
  wormEnabled: boolean('worm_enabled').notNull().default(false),
  encryptionSalt: text('encryption_salt'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
})

export const files = pgTable('files', {
  id: uuid('id').primaryKey().defaultRandom(),
  vaultId: uuid('vault_id').notNull().references(() => vaults.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  path: text('path').notNull(),
  s3Key: text('s3_key').notNull(),
  sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
  contentType: text('content_type').notNull().default('application/octet-stream'),
  storageTier: tierEnum('storage_tier').notNull(),
  sha256: text('sha256'),
  thumbnailKey: text('thumbnail_key'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  lastAccessedAt: timestamp('last_accessed_at'),
  deletedAt: timestamp('deleted_at'),
})

export const retrievalRequests = pgTable('retrieval_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  vaultId: uuid('vault_id').notNull().references(() => vaults.id),
  fileIds: text('file_ids').array().notNull(),
  urgency: urgencyEnum('urgency').notNull(),
  status: retrievalStatusEnum('status').notNull().default('requested'),
  estimatedCostCents: integer('estimated_cost_cents'),
  actualCostCents: integer('actual_cost_cents'),
  sfnExecutionArn: text('sfn_execution_arn'),
  downloadUrl: text('download_url'),
  readyAt: timestamp('ready_at'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  action: text('action').notNull(),
  resourceType: text('resource_type').notNull(),
  resourceId: text('resource_id'),
  ip: text('ip'),
  userAgent: text('user_agent'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const usageRecords = pgTable('usage_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  periodDate: timestamp('period_date').notNull(),
  storageBytesByTier: jsonb('storage_bytes_by_tier').notNull().default({}),
  retrievedBytesByUrgency: jsonb('retrieved_bytes_by_urgency').notNull().default({}),
  reportedToStripeAt: timestamp('reported_to_stripe_at'),
})
