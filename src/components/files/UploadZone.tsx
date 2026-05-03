// @ts-nocheck — migrated in Step 2/7/8
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  Upload,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { uploadFile } from '@/hooks/useStorage';
import { createVideoThumbnail, getThumbnailPath, shouldGenerateThumbnail } from '@/lib/thumbnailUtils';
import { useFileBrowserStore, canWritePath, type UploadItem } from '@/store/useFileBrowserStore';
import { useQueryClient } from '@tanstack/react-query';

const CONCURRENCY = 3;
const WORKER_STAGGER_MS = 400;

// ---------------------------------------------------------------------------
// FileSystem API helpers (folder drag-drop support)
// ---------------------------------------------------------------------------

function getFileFromEntry(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

async function readDirectoryRecursive(
  dir: FileSystemDirectoryEntry,
  basePath: string,
): Promise<Array<{ file: File; targetPath: string }>> {
  const reader = dir.createReader();
  const allEntries: FileSystemEntry[] = [];

  // readEntries returns max 100 at a time — loop until the batch is empty
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) =>
      reader.readEntries(resolve, reject),
    );
    if (batch.length === 0) break;
    allEntries.push(...batch);
  }

  const result: Array<{ file: File; targetPath: string }> = [];
  for (const entry of allEntries) {
    if (entry.isFile) {
      const file = await getFileFromEntry(entry as FileSystemFileEntry);
      result.push({ file, targetPath: basePath + file.name });
    } else if (entry.isDirectory) {
      const sub = await readDirectoryRecursive(
        entry as FileSystemDirectoryEntry,
        basePath + entry.name + '/',
      );
      result.push(...sub);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Upload toast
// ---------------------------------------------------------------------------

function ItemRow({ item, onDismiss }: { item: UploadItem; onDismiss: () => void }) {
  return (
    <div className="flex flex-col gap-1 rounded-md px-2 py-1.5 hover:bg-muted/40">
      <div className="flex items-center gap-2">
        <span className="shrink-0">
          {item.status === 'queued' && <Clock className="size-3.5 text-muted-foreground" />}
          {item.status === 'uploading' && <Loader2 className="size-3.5 animate-spin text-primary" />}
          {item.status === 'done' && <CheckCircle className="size-3.5 text-emerald-500" />}
          {item.status === 'error' && <AlertCircle className="size-3.5 text-destructive" />}
        </span>
        <span className="flex-1 truncate text-xs">{item.name}</span>
        {item.status === 'uploading' && (
          <span className="shrink-0 tabular-nums text-xs text-muted-foreground">{item.progress}%</span>
        )}
        {(item.status === 'done' || item.status === 'error') && (
          <button type="button" onClick={onDismiss} className="shrink-0 rounded p-0.5 hover:bg-muted">
            <X className="size-2.5 text-muted-foreground" />
          </button>
        )}
      </div>
      {item.status === 'uploading' && <Progress value={item.progress} className="h-0.5" />}
      {item.status === 'error' && (
        <p className="text-xs text-destructive">{item.error ?? 'Upload failed'}</p>
      )}
    </div>
  );
}

function UploadToast({
  queue,
  onRemove,
  onClearSettled,
}: {
  queue: UploadItem[];
  onRemove: (id: string) => void;
  onClearSettled: () => void;
}) {
  const [expanded, setExpanded] = useState(true);

  const uploading = queue.filter((u) => u.status === 'uploading');
  const queued = queue.filter((u) => u.status === 'queued');
  const done = queue.filter((u) => u.status === 'done');
  const errors = queue.filter((u) => u.status === 'error');
  const active = uploading.length + queued.length;
  const total = queue.length;
  const allSettled = active === 0;

  const overallProgress =
    total === 0
      ? 0
      : Math.round(
          queue.reduce(
            (sum, u) =>
              sum + (u.status === 'done' ? 100 : u.status === 'error' ? 0 : u.progress),
            0,
          ) / total,
        );

  const headerLabel = allSettled
    ? errors.length > 0
      ? `${done.length} uploaded · ${errors.length} failed`
      : `${done.length} file${done.length === 1 ? '' : 's'} uploaded`
    : `Uploading ${done.length + uploading.length} of ${total - errors.length}`;

  return (
    <div className="w-80 overflow-hidden rounded-xl border bg-card shadow-2xl">
      <div className="flex items-center gap-2 px-3 py-2.5">
        {allSettled ? (
          errors.length > 0 ? (
            <AlertCircle className="size-4 shrink-0 text-destructive" />
          ) : (
            <CheckCircle className="size-4 shrink-0 text-emerald-500" />
          )
        ) : (
          <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
        )}
        <span className="flex-1 truncate text-sm font-medium">{headerLabel}</span>
        <Button variant="ghost" size="icon" className="size-6 shrink-0" onClick={() => setExpanded((e) => !e)}>
          {expanded ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
        </Button>
        <Button variant="ghost" size="icon" className="size-6 shrink-0" onClick={onClearSettled}>
          <X className="size-3.5" />
        </Button>
      </div>

      {!allSettled && (
        <div className="px-3 pb-2">
          <Progress value={overallProgress} className="h-1" />
        </div>
      )}

      {expanded && (
        <>
          <Separator />
          <div className={cn('overflow-y-auto p-1.5', queue.length > 6 ? 'max-h-52' : '')}>
            {queue.map((item) => (
              <ItemRow key={item.id} item={item} onDismiss={() => onRemove(item.id)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// UploadZone
// ---------------------------------------------------------------------------

interface UploadZoneProps {
  children: React.ReactNode;
}

export function UploadZone({ children }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);
  const qc = useQueryClient();

  const { currentPath, uploadQueue, addUpload, updateUpload, removeUpload, isAdmin, identityId } =
    useFileBrowserStore();

  const canUpload = canWritePath(currentPath, { isAdmin, identityId });

  // Auto-dismiss when everything completes with no errors
  useEffect(() => {
    if (uploadQueue.length === 0) return;
    const allDone = uploadQueue.every((u) => u.status === 'done');
    if (!allDone) return;
    const t = setTimeout(() => uploadQueue.forEach((u) => removeUpload(u.id)), 3500);
    return () => clearTimeout(t);
  }, [uploadQueue, removeUpload]);

  // ------------------------------------------------------------------
  // Core upload logic
  // ------------------------------------------------------------------

  const processBatch = useCallback(
    async (batch: Array<{ file: File; targetPath: string }>) => {
      if (!canUpload || batch.length === 0) return;

      const uploadOne = async (id: string, file: File, targetPath: string) => {
        updateUpload(id, { status: 'uploading' });
        try {
          await uploadFile(targetPath, file, (pct) => updateUpload(id, { progress: pct }));

          if (shouldGenerateThumbnail(file)) {
            try {
              const thumb = await createVideoThumbnail(file);
              await uploadFile(getThumbnailPath(targetPath), thumb, () => {});
            } catch {
              // non-fatal
            }
          }

          updateUpload(id, { status: 'done', progress: 100 });
          // Invalidate the direct parent folder of this file
          const parent = targetPath.slice(0, targetPath.lastIndexOf('/') + 1);
          qc.invalidateQueries({ queryKey: ['storage', 'list', parent] });
          setTimeout(() => removeUpload(id), 5000);
        } catch (err) {
          updateUpload(id, {
            status: 'error',
            error: err instanceof Error ? err.message : 'Upload failed',
          });
        }
      };

      // Register all as queued up front so the toast appears immediately
      const items = batch.map(({ file, targetPath }) => {
        const id = crypto.randomUUID();
        addUpload({ id, name: file.name, path: targetPath, progress: 0, status: 'queued' });
        return { id, file, targetPath };
      });

      // Staggered parallel workers — avoids simultaneous CORS preflight storms
      let idx = 0;
      const worker = async (startDelay: number) => {
        await new Promise<void>((r) => setTimeout(r, startDelay));
        for (;;) {
          const i = idx++;
          if (i >= items.length) break;
          await uploadOne(items[i].id, items[i].file, items[i].targetPath);
        }
      };

      await Promise.all(
        Array.from(
          { length: Math.min(CONCURRENCY, items.length) },
          (_, i) => worker(i * WORKER_STAGGER_MS),
        ),
      );
    },
    [canUpload, addUpload, updateUpload, removeUpload, qc],
  );

  // Simple files (file picker, paste) — target path is flat in current folder
  const processFiles = useCallback(
    (files: FileList | File[]) => {
      const uploadPath = currentPath;
      return processBatch(
        Array.from(files).map((file) => ({ file, targetPath: uploadPath + file.name })),
      );
    },
    [currentPath, processBatch],
  );

  // OS clipboard paste
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (!canUpload) return;
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return;
      const items = e.clipboardData?.items ?? ([] as unknown as DataTransferItemList);
      const files: File[] = [];
      for (const item of items) {
        if (item.kind === 'file') {
          const f = item.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        processFiles(files);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [canUpload, processFiles]);

  // ------------------------------------------------------------------
  // Drag and drop — handles folders via FileSystem API
  // ------------------------------------------------------------------

  const onDragEnter = (e: React.DragEvent) => {
    if (!canUpload) return;
    e.preventDefault();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    if (!canUpload) return;
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  };

  const onDragOver = (e: React.DragEvent) => {
    if (!canUpload) return;
    e.preventDefault();
  };

  const onDrop = async (e: React.DragEvent) => {
    if (!canUpload) return;
    e.preventDefault();
    setIsDragging(false);
    dragCounter.current = 0;

    const uploadPath = currentPath; // capture before any async gap

    // Read FileSystem entries SYNCHRONOUSLY (DataTransfer is cleared after the event)
    const fsEntries: FileSystemEntry[] = [];
    const plainFiles: File[] = [];

    if (e.dataTransfer.items) {
      for (const item of Array.from(e.dataTransfer.items)) {
        if (item.kind !== 'file') continue;
        const entry = item.webkitGetAsEntry?.();
        if (entry) {
          fsEntries.push(entry);
        } else {
          const f = item.getAsFile();
          if (f) plainFiles.push(f);
        }
      }
    } else {
      plainFiles.push(...Array.from(e.dataTransfer.files));
    }

    // Now resolve file contents asynchronously
    const batch: Array<{ file: File; targetPath: string }> = [];

    for (const f of plainFiles) {
      batch.push({ file: f, targetPath: uploadPath + f.name });
    }

    for (const entry of fsEntries) {
      if (entry.isFile) {
        const file = await getFileFromEntry(entry as FileSystemFileEntry);
        batch.push({ file, targetPath: uploadPath + file.name });
      } else if (entry.isDirectory) {
        // Recursively read folder, preserving the nested path structure
        const nested = await readDirectoryRecursive(
          entry as FileSystemDirectoryEntry,
          uploadPath + entry.name + '/',
        );
        batch.push(...nested);
      }
    }

    if (batch.length > 0) processBatch(batch);
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canUpload) return;
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
      e.target.value = '';
    }
  };

  const clearSettled = () => {
    uploadQueue.forEach((u) => {
      if (u.status === 'done' || u.status === 'error') removeUpload(u.id);
    });
  };

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <input type="file" multiple className="hidden" onChange={onFileInputChange} id="file-upload-input" />

      {children}

      {isDragging && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-primary bg-primary/10 backdrop-blur-sm">
          <Upload className="size-12 text-primary" />
          <p className="text-lg font-semibold text-primary">Drop files or folders to upload</p>
          <p className="text-sm text-muted-foreground">to {currentPath}</p>
        </div>
      )}

      {uploadQueue.length > 0 && (
        <div className="absolute bottom-4 right-4 z-40">
          <UploadToast queue={uploadQueue} onRemove={removeUpload} onClearSettled={clearSettled} />
        </div>
      )}
    </div>
  );
}

export function useUploadTrigger() {
  return {
    trigger: () => {
      (document.getElementById('file-upload-input') as HTMLInputElement)?.click();
    },
  };
}
