# MVP 4 — Scale

**Goal:** Enterprise-readiness, compliance certifications, multi-region storage, reseller infrastructure, and multi-cloud backend arbitrage. This phase is driven by revenue and B2B expansion, not consumer feature gaps.
**Prerequisite:** MVP 3 complete, product-market fit confirmed (~500+ paying users, stable MRR growth).
**Target timeline:** Ongoing — 6–12 months post-MVP 3.

---

## Scope

| In scope | Out of scope (unless funded) |
|----------|------------------------------|
| Desktop sync agent (macOS + Windows) | Blockchain notarisation |
| SOC 2 Type II audit | Full enterprise SIEM integration |
| HIPAA BAA + legal hold | Satellite / offline storage |
| Multi-region storage (EU, APAC) | On-premises deployment |
| Reseller / white-label program | |
| B2 and R2 backend implementations | |
| Advanced admin + bulk operations | |
| SLA dashboard + uptime page | |

---

## Steps

### Step 1 — Desktop Sync Agent (macOS)

- [ ] Tech stack: Electron + React (reuse web components) or Tauri (smaller binary)
- [ ] Features:
  - System tray icon: sync status (idle / syncing / error), quick vault switch
  - Folder watcher (`chokidar`): detect new/modified files in watched folders, upload to vault
  - Selective sync: choose which vaults sync to which local folders
  - Bandwidth throttling: configurable upload speed cap
  - macOS iCloud Drive integration: access `~/Library/Mobile Documents/` directly (no Apple API needed for local files)
  - Conflict resolution: remote wins / local wins / keep both (with timestamp suffix)
- [ ] Background daemon with auto-start on login
- [ ] Delta sync: track file hash, skip re-upload if unchanged
- [ ] Distribute via macOS notarised `.dmg` (Apple Developer ID required)
- [ ] Auto-updater via Electron's built-in updater or `update-electron-app`

---

### Step 2 — Desktop Sync Agent (Windows)

- [ ] Same Electron/Tauri codebase, Windows-specific:
  - System tray via `electron-tray-window`
  - OneDrive local folder access (`C:\Users\{user}\OneDrive`) without API
  - NTFS junction point handling
  - Windows Defender SmartScreen: code-sign with EV certificate (~$300/yr)
- [ ] Distribute via `.exe` installer (NSIS or WiX) + Microsoft Store (optional)
- [ ] Auto-updater targeting Windows

---

### Step 3 — SOC 2 Type II Audit

**Goal:** table-stakes credential for selling to businesses, procurement teams, and legal professionals.

