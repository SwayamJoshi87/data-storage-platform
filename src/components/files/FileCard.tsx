import { useState } from 'react';
import {
  Folder,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  File,
  Download,
  Trash2,
  Play,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { getFileCategory, formatFileSize, type FileCategory } from '@/lib/fileUtils';
import { getThumbnailPath } from '@/lib/thumbnailUtils';
import { downloadFile, useFileObjectUrl } from '@/hooks/useStorage';
import type { StorageFile, StorageFolder } from '@/hooks/useStorage';
import { useFileBrowserStore, canWritePath } from '@/store/useFileBrowserStore';

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
    <img
      src={url}
      alt={name}
      className="size-full object-cover"
      onError={() => setError(true)}
      loading="lazy"
    />
  );
}

function VideoThumbnail({ path, name }: { path: string; name: string }) {
  const { data: url, isLoading, error } = useFileObjectUrl(getThumbnailPath(path));
  const [imageError, setImageError] = useState(false);

  if (isLoading) return <Skeleton className="size-full rounded-none" />;

  return (
    <div className="flex size-full items-center justify-center bg-muted/30">
      {url && !error && !imageError ? (
        <img
          src={url}
          alt={name}
          className="size-full object-cover"
          loading="lazy"
          onError={() => setImageError(true)}
        />
      ) : (
        <FileVideo className="size-10 text-purple-400 opacity-60" />
      )}
      <div className="absolute inset-0 flex items-center justify-center bg-black/10">
        <div className="flex size-8 items-center justify-center rounded-full bg-background/85 shadow-sm">
          <Play className="ml-0.5 size-3.5 fill-current" />
        </div>
      </div>
    </div>
  );
}

interface FolderCardProps {
  folder: StorageFolder;
  onNavigate: (path: string) => void;
  viewMode: 'grid' | 'list';
}

export function FolderCard({ folder, onNavigate, viewMode }: FolderCardProps) {
  if (viewMode === 'list') {
    return (
      <button
        onClick={() => onNavigate(folder.path)}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent"
      >
        <Folder className="size-5 shrink-0 text-amber-400" />
        <span className="flex-1 truncate text-sm font-medium">{folder.name}</span>
        <span className="text-xs text-muted-foreground">Folder</span>
      </button>
    );
  }

  return (
    <button
      onClick={() => onNavigate(folder.path)}
      className="group flex flex-col items-center gap-2 rounded-xl border border-border/50 bg-card p-4 text-center transition-all hover:border-border hover:bg-accent hover:shadow-md"
    >
      <Folder className="size-12 text-amber-400 transition-transform group-hover:scale-110" />
      <span className="w-full truncate text-xs font-medium">{folder.name}</span>
    </button>
  );
}

interface FileCardProps {
  file: StorageFile;
  isSelected: boolean;
  onOpen: (path: string) => void;
  onInfo: (path: string) => void;
  onDelete: (path: string) => void;
  viewMode: 'grid' | 'list';
}

export function FileCard({ file, isSelected, onOpen, onInfo, onDelete, viewMode }: FileCardProps) {
  const category = getFileCategory(file.name);
  const { isAdmin, identityId } = useFileBrowserStore();
  const canDelete = canWritePath(file.path, { isAdmin, identityId });

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

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(file.path);
  };

  const handleInfo = (e: React.MouseEvent) => {
    e.stopPropagation();
    onInfo(file.path);
  };

  const handleSelectKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen(file.path);
    }
  };

  if (viewMode === 'list') {
    return (
      <div
        role="button"
        tabIndex={0}
        aria-pressed={isSelected}
        onClick={() => onOpen(file.path)}
        onKeyDown={handleSelectKeyDown}
        className={cn(
          'group flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent',
          isSelected && 'bg-accent ring-1 ring-ring',
        )}
      >
        <FileIcon category={category} className="size-5 shrink-0" />
        <span className="flex-1 truncate text-sm">{file.name}</span>
        <span className="w-20 text-right text-xs text-muted-foreground">{formatFileSize(file.size)}</span>
        <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <Button variant="ghost" size="icon" className="size-6" title="File info" onClick={handleInfo}>
            <Info className="size-3" />
          </Button>
          <Button variant="ghost" size="icon" className="size-6" onClick={handleDownload}>
            <Download className="size-3" />
          </Button>
          {canDelete && (
            <Button variant="ghost" size="icon" className="size-6 text-destructive" onClick={handleDelete}>
              <Trash2 className="size-3" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      onClick={() => onOpen(file.path)}
      onKeyDown={handleSelectKeyDown}
      className={cn(
        'group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border border-border/50 bg-card text-left transition-all hover:border-border hover:shadow-md',
        isSelected && 'border-primary ring-1 ring-primary',
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

        <div className="absolute right-2 top-2 z-10 flex gap-1 rounded-lg bg-black/45 p-1 opacity-0 shadow-sm backdrop-blur-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <Button variant="secondary" size="icon" className="size-6 bg-white/90 text-black hover:bg-white" title="File info" onClick={handleInfo}>
            <Info className="size-3" />
          </Button>
          <Button variant="secondary" size="icon" className="size-6 bg-white/90 text-black hover:bg-white" title="Download" onClick={handleDownload}>
            <Download className="size-3" />
          </Button>
          {canDelete && (
            <Button
              variant="secondary"
              size="icon"
              className="size-6 bg-white/90 text-destructive hover:bg-destructive hover:text-destructive-foreground"
              title="Delete"
              onClick={handleDelete}
            >
              <Trash2 className="size-3" />
            </Button>
          )}
        </div>
      </div>

      <div className="px-3 py-2">
        <p className="truncate text-xs font-medium">{file.name}</p>
        <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
      </div>
    </div>
  );
}
