import { useEffect, useState } from 'react';
import { list, uploadData, remove, downloadData, getUrl, copy } from 'aws-amplify/storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getThumbnailPath } from '@/lib/thumbnailUtils';

// ---------------------------------------------------------------------------
// In-memory blob cache — avoids re-downloading the same file on every remount.
// Key: S3 path. Value: Promise<Blob> (kept alive for the session).
// Max 300 entries; oldest entry evicted when full (insertion-order Map).
// ---------------------------------------------------------------------------
const BLOB_CACHE_MAX = 300;
const blobCache = new Map<string, Promise<Blob>>();

function getCachedBlob(path: string): Promise<Blob> {
  if (blobCache.has(path)) return blobCache.get(path)!;

  if (blobCache.size >= BLOB_CACHE_MAX) {
    const oldest = blobCache.keys().next().value;
    if (oldest !== undefined) blobCache.delete(oldest);
  }

  const promise = downloadData({ path })
    .result.then(({ body }) => body.blob())
    .catch((err: unknown) => {
      blobCache.delete(path);
      throw err;
    });

  blobCache.set(path, promise);
  return promise;
}

const FOLDER_MARKER_FILE = '.folder';

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

export async function fetchFolderContents(prefix: string): Promise<FolderContents> {
  const result = await list({ path: prefix, options: { listAll: true } });

  const folderMap = new Map<string, StorageFolder>();
  const files: StorageFile[] = [];

  for (const item of result.items) {
    const rel = item.path.slice(prefix.length);
    if (!rel) continue;
    if (rel === FOLDER_MARKER_FILE) continue;

    const slashIdx = rel.indexOf('/');
    if (slashIdx !== -1) {
      const folderName = rel.slice(0, slashIdx);
      const folderPath = prefix + folderName + '/';
      if (!folderMap.has(folderPath)) {
        folderMap.set(folderPath, { path: folderPath, name: folderName });
      }
    } else {
      files.push({
        path: item.path,
        name: rel,
        size: item.size,
        lastModified: item.lastModified,
        eTag: item.eTag,
      });
    }
  }

  return { folders: Array.from(folderMap.values()), files };
}

export async function fetchFolderSummary(prefix: string): Promise<FolderSummary> {
  const result = await list({ path: prefix, options: { listAll: true } });
  const folderPaths = new Set<string>();
  let fileCount = 0;

  for (const item of result.items) {
    const rel = item.path.slice(prefix.length);
    if (!rel || rel === FOLDER_MARKER_FILE) continue;

    const segments = rel.split('/').filter(Boolean);
    if (segments.length > 1) {
      let currentPath = prefix;
      for (let i = 0; i < segments.length - 1; i += 1) {
        currentPath += `${segments[i]}/`;
        folderPaths.add(currentPath);
      }
    }

    if (segments[segments.length - 1] !== FOLDER_MARKER_FILE) {
      fileCount += 1;
    }
  }

  return {
    folderCount: folderPaths.size,
    fileCount,
    isEmpty: folderPaths.size === 0 && fileCount === 0,
  };
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
    let canceled = false;
    let nextObjectUrl: string | null = null;

    setObjectUrl(null);
    setError(null);

    if (!path) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    getCachedBlob(path)
      .then((blob) => {
        if (canceled) return;
        nextObjectUrl = URL.createObjectURL(blob);
        setObjectUrl(nextObjectUrl);
      })
      .catch((err: unknown) => {
        if (!canceled) {
          setError(err instanceof Error ? err : new Error('Failed to load file'));
        }
      })
      .finally(() => {
        if (!canceled) setIsLoading(false);
      });

    return () => {
      canceled = true;
      if (nextObjectUrl) URL.revokeObjectURL(nextObjectUrl);
    };
  }, [path]);

  return { data: objectUrl, isLoading, error };
}

export function usePresignedFileUrl(path: string | null, enabled = true, expiresIn = 60 * 60 * 5) {
  return useQuery({
    queryKey: ['storage', 'url', path, expiresIn],
    queryFn: async () => {
      if (!path) throw new Error('Missing storage path');

      const { url } = await getUrl({
        path,
        options: {
          expiresIn,
          validateObjectExistence: false,
        },
      });

      return url.toString();
    },
    enabled: Boolean(path && enabled),
    staleTime: Math.max(0, (expiresIn - 60) * 1000),
    gcTime: expiresIn * 1000,
  });
}

export function useDeleteFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (path: string) => {
      await remove({ path });
      await remove({ path: getThumbnailPath(path) }).catch(() => undefined);
    },
    onSuccess: (_, path) => {
      const parent = path.slice(0, path.lastIndexOf('/') + 1);
      qc.invalidateQueries({ queryKey: ['storage', 'list', parent] });
    },
  });
}

export function useDeleteFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (folderPath: string) => {
      const [folderResult, thumbnailResult] = await Promise.all([
        list({ path: folderPath, options: { listAll: true } }),
        list({ path: `thumbnails/${folderPath}`, options: { listAll: true } }).catch(() => ({
          items: [],
        })),
      ]);

      const paths = new Set<string>();

      folderResult.items.forEach((item) => {
        paths.add(item.path);
        paths.add(getThumbnailPath(item.path));
      });

      thumbnailResult.items.forEach((item) => {
        paths.add(item.path);
      });

      await Promise.all(Array.from(paths).map((path) => remove({ path }).catch(() => undefined)));
    },
    onSuccess: (_, folderPath) => {
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
      const folderPath = `${parentPath}${name}/`;
      await uploadData({
        path: `${folderPath}${FOLDER_MARKER_FILE}`,
        data: new Blob([]),
        options: {
          contentType: 'application/x-directory',
        },
      }).result;

      return folderPath;
    },
    onSuccess: (_, { parentPath }) => {
      qc.invalidateQueries({ queryKey: ['storage', 'list', parentPath] });
    },
  });
}

export async function downloadFile(path: string): Promise<Blob> {
  const { body } = await downloadData({ path }).result;
  return body.blob();
}

/** Server-side S3 copy — no download/re-upload needed. Also copies thumbnail sidecar. */
export async function copyS3File(sourcePath: string, destPath: string): Promise<void> {
  await copy({ source: { path: sourcePath }, destination: { path: destPath } });
  // Best-effort thumbnail copy
  await copy({
    source: { path: getThumbnailPath(sourcePath) },
    destination: { path: getThumbnailPath(destPath) },
  }).catch(() => undefined);
}

export async function downloadFolder(folderPath: string): Promise<void> {
  const result = await list({ path: folderPath, options: { listAll: true } });
  const files = result.items.filter((item) => !item.path.endsWith(FOLDER_MARKER_FILE));

  for (const item of files) {
    const blob = await downloadFile(item.path);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    // Use relative path from folder root as filename, replacing slashes
    const parts = item.path.split('/').filter(Boolean);
    a.download =
      item.path.slice(folderPath.length).replace(/\//g, '_') || parts[parts.length - 1] || 'file';
    a.click();
    // Small delay so the browser queues each download separately
    await new Promise<void>((r) => setTimeout(r, 350));
    URL.revokeObjectURL(url);
  }
}

export async function uploadFile(
  path: string,
  file: File,
  onProgress: (pct: number) => void
): Promise<void> {
  await uploadData({
    path,
    data: file,
    options: {
      contentType: file.type,
      onProgress: ({ transferredBytes, totalBytes }) => {
        if (totalBytes) onProgress(Math.round((transferredBytes / totalBytes) * 100));
      },
    },
  }).result;
}
