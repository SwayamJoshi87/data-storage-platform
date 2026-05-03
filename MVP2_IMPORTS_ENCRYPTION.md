# MVP 2 — Imports & Encryption

**Goal:** Users can import data from major cloud providers and optionally encrypt their vaults with zero-knowledge client-side encryption.
**Prerequisite:** MVP 1 shipped and stable with at least 20 paying users.
**Target timeline:** 8–10 weeks after MVP 1.

---

## Scope

| In scope | Out of scope |
|----------|-------------|
| Google Drive import connector | Native iCloud API (does not exist) |
| OneDrive import connector | Desktop sync agent |
| Dropbox import connector | Mobile apps |
| Google Photos import | SOC 2 audit |
| iCloud zip-upload (manual flow) | Vault sharing (moved to MVP 3) |
| Client-side AES-256-GCM encryption | Key escrow / enterprise KMS |
| Encrypted file index (search) | HIPAA BAA |
| Family plan + vault sharing | |
| Email-to-vault ingest | |

---

## Architecture Additions

```
MVP 1 stack, plus:

SQS Queue (import-jobs)
  └── Fargate Workers (import-worker container)
        ├── Google Drive API (OAuth2)
        ├── Microsoft Graph API (OAuth2)
        ├── Dropbox API (OAuth2)
        └── Google Photos Library API (OAuth2)

Browser
  └── WebCrypto API
        ├── Argon2id (key derivation — argon2-browser)
        ├── AES-256-GCM (file encryption/decryption)
        └── Encrypted search index (client-side)

New DB tables:
  import_jobs
  oauth_tokens (encrypted at rest)
  family_members
```

---

## Steps

### Step 1 — Fargate Worker Scaffold

