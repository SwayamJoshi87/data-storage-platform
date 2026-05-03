// Migration stub — original Amplify-backed implementation replaced in Step 4
// when the real StorageBackend + vault-aware API client is wired up.
// All hooks return empty/inert data so the legacy UI compiles without aws-amplify.
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getThumbnailPath } from '@/lib/thumbnailUtils';

export interface StorageFile {
  path: string;
  name: string;
  size?: number;
  lastModified?: Date;
  eTag?: string;
}

export interface StorageFolder {
  path: string;
  name: string;
}

export interface FolderContents {
  folders: StorageFolder[];
  files: StorageFile[];
}

export interface FolderSummary {
  folderCount: number;
  fileCount: number;
  isEmpty: boolean;
}

export async function fetchFolderContents(_prefix: string): Promise<FolderContents> {
  // TODO Step 4: replace with vault API call
  return { folders: [], files: [] };
}

export async function fetchFolderSummary(_prefix: string): Promise<FolderSummary> {
  // TODO Step 4: replace with vault API call
  return { folderCount: 0, fileCount: 0, isEmpty: true };
}

export function useFolderContents(path: string) {
  return useQuery({
    queryKey: ['storage', 'list', path],
    queryFn: () => fetchFolderContents(path),
    enabled: !!path,
    staleTime: 30_000,
  });
}

export function useFolderSummary(path: string) {
  return useQuery({
    queryKey: ['storage', 'summary', path],
    queryFn: () => fetchFolderSummary(path),
    enabled: !!path,
    staleTime: 30_000,
  });
}

export function useFileObjectUrl(path: string | null) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setObjectUrl(null);
    setError(null);
    setIsLoading(false);
    // TODO Step 4: fetch blob via vault API presigned URL
    void path;
  }, [path]);

  return { data: objectUrl, isLoading, error };
}

export function usePresignedFileUrl(path: string | null, enabled = true, _expiresIn = 18000) {
  return useQuery({
    queryKey: ['storage', 'url', path],
    queryFn: async (): Promise<string> => {
      // TODO Step 4: fetch presigned URL from vault API
      throw new Error('Not implemented — Step 4');
    },
    enabled: Boolean(path && enabled),
    staleTime: 0,
  });
}

export function useDeleteFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (path: string) => {
      // TODO Step 4: DELETE /vaults/:vaultId/files/:fileId
      void getThumbnailPath(path);
    },
    onSuccess: (_data, path) => {
      const parent = path.slice(0, path.lastIndexOf('/') + 1);
      qc.invalidateQueries({ queryKey: ['storage', 'list', parent] });
    },
  });
}

export function useDeleteFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (folderPath: string) => {
      // TODO Step 4: recursive delete via vault API
      void folderPath;
    },
    onSuccess: (_data, folderPath) => {
      const parentPath = folderPath.replace(/\/$/, '').split('/').slice(0, -1).join('/') + '/';
      qc.invalidateQueries({ queryKey: ['storage', 'list', parentPath] });
      qc.invalidateQueries({ queryKey: ['storage', 'list', folderPath] });
    },
  });
}

export function useCreateFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ parentPath, name }: { parentPath: string; name: string }) => {
      // TODO Step 4: POST folder marker via vault API
      return `${parentPath}${name}/`;
    },
    onSuccess: (_data, { parentPath }) => {
      qc.invalidateQueries({ queryKey: ['storage', 'list', parentPath] });
    },
  });
}

export async function downloadFile(_path: string): Promise<Blob> {
  // TODO Step 4: stream from presigned URL
  throw new Error('Not implemented — Step 4');
}

export async function copyS3File(_sourcePath: string, _destPath: string): Promise<void> {
  // TODO Step 4: copy via vault API
}

export async function downloadFolder(_folderPath: string): Promise<void> {
  // TODO Step 4: zip + stream via vault API
}

export async function uploadFile(
  _path: string,
  _file: File,
  _onProgress: (pct: number) => void,
): Promise<void> {
  // TODO Step 4: multipart upload via presigned URL from vault API
}
