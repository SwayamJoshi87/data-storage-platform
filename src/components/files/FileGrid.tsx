import { useState } from 'react';
import { FolderOpen } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { FileCard } from '@/components/files/FileCard';
import { MediaViewer } from '@/components/files/MediaViewer';
import { useVaultFiles, useDeleteFile } from '@/hooks/useApi';
import { useFileBrowserStore } from '@/store/useFileBrowserStore';
import { getFileCategory } from '@/lib/fileUtils';
import { cn } from '@/lib/utils';
import type { VaultFile } from '@/hooks/useApi';

function GridSkeleton() {
  return (
    <>
      {Array.from({ length: 12 }).map((_, i) => (
        <Skeleton key={i} className="h-44 w-full rounded-xl" />
      ))}
    </>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-1 px-2">
      {Array.from({ length: 8 }).map((_, i) => (
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
        <p className="font-medium text-muted-foreground">No files yet</p>
        <p className="text-sm text-muted-foreground/60">Upload files or drag them here</p>
      </div>
    </div>
  );
}

interface FileGridProps {
  vaultId: string;
}

export function FileGrid({ vaultId }: FileGridProps) {
  const [mediaViewerFileId, setMediaViewerFileId] = useState<string | null>(null);

  const {
    selectedFileId, setSelectedFileId,
    viewMode, sortOrder, searchQuery, tierFilter,
  } = useFileBrowserStore();

  const { data, isLoading, error } = useVaultFiles(vaultId);
  const { mutate: deleteFile } = useDeleteFile();

  const allFiles = data?.files ?? [];

  // Filter
  const filtered = allFiles.filter((f) => {
    const matchesSearch = f.path.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTier = tierFilter === 'all' || f.storageTier === tierFilter;
    return matchesSearch && matchesTier;
  });

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    const cmp = a.path.localeCompare(b.path);
    return sortOrder === 'asc' ? cmp : -cmp;
  });

  const mediaFiles = sorted.filter((f) => {
    const cat = getFileCategory(f.path);
    return (cat === 'image' || cat === 'video') && (f.storageTier === 'hot' || f.storageTier === 'warm');
  });

  const openFile = (file: VaultFile) => {
    const cat = getFileCategory(file.path);
    if ((cat === 'image' || cat === 'video') && (file.storageTier === 'hot' || file.storageTier === 'warm')) {
      setMediaViewerFileId(file.id);
    } else {
      setSelectedFileId(file.id);
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
        <p className="font-medium text-destructive">Failed to load files</p>
        <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {viewMode === 'grid' ? (
        <div className={cn('grid gap-3 p-4',
          'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6')}>
          {isLoading ? (
            <GridSkeleton />
          ) : sorted.length === 0 ? (
            <EmptyState />
          ) : (
            sorted.map((file) => (
              <FileCard
                key={file.id}
                file={file}
                isSelected={selectedFileId === file.id}
                onOpen={openFile}
                onInfo={(f) => setSelectedFileId(f.id)}
                onDelete={(id) => deleteFile(id)}
                viewMode="grid"
              />
            ))
          )}
        </div>
      ) : (
        <div className="flex flex-col p-2">
          {isLoading ? (
            <ListSkeleton />
          ) : sorted.length === 0 ? (
            <EmptyState />
          ) : (
            sorted.map((file) => (
              <FileCard
                key={file.id}
                file={file}
                isSelected={selectedFileId === file.id}
                onOpen={openFile}
                onInfo={(f) => setSelectedFileId(f.id)}
                onDelete={(id) => deleteFile(id)}
                viewMode="list"
              />
            ))
          )}
        </div>
      )}

      <MediaViewer
        files={mediaFiles}
        openFileId={mediaViewerFileId}
        onOpenFileIdChange={setMediaViewerFileId}
        onShowInfo={(id) => setSelectedFileId(id)}
      />
    </div>
  );
}