- [ ] Engage compliance platform: [Vanta](https://vanta.com) (~$15,000/yr) or [Drata](https://drata.com)
- [ ] Gap assessment: review current controls against SOC 2 Trust Service Criteria (Security, Availability)
- [ ] Remediation work (typical items):
  - [ ] Enforce MFA for all admin access to AWS console
  - [ ] Enable AWS CloudTrail + CloudWatch alerting
  - [ ] Implement formal vulnerability scanning (AWS Inspector or Snyk)
  - [ ] Document incident response plan
  - [ ] Employee background checks + security training
  - [ ] Vendor risk assessment for Clerk, Stripe, Neon, Resend
  - [ ] Formal change management process (PR reviews, staging before prod)
  - [ ] Pen test by accredited firm (~$10,000 one-time)
- [ ] Observation period: 6 months of evidence collection
- [ ] Final audit by accredited CPA firm (~$15,000–25,000)
- [ ] Publish SOC 2 report on trust page (NDA gated)

---

### Step 4 — HIPAA BAA + Legal Hold

**Goal:** unlock healthcare, legal, and financial services verticals.

- [ ] Sign Business Associate Agreement with AWS (free, self-service)
- [ ] Review Clerk, Neon, Resend for HIPAA eligibility — replace non-compliant vendors if needed
- [ ] Technical controls:
  - [ ] All data encrypted at rest (already done) and in transit (already done)
  - [ ] Audit logs retained for 6 years (extend `audit_log` retention policy)
  - [ ] Automatic session timeout (15 min inactivity)
  - [ ] Access logging for all PHI-containing vaults
  - [ ] Workforce access controls (least-privilege IAM)
- [ ] Legal hold features:
  - `vaults.legal_hold: boolean` — cannot delete, cannot change tier
  - Legal hold can only be set / lifted by account owner with MFA
  - Export audit log as signed PDF for court/regulatory submission
- [ ] Offer HIPAA BAA to Business plan customers ($99/mo minimum)

---

### Step 5 — Multi-Region Storage

**Goal:** EU and APAC users get data residency in their region; lower latency for uploads.

- [ ] Add `vaults.region: 'us-east-1' | 'eu-west-1' | 'ap-southeast-1'` column
- [ ] Create S3 buckets in each region (same key structure: `tenants/{user_id}/vaults/{vault_id}/...`)
- [ ] Update `StorageBackend` factory: instantiate S3 client with per-vault region
- [ ] Update API: `POST /api/vaults` accepts `region` param; default based on user's IP geolocation
- [ ] GDPR: EU-region vaults stay in `eu-west-1`; no cross-region replication unless user opts in
- [ ] Pricing: multi-region vaults carry a 10–15% premium (higher S3 costs in EU/APAC)
- [ ] Update Stripe products: add EU and APAC regional pricing variants

---

### Step 6 — Alternative Storage Backends

**Goal:** reduce per-GB storage cost by routing frozen-tier to the cheapest available backend.

- [ ] Implement `BackblazeB2Backend` (using `@aws-sdk/client-s3` against B2's S3-compatible endpoint):
  - $6.95/TB storage, free egress within Cloudflare network
  - Use as warm/cool tier alternative to S3 Standard
- [ ] Implement `CloudflareR2Backend`:
  - $15/TB storage, zero egress fees
  - Use as hot-tier alternative for high-egress users
- [ ] Backend routing table (`vault_backend_overrides` or config map):
  - Tier `frozen` → `S3GlacierDeepArchive` (US) or `B2` (international)
  - Tier `hot` → `R2` (for users with high download volume)
- [ ] Cost arbitrage cron: monthly comparison of actual spend per backend, flag if switching would save > 20%

---

### Step 7 — Reseller / White-Label Program

**Goal:** let agencies, law firms, and IT MSPs offer storage vaults under their own brand.

- [ ] `organizations` table: `id, name, subdomain, logo_url, custom_domain, plan_markup_percent, owner_user_id`
- [ ] `organization_members` table: `id, org_id, user_id, role (owner|admin|member)`
- [ ] White-label features:
  - Custom subdomain: `vaults.lawfirm.com` (CNAME → Vercel)
  - Logo + brand colours in UI (CSS variables injected at runtime)
  - Custom email from-address for notifications
  - Hidden branding (no "Powered by [YourSaaS]" unless on lower reseller tier)
- [ ] Reseller billing:
  - Reseller pays wholesale rate (e.g., cost + 20%)
  - Reseller sets their own end-user pricing
  - Reseller dashboard: member list, storage usage per member, monthly invoice
- [ ] Reseller onboarding: self-serve via `/reseller/apply` — review + approve manually initially

---

### Step 8 — Advanced Admin & Bulk Operations

**Goal:** power users managing thousands of files don't hit UX bottlenecks.

- [ ] `PATCH /api/files/bulk-tier` — move up to 10,000 files between tiers in one API call (background job)
- [ ] `DELETE /api/files/bulk` — bulk soft-delete with confirmation dialog showing total size being deleted
- [ ] CSV export: `GET /api/vaults/:id/export.csv` — file list with size, tier, dates, cost
- [ ] Vault duplication: copy all files from one vault to another (useful for archiving project snapshots)
- [ ] Advanced search: filter by tier, size range, date range, content type, tag
- [ ] Keyboard shortcuts in file browser (multi-select with Shift+click, `Del` to delete, `T` to change tier)
- [ ] Bulk import from CSV: upload a CSV of S3 keys to register existing files into a vault (migration tool)

---

### Step 9 — SLA Dashboard + Status Page

**Goal:** build trust with B2B customers who need uptime guarantees.

- [ ] Public status page at `status.yourdomain.com` (use [Instatus](https://instatus.com) or self-hosted)
- [ ] Synthetic monitoring (Checkly or AWS CloudWatch Synthetics):
  - Every 5 min: check API `/health` endpoint
  - Every 15 min: full smoke test (sign in → list vaults → upload small file → delete)
- [ ] Incident management: auto-create incident on monitor failure, post to status page
- [ ] SLA targets (for paid plans):
  - API availability: 99.9% monthly
  - Retrieval initiation: within 60 seconds of request
  - Notification delivery: within 5 min of file becoming ready
- [ ] SLA credits: automatic Stripe credit if SLA breached (document in ToS)
- [ ] Uptime badge on marketing site and pricing page

---

### Step 10 — Performance & Cost Optimisation

**Goal:** keep margins healthy at scale (1,000+ users, 100TB+ stored).

- [ ] Lambda provisioned concurrency for hot API paths (vault list, file list)
- [ ] Postgres read replicas (Neon) for analytics queries — don't hit primary
- [ ] S3 Intelligent-Tiering evaluation: for users who don't explicitly pick a tier, let AWS auto-tier
- [ ] Aggregated health check batching: process 10,000 file checks per Lambda invocation (batch `HeadObject` via S3 Batch Operations)
- [ ] CDN caching for presigned URL metadata (cache for 1 min to reduce Lambda invocations)
- [ ] Stripe metering optimisation: batch meter events hourly instead of per-event to reduce API calls
- [ ] DynamoDB for import job checkpoints (cheaper and faster than Postgres for high-write short-lived state)

---

## Definition of Done for Phase 4

- [ ] Desktop agent ships on macOS with >100 active installs
- [ ] SOC 2 Type II report issued by accredited auditor
- [ ] At least 1 paying HIPAA customer on BAA agreement
- [ ] EU-region vaults available with documented data residency guarantee
- [ ] First reseller (agency or law firm) live on white-label subdomain
- [ ] P99 API latency < 200ms for vault list + file list endpoints

---

## Estimated Additional Monthly Cost (at 1,000 users / 500TB stored)

| Item | Monthly |
|------|---------|
| AWS S3 Deep Archive (400TB) | ~$400 |
| AWS S3 Standard (100TB) | ~$2,400 |
| Lambda + API Gateway (1M req/day) | ~$150 |
| Fargate import workers (peak) | ~$200 |
| Neon Postgres (Scale tier) | ~$70 |
| Clerk (Pro, ~2k MAU) | ~$65 |
| Vanta (SOC 2 compliance) | ~$1,250 |
| Sentry, PostHog, Resend (Pro tiers) | ~$200 |
| Cloudflare (Pro + Workers) | ~$20 |
| **Total infra** | **~$4,755/mo** |
| **Revenue at $8 avg ARPU × 1,000** | **$8,000/mo** |
| **Gross margin** | **~40%** |

> Margin expands as you convert free users to paid and as Frozen-tier storage dominates (costs $0.001/GB vs $0.024/GB Standard).
