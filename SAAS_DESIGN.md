# Cold Storage SaaS — Design Document

Transform the current S3 Drive file browser into a consumer-facing cold storage SaaS — a "bank vault for data" where users archive rarely-accessed files, import from existing cloud providers, and pay primarily on retrieval.

---

## Table of Contents

1. [Product Vision](#product-vision)
2. [Features](#features)
3. [Architecture](#architecture)
4. [Changes Needed (from current codebase)](#changes-needed)
5. [Challenges](#challenges)
6. [Pricing Model](#pricing-model)
7. [Competitor Landscape](#competitor-landscape)
8. [Roadmap](#roadmap)

---

## Product Vision

**Tagline:** *"Your digital safety deposit box."*

A zero-knowledge cold storage service where users vault data they rarely need but can't lose — old projects, family photos, tax records, legal documents, digital estate. Cheaper than Dropbox/iCloud because retrieval is deliberate, not instant.

**Differentiators vs. existing market:**
- Consumer-friendly UX over raw cold storage (Glacier, B2)
- Multi-cloud import in one place (Google Drive, OneDrive, Dropbox, iCloud)
- Vault metaphor with retrieval requests, time-locks, audit logs
- Zero-knowledge encryption with optional trusted-contact recovery

---

## Features

### Tier 1 — MVP (must-have for launch)

#### Vaults & Storage Tiers
- Multiple vaults per user (e.g., "Family Photos", "Tax Records", "Old Projects")
- Per-file or per-vault tier selection:
  - **Frozen** — 12–48hr retrieval, cheapest (~$4/TB/mo)
  - **Cold** — 1–4hr retrieval (~$10/TB/mo)
  - **Warm** — minutes (~$20/TB/mo)
  - **Hot** — instant (~$40/TB/mo)
- Move files between tiers (with documented cost implications)
- Per-vault storage usage and projected monthly cost

#### Retrieval Request Flow
- "Request access" button instead of direct download for frozen/cold tiers
- Urgency selector (bulk / standard / expedited) with price preview
- Background polling of S3 Glacier retrieval status
- Email/push notification when files are ready
- Time-limited download links (24–48hr after retrieval)
- Audit log of every retrieval (who, when, what, urgency)

#### Authentication & Accounts
- Email + password with MFA (TOTP)
- Social login (Google, Apple)
- Account recovery via email + secondary device
- Session management with device list

#### Upload & File Management
- Drag-and-drop upload with progress
- Folder structure within vaults
- File preview (images, video thumbnails) where authorized
- Search across vaults (encrypted-friendly: filename + tag indexing)
- Delete with optional grace period (soft delete for 30 days)

#### Billing
- Stripe-managed subscriptions (Starter / Personal / Family / Pro)
- Metered overages for storage and retrieval
- Self-serve plan changes via Stripe Customer Portal
- Invoice history, payment method management
- Email receipts and dunning for failed payments

### Tier 2 — Growth Features

#### Import Connectors
- **Google Drive** — OAuth, full or selective folder import
- **OneDrive / SharePoint** — Microsoft Graph API
- **Dropbox** — OAuth + chunked download
- **iCloud** — manual zip upload (Apple "Download a copy of your data") — see Challenges
- **Google Photos** — separate API, library import
- **S3 / B2 / Wasabi bucket migration** — for power users
- **Email-to-vault** — forward attachments to a unique address
- Resumable transfers (multi-GB files survive disconnects)

#### Zero-Knowledge Encryption
- Client-side AES-256-GCM, key derived from password via Argon2id
- Server only stores ciphertext + encrypted file index
- Key never leaves the browser
- Optional **Shamir's Secret Sharing** for recovery via 2-of-3 trusted contacts

#### Vault Sharing
- Share entire vault with another account (read-only or read-write)
- Family plan with up to 5 sub-accounts under one billing
- Per-user storage quotas within a family plan
- Shared vault retrieval permissions

#### Time-Lock & Compliance
- Set minimum hold period on a vault ("can't be retrieved until 2030")
- WORM (write once, read many) mode for legal hold
- Immutable retention policies
- Optional notarization (hash anchored to a public chain) for proof-of-existence

### Tier 3 — Power & Trust Features

#### Trusted Contacts / Digital Estate
- Designate 1–3 trusted contacts who can request retrieval after a dead-man's-switch period
- Configurable inactivity threshold (90 days, 1 year, etc.)
- Trusted contact gets MFA-gated access only
- Full audit trail of estate access

#### Health Checks
- Periodic verification that files are still readable (Glacier integrity)
- Email report of vault health monthly
- "Restore test" — small free retrieval to verify recovery works

#### Desktop Sync Agent
- macOS / Windows app for folder sync to vault
- Native iCloud Drive integration on macOS
- Background uploads with bandwidth throttling
- System tray indicator with sync status

#### Mobile Apps
- iOS and Android for retrieval requests on the go
- Push notifications for retrieval completion
- Camera roll backup to a vault
- Biometric unlock for vault access

#### Advanced Admin
- Bulk operations (move 1000s of files between tiers)
- Cost forecasting dashboard ("at this growth rate you'll spend $X by year-end")
- Vault expiry reminders
- Tag-based organization
- Smart tier suggestions ("these files haven't been accessed in 2 years — move to Frozen?")

---

## Architecture

### High-Level Diagram

```
┌────────────────────────────────────────────────────────────────────┐
│                         Browser SPA                                │
│  React 19 + Vite + WebCrypto (zero-knowledge encryption)           │
└──────┬──────────────────────────────────────────────────┬──────────┘
       │ REST/JSON                                        │ Direct S3
       │ (Clerk JWT)                                      │ (presigned URL)
       ▼                                                  ▼
┌────────────────────────┐                    ┌──────────────────────┐
│  API Layer             │                    │  Storage Tiers       │
│  Lambda + API Gateway  │                    │  ┌────────────────┐  │
│  (Hono framework)      │                    │  │ S3 Standard    │  │
└──────┬─────────────────┘                    │  │ S3 IA          │  │
       │                                      │  │ S3 Glacier IR  │  │
   ┌───┼──────────┬──────────┬─────────┐      │  │ S3 Glacier FR  │  │
   ▼   ▼          ▼          ▼         ▼      │  │ S3 Glacier Deep│  │
┌──────────┐ ┌────────┐ ┌──────────┐ ┌──────┐ │  └────────────────┘  │
│ Postgres │ │ Redis  │ │  Step    │ │ SQS  │ └──────────────────────┘
│ (Neon)   │ │ cache  │ │Functions │ │      │
│          │ │        │ │          │ │      │
│ users    │ │session │ │retrieval │ │import│
│ vaults   │ │presign │ │  state   │ │ jobs │
│ files    │ │ cache  │ │ machine  │ │      │
│ requests │ │        │ │          │ │      │
│ billing  │ │        │ │          │ │      │
│ audit    │ │        │ │          │ │      │
└──────────┘ └────────┘ └────────┬─┘ └──┬───┘
                                 │      │
                          ┌──────▼───┐  │
                          │EventBridge│  │
                          │ (cron)    │  │
                          └───────────┘  │
                                         ▼
                                ┌──────────────┐
                                │   Fargate    │
                                │   Workers    │
                                │  (imports,   │
                                │   migration) │
                                └──────┬───────┘
                                       │ OAuth
                                       ▼
                            ┌─────────────────────┐
                            │  External Providers │
                            │  Google Drive       │
                            │  OneDrive           │
                            │  Dropbox            │
                            │  Google Photos      │
                            └─────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                       External Services                          │
├──────────────────────────────────────────────────────────────────┤
│  Clerk (auth)  │  Stripe (billing)  │  Resend (email)  │  Sentry │
└──────────────────────────────────────────────────────────────────┘
```

### Component Breakdown

#### Frontend
- **Stack:** React 19 + Vite + TanStack Query + Zustand + shadcn/ui (existing)
- **Encryption:** WebCrypto API (AES-256-GCM, Argon2id key derivation via `argon2-browser`)
- **Hosting:** Vercel (already in use)
- **New routes:**
  - `/` — landing page (marketing)
  - `/app/vaults` — vault list with cost breakdown
  - `/app/vault/:id` — file browser per vault (current `FileBrowser` reused)
  - `/app/vault/:id/request` — retrieval request flow
  - `/app/imports` — connector OAuth + active jobs
  - `/app/billing` — Stripe portal redirect
  - `/app/settings` — account, MFA, trusted contacts, devices

#### API Layer
- **Hono** on AWS Lambda behind API Gateway (or Cloudflare Workers as alternative)
- JWT validation via Clerk SDK
- Endpoints (REST):
  - `POST /vaults` `GET /vaults` `PATCH /vaults/:id` `DELETE /vaults/:id`
  - `POST /vaults/:id/upload-url` (returns presigned multipart upload)
  - `GET /vaults/:id/files` (paginated, with tier metadata)
  - `POST /retrievals` `GET /retrievals/:id` `GET /retrievals` (list)
  - `POST /imports` `GET /imports/:id`
  - `POST /webhooks/stripe`
  - `GET /usage` (current period metering)

#### Storage Layer (Abstraction)
Wrap storage backends behind a unified interface so tiers and providers are swappable:

```ts
interface StorageBackend {
  put(key: string, stream: ReadableStream, opts: PutOpts): Promise<PutResult>
  initiateRetrieval(key: string, urgency: Urgency): Promise<RetrievalJob>
  pollRetrieval(jobId: string): Promise<RetrievalStatus>
  getDownloadUrl(key: string, ttl: number): Promise<string>
  delete(key: string): Promise<void>
  headObject(key: string): Promise<ObjectMetadata>
}
```

Implementations (start with S3, add others later):
- `S3StandardBackend` — hot tier
- `S3GlacierIRBackend` — instant retrieval, cool tier
- `S3GlacierFlexibleBackend` — cold tier
- `S3GlacierDeepArchiveBackend` — frozen tier
- `BackblazeB2Backend` — alternative warm tier
- `R2Backend` — alternative for high-egress users

#### Database (Postgres on Neon)

Core tables:

```sql
users            -- mirrored from Clerk via webhook
  id, clerk_id, email, plan, created_at, trusted_contact_emails

vaults
  id, user_id, name, default_tier, time_lock_until,
  worm_enabled, encryption_key_hint, created_at

files
  id, vault_id, path, size_bytes, content_type,
  storage_tier, s3_key, encrypted, sha256,
  created_at, last_accessed_at, deleted_at

retrieval_requests
  id, user_id, vault_id, file_ids[], urgency,
  status (requested|initiated|polling|ready|completed|expired),
  estimated_cost_cents, actual_cost_cents,
  ready_at, expires_at, download_url, created_at

import_jobs
  id, user_id, vault_id, provider (google_drive|onedrive|dropbox|...),
  status, oauth_token_ref, total_bytes, transferred_bytes,
  error, created_at, completed_at

audit_log
  id, user_id, action, resource_type, resource_id,
  ip, user_agent, metadata, created_at

usage_records
  id, user_id, period_start, period_end,
  storage_gb_days_by_tier (jsonb), retrieved_gb_by_urgency (jsonb),
  reported_to_stripe_at

trusted_contacts
  id, user_id, contact_email, share_index (Shamir),
  inactivity_threshold_days, last_heartbeat_at
```

#### Retrieval State Machine (Step Functions)

```
[Requested]
    │ (validate quota, charge hold)
    ▼
[Validated]
    │ (initiate S3 restore)
    ▼
[InitiatedAtS3]
    │ (EventBridge cron: poll every 15 min)
    ▼
[Polling] ──┐
    │       │ (not ready)
    │       └──── back to Polling
    │ (S3 reports ready)
    ▼
[Ready]
    │ (generate presigned URL, send email)
    ▼
[NotificationSent]
    │ (user downloads OR 48hr passes)
    ▼
[Completed] / [Expired]
    │ (record actual_cost, update usage)
    ▼
[Done]
```

#### Import Workers (Fargate)
- Triggered by SQS message from API
- Long-running container (no Lambda 15-min limit)
- Streams from external API directly to S3 multipart upload
- Checkpoints progress to Postgres every N MB for resumability
- Refreshes OAuth tokens as needed
- Reports completion via SNS → API → user notification

#### Background Jobs (EventBridge cron)
- **Daily:** roll up usage → send to Stripe metered billing
- **Every 15 min:** poll Glacier retrieval jobs
- **Hourly:** check expiring download links, send reminder emails
- **Weekly:** trusted-contact heartbeat check, vault health verification
- **Monthly:** generate vault health reports

#### External Services
| Service | Purpose | Why |
|---------|---------|-----|
| **Clerk** | Auth + user mgmt | Drop-in MFA, social login, billing-aware sessions |
| **Stripe** | Subscriptions + metering | Industry standard, Customer Portal eliminates billing UI |
| **Resend** | Transactional email | Clean API, good deliverability |
| **Sentry** | Error monitoring | Catch frontend + Lambda errors |
| **PostHog** | Product analytics | Funnel tracking for retrieval flow |
| **Cloudflare** | DNS + DDoS | In front of API and assets |

---

## Changes Needed

From the current codebase (`amplify/` + `src/`) to the SaaS:

### Removed / Deprecated
- **AWS Amplify Gen 2 backend** (`amplify/`) — replaced by direct AWS SDK + Hono API
- **Cognito + Identity Pool** — replaced by Clerk
- **`aws-amplify` SDK in frontend** — replaced by `@clerk/clerk-react` + `fetch` to our API
- **`useStorage.ts`** — replaced by `useApi.ts` with vault-aware endpoints
- **Hardcoded path prefixes** (`public/`, `admin/`, `private/{id}`) — replaced by per-vault keys

### Modified
- **`src/pages/FileBrowser.tsx`** — becomes per-vault view, gains tier badges and retrieval CTA
- **`src/components/files/FileCard.tsx`** — show storage tier, last-accessed, retrieval status
- **`src/components/files/UploadZone.tsx`** — tier selection at upload time, shows projected cost
- **`src/components/files/MediaViewer.tsx`** — only loads for hot/warm tiers; cold tiers show "Request access"
- **`src/store/useFileBrowserStore.ts`** — add current vault, retrieval queue, tier filter
- **`src/components/layout/AppSidebar.tsx`** — vault list (not folder tree from S3 listings)

### New Code
- **`src/pages/Vaults.tsx`** — vault list with cost summary
- **`src/pages/VaultRequest.tsx`** — retrieval request form with urgency + price preview
- **`src/pages/Imports.tsx`** — connector OAuth + job status
- **`src/pages/Billing.tsx`** — Stripe portal redirect + usage chart
- **`src/pages/Settings.tsx`** — MFA, devices, trusted contacts
- **`src/lib/encryption.ts`** — WebCrypto wrapper, key derivation, Shamir
- **`src/hooks/useApi.ts`** — typed API client (TanStack Query bindings)
- **`src/hooks/useRetrieval.ts`** — retrieval state polling
- **`api/`** — new directory for Hono Lambda handlers
- **`api/routes/vaults.ts`, `retrievals.ts`, `imports.ts`, `webhooks.ts`** — endpoint handlers
- **`api/storage/`** — `StorageBackend` interface + S3 implementations
- **`api/db/schema.ts`** — Drizzle ORM schema + migrations
- **`infra/`** — IaC for Lambda, Step Functions, Fargate, EventBridge (CDK or Terraform)
- **`workers/import-worker/`** — Fargate container for OAuth-based imports

### Configuration
- Drop `amplify_outputs.json`, add `.env`:
  ```
  CLERK_PUBLISHABLE_KEY=
  CLERK_SECRET_KEY=
  STRIPE_SECRET_KEY=
  STRIPE_WEBHOOK_SECRET=
  DATABASE_URL=
  AWS_REGION=
  S3_BUCKET=
  RESEND_API_KEY=
  ```
- New IAM roles: API Lambda, Worker Fargate, Step Functions execution
- S3 lifecycle policies per tier (auto-transition, expiration)

### Bucket Restructuring
Current: single bucket with `public/` `admin/` `private/{id}/` prefixes.
New: single bucket with `tenants/{user_id}/vaults/{vault_id}/{file_id}` keys, plus `thumbnails/...` mirror. Storage class set per object based on tier.

---

## Challenges

### Technical

1. **Glacier retrieval orchestration**
   Polling, partial failures, link expiry, batched retrievals across many small objects. Step Functions help but the state graph gets complex.

2. **Zero-knowledge key recovery**
   If users forget their password, their data is gone. Shamir's Secret Sharing across trusted contacts is the answer but the UX is genuinely hard — what if a contact loses their share? Account merging? Contact death?

3. **Import resumability for large files**
   Multi-GB Google Drive transfers fail constantly. Need chunked, checkpointed transfers with OAuth refresh mid-stream. iCloud has no API at all — must rely on user-uploaded zip from Apple's data export.

4. **Cost accounting precision**
   Metering storage-GB-days per user across 4 tiers, plus retrieval bytes, plus operations costs, then reporting accurately to Stripe daily. Off-by-one billing bugs erode trust fast.

5. **S3 Glacier minimum object size + retrieval costs**
   Small objects in Glacier have a 32KB minimum billing size. Many small files = surprise costs. May need to bundle small files into archive objects.

6. **Encryption + search tension**
   Zero-knowledge means server can't index file contents. Filename and tag search must happen on client-side or via encrypted search index (CryptDB-style) — significantly limits search UX.

7. **Multipart upload + tier transitions**
   Files uploaded directly to Glacier tiers via S3's `x-amz-storage-class` header, but multipart uploads have edge cases with storage class inheritance. Needs careful testing.

8. **Mobile WebCrypto performance**
   Argon2id key derivation is intentionally slow. On low-end mobile this is a 5–10s wait. Need progress UI and ideally hardware-backed key storage.

### Product / Market

9. **iCloud has no third-party API**
   Apple deliberately doesn't expose iCloud Drive to third parties. Either build a macOS-only desktop agent (huge cost) or punt to "upload your Apple data export zip" (poor UX). This will be the single most-asked-for feature you can't deliver well.

10. **User education on retrieval delays**
    Consumers expect Dropbox-instant access. Explaining "this file takes 12 hours to retrieve, here's why it's cheaper" without sounding like a downside takes serious copywriting.

11. **Backblaze Personal Backup is $99/year unlimited**
    Hard to compete on raw price for casual consumers. Differentiation must be vault UX, encryption, and multi-source import — not just price.

12. **Trust is everything in storage**
    A single data loss incident — even if user error — kills the brand. Need extreme reliability + recovery flows + clear communication. Regular third-party audits help (SOC 2 eventually).

### Operational

13. **Support load**
    Storage support tickets are high-touch ("where is my file") and emotional ("I lost my wedding photos"). Budget $8–15 per ticket and design self-service recovery into every flow.

14. **Glacier early-deletion fees**
    Objects deleted before 90/180 days incur penalty charges. Must be passed to user or absorbed — bake into ToS clearly.

15. **OAuth token rotation at scale**
    Google/Microsoft tokens expire and refresh. Token rotation failures pause imports silently. Need monitoring and proactive re-auth flows.

16. **Compliance & jurisdiction**
    Once you store EU users' data: GDPR. Healthcare or legal users: HIPAA / ISO 27001 ask. Each adds engineering and process burden.

17. **Egress arbitrage by abusive users**
    A user could store cheaply, then retrieve constantly to use you as CDN. Needs rate limits and tier-mismatch detection (auto-suggest tier upgrade).

18. **Cold start on Lambda for retrieval polling**
    Acceptable for user-facing API, annoying for cron. Provisioned concurrency for hot paths only.

---

## Pricing Model

### Storage Tiers (per GB/month)
| Tier | Cost to us | Sell at | Margin |
|------|-----------|---------|--------|
| Frozen | $0.0015 | $0.004 | ~63% |
| Cold | $0.004 | $0.010 | ~60% |
| Warm | $0.008 | $0.020 | ~60% |
| Hot | $0.016 | $0.040 | ~60% |

### Retrieval Fees (per GB)
| Urgency | Cost to us | Charge |
|---------|-----------|--------|
| Bulk (48hr) | $0.003 | $0.005 |
| Standard (12hr) | $0.010 | $0.020 |
| Expedited (4hr) | $0.030 | $0.050 |

### Plans
| Plan | Storage Included | Price/mo | Notes |
|------|-----------------|----------|-------|
| Starter | 500GB Frozen | $3 | 1 vault, no imports |
| Personal | 2TB Frozen | $8 | 5 vaults, all connectors |
| Family | 5TB Frozen + 1TB Cold | $15 | Up to 5 sub-accounts, sharing |
| Pro | 10TB Frozen + 1TB Warm | $35 | Trusted contacts, time-locks |

Overage billing through Stripe metered usage. Free tier: 10GB Frozen, 1 retrieval/month.

---

## Competitor Landscape

### Direct cold storage (infrastructure)
- AWS S3 Glacier — $0.99/TB, no consumer UX
- Google Cloud Archive — $1.20/TB
- Azure Archive — $0.99/TB
- Backblaze B2 — $6.95/TB, free egress to 3x storage
- Wasabi — $6.99/TB, no egress
- Cloudflare R2 — $10–15/TB, free egress
- iDrive e2 — $4/TB, no egress

### Consumer backup
- Backblaze Personal Backup — $99/yr unlimited (biggest threat)
- iDrive Personal — $80/yr for 5TB
- Carbonite, Acronis Cyber Protect, pCloud Lifetime

### Encrypted / zero-knowledge
- Tresorit — business-focused, expensive
- Internxt, Filen — open-source, cheap
- ProtonDrive — Proton brand trust

### Adjacent
- Evervault, Digi.me — digital data vaults
- Glacier by Attic — small consumer Glacier wrapper

**Where we fit:** none combine consumer vault UX + multi-cloud import + zero-knowledge encryption + retrieval-request flow. Lean into the vault metaphor and digital estate planning angle.

---

## Roadmap

### Phase 0 — Foundation (4–6 weeks)
- Migrate auth: Cognito → Clerk
- Stand up Postgres + Drizzle schema
- Hono API on Lambda with vault CRUD
- Storage backend abstraction with S3 Standard + Glacier Deep Archive
- Frontend: vault list, per-vault file browser, basic upload

### Phase 1 — Core Product (6–8 weeks)
- Retrieval request flow + Step Functions state machine
- Stripe subscriptions + metered usage
- Email notifications (Resend)
- Audit logging
- Marketing site + onboarding flow
- Public beta launch

### Phase 2 — Imports & Encryption (8–10 weeks)
- Google Drive connector (Fargate worker)
- OneDrive connector
- Dropbox connector
- Client-side encryption with WebCrypto
- iCloud zip-import flow
- Vault sharing within family plans

### Phase 3 — Trust & Power (10–12 weeks)
- Trusted contacts + Shamir secret sharing
- Time-lock / WORM mode
- Health checks + monthly reports
- Cost forecasting dashboard
- Smart tier suggestions
- Mobile apps (iOS first)

### Phase 4 — Scale (ongoing)
- Desktop sync agent (macOS/Windows)
- SOC 2 audit
- HIPAA/legal hold features for B2B expansion
- Multi-region storage for compliance
- Reseller / white-label program
