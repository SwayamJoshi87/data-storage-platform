# MVP 1 — Public Beta

**Goal:** Paying users can create vaults, upload files to tiered storage, request retrievals, and manage billing.
**Target timeline:** 10–14 weeks (solo founder)
**Success metric:** 20–50 paying beta users, at least one successful end-to-end retrieval from Glacier Deep Archive.

---

## Scope

| In scope | Out of scope |
|----------|-------------|
| Vault create / browse / delete | Cloud imports (Google Drive, OneDrive) |
| 2 storage tiers: Hot + Frozen | Client-side zero-knowledge encryption |
| Retrieval request flow (Glacier) | Vault sharing / family plans |
| Stripe subscriptions + metering | Mobile apps |
| Email notifications | Time-locks / WORM mode |
| Audit log | Trusted contacts |
| Marketing + pricing page | Desktop sync agent |

---

## Architecture (MVP 1)

```
Browser (React 19 + Vite)
  │
  ├── Clerk (auth)
  ├── Stripe.js (checkout redirect)
  └── API calls (useApi.ts + TanStack Query)
        │
        ▼
  Hono on Vercel Serverless / Lambda
  (Clerk JWT middleware)
        │
   ┌────┼──────────────┬────────────────┐
   ▼    ▼              ▼                ▼
Neon  Redis (opt)  Step Functions   S3 Bucket
Postgres          (retrieval SM)    ├─ STANDARD
(Drizzle ORM)                       └─ DEEP_ARCHIVE
        │
   EventBridge cron
   ├─ Glacier poll (15 min)
   └─ Usage meter (daily → Stripe)

External: Clerk · Stripe · Resend · Sentry · PostHog
```

---

## Steps

### Step 1 — Project Setup & Cleanup

**Goal:** clean repo with no Amplify references, new dependencies installed.

- [ ] Remove `aws-amplify`, `@aws-amplify/*` from `package.json`
- [ ] Install new dependencies:
  ```
  @clerk/clerk-react @clerk/backend
  hono @hono/node-server
  drizzle-orm drizzle-kit @neondatabase/serverless
  stripe @stripe/stripe-js
  resend
  @sentry/react @sentry/node
  posthog-js
  zod
  ```
- [ ] Create `.env.local`:
  ```
  VITE_CLERK_PUBLISHABLE_KEY=
  CLERK_SECRET_KEY=
  CLERK_WEBHOOK_SECRET=
  DATABASE_URL=
  STRIPE_SECRET_KEY=
  STRIPE_WEBHOOK_SECRET=
  VITE_STRIPE_PUBLISHABLE_KEY=
  RESEND_API_KEY=
  RESEND_FROM_ADDRESS=
  S3_BUCKET=
  AWS_REGION=
  AWS_ACCESS_KEY_ID=
  AWS_SECRET_ACCESS_KEY=
  STEP_FUNCTIONS_ARN=
  SENTRY_DSN=
  VITE_POSTHOG_KEY=
  ```
- [ ] Scaffold `api/` directory:
  ```
  api/
    index.ts          Hono app entry
    middleware/
      auth.ts         Clerk JWT verification
      quota.ts        Plan enforcement
    routes/
      vaults.ts
      files.ts
      retrievals.ts
      billing.ts
      webhooks/
        clerk.ts
        stripe.ts
    db/
      schema.ts
      client.ts
      migrations/
    storage/
      StorageBackend.ts
      S3StandardBackend.ts
      S3GlacierDeepArchiveBackend.ts
  ```
- [ ] Delete `amplify/` directory and `amplify_outputs.json`
- [ ] Update `vite.config.ts` env prefix from `REACT_APP_` to `VITE_`

---

### Step 2 — Auth: Cognito → Clerk

**Goal:** users can sign up, sign in (email + Google + Apple), enrol MFA, and sign out. No Amplify auth anywhere.

