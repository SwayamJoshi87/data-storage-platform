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

_(none yet)_
