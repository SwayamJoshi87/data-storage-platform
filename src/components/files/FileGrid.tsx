import { Skeleton } from '@/components/ui/skeleton';
import { FolderOpen } from 'lucide-react';
import { FileCard, FolderCard } from '@/components/files/FileCard';
import { useFolderContents } from '@/hooks/useStorage';
import { useDeleteFile } from '@/hooks/useStorage';
import { useFileBrowserStore } from '@/store/useFileBrowserStore';
import { cn } from '@/lib/utils';
import type { StorageFile } from '@/hooks/useStorage';

function GridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-44 w-full rounded-xl" />
      ))}
    </>
  );
}

function ListSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-1 px-2">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full rounded-lg" />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="col-span-full flex flex-col items-center justify-center gap-3 py-20 text-center">
      <FolderOpen className="size-12 text-muted-foreground/40" />
      <div>
        <p className="font-medium text-muted-foreground">This folder is empty</p>
        <p className="text-sm text-muted-foreground/60">Upload files or drag them here</p>
      </div>
    </div>
  );
}

export function FileGrid() {
  const {
    currentPath,
    setCurrentPath,
    selectedFilePath,
    setSelectedFilePath,
    viewMode,
    sortField,
    sortOrder,
    searchQuery,
  } = useFileBrowserStore();

  const { data, isLoading, error } = useFolderContents(currentPath);
  const { mutate: deleteFile } = useDeleteFile();

  const sortFiles = (files: StorageFile[]) => {
    return [...files].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortField === 'size') cmp = (a.size ?? 0) - (b.size ?? 0);
      else if (sortField === 'lastModified')
        cmp = (a.lastModified?.getTime() ?? 0) - (b.lastModified?.getTime() ?? 0);
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  };

  const filtered = data
    ? {
        folders: data.folders.filter((f) =>
          f.name.toLowerCase().includes(searchQuery.toLowerCase()),
        ),
        files: sortFiles(
          data.files.filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase())),
        ),
      }
    : null;

  const isEmpty = filtered && filtered.folders.length === 0 && filtered.files.length === 0;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
        <p className="font-medium text-destructive">Failed to load folder</p>
        <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
      </div>
    );
  }

  if (viewMode === 'grid') {
    return (
      <div
        className={cn(
          'grid gap-3 p-4',
          'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6',
        )}
      >
        {isLoading ? (
          <GridSkeleton />
        ) : isEmpty ? (
          <EmptyState />
        ) : (
          <>
            {filtered!.folders.map((folder) => (
              <FolderCard
                key={folder.path}
                folder={folder}
                onNavigate={setCurrentPath}
                viewMode="grid"
              />
            ))}
            {filtered!.files.map((file) => (
              <FileCard
                key={file.path}
                file={file}
                isSelected={selectedFilePath === file.path}
                onSelect={setSelectedFilePath}
                onDelete={deleteFile}
                viewMode="grid"
              />
            ))}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col p-2">
      {isLoading ? (
        <ListSkeleton />
      ) : isEmpty ? (
        <EmptyState />
      ) : (
        <>
          {filtered!.folders.length > 0 && (
            <div className="mb-1">
              <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Folders
              </p>
              {filtered!.folders.map((folder) => (
                <FolderCard
                  key={folder.path}
                  folder={folder}
                  onNavigate={setCurrentPath}
                  viewMode="list"
                />
              ))}
            </div>
          )}
          {filtered!.files.length > 0 && (
            <div>
              <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Files
              </p>
              {filtered!.files.map((file) => (
                <FileCard
                  key={file.path}
                  file={file}
                  isSelected={selectedFilePath === file.path}
                  onSelect={setSelectedFilePath}
                  onDelete={deleteFile}
                  viewMode="list"
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