- [ ] Write `workers/import-worker/` Dockerfile (Node 20 slim)
- [ ] Define SQS queue `import-jobs` (standard, not FIFO — order doesn't matter)
- [ ] Worker entry point: poll SQS, deserialise job, dispatch to provider handler, ack on completion
- [ ] Checkpoint progress to Postgres `import_jobs` every 50MB transferred
- [ ] Graceful shutdown handler: SIGTERM → complete current chunk → ack partial, re-queue remaining
- [ ] Push image to ECR, deploy as Fargate task triggered by SQS Lambda trigger
- [ ] `import_jobs` table:
  ```
  id, user_id, vault_id, provider (google_drive|onedrive|dropbox|google_photos|zip),
  status (queued|running|paused|completed|failed),
  oauth_token_ref, source_path, total_bytes, transferred_bytes,
  error_message, checkpoint_cursor, created_at, completed_at
  ```

---

### Step 2 — Google Drive Connector

- [ ] Register Google Cloud OAuth app (Drive API scope: `drive.readonly`)
- [ ] `GET /api/imports/google-drive/auth` — redirect to Google OAuth consent
- [ ] `GET /api/imports/google-drive/callback` — exchange code for tokens, store encrypted in `oauth_tokens`
- [ ] `GET /api/imports/google-drive/browse?folderId=` — list files/folders (for picker UI)
- [ ] `POST /api/imports` — create `import_job`, push to SQS
- [ ] Fargate worker `GoogleDriveHandler`:
  - Paginate Drive file list (100 files/page)
  - Download each file via `drive.files.get?alt=media` with streaming
  - Pipe directly to S3 multipart upload (no temp disk)
  - Handle token refresh mid-import (tokens expire after 1hr)
  - Checkpoint: store `pageToken` + last processed `fileId`
- [ ] `src/pages/Imports.tsx` — Google Drive card:
  - "Connect Google Drive" → OAuth redirect
  - Folder picker (breadcrumb nav, checkboxes)
  - Destination vault + tier selector
  - Progress bar (transferred MB / total MB)

---

### Step 3 — OneDrive Connector

- [ ] Register Azure AD app (Microsoft Graph scope: `Files.Read`)
- [ ] OAuth flow: `GET /api/imports/onedrive/auth` + `callback`
- [ ] Store encrypted refresh token in `oauth_tokens`
- [ ] Fargate worker `OneDriveHandler`:
  - Graph API: `GET /me/drive/items/{id}/children` for listing
  - `GET /me/drive/items/{id}/content` for download (returns redirect to CDN URL — follow it)
  - Multipart S3 upload, checkpoint by item ID
  - Handle Graph throttle responses (429 + Retry-After header)
- [ ] UI: same import card pattern as Google Drive

---

### Step 4 — Dropbox Connector

- [ ] Register Dropbox app (`files.content.read` scope)
- [ ] OAuth flow + token storage
- [ ] Fargate worker `DropboxHandler`:
  - `POST /2/files/list_folder` + `list_folder/continue` for listing
  - `POST /2/files/download` for file bytes
  - Handle Dropbox API rate limits (exponential backoff)
- [ ] UI: import card

---

### Step 5 — Google Photos Connector

- [ ] Separate OAuth scope: `photoslibrary.readonly` (different from Drive)
- [ ] Fargate worker `GooglePhotosHandler`:
  - `mediaItems.list` pagination
  - Download via `baseUrl + "=d"` param
  - Preserve EXIF metadata in S3 user metadata headers
  - Organise into vault folders by Google Photos album
- [ ] UI: import card with album picker

---

### Step 6 — iCloud Import (Manual Zip Flow)

**Note:** Apple has no third-party iCloud API. Best achievable is a guided manual flow.

- [ ] `src/pages/ImportICloud.tsx` — guided wizard:
  - Step 1: link to Apple's [Data and Privacy](https://privacy.apple.com) page with instructions
  - Step 2: "Once downloaded, upload your zip file here"
  - Step 3: `UploadZone` accepting `.zip` files up to 50GB
- [ ] API: `POST /api/imports/zip` — accept multipart zip upload, push to SQS
- [ ] Fargate worker `ZipHandler`:
  - Stream-extract zip using `unzipper` (no full extraction to disk)
  - Upload each extracted file to S3 under target vault
  - Handle Apple's export structure (iCloud Drive, Photos, Mail attachments)
- [ ] Progress shown per-file during extraction

---

### Step 7 — Import Management UI

- [ ] `src/pages/Imports.tsx`:
  - Provider connection status cards (connected / not connected)
  - Active imports list with real-time progress (poll `GET /api/imports` every 5s)
  - Completed / failed imports history (last 30 days)
  - "Retry" button for failed imports
  - "Cancel" button for running imports (sends cancellation signal to SQS worker)
- [ ] `GET /api/imports` — list user's import jobs
- [ ] `DELETE /api/imports/:id` — cancel + dequeue
- [ ] OAuth token refresh: store new tokens on every refresh; proactively re-auth 7 days before expiry

---

### Step 8 — Client-Side Encryption

**Goal:** zero-knowledge — server only ever stores ciphertext. User holds the key.

- [ ] Install `argon2-browser` (WASM Argon2id implementation)
- [ ] Write `src/lib/encryption.ts`:
  ```ts
  // Key derivation
  deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey>
    // Argon2id: memory=64MB, iterations=3, parallelism=1
    // Output: 256-bit raw key → WebCrypto AES-GCM import

  // File encryption (streaming)
  encryptStream(stream: ReadableStream, key: CryptoKey): ReadableStream
    // Random 96-bit IV prepended to ciphertext

  // File decryption (streaming)
  decryptStream(stream: ReadableStream, key: CryptoKey): ReadableStream

  // Metadata encryption (small blobs: filename, tags)
  encryptString(plaintext: string, key: CryptoKey): Promise<string> // base64url
  decryptString(ciphertext: string, key: CryptoKey): Promise<string>
  ```
- [ ] Key storage strategy:
  - Derived key lives only in memory (never persisted)
  - Salt stored server-side in `vaults.encryption_salt`
  - User re-derives on each session unlock
  - Optional: store encrypted key in browser `sessionStorage` for the browser tab lifetime
- [ ] Vault "encryption setup" flow:
  - Toggle "Enable encryption" on vault create or in vault settings
  - Prompt for encryption password (separate from login password)
  - Derive key, store salt to server, encrypt a test string to verify
  - Show warning: "If you forget this password, your files cannot be recovered"
- [ ] Modify `UploadZone.tsx`: if vault is encrypted → pipe file through `encryptStream` before S3 upload
- [ ] Modify download flow: fetch ciphertext from S3, pipe through `decryptStream`, offer as `blob:` download
- [ ] Lock screen: encrypted vaults show a lock icon — user enters encryption password to unlock tab session

---

### Step 9 — Encrypted Search Index

**Goal:** filename/tag search works without the server seeing plaintext.

- [ ] Client-side index strategy: on each upload, extract bigrams from filename+tags, encrypt each bigram with a derived search key (separate from file key — use HMAC-SHA256 as a deterministic encryption)
- [ ] Store encrypted bigrams in `files.search_tokens` (text array in Postgres)
- [ ] Search: client sends HMAC of each query bigram → server matches against `search_tokens` array → returns matching file IDs → client decrypts filenames to display
- [ ] `GET /api/vaults/:id/search?tokens[]=` — accepts array of HMAC tokens, returns matching file IDs
- [ ] Update `src/components/files/SearchBar.tsx` to use this flow for encrypted vaults

---

### Step 10 — Family Plan + Vault Sharing

- [ ] `family_members` table: `id, owner_user_id, member_user_id, storage_quota_bytes, created_at`
- [ ] `vault_shares` table: `id, vault_id, shared_with_user_id, permission (read|write), created_at`
- [ ] `POST /api/family/invite` — send invite email via Resend, create pending member record
- [ ] `POST /api/vaults/:id/share` — share vault with email (must be family member or any user)
- [ ] Family plan enforcement: total storage across all members capped at plan limit (5TB)
- [ ] `src/pages/FamilySettings.tsx` — member list, invite button, per-member storage usage bar
- [ ] Shared vaults appear in sidebar for the recipient (read-only badge or write access)

---

### Step 11 — Email-to-Vault Ingest

- [ ] Each user gets a unique ingest address: `vault-{uuid}@ingest.yourdomain.com`
- [ ] Set up [Resend Inbound](https://resend.com/docs/api-reference/inbound) or route via SES → Lambda
- [ ] Lambda parses MIME email, extracts attachments
- [ ] Uploads each attachment to the target vault (looks up vault by ingest token)
- [ ] Sends confirmation email: "2 files added to your Tax Records vault"
- [ ] `vaults.ingest_email_token` column; `GET /api/vaults/:id/ingest-address` returns address

---

### Step 12 — Testing & Hardening

- [ ] Integration tests for each import connector using provider sandbox/test accounts
- [ ] Test large file import (>1GB) through Fargate — verify no memory issues, multipart works
- [ ] Test encryption round-trip: upload encrypted → download + decrypt → byte-for-byte match
- [ ] Test encryption password wrong → graceful error (not corrupted state)
- [ ] Test OAuth token expiry mid-import → worker refreshes and resumes
- [ ] Fargate worker memory and CPU sizing (2 vCPU / 4GB RAM starting point)
- [ ] DLQ (dead letter queue) for failed SQS jobs — alert on DLQ depth > 0

---

## Definition of Done

- [ ] User can connect Google Drive and import 1GB+ folder into a vault
- [ ] User can enable encryption on a vault, upload a file, and download + decrypt it
- [ ] Encrypted vault search returns correct results
- [ ] Family plan with 2 sub-accounts, shared vault visible to both

---

## Estimated Additional Monthly Cost

| Item | Cost |
|------|------|
| Fargate (import workers, ~4hr/day active) | ~$30–60 |
| SQS (import job queue) | < $1 |
| Google/MS/Dropbox API — no cost for reads | $0 |
| argon2-browser (WASM) — client-side | $0 |
| **Additional monthly** | **~$30–60** |
