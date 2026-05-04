import { useState } from 'react';
import { X, Download, Trash2, FileText, FileVideo, FileAudio, FileArchive, File, Lock, Play, Clock, CheckCircle, Loader2 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { getFileCategory, formatFileSize, formatDateTime, getFileExtension } from '@/lib/fileUtils';
import { useVaultFiles, useDeleteFile, useFileDownloadUrl, useRequestRetrieval, useRetrievals, useRetrieval } from '@/hooks/useApi';
import type { Urgency } from '@/hooks/useApi';
import { useVaults } from '@/hooks/useApi';
import { TierBadge } from '@/components/files/FileCard';
import { useParams } from 'react-router-dom';

const RETRIEVAL_OPTIONS: { urgency: Urgency; label: string; price: string; sla: string; ratePerGb: number }[] = [
  { urgency: 'bulk',      label: 'Bulk',      price: '$0.0025/GB', sla: '~48 hours', ratePerGb: 0.0025 },
  { urgency: 'standard',  label: 'Standard',  price: '$0.01/GB',   sla: '~12 hours', ratePerGb: 0.01   },
  { urgency: 'expedited', label: 'Expedited', price: '$0.03/GB',   sla: '~4 hours',  ratePerGb: 0.03   },
];

const URGENCY_DURATION_MS: Record<Urgency, number> = {
  bulk:      48 * 60 * 60 * 1000,
  standard:  12 * 60 * 60 * 1000,
  expedited:  4 * 60 * 60 * 1000,
};

function formatEta(createdAt: string, urgency: Urgency): string {
  const eta = new Date(new Date(createdAt).getTime() + URGENCY_DURATION_MS[urgency]);
  const diffMs = eta.getTime() - Date.now();
  if (diffMs <= 0) return 'any moment now';
  const h = Math.floor(diffMs / 3_600_000);
  const m = Math.floor((diffMs % 3_600_000) / 60_000);
  return h > 0 ? `~${h}h ${m}m remaining` : `~${m}m remaining`;
}

interface FileDetailProps {
  fileId: string | null;
  onClose: () => void;
}

export function FileDetail({ fileId, onClose }: FileDetailProps) {
  const { vaultId } = useParams<{ vaultId: string }>();
  const [videoOpen, setVideoOpen] = useState(false);
  const [selectedUrgency, setSelectedUrgency] = useState<Urgency>('standard');

  const { data: filesData } = useVaultFiles(vaultId ?? null);
  const { data: vaults } = useVaults();
  const { mutate: deleteFile, isPending: deleting } = useDeleteFile();
  const { mutate: requestRetrieval, isPending: requesting } = useRequestRetrieval();

  const file = filesData?.files.find((f) => f.id === fileId) ?? null;
  const vault = vaults?.find((v) => v.id === file?.vaultId);
  const category = file ? getFileCategory(file.path) : 'other';
  const isLocked = file ? (file.storageTier === 'cold' || file.storageTier === 'frozen') : false;

  // Find an active retrieval for this file
  const { data: allRetrievals } = useRetrievals();
  const activeRetrieval = allRetrievals?.find(
    (r) => fileId && r.fileIds.includes(fileId) &&
      (r.status === 'initiated' || r.status === 'polling' || r.status === 'ready'),
  ) ?? null;

  // Poll the specific retrieval while in-flight
  const isPolling = activeRetrieval?.status === 'polling' || activeRetrieval?.status === 'initiated';
  const { data: polledRetrieval } = useRetrieval(isPolling ? activeRetrieval.id : null);
  const retrieval = polledRetrieval ?? activeRetrieval;
  const isReady = retrieval?.status === 'ready';

  // Presigned URL for hot/warm preview
  const downloadEnabled = !!file && !isLocked && (category !== 'video' || videoOpen);
  const { data: downloadUrl, isLoading: urlLoading } = useFileDownloadUrl(
    downloadEnabled ? fileId : null,
  );

  const handleDownload = () => {
    const url = isReady ? retrieval?.downloadUrl : downloadUrl;
    if (!url || !file) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = file.path;
    a.click();
  };

  const handleDelete = () => {
    if (!file) return;
    deleteFile(file.id, { onSuccess: onClose });
  };

  const handleRequestRetrieval = () => {
    if (!fileId) return;
    requestRetrieval({ fileIds: [fileId], urgency: selectedUrgency });
  };

  // Cost estimate for the selected urgency
  const selectedOption = RETRIEVAL_OPTIONS.find((o) => o.urgency === selectedUrgency)!;
  const estimatedCost = file
    ? ((file.sizeBytes / 1024 ** 3) * selectedOption.ratePerGb).toFixed(4)
    : null;

  return (
    <Sheet open={!!file} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-80 overflow-y-auto p-0 sm:w-96" showCloseButton={false}>
        <SheetHeader className="flex flex-row items-center justify-between border-b px-4 py-3">
          <SheetTitle className="truncate pr-2 text-sm">{file?.path}</SheetTitle>
          <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </SheetHeader>

        <div className="flex flex-col gap-4 p-4">
          {/* Preview */}
          <div className="flex h-48 w-full items-center justify-center overflow-hidden rounded-lg bg-muted/30">
            {isLocked ? (
              <div className="flex flex-col items-center gap-2 text-center px-4">
                <Lock className="size-12 text-muted-foreground/50" />
                <p className="text-sm font-medium text-muted-foreground">
                  {file?.storageTier === 'frozen' ? 'Frozen' : 'Cold'} storage
                </p>
                <p className="text-xs text-muted-foreground/70">Request retrieval to access</p>
              </div>
            ) : category === 'image' && downloadUrl ? (
              <img src={downloadUrl} alt={file?.path} className="max-h-full max-w-full object-contain" />
            ) : category === 'image' && urlLoading ? (
              <Skeleton className="size-full rounded-lg" />
            ) : category === 'video' ? (
              videoOpen && downloadUrl ? (
                <video src={downloadUrl} controls autoPlay className="max-h-full w-full" />
              ) : (
                <button type="button"
                  className="relative flex size-full items-center justify-center bg-muted/30"
                  onClick={() => setVideoOpen(true)}>
                  <FileVideo className="size-16 text-purple-400" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                    <div className="flex size-10 items-center justify-center rounded-full bg-background/85 shadow-sm">
                      <Play className="ml-0.5 size-4 fill-current" />
                    </div>
                  </div>
                </button>
              )
            ) : category === 'audio' && downloadUrl ? (
              <div className="flex flex-col items-center gap-3">
                <FileAudio className="size-16 text-pink-400" />
                <audio src={downloadUrl} controls className="w-full max-w-xs" />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                {category === 'pdf'     ? <FileText    className="size-16 text-red-400" />
               : category === 'text'    ? <FileText    className="size-16 text-blue-400" />
               : category === 'archive' ? <FileArchive className="size-16 text-amber-400" />
               :                          <File        className="size-16 text-muted-foreground" />}
                <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium">
                  {getFileExtension(file?.path ?? '')}
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            {isLocked ? (
              isReady ? (
                <Button className="flex-1 gap-2" onClick={handleDownload}>
                  <Download className="size-3.5" />
                  Download (24h link)
                </Button>
              ) : isPolling ? (
                <Button className="flex-1 gap-2" variant="outline" disabled>
                  <Loader2 className="size-3.5 animate-spin" />
                  Restoring…
                </Button>
              ) : (
                <Button className="flex-1 gap-2" onClick={handleRequestRetrieval} disabled={requesting}>
                  {requesting
                    ? <Loader2 className="size-3.5 animate-spin" />
                    : <Lock className="size-3.5" />}
                  Request retrieval
                </Button>
              )
            ) : (
              <Button className="flex-1 gap-2" onClick={handleDownload} disabled={!downloadUrl}>
                <Download className="size-3.5" />
                Download
              </Button>
            )}
            <Button
              variant="outline" size="icon"
              className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
              onClick={handleDelete} disabled={deleting}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>

          <Separator />

          {/* File info */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">File Info</h4>
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Type</dt>
              <dd className="truncate font-medium capitalize">{category}</dd>
              <dt className="text-muted-foreground">Size</dt>
              <dd className="font-medium">{formatFileSize(file?.sizeBytes)}</dd>
              <dt className="text-muted-foreground">Uploaded</dt>
              <dd className="font-medium">{formatDateTime(file?.createdAt)}</dd>
              <dt className="text-muted-foreground">Tier</dt>
              <dd>{file && <TierBadge tier={file.storageTier} />}</dd>
              <dt className="text-muted-foreground">Vault</dt>
              <dd className="truncate font-medium">{vault?.name ?? '—'}</dd>
            </dl>
          </div>

          {/* Retrieval section — only for cold/frozen */}
          {isLocked && (
            <>
              <Separator />

              {/* Active retrieval status banner */}
              {retrieval && (
                <div className={cn(
                  'flex items-start gap-3 rounded-lg border p-3 text-sm',
                  isReady
                    ? 'border-emerald-500/30 bg-emerald-500/10'
                    : 'border-primary/20 bg-primary/5',
                )}>
                  {isReady
                    ? <CheckCircle className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                    : <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-primary" />}
                  <div className="min-w-0">
                    {isReady ? (
                      <>
                        <p className="font-medium text-emerald-600 dark:text-emerald-400">File is ready</p>
                        <p className="text-xs text-muted-foreground">
                          Link expires {retrieval.expiresAt ? formatDateTime(retrieval.expiresAt) : 'in 24h'}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-medium">Restore in progress</p>
                        <p className="text-xs text-muted-foreground">
                          {formatEta(retrieval.createdAt, retrieval.urgency)}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Urgency selector — only when no active retrieval */}
              {!retrieval && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Retrieval speed
                  </h4>
                  <div className="space-y-1.5">
                    {RETRIEVAL_OPTIONS.map(({ urgency, label, price, sla }) => (
                      <button
                        key={urgency}
                        type="button"
                        onClick={() => setSelectedUrgency(urgency)}
                        className={cn(
                          'flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors',
                          selectedUrgency === urgency
                            ? 'border-primary/50 bg-primary/8 text-foreground'
                            : 'border-transparent hover:bg-accent',
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            'size-3 rounded-full border-2 transition-colors',
                            selectedUrgency === urgency
                              ? 'border-primary bg-primary'
                              : 'border-muted-foreground/40',
                          )} />
                          <span className="font-medium">{label}</span>
                          <span className="text-xs text-muted-foreground">{sla}</span>
                        </div>
                        <span className="font-mono text-xs text-muted-foreground">{price}</span>
                      </button>
                    ))}
                  </div>
                  {estimatedCost && (
                    <div className="flex items-center gap-1.5 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                      <Clock className="size-3.5 shrink-0" />
                      <span>
                        Estimated cost:{' '}
                        <span className="font-medium text-foreground">${estimatedCost}</span>
                      </span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
