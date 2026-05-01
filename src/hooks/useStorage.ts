import { useEffect, useState } from 'react';
import { list, uploadData, remove, downloadData, getUrl } from 'aws-amplify/storage';
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

export async function fetchFolderContents(prefix: string): Promise<FolderContents> {
  const result = await list({ path: prefix, options: { listAll: true } });

  const folderMap = new Map<string, StorageFolder>();
  const files: StorageFile[] = [];

  for (const item of result.items) {
    const rel = item.path.slice(prefix.length);
    if (!rel) continue;

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

export function useFolderContents(path: string) {
  return useQuery({
    queryKey: ['storage', 'list', path],
    queryFn: () => fetchFolderContents(path),
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
    const task = downloadData({ path });

    task.result
      .then(async ({ body }) => {
        const blob = await body.blob();
        if (canceled) return;

        nextObjectUrl = URL.createObjectURL(blob);
        setObjectUrl(nextObjectUrl);
      })
      .catch((err) => {
        if (!canceled) {
          setError(err instanceof Error ? err : new Error('Failed to load file'));
        }
      })
      .finally(() => {
        if (!canceled) setIsLoading(false);
      });

    return () => {
      canceled = true;
      task.cancel();
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

export async function downloadFile(path: string): Promise<Blob> {
  const { body } = await downloadData({ path }).result;
  return body.blob();
}

export async function uploadFile(
  path: string,
  file: File,
  onProgress: (pct: number) => void,
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
