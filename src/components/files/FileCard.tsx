import { useState } from 'react';
import {
  Check,
  Download,
  File,
  FileArchive,
  FileAudio,
  FileImage,
  FileText,
  FileVideo,
  Folder,
  Info,
  Play,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { getFileCategory, formatFileSize, type FileCategory } from '@/lib/fileUtils';
import { getThumbnailPath } from '@/lib/thumbnailUtils';
import { downloadFile, useFileObjectUrl } from '@/hooks/useStorage';
import type { StorageFile, StorageFolder } from '@/hooks/useStorage';
import { useFileBrowserStore, canWritePath } from '@/store/useFileBrowserStore';
import { useLongPress } from '@/hooks/useLongPress';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function FileIcon({ category, className }: { category: FileCategory; className?: string }) {
  const cls = cn('size-8', className);
  switch (category) {
    case 'image': return <FileImage className={cn(cls, 'text-emerald-400')} />;
    case 'video': return <FileVideo className={cn(cls, 'text-purple-400')} />;
    case 'audio': return <FileAudio className={cn(cls, 'text-pink-400')} />;
    case 'pdf': return <FileText className={cn(cls, 'text-red-400')} />;
    case 'text': return <FileText className={cn(cls, 'text-blue-400')} />;
    case 'archive': return <FileArchive className={cn(cls, 'text-amber-400')} />;
    default: return <File className={cn(cls, 'text-muted-foreground')} />;
  }
}

function ImageThumbnail({ path, name }: { path: string; name: string }) {
  const { data: url, isLoading } = useFileObjectUrl(path);
  const [error, setError] = useState(false);
  if (isLoading) return <Skeleton className="size-full rounded-none" />;
  if (!url || error) return <FileImage className="size-10 text-emerald-400 opacity-50" />;
  return (
    <img src={url} alt={name} className="size-full object-cover" onError={() => setError(true)} loading="lazy" />
  );
}

function VideoThumbnail({ path, name }: { path: string; name: string }) {
  const { data: url, isLoading, error } = useFileObjectUrl(getThumbnailPath(path));
  const [imageError, setImageError] = useState(false);
  if (isLoading) return <Skeleton className="size-full rounded-none" />;
  return (
    <div className="flex size-full items-center justify-center bg-muted/30">
      {url && !error && !imageError ? (
        <img src={url} alt={name} className="size-full object-cover" loading="lazy" onError={() => setImageError(true)} />
      ) : (
        <FileVideo className="size-10 text-purple-400 opacity-60" />
      )}
      <div className="absolute inset-0 flex items-center justify-center bg-black/10">
        <div className="flex size-8 items-center justify-center rounded-full bg-black/50 shadow-sm backdrop-blur-sm">
          <Play className="ml-0.5 size-3.5 fill-white text-white" />
        </div>
      </div>
    </div>
  );
}

// Round checkbox used in selection mode and on hover (desktop)
function SelectCircle({ checked }: { checked: boolean }) {
  return (
    <div
      className={cn(
        'flex size-5 items-center justify-center rounded-full border-2 transition-all',
        checked
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-white/70 bg-black/40 backdrop-blur-sm',
      )}
    >
      {checked && <Check className="size-3 stroke-[3]" />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// FolderCard
// ---------------------------------------------------------------------------

interface FolderCardProps {
  folder: StorageFolder;
  onNavigate: (path: string) => void;
  onDelete?: (folder: StorageFolder) => void;
  onDownload?: (path: string) => void;
  viewMode: 'grid' | 'list';
  isSelecting: boolean;
  isMultiSelected: boolean;
  onLongPress: () => void;
  onToggleSelect: () => void;
}

export function FolderCard({
  folder,
  onNavigate,
  onDelete,
  onDownload,
  viewMode,
  isSelecting,
  isMultiSelected,
  onLongPress,
  onToggleSelect,
}: FolderCardProps) {
  const { isAdmin, identityId } = useFileBrowserStore();
  const canDelete = Boolean(onDelete) && canWritePath(folder.path, { isAdmin, identityId });
  const longPress = useLongPress(onLongPress);

  const handleClick = (e: React.MouseEvent) => {
    // Ctrl/⌘+click enters or toggles selection on desktop
    if (e.ctrlKey || e.metaKey) {
      if (!isSelecting) onLongPress();
      else onToggleSelect();
      return;
    }
    if (isSelecting) { onToggleSelect(); return; }
    onNavigate(folder.path);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (isSelecting) onToggleSelect();
      else onNavigate(folder.path);
    }
  };

  const handleDelete = (e: React.MouseEvent) => { e.stopPropagation(); onDelete?.(folder); };
  const handleDownload = (e: React.MouseEvent) => { e.stopPropagation(); onDownload?.(folder.path); };

  if (viewMode === 'list') {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        {...longPress}
        className={cn(
          'group flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent',
          isMultiSelected && 'bg-accent ring-1 ring-primary',
        )}
      >
        {/* Desktop hover checkbox */}
        <span className="relative shrink-0">
          <Folder className={cn('size-5 text-amber-400 transition-opacity', isSelecting ? 'hidden' : 'block sm:group-hover:opacity-0')} />
          <span
            onClick={(e) => { e.stopPropagation(); isSelecting ? onToggleSelect() : onLongPress(); }}
            className={cn(
              'absolute inset-0 flex items-center justify-center',
              isSelecting ? 'flex' : 'hidden sm:flex sm:opacity-0 sm:group-hover:opacity-100',
            )}
          >
            <SelectCircle checked={isMultiSelected} />
          </span>
        </span>
        <span className="flex-1 truncate text-sm font-medium">{folder.name}</span>
        <span className="text-xs text-muted-foreground">Folder</span>
        {!isSelecting && onDownload && (
          <Button variant="ghost" size="icon" className="size-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100" title="Download folder" onClick={handleDownload}>
            <Download className="size-3.5" />
          </Button>
        )}
        {!isSelecting && canDelete && (
          <Button variant="ghost" size="icon" className="size-7 shrink-0 text-destructive opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100" title="Delete folder" onClick={handleDelete}>
            <Trash2 className="size-3.5" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      {...longPress}
      className={cn(
        'group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border border-border/50 bg-card text-left transition-all hover:border-amber-400/20 hover:shadow-md select-none',
        isMultiSelected && 'border-primary ring-2 ring-primary',
      )}
    >
      <div className="relative flex h-32 w-full items-center justify-center bg-muted/20">
        <Folder className="size-12 text-amber-400 transition-transform group-hover:scale-110" />

        {/* Checkbox — desktop: fades in on hover; always visible in select mode */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); isSelecting ? onToggleSelect() : onLongPress(); }}
          className={cn(
            'absolute left-2 top-2 z-10 transition-opacity',
            isSelecting
              ? 'opacity-100'
              : 'hidden sm:flex opacity-0 group-hover:opacity-100',
          )}
          title="Select"
        >
          <SelectCircle checked={isMultiSelected} />
        </button>

        {/* Desktop hover actions */}
        {!isSelecting && (
          <div className="absolute right-2 top-2 hidden gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 sm:flex">
            {onDownload && (
              <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:bg-muted hover:text-foreground" title="Download folder" onClick={handleDownload}>
                <Download className="size-3.5" />
              </Button>
            )}
            {canDelete && (
              <Button variant="ghost" size="icon" className="size-7 text-destructive hover:bg-destructive/15 hover:text-destructive" title="Delete folder" onClick={handleDelete}>
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="px-3 py-2">
        <p className="truncate text-center text-xs font-medium">{folder.name}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FileCard
// ---------------------------------------------------------------------------

interface FileCardProps {
  file: StorageFile;
  isSelected: boolean;
  onOpen: (path: string) => void;
  onInfo: (path: string) => void;
  onDelete: (path: string) => void;
  viewMode: 'grid' | 'list';
  isSelecting: boolean;
  isMultiSelected: boolean;
  onLongPress: () => void;
  onToggleSelect: () => void;
}

export function FileCard({
  file,
  isSelected,
  onOpen,
  onInfo,
  onDelete,
  viewMode,
  isSelecting,
  isMultiSelected,
  onLongPress,
  onToggleSelect,
}: FileCardProps) {
  const category = getFileCategory(file.name);
  const { isAdmin, identityId } = useFileBrowserStore();
  const canDelete = canWritePath(file.path, { isAdmin, identityId });
  const longPress = useLongPress(onLongPress);

  const handleClick = (e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      if (!isSelecting) onLongPress();
      else onToggleSelect();
      return;
    }
    if (isSelecting) { onToggleSelect(); return; }
    onOpen(file.path);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (isSelecting) onToggleSelect();
      else onOpen(file.path);
    }
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const blob = await downloadFile(file.path);
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  };

  const handleDelete = (e: React.MouseEvent) => { e.stopPropagation(); onDelete(file.path); };
  const handleInfo = (e: React.MouseEvent) => { e.stopPropagation(); onInfo(file.path); };

  if (viewMode === 'list') {
    return (
      <div
        role="button"
        tabIndex={0}
        aria-pressed={isMultiSelected || isSelected}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        {...longPress}
        className={cn(
          'group flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent select-none',
          isSelected && !isSelecting && 'bg-accent ring-1 ring-ring',
          isMultiSelected && 'bg-accent ring-1 ring-primary',
        )}
      >
        {/* Desktop hover checkbox overlaid on icon */}
        <span className="relative shrink-0">
          <FileIcon category={category} className={cn('size-5', isSelecting ? 'hidden' : 'block sm:group-hover:opacity-0')} />
          <span
            onClick={(e) => { e.stopPropagation(); isSelecting ? onToggleSelect() : onLongPress(); }}
            className={cn(
              'absolute inset-0 flex items-center justify-center',
              isSelecting ? 'flex' : 'hidden sm:flex sm:opacity-0 sm:group-hover:opacity-100',
            )}
          >
            <SelectCircle checked={isMultiSelected} />
          </span>
        </span>
        <span className="flex-1 truncate text-sm">{file.name}</span>
        <span className="w-20 text-right text-xs text-muted-foreground">{formatFileSize(file.size)}</span>
        {!isSelecting && (
          <div className="hidden shrink-0 gap-1 opacity-0 transition-opacity sm:flex sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
            <Button variant="ghost" size="icon" className="size-7" title="File info" onClick={handleInfo}>
              <Info className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="size-7" title="Download" onClick={handleDownload}>
              <Download className="size-3.5" />
            </Button>
            {canDelete && (
              <Button variant="ghost" size="icon" className="size-7 text-destructive hover:bg-destructive/15" onClick={handleDelete}>
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isMultiSelected || isSelected}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      {...longPress}
      className={cn(
        'group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border border-border/50 bg-card text-left transition-all hover:border-border hover:shadow-md select-none',
        isSelected && !isSelecting && 'border-primary ring-1 ring-primary',
        isMultiSelected && 'border-primary ring-2 ring-primary',
      )}
    >
      <div className="relative flex h-32 w-full items-center justify-center bg-muted/30">
        {category === 'image' ? (
          <ImageThumbnail path={file.path} name={file.name} />
        ) : category === 'video' ? (
          <VideoThumbnail path={file.path} name={file.name} />
        ) : (
          <FileIcon category={category} />
        )}

        {/* Checkbox — desktop: fades in on hover; always visible in select mode */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); isSelecting ? onToggleSelect() : onLongPress(); }}
          className={cn(
            'absolute left-2 top-2 z-10 transition-opacity',
            isSelecting
              ? 'opacity-100'
              : 'hidden sm:flex opacity-0 group-hover:opacity-100',
          )}
          title="Select"
        >
          <SelectCircle checked={isMultiSelected} />
        </button>

        {/* Desktop hover action buttons */}
        {!isSelecting && (
          <div className="absolute right-2 top-2 z-10 hidden gap-1 rounded-lg bg-black/60 p-1 opacity-0 shadow-sm backdrop-blur-sm transition-opacity sm:flex sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
            <Button variant="ghost" size="icon" className="size-6 text-white hover:bg-white/20 hover:text-white" title="File info" onClick={handleInfo}>
              <Info className="size-3" />
            </Button>
            <Button variant="ghost" size="icon" className="size-6 text-white hover:bg-white/20 hover:text-white" title="Download" onClick={handleDownload}>
              <Download className="size-3" />
            </Button>
            {canDelete && (
              <Button variant="ghost" size="icon" className="size-6 text-red-400 hover:bg-red-500/20 hover:text-red-300" title="Delete" onClick={handleDelete}>
                <Trash2 className="size-3" />
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="px-3 py-2">
        <p className="truncate text-xs font-medium">{file.name}</p>
        <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
      </div>
    </div>
  );
}
