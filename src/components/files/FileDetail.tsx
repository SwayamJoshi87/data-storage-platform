import { useState } from 'react';
import { X, Download, Trash2, FileText, FileVideo, FileAudio, FileArchive, File, Lock, Play } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { getFileCategory, formatFileSize, formatDateTime, getFileExtension } from '@/lib/fileUtils';
import { useVaultFiles, useDeleteFile, useFileDownloadUrl } from '@/hooks/useApi';
import { useVaults } from '@/hooks/useApi';
import { TierBadge } from '@/components/files/FileCard';
import { useParams } from 'react-router-dom';

// Retrieval cost estimates shown in detail panel for cold/frozen files
const RETRIEVAL_COSTS = [
  { label: 'Bulk',      price: '$0.0025/GB', sla: '~48 hours' },
  { label: 'Standard',  price: '$0.01/GB',   sla: '~12 hours' },
  { label: 'Expedited', price: '$0.03/GB',   sla: '~4 hours'  },
];

interface FileDetailProps {
  fileId: string | null;
  onClose: () => void;
}

export function FileDetail({ fileId, onClose }: FileDetailProps) {
  const { vaultId } = useParams<{ vaultId: string }>();
  const [videoOpen, setVideoOpen] = useState(false);
  const { data: filesData } = useVaultFiles(vaultId ?? null);
  const { data: vaults } = useVaults();
  const { mutate: deleteFile, isPending: deleting } = useDeleteFile();
  const file = filesData?.files.find((f) => f.id === fileId) ?? null;
  const vault = vaults?.find((v) => v.id === file?.vaultId);
  const category = file ? getFileCategory(file.path) : 'other';
  const isLocked = file ? (file.storageTier === 'cold' || file.storageTier === 'frozen') : false;

  // Only load presigned URL for hot/warm and if explicitly requested for video
  const downloadEnabled = !!file && !isLocked && (category !== 'video' || videoOpen);
  const { data: downloadUrl, isLoading: urlLoading } = useFileDownloadUrl(
    downloadEnabled ? fileId : null,
  );

  const handleDownload = () => {
    if (!downloadUrl || !file) return;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = file.path;
    a.click();
  };

  const handleDelete = () => {
    if (!file) return;
    deleteFile(file.id, { onSuccess: onClose });
  };

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
                <p className="text-sm font-medium text-muted-foreground">Cold storage</p>
                <p className="text-xs text-muted-foreground/70">Request access to preview</p>
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
              <Button className="flex-1 gap-2" variant="outline" disabled>
                <Lock className="size-3.5" />
                Request access (Step 8)
              </Button>
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

          {/* Retrieval costs for cold/frozen */}
          {isLocked && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Retrieval costs
                </h4>
                <div className="space-y-1.5">
                  {RETRIEVAL_COSTS.map(({ label, price, sla }) => (
                    <div key={label} className="flex items-center justify-between text-sm">
                      <div>
                        <span className="font-medium">{label}</span>
                        <span className="ml-1.5 text-xs text-muted-foreground">{sla}</span>
                      </div>
                      <span className="font-mono text-xs text-muted-foreground">{price}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
