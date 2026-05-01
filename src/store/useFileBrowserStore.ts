import { create } from 'zustand';

export type ViewMode = 'grid' | 'list';
export type SortField = 'name' | 'size' | 'lastModified';
export type SortOrder = 'asc' | 'desc';

export interface UploadItem {
  id: string;
  name: string;
  path: string;
  progress: number;
  status: 'uploading' | 'done' | 'error';
  error?: string;
}

interface FileBrowserState {
  currentPath: string;
  selectedFilePath: string | null;
  viewMode: ViewMode;
  sortField: SortField;
  sortOrder: SortOrder;
  searchQuery: string;
  uploadQueue: UploadItem[];
  identityId: string | null;
  isAdmin: boolean;

  setCurrentPath: (path: string) => void;
  setSelectedFilePath: (path: string | null) => void;
  setViewMode: (mode: ViewMode) => void;
  setSortField: (field: SortField) => void;
  setSortOrder: (order: SortOrder) => void;
  setSearchQuery: (q: string) => void;
  setIdentityId: (id: string) => void;
  setIsAdmin: (isAdmin: boolean) => void;
  addUpload: (item: UploadItem) => void;
  updateUpload: (id: string, updates: Partial<UploadItem>) => void;
  removeUpload: (id: string) => void;
}

const READ_ONLY_PREFIXES = ['public/', 'backup_public/'];

export function isReadOnlyPath(path: string, isAdmin = false) {
  if (isAdmin) return false;
  return READ_ONLY_PREFIXES.some((p) => path === p || path.startsWith(p));
}

export const useFileBrowserStore = create<FileBrowserState>((set) => ({
  currentPath: 'public/',
  selectedFilePath: null,
  viewMode: 'grid',
  sortField: 'name',
  sortOrder: 'asc',
  searchQuery: '',
  uploadQueue: [],
  identityId: null,
  isAdmin: false,

  setCurrentPath: (path) => set({ currentPath: path, selectedFilePath: null }),
  setSelectedFilePath: (path) => set({ selectedFilePath: path }),
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
}));
