# Known Issues

## Open

None currently.

## Closed

### [FEATURE] Users could not create folders
**Importance:** Important  
**Status:** Fixed on feature branch  
**First seen:** 2026-05-01  
**Symptom:** Writable locations supported file upload but did not provide a way to create or remove folders from the browser UI.  
**Fix:** Added a Folder action next to Upload for writable paths. Creating a folder uploads a hidden `.folder` marker object inside the new prefix, and folder listings hide that marker from the file list. Folder cards now expose delete controls, and deleting a folder recursively checks for data before warning and removing contents.  
**Files:** `src/components/files/CreateFolderDialog.tsx`, `src/components/files/DeleteFolderDialog.tsx`, `src/components/files/FileCard.tsx`, `src/components/files/FileGrid.tsx`, `src/components/layout/Topbar.tsx`, `src/hooks/useStorage.ts`

---

### [UX] Sidebar subfolders looked too narrow
**Importance:** Important  
**Status:** Fixed on feature branch  
**First seen:** 2026-05-01  
**Symptom:** Nested folders in the sidebar did not visually reach the parent folder row width, making the tree feel uneven.  
**Fix:** Adjusted sidebar subfolder spacing so subfolder rows span the parent menu width with a modest indent.  
**Files:** `src/components/layout/AppSidebar.tsx`

---

### [BUG] Profile dropdown click causes blank page
**Importance:** Important  
**Status:** Fixed on feature branch  
**First seen:** 2026-04-30  
**Symptom:** Clicking the user avatar in the top-right corner rendered a blank page instead of opening the account menu.  
**Root cause:** The base-ui dropdown primitive path was brittle in this app and could crash the React tree when opening the account menu.  
**Fix:** Replaced the account dropdown primitive with a controlled shadcn-styled account menu using a normal button. The menu now includes Profile, Sign out, and an Admin Dashboard option for admin users.  
**Files:** `src/components/layout/Topbar.tsx`

---

### [UX] Media cards opened the info drawer instead of a viewer
**Importance:** Important  
**Status:** Fixed on feature branch  
**First seen:** 2026-05-01  
**Symptom:** Clicking an image or video card opened the right-side info panel, which made media browsing awkward and forced users to inspect media one at a time through metadata mode.  
**Fix:** Added a dedicated near-fullscreen media viewer with previous/next controls, download, and an info action. File cards now expose a separate Info button for the right-side detail panel, and card action buttons use a compact shadcn button cluster to avoid layered controls. The viewer warms presigned URLs for `n-2` through `n+2` and preloads nearby image bytes.  
**Files:** `src/components/files/MediaViewer.tsx`, `src/components/files/FileGrid.tsx`, `src/components/files/FileCard.tsx`, `src/store/useFileBrowserStore.ts`

---

### [BUG] Video thumbnails loaded full video
**Importance:** Important  
**Status:** Fixed on feature branch  
**First seen:** 2026-05-01  
**Symptom:** Video thumbnails became slow after removing presigned media URLs because the app had to download the full video into a local `blob:` URL before rendering a frame.  
**Fix:** New video uploads generate a JPEG thumbnail sidecar at `thumbnails/{originalPath}.jpg`. Grid cards and the detail preview load the thumbnail object instead of the original video, and original videos are downloaded only when the user clicks Download. Existing videos need re-upload or a backfill to get thumbnails.  
**Files:** `src/lib/thumbnailUtils.ts`, `src/components/files/UploadZone.tsx`, `src/components/files/FileCard.tsx`, `src/components/files/FileDetail.tsx`, `src/hooks/useStorage.ts`, `amplify/storage/resource.ts`

---

### [BUG] Private video thumbnail uploads were denied for non-admin users
**Importance:** Important  
**Status:** Fixed on feature branch  
**First seen:** 2026-05-01  
**Symptom:** Uploading a video under `private/{identityId}/` completed the original video upload, but the generated thumbnail failed with `AccessDenied` on `s3:PutObject` for `thumbnails/private/{identityId}/...jpg`. The grid then fell back to the generic video icon.  
**Fix:** Added an explicit owner-scoped IAM policy for the authenticated role in the storage stack, granting list/read/write/delete for both `private/${cognito-identity.amazonaws.com:sub}/` and `thumbnails/private/${cognito-identity.amazonaws.com:sub}/`. This must be deployed with `npx ampx sandbox --once` or the normal backend deploy before AWS will stop returning 403.  
**Files:** `amplify/backend.ts`

---

### [SECURITY] Presigned media URLs were copyable
**Importance:** Important  
**Status:** Fixed on feature branch  
**First seen:** 2026-05-01  
**Symptom:** Copying an S3 presigned URL let anyone with that URL view the object until expiry.  
**Fix:** Removed copy-link UI and presigned URLs for thumbnails and downloads. Media viewer playback intentionally uses 5-hour presigned URLs so images and videos can load directly through the browser; copied playback URLs work only until expiry.  
**Files:** `src/hooks/useStorage.ts`, `src/components/files/FileCard.tsx`, `src/components/files/FileDetail.tsx`
