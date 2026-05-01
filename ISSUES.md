# Known Issues

## Open

### [BUG] Profile dropdown click causes blank page
**Status:** Investigation in progress  
**First seen:** 2026-04-30  
**Symptom:** Clicking the user avatar in the top-right corner renders a blank page instead of opening the dropdown menu.  
**Root cause:** `shadcn/ui` components now use `@base-ui/react` instead of Radix UI. `DropdownMenuTrigger` and `TooltipTrigger` from base-ui render their own `<button>` element and do not support the Radix-style `asChild` prop to merge with a child `<Button>`. Using `asChild` results in nested `<button>` elements, which is invalid HTML and causes React to throw a hydration/render error, blanking the page.  
**Fix attempted:** Removed `asChild` from `DropdownMenuTrigger` in `Topbar.tsx` and applied button styles directly on the trigger element. Same fix applied to all `TooltipTrigger` usages — replaced with native `title` attribute on `Button`. Needs verification in browser.  
**Files:** `src/components/layout/Topbar.tsx`, `src/components/ThemeToggle.tsx`, `src/components/files/FileCard.tsx`

---

## Closed

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
