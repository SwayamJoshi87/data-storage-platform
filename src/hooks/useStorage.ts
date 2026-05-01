import { list, getUrl, uploadData, remove } from 'aws-amplify/storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

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

export function useFileUrl(path: string | null) {
  return useQuery({
    queryKey: ['storage', 'url', path],
    queryFn: async () => {
      if (!path) return null;
      const { url } = await getUrl({ path, options: { expiresIn: 3600 } });
      return url.toString();
    },
    enabled: !!path,
    staleTime: 50 * 60 * 1000,
    gcTime: 55 * 60 * 1000,
  });
}

export function useDeleteFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (path: string) => remove({ path }),
    onSuccess: (_, path) => {
      const parent = path.slice(0, path.lastIndexOf('/') + 1);
      qc.invalidateQueries({ queryKey: ['storage', 'list', parent] });
    },
  });
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
