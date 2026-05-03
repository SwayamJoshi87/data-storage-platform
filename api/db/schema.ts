import {
  pgTable, text, timestamp, integer, bigint, boolean, jsonb, pgEnum, uuid, index, uniqueIndex,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ---- Enums ----------------------------------------------------------------

export const planEnum = pgEnum('plan', ['free', 'starter', 'personal', 'family', 'pro'])
export const tierEnum = pgEnum('tier', ['hot', 'warm', 'cold', 'frozen'])
export const urgencyEnum = pgEnum('urgency', ['bulk', 'standard', 'expedited'])
export const retrievalStatusEnum = pgEnum('retrieval_status', [
  'requested', 'validated', 'initiated', 'polling', 'ready',
  'notification_sent', 'completed', 'expired',
])

// ---- Tables ---------------------------------------------------------------

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  clerkId: text('clerk_id').notNull().unique(),
  email: text('email').notNull(),
  plan: planEnum('plan').notNull().default('free'),
  stripeCustomerId: text('stripe_customer_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('users_clerk_id_idx').on(t.clerkId),
])

export const vaults = pgTable('vaults', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  defaultTier: tierEnum('default_tier').notNull().default('frozen'),
  holdUntil: timestamp('hold_until'),
  wormEnabled: boolean('worm_enabled').notNull().default(false),
  encryptionSalt: text('encryption_salt'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
}, (t) => [
  index('vaults_user_id_idx').on(t.userId),
  index('vaults_user_id_deleted_at_idx').on(t.userId, t.deletedAt),
])

export const files = pgTable('files', {
  id: uuid('id').primaryKey().defaultRandom(),
  vaultId: uuid('vault_id').notNull().references(() => vaults.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  path: text('path').notNull(),
  s3Key: text('s3_key').notNull().unique(),
  sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
  contentType: text('content_type').notNull().default('application/octet-stream'),
  storageTier: tierEnum('storage_tier').notNull(),
  sha256: text('sha256'),
  thumbnailKey: text('thumbnail_key'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  lastAccessedAt: timestamp('last_accessed_at'),
  deletedAt: timestamp('deleted_at'),
}, (t) => [
  index('files_vault_id_idx').on(t.vaultId),
  index('files_user_id_idx').on(t.userId),
  // For usage metering: sum bytes by tier for non-deleted files
  index('files_user_id_tier_deleted_idx').on(t.userId, t.storageTier, t.deletedAt),
])

export const retrievalRequests = pgTable('retrieval_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  vaultId: uuid('vault_id').notNull().references(() => vaults.id, { onDelete: 'cascade' }),
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
}, (t) => [
  index('retrieval_requests_user_id_idx').on(t.userId),
  // For the Glacier polling cron: quickly find all in-flight requests
  index('retrieval_requests_status_idx').on(t.status),
])

export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  action: text('action').notNull(),
  resourceType: text('resource_type').notNull(),
  resourceId: text('resource_id'),
  ip: text('ip'),
  userAgent: text('user_agent'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index('audit_log_user_id_created_at_idx').on(t.userId, t.createdAt),
])

export const usageRecords = pgTable('usage_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  periodDate: timestamp('period_date').notNull(),
  storageBytesByTier: jsonb('storage_bytes_by_tier').notNull().default({}),
  retrievedBytesByUrgency: jsonb('retrieved_bytes_by_urgency').notNull().default({}),
  reportedToStripeAt: timestamp('reported_to_stripe_at'),
}, (t) => [
  index('usage_records_user_id_period_idx').on(t.userId, t.periodDate),
])

// ---- Relations ------------------------------------------------------------

export const usersRelations = relations(users, ({ many }) => ({
  vaults: many(vaults),
  files: many(files),
  retrievalRequests: many(retrievalRequests),
  auditLog: many(auditLog),
  usageRecords: many(usageRecords),
}))

export const vaultsRelations = relations(vaults, ({ one, many }) => ({
  user: one(users, { fields: [vaults.userId], references: [users.id] }),
  files: many(files),
  retrievalRequests: many(retrievalRequests),
}))

export const filesRelations = relations(files, ({ one }) => ({
  vault: one(vaults, { fields: [files.vaultId], references: [vaults.id] }),
  user: one(users, { fields: [files.userId], references: [users.id] }),
}))

export const retrievalRequestsRelations = relations(retrievalRequests, ({ one }) => ({
  user: one(users, { fields: [retrievalRequests.userId], references: [users.id] }),
  vault: one(vaults, { fields: [retrievalRequests.vaultId], references: [vaults.id] }),
}))

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  user: one(users, { fields: [auditLog.userId], references: [users.id] }),
}))

export const usageRecordsRelations = relations(usageRecords, ({ one }) => ({
  user: one(users, { fields: [usageRecords.userId], references: [users.id] }),
}))
