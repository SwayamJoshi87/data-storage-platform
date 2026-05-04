import { create } from 'zustand';
import type { Tier } from '@/hooks/useApi';

export type ViewMode = 'grid' | 'list';
export type SortOrder = 'asc' | 'desc';

export interface UploadItem {
  id: string;
  name: string;
  vaultId: string;
  progress: number;
  status: 'queued' | 'uploading' | 'done' | 'error';
  error?: string;
}

interface FileBrowserState {
  selectedFileId: string | null;
  viewMode: ViewMode;
  sortOrder: SortOrder;
  searchQuery: string;
  tierFilter: Tier | 'all';
  uploadQueue: UploadItem[];
  isAdmin: boolean;

  setSelectedFileId: (id: string | null) => void;
  setViewMode: (mode: ViewMode) => void;
  setSortOrder: (order: SortOrder) => void;
  setSearchQuery: (q: string) => void;
  setTierFilter: (tier: Tier | 'all') => void;
  setIsAdmin: (isAdmin: boolean) => void;
  addUpload: (item: UploadItem) => void;
  updateUpload: (id: string, updates: Partial<UploadItem>) => void;
  removeUpload: (id: string) => void;
}

export const useFileBrowserStore = create<FileBrowserState>((set) => ({
  selectedFileId: null,
  viewMode: 'grid',
  sortOrder: 'asc',
  searchQuery: '',
  tierFilter: 'all',
  uploadQueue: [],
  isAdmin: false,

  setSelectedFileId: (id) => set({ selectedFileId: id }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setSortOrder: (order) => set({ sortOrder: order }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setTierFilter: (tier) => set({ tierFilter: tier }),
  setIsAdmin: (isAdmin) => set({ isAdmin }),
  addUpload: (item) => set((s) => ({ uploadQueue: [...s.uploadQueue, item] })),
  updateUpload: (id, updates) =>
    set((s) => ({ uploadQueue: s.uploadQueue.map((i) => (i.id === id ? { ...i, ...updates } : i)) })),
  removeUpload: (id) =>
    set((s) => ({ uploadQueue: s.uploadQueue.filter((i) => i.id !== id) })),
}));
