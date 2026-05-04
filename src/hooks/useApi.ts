import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-react'

// ---- Shared types ----------------------------------------------------------

export type Plan = 'free' | 'starter' | 'personal' | 'family' | 'pro'
export type Tier = 'hot' | 'warm' | 'cold' | 'frozen'
export type Urgency = 'bulk' | 'standard' | 'expedited'

export interface Vault {
  id: string
  name: string
  description: string | null
  defaultTier: Tier
  wormEnabled: boolean
  createdAt: string
  deletedAt: string | null
}

export interface VaultFile {
  id: string
  vaultId: string
  userId: string
  path: string
  s3Key: string
  sizeBytes: number
  contentType: string
  storageTier: Tier
  sha256: string | null
  thumbnailKey: string | null
  createdAt: string
  lastAccessedAt: string | null
}

export interface UsageData {
  storageByTier: Record<Tier, number>
  periodStart: string
  periodEnd: string
}

export interface UploadUrlResponse {
  fileId: string
  uploadUrl: string
  s3Key: string
}

// ---- Base fetch ------------------------------------------------------------

export function useApiFetch() {
  const { getToken } = useAuth()

  return async <T>(path: string, init?: RequestInit): Promise<T> => {
    const token = await getToken()
    const res = await fetch(`/api${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init?.headers ?? {}),
      },
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({ message: res.statusText })) as { message?: string }
      throw new Error(body.message ?? `Request failed: ${res.status}`)
    }
    return res.json() as Promise<T>
  }
}

// ---- Query keys ------------------------------------------------------------

export const queryKeys = {
  vaults: () => ['vaults'] as const,
  vault: (id: string) => ['vaults', id] as const,
  vaultFiles: (vaultId: string, cursor?: string) => ['vaults', vaultId, 'files', cursor] as const,
  usage: () => ['usage'] as const,
}

// ---- Vault hooks -----------------------------------------------------------

export function useVaults() {
  const apiFetch = useApiFetch()
  return useQuery({
    queryKey: queryKeys.vaults(),
    queryFn: () => apiFetch<{ vaults: Vault[] }>('/vaults').then((r) => r.vaults),
  })
}

export function useCreateVault() {
  const apiFetch = useApiFetch()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { name: string; description?: string; defaultTier?: Tier }) =>
      apiFetch<{ vault: Vault }>('/vaults', {
        method: 'POST',
        body: JSON.stringify(input),
      }).then((r) => r.vault),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.vaults() }),
  })
}

export function useUpdateVault() {
  const apiFetch = useApiFetch()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...updates }: { id: string; name?: string; description?: string; defaultTier?: Tier }) =>
      apiFetch<{ vault: Vault }>(`/vaults/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      }).then((r) => r.vault),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.vaults() })
      qc.invalidateQueries({ queryKey: queryKeys.vault(vars.id) })
    },
  })
}

export function useDeleteVault() {
  const apiFetch = useApiFetch()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vaultId: string) =>
      apiFetch<{ ok: boolean }>(`/vaults/${vaultId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.vaults() }),
  })
}

// ---- File hooks ------------------------------------------------------------

export function useVaultFiles(vaultId: string | null, cursor?: string) {
  const apiFetch = useApiFetch()
  return useQuery({
    queryKey: queryKeys.vaultFiles(vaultId ?? '', cursor),
    queryFn: () => {
      const params = new URLSearchParams({ limit: '50' })
      if (cursor) params.set('cursor', cursor)
      return apiFetch<{ files: VaultFile[]; nextCursor: string | null }>(
        `/vaults/${vaultId}/files?${params}`,
      )
    },
    enabled: !!vaultId,
  })
}

export function useDeleteFile() {
  const apiFetch = useApiFetch()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (fileId: string) =>
      apiFetch<{ ok: boolean }>(`/files/${fileId}`, { method: 'DELETE' }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['vaults'] }),
  })
}

/** Get a presigned upload URL and create the file record in the DB. */
export function useGetUploadUrl() {
  const apiFetch = useApiFetch()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      vaultId,
      filename,
      contentType,
      sizeBytes,
      tier,
    }: {
      vaultId: string
      filename: string
      contentType: string
      sizeBytes: number
      tier?: Tier
    }) =>
      apiFetch<UploadUrlResponse>(`/vaults/${vaultId}/upload-url`, {
        method: 'POST',
        body: JSON.stringify({ filename, contentType, sizeBytes, tier }),
      }),
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: queryKeys.vaultFiles(vars.vaultId) }),
  })
}

// ---- Download URL hook -----------------------------------------------------

export function useFileDownloadUrl(fileId: string | null) {
  const apiFetch = useApiFetch()
  return useQuery({
    queryKey: ['files', fileId, 'download-url'] as const,
    queryFn: () => apiFetch<{ url: string; expiresIn: number }>(`/files/${fileId}/download-url`).then((r) => r.url),
    enabled: !!fileId,
    staleTime: 50 * 60 * 1000, // treat presigned URL as fresh for 50 min
    gcTime: 60 * 60 * 1000,
  })
}

// ---- Usage hook ------------------------------------------------------------

export function useUsage() {
  const apiFetch = useApiFetch()
  return useQuery({
    queryKey: queryKeys.usage(),
    queryFn: () => apiFetch<UsageData>('/usage'),
  })
}
