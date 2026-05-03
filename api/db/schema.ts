import { pgTable, text, timestamp, boolean, integer, bigint, jsonb } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(), // Clerk user ID (clerk_xxx)
  email: text('email').notNull().unique(),
  plan: text('plan').notNull().default('free'), // 'free' | 'starter' | 'personal' | 'family' | 'pro'
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const vaults = pgTable('vaults', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  defaultTier: text('default_tier').notNull().default('frozen'), // 'hot'|'warm'|'cold'|'frozen'
  encrypted: boolean('encrypted').notNull().default(false),
  encryptionKeyHint: text('encryption_key_hint'),
  wormEnabled: boolean('worm_enabled').notNull().default(false),
  timeLockUntil: timestamp('time_lock_until'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

export const files = pgTable('files', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  vaultId: text('vault_id')
    .notNull()
    .references(() => vaults.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  path: text('path').notNull(), // virtual folder path within vault
  sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
  contentType: text('content_type').notNull().default('application/octet-stream'),
  storageTier: text('storage_tier').notNull(), // 'hot'|'warm'|'cold'|'frozen'
  s3Key: text('s3_key').notNull(), // tenants/{userId}/vaults/{vaultId}/{fileId}
  sha256: text('sha256'),
  encrypted: boolean('encrypted').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastAccessedAt: timestamp('last_accessed_at'),
  deletedAt: timestamp('deleted_at'),
});

export const retrievalRequests = pgTable('retrieval_requests', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  vaultId: text('vault_id')
    .notNull()
    .references(() => vaults.id),
  fileIds: jsonb('file_ids').$type<string[]>().notNull(),
  urgency: text('urgency').notNull(), // 'bulk'|'standard'|'expedited'
  // 'requested'|'initiated'|'polling'|'ready'|'completed'|'expired'
  status: text('status').notNull().default('requested'),
  estimatedCostCents: integer('estimated_cost_cents'),
  actualCostCents: integer('actual_cost_cents'),
  s3RestoreJobId: text('s3_restore_job_id'),
  readyAt: timestamp('ready_at'),
  expiresAt: timestamp('expires_at'),
  downloadUrl: text('download_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const auditLog = pgTable('audit_log', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: text('action').notNull(), // 'upload'|'download'|'delete'|'retrieve'|'share' …
  resourceType: text('resource_type').notNull(), // 'vault'|'file'|'retrieval'
  resourceId: text('resource_id'),
  ip: text('ip'),
  userAgent: text('user_agent'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const usageRecords = pgTable('usage_records', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  periodStart: timestamp('period_start').notNull(),
  periodEnd: timestamp('period_end').notNull(),
  storageGbDaysByTier: jsonb('storage_gb_days_by_tier')
    .$type<Record<string, number>>()
    .notNull()
    .default({}),
  retrievedGbByUrgency: jsonb('retrieved_gb_by_urgency')
    .$type<Record<string, number>>()
    .notNull()
    .default({}),
  reportedToStripeAt: timestamp('reported_to_stripe_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
