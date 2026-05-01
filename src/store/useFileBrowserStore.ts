import { create } from 'zustand';

export type ViewMode = 'grid' | 'list';
export type SortField = 'name' | 'size' | 'lastModified';
export type SortOrder = 'asc' | 'desc';

export interface UploadItem {
  id: string;
  name: string;
  path: string;
  progress: number;
  status: 'queued' | 'uploading' | 'done' | 'error';
  error?: string;
}

interface FileBrowserState {
  currentPath: string;
  selectedFilePath: string | null;
  mediaViewerPath: string | null;
  viewMode: ViewMode;
  sortField: SortField;
  sortOrder: SortOrder;
  searchQuery: string;
  uploadQueue: UploadItem[];
  identityId: string | null;
  isAdmin: boolean;
  /** Paths of files copied in-app for pasting to another folder */
  clipboardPaths: string[];

  setCurrentPath: (path: string) => void;
  setSelectedFilePath: (path: string | null) => void;
  setMediaViewerPath: (path: string | null) => void;
  setViewMode: (mode: ViewMode) => void;
  setSortField: (field: SortField) => void;
  setSortOrder: (order: SortOrder) => void;
  setSearchQuery: (q: string) => void;
  setIdentityId: (id: string) => void;
  setIsAdmin: (isAdmin: boolean) => void;
  addUpload: (item: UploadItem) => void;
  updateUpload: (id: string, updates: Partial<UploadItem>) => void;
  removeUpload: (id: string) => void;
  setClipboardPaths: (paths: string[]) => void;
}

interface AccessContext {
  isAdmin: boolean;
  identityId: string | null;
}

function isWithinPrefix(path: string, prefix: string) {
  return path === prefix || path.startsWith(prefix);
}

export function canWritePath(path: string, { isAdmin, identityId }: AccessContext) {
  if (!path) return false;
  if (isWithinPrefix(path, 'public/')) return isAdmin;
  if (isWithinPrefix(path, 'admin/')) return isAdmin;
  if (identityId && isWithinPrefix(path, `private/${identityId}/`)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// URL hash helpers — encode/decode navigation state so the browser's
// back/forward buttons work within the app.
// ---------------------------------------------------------------------------

export function buildUrlHash(path: string, viewer: string | null): string {
  const params = new URLSearchParams();
  params.set('p', path);
  if (viewer) params.set('v', viewer);
  return '#' + params.toString();
}

export function parseUrlHash(hash: string): { path: string | null; viewer: string | null } {
  const str = hash.startsWith('#') ? hash.slice(1) : hash;
  const params = new URLSearchParams(str);
  return { path: params.get('p'), viewer: params.get('v') };
}

function getInitialStateFromUrl(): { currentPath?: string; mediaViewerPath?: string | null } {
  if (typeof window === 'undefined') return {};
  const { path, viewer } = parseUrlHash(window.location.hash);
  if (!path) return {};
  return { currentPath: path, mediaViewerPath: viewer ?? null };
}

export const useFileBrowserStore = create<FileBrowserState>()((set, get) => ({
  currentPath: 'public/',
  selectedFilePath: null,
  mediaViewerPath: null,
  viewMode: 'grid',
  sortField: 'name',
  sortOrder: 'asc',
  searchQuery: '',
  uploadQueue: [],
  identityId: null,
  isAdmin: false,
  clipboardPaths: [],
  // Override defaults with any path/viewer encoded in the URL
  ...getInitialStateFromUrl(),

  setCurrentPath: (path) => {
    history.pushState({ path, viewer: null }, '', buildUrlHash(path, null));
    set({ currentPath: path, selectedFilePath: null, mediaViewerPath: null });
  },
  setSelectedFilePath: (path) => set({ selectedFilePath: path }),
  setMediaViewerPath: (path) => {
    const currentPath = get().currentPath;
    if (path) {
      history.pushState({ path: currentPath, viewer: path }, '', buildUrlHash(currentPath, path));
    } else {
      // Closing the viewer: replace so back doesn't reopen it
      history.replaceState({ path: currentPath, viewer: null }, '', buildUrlHash(currentPath, null));
    }
    set({ mediaViewerPath: path });
  },
  setViewMode: (mode) => set({ viewMode: mode }),
  setSortField: (field) => set({ sortField: field }),
  setSortOrder: (order) => set({ sortOrder: order }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setIdentityId: (id) => set({ identityId: id }),
  setIsAdmin: (isAdmin) => set({ isAdmin }),
  addUpload: (item) => set((s) => ({ uploadQueue: [...s.uploadQueue, item] })),
  updateUpload: (id, updates) =>
    set((s) => ({
      uploadQueue: s.uploadQueue.map((i) => (i.id === id ? { ...i, ...updates } : i)),
    })),
  removeUpload: (id) =>
    set((s) => ({ uploadQueue: s.uploadQueue.filter((i) => i.id !== id) })),
  setClipboardPaths: (paths) => set({ clipboardPaths: paths }),
}));
