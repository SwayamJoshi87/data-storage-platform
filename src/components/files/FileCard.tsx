import {
  File, FileArchive, FileAudio, FileImage, FileText, FileVideo,
  Flame, Info, Lock, Snowflake, Thermometer, Trash2, Wind,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getFileCategory, formatFileSize, type FileCategory } from '@/lib/fileUtils';
import type { VaultFile, Tier } from '@/hooks/useApi';

// ---- Tier badge ------------------------------------------------------------

const TIER_META: Record<Tier, { label: string; icon: React.ElementType; className: string }> = {
  hot:    { label: 'Hot',    icon: Flame,       className: 'text-orange-400 border-orange-500/30 bg-orange-500/10' },
  warm:   { label: 'Warm',   icon: Thermometer, className: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10' },
  cold:   { label: 'Cold',   icon: Wind,        className: 'text-blue-400   border-blue-500/30   bg-blue-500/10'   },
  frozen: { label: 'Frozen', icon: Snowflake,   className: 'text-indigo-400 border-indigo-500/30 bg-indigo-500/10' },
};

export function TierBadge({ tier, className }: { tier: Tier; className?: string }) {
  const { label, icon: Icon, className: base } = TIER_META[tier];
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium', base, className)}>
      <Icon className="size-2.5" />
      {label}
    </span>
  );
}

// ---- File icon -------------------------------------------------------------

function FileIcon({ category, className }: { category: FileCategory; className?: string }) {
  const cls = cn('size-8', className);
  switch (category) {
    case 'image':   return <FileImage   className={cn(cls, 'text-emerald-400')} />;
    case 'video':   return <FileVideo   className={cn(cls, 'text-purple-400')}  />;
    case 'audio':   return <FileAudio   className={cn(cls, 'text-pink-400')}    />;
    case 'pdf':     return <FileText    className={cn(cls, 'text-red-400')}     />;
    case 'text':    return <FileText    className={cn(cls, 'text-blue-400')}    />;
    case 'archive': return <FileArchive className={cn(cls, 'text-amber-400')}   />;
    default:        return <File        className={cn(cls, 'text-muted-foreground')} />;
  }
}

// ---- Card ------------------------------------------------------------------

interface FileCardProps {
  file: VaultFile;
  isSelected: boolean;
  onOpen: (file: VaultFile) => void;
  onInfo: (file: VaultFile) => void;
  onDelete: (fileId: string) => void;
  viewMode: 'grid' | 'list';
}

export function FileCard({ file, isSelected, onOpen, onInfo, onDelete, viewMode }: FileCardProps) {
  const category = getFileCategory(file.path);
  const isLocked = file.storageTier === 'cold' || file.storageTier === 'frozen';

  if (viewMode === 'list') {
    return (
      <div
        className={cn(
          'group flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-accent/50',
          isSelected && 'bg-accent',
        )}
      >
        <FileIcon category={category} className="size-4 shrink-0" />
        <span className="flex-1 truncate text-sm">{file.path}</span>
        <span className="shrink-0 text-xs text-muted-foreground">{formatFileSize(file.sizeBytes)}</span>
        <TierBadge tier={file.storageTier} />
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {isLocked ? (
            <Button variant="outline" size="sm" className="h-6 gap-1 px-2 text-xs" onClick={() => onInfo(file)}>
              <Lock className="size-3" /> Access
            </Button>
          ) : (
            <Button variant="ghost" size="icon" className="size-6" onClick={() => onOpen(file)}>
              <FileImage className="size-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="size-6" onClick={() => onInfo(file)}>
            <Info className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-6 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => onDelete(file.id)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group relative flex flex-col gap-2 rounded-xl border bg-card p-3 transition-colors hover:border-primary/30 hover:bg-accent/40',
        isSelected && 'border-primary/50 bg-accent',
      )}
    >
      {/* Preview area */}
      <button
        type="button"
        className="flex h-28 w-full items-center justify-center rounded-lg bg-muted/40"
        onClick={() => isLocked ? onInfo(file) : onOpen(file)}
        title={isLocked ? 'In cold storage — request access' : 'Preview'}
      >
        {isLocked ? (
          <div className="flex flex-col items-center gap-1.5">
            <Lock className="size-8 text-muted-foreground/50" />
            <span className="text-xs text-muted-foreground">Cold storage</span>
          </div>
        ) : (
          <FileIcon category={category} />
        )}
      </button>

      {/* Name + tier */}
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{file.path}</p>
        <div className="mt-1 flex items-center justify-between gap-1">
          <span className="text-xs text-muted-foreground">{formatFileSize(file.sizeBytes)}</span>
          <TierBadge tier={file.storageTier} />
        </div>
      </div>

      {/* Actions — visible on hover */}
      <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Button variant="secondary" size="icon" className="size-6 shadow-sm" onClick={() => onInfo(file)}>
          <Info className="size-3.5" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="size-6 shadow-sm text-destructive hover:bg-destructive hover:text-destructive-foreground"
          onClick={() => onDelete(file.id)}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
