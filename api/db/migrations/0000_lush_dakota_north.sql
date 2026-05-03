CREATE TYPE "public"."plan" AS ENUM('free', 'starter', 'personal', 'family', 'pro');--> statement-breakpoint
CREATE TYPE "public"."retrieval_status" AS ENUM('requested', 'validated', 'initiated', 'polling', 'ready', 'notification_sent', 'completed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."tier" AS ENUM('hot', 'warm', 'cold', 'frozen');--> statement-breakpoint
CREATE TYPE "public"."urgency" AS ENUM('bulk', 'standard', 'expedited');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text,
	"ip" text,
	"user_agent" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vault_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"path" text NOT NULL,
	"s3_key" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"content_type" text DEFAULT 'application/octet-stream' NOT NULL,
	"storage_tier" "tier" NOT NULL,
	"sha256" text,
	"thumbnail_key" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_accessed_at" timestamp,
	"deleted_at" timestamp,
	CONSTRAINT "files_s3_key_unique" UNIQUE("s3_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "retrieval_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"vault_id" uuid NOT NULL,
	"file_ids" text[] NOT NULL,
	"urgency" "urgency" NOT NULL,
	"status" "retrieval_status" DEFAULT 'requested' NOT NULL,
	"estimated_cost_cents" integer,
	"actual_cost_cents" integer,
	"sfn_execution_arn" text,
	"download_url" text,
	"ready_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "usage_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"period_date" timestamp NOT NULL,
	"storage_bytes_by_tier" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"retrieved_bytes_by_urgency" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reported_to_stripe_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_id" text NOT NULL,
	"email" text NOT NULL,
	"plan" "plan" DEFAULT 'free' NOT NULL,
	"stripe_customer_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerk_id_unique" UNIQUE("clerk_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vaults" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"default_tier" "tier" DEFAULT 'frozen' NOT NULL,
	"hold_until" timestamp,
	"worm_enabled" boolean DEFAULT false NOT NULL,
	"encryption_salt" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "files" ADD CONSTRAINT "files_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "public"."vaults"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "files" ADD CONSTRAINT "files_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "retrieval_requests" ADD CONSTRAINT "retrieval_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "retrieval_requests" ADD CONSTRAINT "retrieval_requests_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "public"."vaults"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vaults" ADD CONSTRAINT "vaults_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_log_user_id_created_at_idx" ON "audit_log" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "files_vault_id_idx" ON "files" USING btree ("vault_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "files_user_id_idx" ON "files" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "files_user_id_tier_deleted_idx" ON "files" USING btree ("user_id","storage_tier","deleted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "retrieval_requests_user_id_idx" ON "retrieval_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "retrieval_requests_status_idx" ON "retrieval_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "usage_records_user_id_period_idx" ON "usage_records" USING btree ("user_id","period_date");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_clerk_id_idx" ON "users" USING btree ("clerk_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vaults_user_id_idx" ON "vaults" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vaults_user_id_deleted_at_idx" ON "vaults" USING btree ("user_id","deleted_at");