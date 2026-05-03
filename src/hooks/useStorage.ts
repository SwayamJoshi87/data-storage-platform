// MIGRATION STUB — replaced entirely in Step 4 (API layer).
// Exports match the original surface so existing components compile unchanged.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// ---- Types ----------------------------------------------------------------

export type StorageItem = {
  key: string
  path: string
  size: number
  lastModified: Date
  eTag: string
  isFolder: boolean
  contentType?: string
}

export type StorageFile = StorageItem & { isFolder: false }
export type StorageFolder = StorageItem & { isFolder: true }

// ---- Stub helpers ---------------------------------------------------------

const notMigrated = () => { throw new Error('Storage not yet migrated — complete Step 4') }
const noopMutation = () => useMutation({ mutationFn: notMigrated })

// ---- Hooks ----------------------------------------------------------------

export function useStorageList(_prefix: string, _options?: any) {
  return useQuery({ queryKey: ['storage-stub', _prefix], queryFn: () => [] as StorageItem[], enabled: false })
}

export function useFolderContents(_prefix: string, _options?: any) {
  return useQuery({ queryKey: ['folder-stub', _prefix], queryFn: () => ({ files: [] as StorageFile[], folders: [] as StorageFolder[] }), enabled: false })
}

export function useFileObjectUrl(_key: string | null) {
  return useQuery({ queryKey: ['object-url-stub', _key], queryFn: () => null as string | null, enabled: false })
}

export function usePresignedFileUrl(_key: string | null, _expiresIn?: number) {
  return useQuery({ queryKey: ['presigned-stub', _key], queryFn: () => null as string | null, enabled: false })
}

export function useCreateFolder() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: async (_path: string) => { notMigrated(); void qc } })
}

export function useDeleteFile() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: async (_key: string) => { notMigrated(); void qc } })
}

export function useDeleteFolder() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: async (_prefix: string) => { notMigrated(); void qc } })
}

export function useFolderSummary(_prefix: string) {
  return useQuery({ queryKey: ['folder-summary-stub', _prefix], queryFn: () => ({ fileCount: 0, folderCount: 0 }), enabled: false })
}

// ---- Functions ------------------------------------------------------------

export async function uploadFile(_path: string, _file: File, _onProgress?: (pct: number, transferred: number, total: number) => void) {
  notMigrated()
}

export async function downloadFile(_key: string) {
  notMigrated()
}

export async function downloadFolder(_prefix: string) {
  notMigrated()
}

export async function getFileUrl(_key: string) {
  notMigrated()
  return ''
}

export async function deleteFile(_key: string) {
  notMigrated()
}

export async function createFolder(_path: string) {
  notMigrated()
}

export async function moveFile(_src: string, _dest: string) {
  notMigrated()
}

export async function copyS3File(_src: string, _dest: string) {
  notMigrated()
}

// keep noopMutation referenced to avoid tree-shaking warnings
void noopMutation
