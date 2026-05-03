# MVP 3 — Trust & Power

**Goal:** Deep trust features (digital estate planning, time-locks, health checks) and power-user tools that justify Pro subscriptions and attract a B2B-adjacent audience (freelancers, lawyers, small teams).
**Prerequisite:** MVP 2 shipped with encryption stable.
**Target timeline:** 10–12 weeks after MVP 2.

---

## Scope

| In scope | Out of scope |
|----------|-------------|
| Shamir's Secret Sharing for key recovery | SOC 2 audit (Phase 4) |
| Trusted contact recovery flow | HIPAA BAA |
| Time-lock / hold period enforcement | Multi-region storage |
| WORM (write once, read many) mode | Enterprise SSO |
| Vault health checks + integrity reports | White-label / reseller |
| Monthly health email digest | |
| Cost forecasting dashboard | |
| Smart tier suggestion engine | |
| iOS mobile app | |

---

## Steps

### Step 1 — Shamir's Secret Sharing

**Goal:** zero-knowledge encryption without "forget password = lose everything."

- [ ] Install `secrets.js-grempe` (Shamir's Secret Sharing in JS)
- [ ] Extend `src/lib/encryption.ts`:
  ```ts
  splitKey(key: CryptoKey, totalShares: number, threshold: number): Promise<string[]>
    // Encodes raw key bytes → Shamir shares (hex strings)

  reconstructKey(shares: string[]): Promise<CryptoKey>
    // Recombines threshold-of-N shares → CryptoKey
  ```
- [ ] `trusted_contacts` table:
  ```
  id, vault_id (or user_id for account-level), contact_email,
  encrypted_share (AES-encrypted with contact's public key or a password),
  share_index, threshold, total_shares,
  inactivity_threshold_days, last_heartbeat_at,
  status (pending_accept | active | used), created_at
  ```
- [ ] Setup flow (2-of-3 split example):
  1. User enters 3 trusted contact emails in vault settings
  2. Key is split into 3 Shamir shares client-side
  3. Each share is encrypted with a one-time password, emailed to each contact
  4. Contact clicks link → sets their own recovery passphrase → share stored server-side (encrypted)
  5. User sees "2 of 3 contacts have accepted"

---

### Step 2 — Trusted Contact Recovery Flow

**Goal:** if a user loses their encryption password, 2-of-3 trusted contacts can authorize recovery.

- [ ] Recovery request flow:
  1. User clicks "I forgot my encryption password" on locked vault
  2. Server emails all active trusted contacts: "John Doe is requesting access to their vault"
  3. Each contact logs into their own account, sees recovery request, confirms with their passphrase
  4. After `threshold` contacts confirm: server assembles shares, returns to requester's browser
  5. Browser reconstructs key, prompts user to set new encryption password, re-encrypts all metadata
- [ ] `recovery_requests` table: `id, user_id, vault_id, shares_collected, threshold, status, expires_at`
- [ ] Trusted contact notification email: context-rich ("your contact stored 847 files, last active 3 days ago")
- [ ] Dead-man's switch:
  - If user has not logged in for `inactivity_threshold_days` (configurable: 90/180/365 days)
  - System emails user: "Are you still there? Click to confirm."
  - If no response in 7 days: notify trusted contacts they can now initiate estate access
  - Trusted contacts go through the same recovery flow to gain read access
- [ ] `src/pages/TrustedContacts.tsx` — manage contacts, see acceptance status, configure inactivity threshold

---

### Step 3 — Time-Lock / Hold Period

**Goal:** vaults or individual files cannot be retrieved before a set date, regardless of who requests it.

- [ ] Add `vaults.hold_until: timestamp | null` and `files.hold_until: timestamp | null`
- [ ] Enforce in `POST /api/retrievals`: if `hold_until > NOW()` → reject with 403 + days remaining
- [ ] UI: vault settings → "Set hold period" date picker with confirmation warning
- [ ] Time-lock badge on vault card and file cards showing "Locked until Jan 1, 2027"
- [ ] Editing/removing a time-lock requires MFA re-verification + 48hr cooling-off period (prevents panic deletion)
- [ ] Audit log entry for every time-lock set, modified, or removed

---

### Step 4 — WORM Mode (Write Once, Read Many)

**Goal:** files can never be modified or deleted once uploaded — useful for legal/compliance users.

- [ ] `vaults.worm_enabled: boolean` — set at vault creation only (cannot be disabled later)
- [ ] `files.worm: boolean` — inherited from vault at upload time
- [ ] WORM enforcement in API: `DELETE /api/files/:id` → 403 if `worm = true`
- [ ] WORM enforcement in S3: enable **S3 Object Lock** (Compliance mode, 30-year retention) on WORM objects
- [ ] UI: "WORM Vault" badge, warning dialog on vault creation explaining permanence
- [ ] Billing note: WORM objects cannot be deleted to reduce storage cost — surfaced clearly

---

### Step 5 — Vault Health Checks

**Goal:** users have confidence their data is intact without needing to retrieve it.

- [ ] Health check definition: for each file, verify `s3.headObject` returns a matching `ETag` / `ContentLength` against the `files` DB record
- [ ] `vault_health_reports` table: `id, vault_id, checked_at, total_files, ok_files, error_files, errors (jsonb)`
- [ ] EventBridge weekly cron → Lambda: iterate all vaults, run health checks (paginated — 1000 files/batch), store results
- [ ] `GET /api/vaults/:id/health` — return latest health report
- [ ] `src/pages/VaultHealth.tsx` — show last check date, ok/error counts, list of any flagged files
- [ ] Monthly health email (Resend): "All 2,847 files in your 3 vaults checked out — last verified May 3"
- [ ] Alert email if any integrity error detected: "1 file in Tax Records could not be verified"

---

### Step 6 — Cost Forecasting Dashboard

**Goal:** users can predict future spend and proactively manage it.

- [ ] `GET /api/analytics/cost-forecast` — Lambda:
  - Fetch 90 days of `usage_records` per user
  - Calculate storage growth rate (linear regression, simple)
  - Project 6-month and 12-month spend by tier
  - Identify top 5 largest vaults by cost
- [ ] `src/pages/CostDashboard.tsx`:
  - Monthly spend chart (bar — last 6 months actual, next 3 months projected)
  - Per-vault cost breakdown table (storage cost, retrieval cost, total)
  - "Optimise storage" section (surfacing smart tier suggestions — Step 7)
  - Break-even calculator: "Moving 500GB from Cold to Frozen saves $X/month but costs $Y to retrieve once"

---

### Step 7 — Smart Tier Suggestions

**Goal:** passive cost reduction by nudging users toward cheaper tiers for files they don't access.

- [ ] Weekly EventBridge cron → Lambda:
  - Scan `files` where `last_accessed_at < NOW() - interval '90 days'` and `storage_tier != 'frozen'`
  - Generate `TierSuggestion` records grouped by vault
- [ ] `tier_suggestions` table: `id, user_id, vault_id, file_ids[], current_tier, suggested_tier, monthly_savings_cents, created_at, dismissed_at, accepted_at`
- [ ] `src/components/TierSuggestionBanner.tsx`:
  - Shown in vault view when suggestions exist
  - "Move 234 files to Frozen and save $4.20/month — files not accessed in 6+ months"
  - "Review files" → checkbox list → "Apply" → batch `PATCH /api/files/tier` endpoint
- [ ] `PATCH /api/files/tier` — bulk tier change: update `files.storage_tier`, call S3 `CopyObject` with new storage class, delete original

---

### Step 8 — iOS Mobile App

**Goal:** users can request retrievals, check vault status, and get push notifications on their phone.

- [ ] Tech stack: React Native (Expo) — reuse business logic and hooks from web
- [ ] Screens:
  - `VaultList` — list of vaults with storage + cost summary
  - `VaultDetail` — file list (read-only preview for hot tier, "Request Access" for cold)
  - `Retrievals` — active / ready retrieval requests with download button
  - `Notifications` — push notification history
  - `Settings` — account, MFA, trusted contacts
- [ ] Push notifications via APNs (Expo Notifications):
  - Retrieval ready → "Your files from Tax Records are ready to download"
  - Retrieval expiring → "Download link expires in 2 hours"
  - Payment failed → "Action required: update payment method"
- [ ] Biometric unlock: Face ID / Touch ID gates vault access in the app
- [ ] Camera Roll backup: background upload of new photos to a designated vault (opt-in)
- [ ] Store on App Store (Apple Developer Program: $99/yr)

---

### Step 9 — Android Mobile App

- [ ] Same Expo codebase, Android-specific adjustments:
  - FCM push notifications instead of APNs
  - Fingerprint / face unlock via `expo-local-authentication`
  - Google Photos backup integration (deeper than iOS due to open APIs)
- [ ] Store on Google Play ($25 one-time registration)
- [ ] Background sync via `expo-background-fetch`

---

### Step 10 — Pro Plan Gating

Ensure all MVP 3 features are gated correctly:

| Feature | Plan required |
|---------|--------------|
| Trusted contacts + Shamir recovery | Pro |
| Time-lock on vaults | Pro |
| WORM mode | Pro |
| Health checks + reports | Personal and above |
| Cost forecasting | Personal and above |
| Smart tier suggestions | All plans |
| Mobile app | All plans |
| Audit log | Pro |

- [ ] Update `api/middleware/quota.ts` with new feature gates
- [ ] Update pricing page to reflect new Pro features
- [ ] Add upgrade prompts in UI where gated features are shown to lower-tier users

---

## Definition of Done

- [ ] User can set up 2-of-3 trusted contacts and successfully recover an encrypted vault with 2 contacts' shares
- [ ] Time-locked vault correctly rejects retrieval requests until the hold date
- [ ] Health check runs weekly and sends monthly email digest
- [ ] iOS app available on TestFlight (internal testing), shows vaults and processes retrieval requests
- [ ] Cost forecasting dashboard shows projected spend for the next 6 months

---

## Estimated Additional Monthly Cost

| Item | Monthly |
|------|---------|
| Expo (free tier) | $0 |
| APNs / FCM (free) | $0 |
| Apple Developer Program ($99/yr) | ~$8 |
| Google Play ($25 one-time) | ~$2 |
| Lambda for analytics + suggestions cron | ~$5–10 |
| **Additional monthly** | **~$15–20** |
