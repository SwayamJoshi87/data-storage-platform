import { useCallback, useEffect, useState } from 'react';
import { Clipboard, Copy, Download, FolderOpen, Trash2, X } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { FileCard, FolderCard } from '@/components/files/FileCard';
import { DeleteFolderDialog } from '@/components/files/DeleteFolderDialog';
import { MediaViewer } from '@/components/files/MediaViewer';
import {
  useFolderContents,
  useDeleteFile,
  useDeleteFolder,
  downloadFile,
  downloadFolder,
  copyS3File,
} from '@/hooks/useStorage';
import { useFileBrowserStore, canWritePath } from '@/store/useFileBrowserStore';
import { useQueryClient } from '@tanstack/react-query';
import { getFileCategory } from '@/lib/fileUtils';
import { cn } from '@/lib/utils';
import type { StorageFile, StorageFolder } from '@/hooks/useStorage';

// ---------------------------------------------------------------------------
// Loading / empty states
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Selection toolbar
// ---------------------------------------------------------------------------

interface SelectionToolbarProps {
  count: number;
  total: number;
  hasFiles: boolean;
  canDeleteAll: boolean;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onCopy: () => void;
  onDownload: () => void;
  onDelete: () => void;
  onExit: () => void;
}

function SelectionToolbar({
  count,
  total,
  hasFiles,
  canDeleteAll,
  onSelectAll,
  onDeselectAll,
  onCopy,
  onDownload,
  onDelete,
  onExit,
}: SelectionToolbarProps) {
  return (
    <div className="sticky top-0 z-20 flex shrink-0 items-center gap-1 border-b bg-background/95 px-2 py-1.5 backdrop-blur-sm">
      <Button
        variant="ghost"
        size="icon"
        onClick={onExit}
        className="size-8 shrink-0"
        title="Exit (Esc)"
      >
        <X className="size-4" />
      </Button>

      <span className="min-w-0 shrink-0 text-sm font-medium tabular-nums">
        {count}/{total}
      </span>

      <Separator orientation="vertical" className="mx-1 h-5 shrink-0" />

      <Button variant="ghost" size="sm" className="h-8 shrink-0 text-xs" onClick={onSelectAll}>
        Select all
      </Button>
      <Button variant="ghost" size="sm" className="h-8 shrink-0 text-xs" onClick={onDeselectAll}>
        Deselect all
      </Button>

      {/* Spacer */}
      <span className="flex-1" />

      {/* Actions */}
      <Button
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5 shrink-0"
        disabled={!hasFiles}
        title="Copy selected files"
        onClick={onCopy}
      >
        <Copy className="size-4" />
        <span className="hidden sm:inline text-xs">Copy</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5 shrink-0"
        disabled={!hasFiles}
        title="Download files"
        onClick={onDownload}
      >
        <Download className="size-4" />
        <span className="hidden sm:inline text-xs">Download</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
        disabled={!canDeleteAll}
        title={canDeleteAll ? 'Delete selected' : 'No permission'}
        onClick={onDelete}
      >
        <Trash2 className="size-4" />
        <span className="hidden sm:inline text-xs">Delete</span>
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FileGrid
// ---------------------------------------------------------------------------

export function FileGrid() {
  const [folderToDelete, setFolderToDelete] = useState<StorageFolder | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());

  const {
    currentPath,
    identityId,
    isAdmin,
    setCurrentPath,
    selectedFilePath,
    setSelectedFilePath,
    mediaViewerPath,
    setMediaViewerPath,
    viewMode,
    sortField,
    sortOrder,
    searchQuery,
    clipboardPaths,
    setClipboardPaths,
  } = useFileBrowserStore();

  const qc = useQueryClient();
  const resolvedPath = currentPath === 'private/' && !identityId ? '' : currentPath;
  const { data, isLoading, error } = useFolderContents(resolvedPath);
  const deleteFileMutation = useDeleteFile();
  const deleteFolderMutation = useDeleteFolder();
  const canUpload = canWritePath(currentPath, { isAdmin, identityId });

  // ------------------------------------------------------------------
  // Sorting / filtering
  // ------------------------------------------------------------------

  const sortFiles = (files: StorageFile[]) =>
    [...files].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortField === 'size') cmp = (a.size ?? 0) - (b.size ?? 0);
      else if (sortField === 'lastModified')
        cmp = (a.lastModified?.getTime() ?? 0) - (b.lastModified?.getTime() ?? 0);
      return sortOrder === 'asc' ? cmp : -cmp;
    });

  const filtered = data
    ? {
        folders: data.folders.filter((f) =>
          f.name.toLowerCase().includes(searchQuery.toLowerCase())
        ),
        files: sortFiles(
          data.files.filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
        ),
      }
    : null;

  const mediaFiles =
    filtered?.files.filter((file) => {
      const cat = getFileCategory(file.name);
      return cat === 'image' || cat === 'video';
    }) ?? [];

  // ------------------------------------------------------------------
  // Selection helpers
  // ------------------------------------------------------------------

  // ------------------------------------------------------------------
  // In-app clipboard (Ctrl+C to copy selected, click banner to paste)
  // ------------------------------------------------------------------

  const handlePaste = useCallback(async () => {
    if (!canUpload || clipboardPaths.length === 0) return;
    const filePaths = clipboardPaths.filter((p) => !p.endsWith('/'));
    for (const src of filePaths) {
      const parts = src.split('/').filter(Boolean);
      const filename = parts[parts.length - 1] ?? 'file';
      let destPath = currentPath + filename;
      // Avoid overwriting self if pasting into the same folder
      if (destPath === src) {
        const dot = filename.lastIndexOf('.');
        const base = dot >= 0 ? filename.slice(0, dot) : filename;
        const ext = dot >= 0 ? filename.slice(dot) : '';
        destPath = currentPath + base + ' (copy)' + ext;
      }
      await copyS3File(src, destPath).catch(() => undefined);
    }
    qc.invalidateQueries({ queryKey: ['storage', 'list', currentPath] });
    setClipboardPaths([]);
  }, [canUpload, clipboardPaths, currentPath, qc, setClipboardPaths]);

  // Ctrl+C when in selection mode → copy selected files to app clipboard
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 'c' && selectMode && selectedPaths.size > 0) {
        setClipboardPaths([...selectedPaths].filter((p) => !p.endsWith('/')));
      }
      // Escape exits selection mode
      if (e.key === 'Escape' && selectMode) exitSelectMode();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectMode, selectedPaths, setClipboardPaths]);

  // ------------------------------------------------------------------
  // Selection helpers
  // ------------------------------------------------------------------

  const enterSelectMode = (path: string) => {
    setSelectMode(true);
    setSelectedPaths(new Set([path]));
  };

  const toggleSelect = (path: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedPaths(new Set());
  };

  // All selectable paths in the current view (folders + files)
  const allSelectablePaths = filtered
    ? [...filtered.folders.map((f) => f.path), ...filtered.files.map((f) => f.path)]
    : [];

  const selectAll = () => setSelectedPaths(new Set(allSelectablePaths));
  const deselectAll = () => setSelectedPaths(new Set());

  // Ctrl+A to select all when in selection mode
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && selectMode) {
        e.preventDefault();
        selectAll();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectMode, allSelectablePaths.join(',')]);

  // Paths where user has write permission
  const canDeletePath = (path: string) => canWritePath(path, { isAdmin, identityId });
  const canDeleteAll = selectedPaths.size > 0 && [...selectedPaths].every(canDeletePath);

  // Whether any selected item is a file (not a folder)
  const hasFiles = [...selectedPaths].some((p) => !p.endsWith('/'));

  // ------------------------------------------------------------------
  // Bulk actions
  // ------------------------------------------------------------------

  const handleBulkDownload = async () => {
    const filePaths = [...selectedPaths].filter((p) => !p.endsWith('/'));
    for (const path of filePaths) {
      const blob = await downloadFile(path);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const parts = path.split('/').filter(Boolean);
      a.download = parts[parts.length - 1] ?? 'file';
      a.click();
      await new Promise<void>((r) => setTimeout(r, 300));
      URL.revokeObjectURL(url);
    }
  };

  const handleBulkDelete = async () => {
    const label = selectedPaths.size === 1 ? '1 item' : `${selectedPaths.size} items`;
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;

    const filePaths = [...selectedPaths].filter((p) => !p.endsWith('/'));
    const folderPaths = [...selectedPaths].filter((p) => p.endsWith('/'));

    await Promise.all(filePaths.map((p) => deleteFileMutation.mutateAsync(p)));
    for (const fp of folderPaths) {
      await deleteFolderMutation.mutateAsync(fp);
    }

    exitSelectMode();
  };

  // ------------------------------------------------------------------
  // Normal (non-selection) file actions
  // ------------------------------------------------------------------

  const openFile = (path: string) => {
    const file = filtered?.files.find((item) => item.path === path);
    const cat = file ? getFileCategory(file.name) : 'other';
    if (cat === 'image' || cat === 'video') {
      setMediaViewerPath(path);
      return;
    }
    setSelectedFilePath(path);
  };

  const showFileInfo = (path: string) => setSelectedFilePath(path);

  const handleFolderDownload = (folderPath: string) => {
    downloadFolder(folderPath);
  };

  const isEmpty = filtered && filtered.folders.length === 0 && filtered.files.length === 0;

  // ------------------------------------------------------------------
  // Shared card props helpers
  // ------------------------------------------------------------------

  const folderCardProps = (folder: StorageFolder) => ({
    folder,
    onNavigate: setCurrentPath,
    onDelete: setFolderToDelete,
    onDownload: handleFolderDownload,
    viewMode: viewMode as 'grid' | 'list',
    isSelecting: selectMode,
    isMultiSelected: selectedPaths.has(folder.path),
    onLongPress: () => enterSelectMode(folder.path),
    onToggleSelect: () => toggleSelect(folder.path),
  });

  const fileCardProps = (file: StorageFile) => ({
    file,
    isSelected: selectedFilePath === file.path,
    onOpen: openFile,
    onInfo: showFileInfo,
    onDelete: deleteFileMutation.mutate,
    viewMode: viewMode as 'grid' | 'list',
    isSelecting: selectMode,
    isMultiSelected: selectedPaths.has(file.path),
    onLongPress: () => enterSelectMode(file.path),
    onToggleSelect: () => toggleSelect(file.path),
  });

  // ------------------------------------------------------------------
  // Error state
  // ------------------------------------------------------------------

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
        <p className="font-medium text-destructive">Failed to load folder</p>
        <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  const handleCopy = () => {
    setClipboardPaths([...selectedPaths].filter((p) => !p.endsWith('/')));
    exitSelectMode();
  };

  const toolbar = selectMode ? (
    <SelectionToolbar
      count={selectedPaths.size}
      total={allSelectablePaths.length}
      hasFiles={hasFiles}
      canDeleteAll={canDeleteAll}
      onSelectAll={selectAll}
      onDeselectAll={deselectAll}
      onCopy={handleCopy}
      onDownload={handleBulkDownload}
      onDelete={handleBulkDelete}
      onExit={exitSelectMode}
    />
  ) : null;

  // Paste banner — shown when the in-app clipboard has files and user can write here
  const pasteBanner =
    !selectMode && clipboardPaths.length > 0 && canUpload ? (
      <div className="sticky top-0 z-20 flex items-center gap-2 border-b bg-primary/8 px-4 py-2 text-sm backdrop-blur-sm">
        <Clipboard className="size-4 shrink-0 text-primary" />
        <span className="flex-1 text-primary">
          {clipboardPaths.length} file{clipboardPaths.length === 1 ? '' : 's'} copied — paste here
        </span>
        <Button size="sm" onClick={handlePaste} className="h-7 gap-1.5">
          Paste
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-7 text-muted-foreground"
          onClick={() => setClipboardPaths([])}
        >
          <X className="size-3.5" />
        </Button>
      </div>
    ) : null;

  const shared = (
    <>
      <MediaViewer
        files={mediaFiles}
        openPath={mediaViewerPath}
        onOpenPathChange={setMediaViewerPath}
        onShowInfo={showFileInfo}
      />
      <DeleteFolderDialog
        folder={folderToDelete}
        onOpenChange={(open) => !open && setFolderToDelete(null)}
      />
    </>
  );

  if (viewMode === 'grid') {
    return (
      <div className="flex flex-col">
        {toolbar}
        {pasteBanner}
        <div
          className={cn(
            'grid gap-3 p-4',
            'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
          )}
        >
          {isLoading ? (
            <GridSkeleton />
          ) : isEmpty ? (
            <EmptyState />
          ) : (
            <>
              {filtered!.folders.map((folder) => (
                <FolderCard key={folder.path} {...folderCardProps(folder)} />
              ))}
              {filtered!.files.map((file) => (
                <FileCard key={file.path} {...fileCardProps(file)} />
              ))}
            </>
          )}
        </div>
        {shared}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {toolbar}
      {pasteBanner}
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
                  <FolderCard key={folder.path} {...folderCardProps(folder)} />
                ))}
              </div>
            )}
            {filtered!.files.length > 0 && (
              <div>
                <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Files
                </p>
                {filtered!.files.map((file) => (
                  <FileCard key={file.path} {...fileCardProps(file)} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
      {shared}
    </div>
  );
}
