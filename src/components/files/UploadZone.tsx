import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle, ChevronDown, ChevronUp, Clock, Flame, Loader2, Snowflake, Thermometer, Upload, Wind, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useFileBrowserStore, type UploadItem } from '@/store/useFileBrowserStore';
import { useApiFetch } from '@/hooks/useApi';
import type { Tier, UploadUrlResponse } from '@/hooks/useApi';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/hooks/useApi';

const TIER_META: Record<Tier, { label: string; icon: React.ElementType; price: string }> = {
  hot:    { label: 'Hot',    icon: Flame,       price: '$0.023' },
  warm:   { label: 'Warm',   icon: Thermometer, price: '$0.015' },
  cold:   { label: 'Cold',   icon: Wind,        price: '$0.004' },
  frozen: { label: 'Frozen', icon: Snowflake,   price: '$0.001' },
};
const TIERS = ['hot', 'warm', 'cold', 'frozen'] as Tier[];

// ---- Upload helpers --------------------------------------------------------

async function uploadToPresignedUrl(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status === 200 || xhr.status === 204) ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`));
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(file);
  });
}

// ---- Upload toast ----------------------------------------------------------

function ItemRow({ item, onDismiss }: { item: UploadItem; onDismiss: () => void }) {
  return (
    <div className="flex flex-col gap-1 rounded-md px-2 py-1.5 hover:bg-muted/40">
      <div className="flex items-center gap-2">
        <span className="shrink-0">
          {item.status === 'queued'    && <Clock     className="size-3.5 text-muted-foreground" />}
          {item.status === 'uploading' && <Loader2   className="size-3.5 animate-spin text-primary" />}
          {item.status === 'done'      && <CheckCircle className="size-3.5 text-emerald-500" />}
          {item.status === 'error'     && <AlertCircle className="size-3.5 text-destructive" />}
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
      {item.status === 'error' && <p className="text-xs text-destructive">{item.error ?? 'Upload failed'}</p>}
    </div>
  );
}

function UploadToast({ queue, onRemove, onClearSettled }: { queue: UploadItem[]; onRemove: (id: string) => void; onClearSettled: () => void }) {
  const [expanded, setExpanded] = useState(true);
  const active = queue.filter((u) => u.status === 'uploading' || u.status === 'queued').length;
  const done = queue.filter((u) => u.status === 'done').length;
  const errors = queue.filter((u) => u.status === 'error').length;
  const allSettled = active === 0;
  const overallProgress = queue.length === 0 ? 0 :
    Math.round(queue.reduce((s, u) => s + (u.status === 'done' ? 100 : u.progress), 0) / queue.length);
  const headerLabel = allSettled
    ? errors > 0 ? `${done} uploaded · ${errors} failed` : `${done} file${done === 1 ? '' : 's'} uploaded`
    : `Uploading ${done + queue.filter((u) => u.status === 'uploading').length} of ${queue.length - errors}`;

  return (
    <div className="w-80 overflow-hidden rounded-xl border bg-card shadow-2xl">
      <div className="flex items-center gap-2 px-3 py-2.5">
        {allSettled
          ? errors > 0 ? <AlertCircle className="size-4 shrink-0 text-destructive" /> : <CheckCircle className="size-4 shrink-0 text-emerald-500" />
          : <Loader2 className="size-4 shrink-0 animate-spin text-primary" />}
        <span className="flex-1 truncate text-sm font-medium">{headerLabel}</span>
        <Button variant="ghost" size="icon" className="size-6" onClick={() => setExpanded((e) => !e)}>
          {expanded ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
        </Button>
        <Button variant="ghost" size="icon" className="size-6" onClick={onClearSettled}>
          <X className="size-3.5" />
        </Button>
      </div>
      {!allSettled && <div className="px-3 pb-2"><Progress value={overallProgress} className="h-1" /></div>}
      {expanded && (
        <>
          <Separator />
          <div className={cn('overflow-y-auto p-1.5', queue.length > 6 ? 'max-h-52' : '')}>
            {queue.map((item) => <ItemRow key={item.id} item={item} onDismiss={() => onRemove(item.id)} />)}
          </div>
        </>
      )}
    </div>
  );
}

// ---- UploadZone ------------------------------------------------------------

interface UploadZoneProps {
  vaultId: string;
  defaultTier: Tier;
  children: React.ReactNode;
}

export function UploadZone({ vaultId, defaultTier, children }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedTier, setSelectedTier] = useState<Tier>(defaultTier);
  const dragCounter = useRef(0);
  const qc = useQueryClient();
  const apiFetch = useApiFetch();
  const { uploadQueue, addUpload, updateUpload, removeUpload } = useFileBrowserStore();

  // Keep tier in sync with vault default
  useEffect(() => { setSelectedTier(defaultTier); }, [defaultTier]);

  // Auto-dismiss all-done queue
  useEffect(() => {
    if (uploadQueue.length === 0) return;
    if (!uploadQueue.every((u) => u.status === 'done')) return;
    const t = setTimeout(() => uploadQueue.forEach((u) => removeUpload(u.id)), 3500);
    return () => clearTimeout(t);
  }, [uploadQueue, removeUpload]);

  const uploadOne = useCallback(async (id: string, file: File) => {
    updateUpload(id, { status: 'uploading' });
    try {
      const { uploadUrl } = await apiFetch<UploadUrlResponse>(`/vaults/${vaultId}/upload-url`, {
        method: 'POST',
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
          tier: selectedTier,
        }),
      });
      await uploadToPresignedUrl(uploadUrl, file, (pct) => updateUpload(id, { progress: pct }));
      updateUpload(id, { status: 'done', progress: 100 });
      qc.invalidateQueries({ queryKey: queryKeys.vaultFiles(vaultId) });
    } catch (err) {
      updateUpload(id, { status: 'error', error: err instanceof Error ? err.message : 'Upload failed' });
    }
  }, [vaultId, selectedTier, apiFetch, updateUpload, qc]);

  const processFiles = useCallback((fileList: File[]) => {
    if (!fileList.length) return;
    const items = fileList.map((file) => {
      const id = crypto.randomUUID();
      addUpload({ id, name: file.name, vaultId, progress: 0, status: 'queued' });
      return { id, file };
    });
    // Staggered parallel workers (max 3 concurrent)
    let idx = 0;
    const worker = async (delay: number) => {
      await new Promise<void>((r) => setTimeout(r, delay));
      for (;;) {
        const i = idx++;
        if (i >= items.length) break;
        await uploadOne(items[i].id, items[i].file);
      }
    };
    void Promise.all(Array.from({ length: Math.min(3, items.length) }, (_, i) => worker(i * 300)));
  }, [vaultId, addUpload, uploadOne]);

  // Drag and drop
  const onDragEnter = (e: React.DragEvent) => { e.preventDefault(); dragCounter.current++; if (e.dataTransfer.items.length) setIsDragging(true); };
  const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); if (--dragCounter.current === 0) setIsDragging(false); };
  const onDragOver  = (e: React.DragEvent) => e.preventDefault();
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false); dragCounter.current = 0;
    processFiles(Array.from(e.dataTransfer.files));
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) { processFiles(Array.from(e.target.files)); e.target.value = ''; }
  };

  const clearSettled = () => {
    uploadQueue.filter((u) => u.status === 'done' || u.status === 'error').forEach((u) => removeUpload(u.id));
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
      onDragEnter={onDragEnter} onDragLeave={onDragLeave} onDragOver={onDragOver} onDrop={onDrop}>
      <input type="file" multiple className="hidden" onChange={onFileInputChange} id="file-upload-input" />

      {children}

      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed border-primary bg-primary/10 backdrop-blur-sm">
          <Upload className="size-12 text-primary" />
          <div className="text-center">
            <p className="text-lg font-semibold text-primary">Drop files to upload</p>
            <p className="text-sm text-muted-foreground">to {selectedTier} storage</p>
          </div>
          {/* Tier selector in drag overlay */}
          <div className="flex gap-1 rounded-xl border bg-background/90 p-1">
            {TIERS.map((t) => {
              const { label, icon: Icon, price } = TIER_META[t];
              return (
                <button key={t} type="button" onClick={() => setSelectedTier(t)}
                  className={cn('flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors',
                    selectedTier === t ? 'bg-primary text-primary-foreground' : 'hover:bg-accent')}>
                  <Icon className="size-3.5" />
                  <span>{label}</span>
                  <span className="text-xs opacity-70">{price}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Upload queue toast */}
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
    trigger: () => (document.getElementById('file-upload-input') as HTMLInputElement)?.click(),
  };
}