- [ ] Create Clerk application at [dashboard.clerk.com](https://dashboard.clerk.com)
  - Enable email/password, Google OAuth, Apple OAuth
  - Enable TOTP MFA (optional for users, required on Pro plan later)
  - Set redirect URLs to `http://localhost:5173` + Vercel preview URL
- [ ] Install `@clerk/clerk-react`
- [ ] Wrap `src/App.tsx` with `<ClerkProvider publishableKey={...}>` — replace `<Authenticator>`
- [ ] Add `/sign-in` and `/sign-up` routes using `<SignIn />` and `<SignUp />` components
- [ ] Replace all `useAuthenticator()` calls with `useUser()` / `useAuth()`
- [ ] Replace sign-out button in `Topbar.tsx` with `<UserButton />`
- [ ] Add route guard: `<SignedIn>` / `<SignedOut>` wrappers in `App.tsx`
- [ ] Register Clerk webhook in dashboard → `POST /api/webhooks/clerk`
  - Events: `user.created`, `user.updated`, `user.deleted`
  - Upsert into `users` table on each event
- [ ] Remove all Identity Pool / Cognito references from `src/hooks/useStorage.ts` (file will be deleted in Step 4)
- [ ] **Test checklist:**
  - [ ] Sign up with email
  - [ ] Sign up with Google
  - [ ] Sign in, sign out
  - [ ] Enrol TOTP MFA, verify on next login
  - [ ] Clerk webhook fires and writes user row to DB

---

### Step 3 — Database: Neon Postgres + Drizzle

**Goal:** all app state lives in Postgres, not S3 listings or local state.

- [ ] Provision [Neon](https://neon.tech) free-tier instance, copy connection string
- [ ] Install `drizzle-orm drizzle-kit @neondatabase/serverless`
- [ ] Write schema in `api/db/schema.ts`:

  ```ts
  // users — synced from Clerk
  users: id, clerk_id, email, plan (free|starter|personal|family|pro),
         stripe_customer_id, created_at, updated_at

  // vaults
  vaults: id, user_id, name, description, default_tier
          (hot|warm|cold|frozen), created_at, deleted_at

  // files
  files: id, vault_id, user_id, path, s3_key, size_bytes,
         content_type, storage_tier, sha256, thumbnail_key,
         created_at, last_accessed_at, deleted_at

  // retrieval_requests
  retrieval_requests: id, user_id, vault_id, file_ids (text[]),
    urgency (bulk|standard|expedited),
    status (requested|validated|initiated|polling|ready|notification_sent|completed|expired),
    estimated_cost_cents, actual_cost_cents,
    sfn_execution_arn, download_url,
    ready_at, expires_at, created_at, updated_at

  // audit_log
  audit_log: id, user_id, action, resource_type, resource_id,
             ip, user_agent, metadata (jsonb), created_at

  // usage_records (for Stripe metering)
  usage_records: id, user_id, period_date (date),
                 storage_bytes_by_tier (jsonb),
                 retrieved_bytes_by_urgency (jsonb),
                 reported_to_stripe_at
  ```

- [ ] Run `drizzle-kit generate` to generate first migration SQL
- [ ] Run `drizzle-kit migrate` against Neon
- [ ] Write `api/db/client.ts` — Neon serverless connection + Drizzle instance
- [ ] **Test:** insert + query a user row, vault row from a Lambda test invocation

---

### Step 4 — API Layer: Hono

**Goal:** typed REST API with Clerk auth, replacing all direct Amplify SDK calls from the frontend.

- [ ] Scaffold Hono app (`api/index.ts`), export as Vercel serverless handler or Lambda handler
- [ ] Add Clerk JWT middleware (`api/middleware/auth.ts`):
  - Verify `Authorization: Bearer <token>` on every protected route
  - Attach `userId` (Clerk user ID) to context
- [ ] Implement routes:

  **Vaults**
  ```
  GET    /api/vaults                 list user's vaults
  POST   /api/vaults                 create vault
  PATCH  /api/vaults/:id             rename / change default tier
  DELETE /api/vaults/:id             soft delete (set deleted_at)
  ```

  **Files**
  ```
  GET    /api/vaults/:id/files       list files (paginated, cursor-based)
  POST   /api/vaults/:id/upload-url  return presigned S3 multipart upload URL + file record id
  DELETE /api/files/:id              soft delete file
  ```

  **Usage**
  ```
  GET    /api/usage                  current period storage GB + retrieval GB
  ```

  **Webhooks** (no auth middleware — signature verification instead)
  ```
  POST   /api/webhooks/clerk         user sync
  POST   /api/webhooks/stripe        billing events
  ```

- [ ] Write `src/hooks/useApi.ts` — typed fetch wrapper:
  ```ts
  // TanStack Query bindings
  useVaults()
  useVaultFiles(vaultId, cursor)
  useUsage()
  useUploadUrl(vaultId)
  ```
- [ ] Delete `src/hooks/useStorage.ts`
- [ ] Replace all `useStorage` calls in components with `useApi` equivalents
- [ ] **Test:** create vault via `POST /api/vaults`, list via `GET /api/vaults`

---

### Step 5 — Storage Backend Abstraction

**Goal:** S3 operations hidden behind an interface so tiers and backends are swappable later.

- [ ] Define `api/storage/StorageBackend.ts`:
  ```ts
  export interface StorageBackend {
    put(key: string, stream: ReadableStream, opts: {
      contentType: string
      size: number
      metadata?: Record<string, string>
    }): Promise<{ etag: string }>

    getPresignedUploadUrl(key: string, contentType: string, expiresIn: number): Promise<string>

    initiateRetrieval(key: string, urgency: 'bulk' | 'standard' | 'expedited'): Promise<{
      jobId: string
      estimatedCompletionAt: Date
    }>

    pollRetrieval(key: string): Promise<'pending' | 'ready'>

    getPresignedDownloadUrl(key: string, expiresIn: number): Promise<string>

    delete(key: string): Promise<void>
    headObject(key: string): Promise<{ size: number; lastModified: Date; storageClass: string }>
  }
  ```

- [ ] Implement `S3StandardBackend` (storage class: `STANDARD`)
- [ ] Implement `S3GlacierDeepArchiveBackend` (storage class: `DEEP_ARCHIVE`)
  - `initiateRetrieval`: calls `s3.restoreObject()` with appropriate tier
  - `pollRetrieval`: calls `s3.headObject()` and checks `Restore` header
- [ ] Restructure S3 bucket key format:
  ```
  tenants/{clerk_user_id}/vaults/{vault_id}/{file_id}/{filename}
  thumbnails/{clerk_user_id}/vaults/{vault_id}/{file_id}.jpg
  ```
- [ ] Create IAM role for API Lambda:
  - `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject` on `tenants/*`
  - `s3:RestoreObject`, `s3:HeadObject` on `tenants/*`
  - `s3:PutObject` on `thumbnails/*`
- [ ] Set S3 lifecycle rule: objects with tag `tier=frozen` → skip Standard-IA, go directly to DEEP_ARCHIVE on day 0 (use storage class at upload time, not lifecycle transition)
- [ ] **Test:** upload 1 file to STANDARD via presigned URL, upload 1 file directly to DEEP_ARCHIVE, verify storage classes in AWS console

---

### Step 6 — Frontend: Vault UI

**Goal:** users see a vault list, can create vaults, and navigate into each vault.

- [ ] Create `src/pages/Vaults.tsx`:
  - Grid of vault cards (name, tier badge, file count, estimated monthly cost)
  - "New Vault" button → `CreateVaultDialog`
  - Empty state with helpful copy for new users
- [ ] Create `src/components/vault/CreateVaultDialog.tsx`:
  - Fields: name, description, default tier (radio: Hot / Warm / Cold / Frozen with price/GB/mo shown)
- [ ] Update `src/components/layout/AppSidebar.tsx`:
  - Replace S3 folder tree listing with vault list from `useVaults()`
  - Remove `identityId` / Cognito Identity Pool dependency
  - Active vault highlighted
- [ ] Update `src/store/useFileBrowserStore.ts`:
  - Add: `currentVaultId: string | null`
  - Add: `tierFilter: Tier | 'all'`
  - Remove: S3 path / prefix state
- [ ] Update routing in `src/App.tsx`:
  - `/app/vaults` → `<Vaults />`
  - `/app/vault/:id` → `<FileBrowser vaultId={id} />`
  - Default redirect `/app` → `/app/vaults`
- [ ] **Test:** create 2 vaults, navigate between them, sidebar shows both

---

### Step 7 — Frontend: File Browser Updates

**Goal:** file browser is vault-aware, shows tier info, gates media access by tier.

- [ ] Update `src/pages/FileBrowser.tsx`:
  - Fetch files from `GET /api/vaults/:id/files` (not `Storage.list()`)
  - Support cursor-based pagination ("load more")
- [ ] Update `src/components/files/FileCard.tsx`:
  - Add tier badge chip (Frozen = blue, Cold = teal, Warm = yellow, Hot = green)
  - Add `last_accessed_at` tooltip
  - For Frozen/Cold tier: replace download/preview actions with "Request Access" button
- [ ] Update `src/components/files/UploadZone.tsx`:
  - Add tier selector (defaults to vault's `default_tier`)
  - Show projected monthly cost next to tier selector (`size × $/GB/mo`)
  - On upload complete: call `POST /api/vaults/:id/upload-url`, upload to presigned URL, mark complete
- [ ] Update `src/components/files/MediaViewer.tsx`:
  - Only open for Hot / Warm tier files
  - For Cold / Frozen: show "This file is in cold storage — request access to view"
- [ ] Update `src/components/files/FileDetail.tsx`:
  - Show storage tier, size, upload date, estimated retrieval cost by urgency
- [ ] **Test:** upload a file to Hot → preview works. Upload to Frozen → card shows "Request Access", media viewer blocked.

---

### Step 8 — Retrieval Request Flow

**Goal:** users can request frozen/cold files, the system polls Glacier, notifies on ready, and provides a timed download link.

#### 8a — Backend State Machine

- [ ] Define Step Functions state machine (`infra/retrieval-machine.asl.json`):
  ```
  Requested
    → (Lambda: validate quota + cost, insert DB row, start SFN)
  Initiated
    → (Lambda: call s3.restoreObject for each file key)
  Polling
    → (Wait 15 min) → (Lambda: headObject check)
    → if not ready: loop back to Wait
    → if ready: proceed
  Ready
    → (Lambda: generate presigned download URLs, update DB)
  NotificationSent
    → (Lambda: send Resend email)
  Completed / Expired
    → (Lambda: record actual cost to usage_records)
  ```
- [ ] Deploy state machine via AWS CDK or console
- [ ] Write Lambda handlers for each state transition
- [ ] EventBridge rule: cron `*/15 * * * *` → trigger polling Lambda for all `polling` status requests

#### 8b — API Endpoints

- [ ] `POST /api/retrievals` — validate plan quota, estimate cost (show to user before confirming), insert row, start SFN execution
- [ ] `GET /api/retrievals` — list user's retrieval requests (pending / ready / completed)
- [ ] `GET /api/retrievals/:id` — single request status + download URL if ready

#### 8c — Frontend

- [ ] Create `src/pages/VaultRequest.tsx`:
  - Step 1: file list with checkboxes (pre-selected if clicked from FileCard)
  - Step 2: urgency selector — Bulk (48hr, cheapest) / Standard (12hr) / Expedited (4hr, premium)
  - Real-time cost estimate shown before confirm
  - Step 3: confirmation → `POST /api/retrievals`
- [ ] Create `src/hooks/useRetrieval.ts`:
  - `useRetrievalStatus(id)` — TanStack Query, polls `GET /api/retrievals/:id` every 30s while status is `polling`
- [ ] Add retrieval queue section to `FileBrowser.tsx`:
  - Collapsible list of active/ready requests
  - Progress chip: "Ready for download", "Estimated ready in 6hr", "Expires in 22hr"
  - Download button when ready (opens presigned URL)
- [ ] **Test (using Glacier Instant Retrieval in dev to avoid 12hr wait):** upload → request → poll → download link appears → download works.

---

### Step 9 — Stripe Billing

**Goal:** users can subscribe to a plan, manage it themselves, and get metered for overages.

#### 9a — Stripe Setup

- [ ] Create Stripe products + prices:
  | Product | Price ID | Monthly |
  |---------|----------|---------|
  | Starter | `price_starter` | $3 |
  | Personal | `price_personal` | $8 |
  | Family | `price_family` | $15 |
  | Pro | `price_pro` | $35 |
- [ ] Create Stripe Meters: `storage_gb_days`, `retrieved_gb`
- [ ] Add meter prices to each product (pay-as-you-go overage)
- [ ] Enable Stripe Customer Portal (allow plan changes, cancel, payment method update)

#### 9b — API

- [ ] `POST /api/billing/checkout` — create Stripe Checkout session for a given plan, return URL
- [ ] `GET /api/billing/portal` — create Customer Portal session, return URL
- [ ] `POST /api/webhooks/stripe`:
  - `checkout.session.completed` → update `users.plan` + `users.stripe_customer_id`
  - `customer.subscription.updated` → sync plan
  - `customer.subscription.deleted` → downgrade to free
  - `invoice.payment_failed` → flag account, send email

#### 9c — Usage Metering Cron

- [ ] EventBridge daily cron → Lambda:
  - Aggregate `files` table: `SUM(size_bytes × days_in_period)` per tier per user
  - Aggregate `retrieval_requests`: `SUM(actual_bytes_retrieved)` per urgency per user
  - Call `stripe.billing.meterEvents.create()` for each user
  - Mark `usage_records.reported_to_stripe_at`

#### 9d — Quota Enforcement

- [ ] `api/middleware/quota.ts`:
  - On upload: check `SUM(size_bytes)` against plan storage limit. Reject with 402 if over.
  - On retrieval request: check monthly retrieval count for free tier (1 retrieval/mo). Reject with 402 if over.

#### 9e — Frontend

- [ ] `src/pages/Pricing.tsx` — plan comparison table with "Get Started" CTA per plan
- [ ] `src/pages/Billing.tsx`:
  - Current plan name, renewal date, storage used / limit (progress bar)
  - "Manage Billing" button → `GET /api/billing/portal` → redirect
  - "Upgrade" link → `/pricing`
- [ ] Add "Upgrade" banner in `Topbar.tsx` when user is on free tier approaching quota
- [ ] **Test:** sign up free → upload 10GB → hit quota → upgrade to Starter → quota lifts

---

### Step 10 — Email Notifications (Resend)

**Goal:** users get timely transactional emails for key events.

- [ ] Create [Resend](https://resend.com) account, verify sending domain
- [ ] Write email templates (`api/emails/`):
  - `Welcome.tsx` — "Your vault is ready. Here's how to upload your first file."
  - `RetrievalReady.tsx` — "Your files are ready to download. Link expires in 48 hours."
  - `RetrievalExpiring.tsx` — "Your download link expires in 24 hours — don't forget to save your files."
  - `PaymentFailed.tsx` — "Your payment failed. Update your card to keep vault access."
- [ ] Wire triggers:
  - Welcome → Clerk `user.created` webhook handler
  - Retrieval ready → Step Functions `NotificationSent` Lambda
  - Retrieval expiring → EventBridge cron (daily, check `expires_at` within 24hr)
  - Payment failed → Stripe `invoice.payment_failed` webhook handler
- [ ] **Test:** trigger each email manually via a test endpoint, verify receipt + links work

---

### Step 11 — Audit Logging

**Goal:** every security-relevant action is logged and accessible to Pro users.

- [ ] Write to `audit_log` table in every relevant handler:
  | Action | Trigger |
  |--------|---------|
  | `vault.created` | POST /vaults |
  | `vault.deleted` | DELETE /vaults/:id |
  | `file.uploaded` | POST /vaults/:id/upload-url completion |
  | `file.deleted` | DELETE /files/:id |
  | `retrieval.requested` | POST /retrievals |
  | `retrieval.downloaded` | download URL accessed |
  | `user.signed_in` | Clerk `session.created` webhook |
- [ ] `GET /api/audit?vault_id=&limit=50&cursor=` — Pro plan only (enforce in quota middleware)
- [ ] `src/pages/Settings.tsx` — "Security Log" tab: table of audit events with action, resource, time, IP

---

### Step 12 — Monitoring & Analytics

**Goal:** visibility into errors and user behaviour from day one.

- [ ] **Sentry:**
  - Install `@sentry/react` in frontend (`src/main.tsx`)
  - Install `@sentry/node` in API Lambda
  - Configure DSN, set up error → email/Slack alert for new issues
- [ ] **PostHog:**
  - Install `posthog-js` in frontend
  - Track events:
    - `vault_created` (default_tier)
    - `file_uploaded` (tier, size_mb)
    - `retrieval_requested` (urgency, file_count, estimated_cost_cents)
    - `retrieval_completed` (wait_hours)
    - `plan_upgraded` (from_plan, to_plan)
  - Set up funnel: Sign up → First vault → First upload → First retrieval
  - Set up cohort: users who upgraded within 7 days

---

### Step 13 — Marketing Site + Onboarding

**Goal:** cold traffic can understand the product and sign up; new users reach "first value" quickly.

- [ ] `src/pages/Landing.tsx` (route `/`):
  - Hero: headline ("Your digital safety deposit box"), sub-headline, CTA button
  - Features section: vault UX, retrieval flow, pricing tiers, encryption (coming soon)
  - Trust signals: "Data stored in AWS", uptime pledge, no hidden egress fees
  - Pricing table (same as `/pricing`) with monthly prices
- [ ] `src/pages/Pricing.tsx` (route `/pricing`):
  - Plan comparison table (Starter / Personal / Family / Pro)
  - Retrieval fee table (Bulk / Standard / Expedited)
  - FAQ (what is cold storage, how long does retrieval take, what happens if I cancel)
- [ ] Post-signup onboarding wizard (3 steps shown on first visit only):
  - Step 1: "Name your first vault" (pre-filled as "My Vault")
  - Step 2: "Choose a default storage tier" (with cost tooltip)
  - Step 3: "Upload your first file" (inline UploadZone)
  - Dismiss / skip option
- [ ] Empty states (no vaults, no files in vault, no retrievals)
- [ ] `src/pages/Terms.tsx` and `src/pages/Privacy.tsx` — legal pages (use a template, customise data retention + storage jurisdiction sections)

---

### Step 14 — Beta Launch Prep

**Goal:** stable enough for 20–50 real users with real data.

- [ ] **Smoke tests (Playwright):**
  - Sign up → create vault → upload file (Hot tier) → preview in MediaViewer
  - Upload file (Frozen tier) → request retrieval → (mock Glacier) → download link appears
  - Upgrade plan via Stripe Checkout → verify plan badge updates
  - Sign in → audit log shows sign-in event
- [ ] **Staging environment:**
  - Separate `.env.staging` with Stripe test keys, Neon staging branch, separate S3 bucket
  - Deploy to Vercel preview URL
- [ ] **Rate limiting:** 100 req/min per user in Hono middleware (use `@hono/rate-limiter`)
- [ ] **CORS:** lock API to Vercel production + preview domains only
- [ ] **Security headers:** CSP, HSTS, X-Frame-Options via Vercel `headers` config
- [ ] **Glacier early-deletion notice in ToS:** objects deleted before 90 days incur penalty charged to user
- [ ] **Invite 20–50 beta users:** collect email list, send invites, set up a Slack/Discord channel for feedback
- [ ] **PostHog survey trigger:** show feedback form after first retrieval completion

---

## Definition of Done

- [ ] A user can sign up, create a vault, upload a file to Frozen tier, request retrieval, and download the restored file
- [ ] Stripe charges the user correctly for their plan and records retrieval usage
- [ ] All key actions appear in the audit log
- [ ] Sentry is capturing errors in production
- [ ] At least 1 paying customer

---

## Estimated Cost at Launch

| Item | Monthly |
|------|---------|
| Vercel Pro | $20 |
| Neon Postgres (free tier) | $0 |
| Clerk (under 10k MAU) | $0 |
| Stripe (2.9% + $0.30 per charge) | $0 upfront |
| Resend (free tier: 3k emails/mo) | $0 |
| Sentry (free tier) | $0 |
| AWS (Lambda + S3 + Step Functions — dev usage) | ~$20–50 |
| **Total floor** | **~$40–70/mo** |
