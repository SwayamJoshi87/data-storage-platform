import { useEffect, useState } from 'react';
import { X, Download, Trash2, FileText, FileVideo, FileAudio, FileArchive, File, Play } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { downloadFile, useFileObjectUrl, usePresignedFileUrl } from '@/hooks/useStorage';
import { useDeleteFile } from '@/hooks/useStorage';
import { getFileCategory, formatFileSize, formatDateTime, getFileExtension } from '@/lib/fileUtils';
import { getThumbnailPath } from '@/lib/thumbnailUtils';
import type { StorageFile } from '@/hooks/useStorage';
import { useFileBrowserStore, canWritePath } from '@/store/useFileBrowserStore';

interface FileDetailProps {
  file: StorageFile | null;
  onClose: () => void;
}

export function FileDetail({ file, onClose }: FileDetailProps) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isVideoRequested, setIsVideoRequested] = useState(false);
  const category = file ? getFileCategory(file.name) : 'other';
  const previewPath = file
    ? category === 'video'
      ? getThumbnailPath(file.path)
      : file.path
    : null;
  const { data: url, isLoading: urlLoading } = useFileObjectUrl(previewPath);
  const { data: videoUrl, isLoading: videoLoading } = usePresignedFileUrl(
    file && category === 'video' ? file.path : null,
    isVideoRequested,
  );
  const { mutate: deleteFile, isPending: deleting } = useDeleteFile();
  const { isAdmin, identityId } = useFileBrowserStore();
  const canDelete = file ? canWritePath(file.path, { isAdmin, identityId }) : false;

  useEffect(() => {
    setIsPreviewOpen(false);
    setIsVideoRequested(false);
  }, [file?.path]);

  const handleDownload = async () => {
    if (!file) return;

    const blob = await downloadFile(file.path);
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  };

  const handleDelete = () => {
    if (!file) return;
    deleteFile(file.path, { onSuccess: onClose });
  };

  const openPreview = () => {
    if (!file || (category !== 'image' && category !== 'video')) return;
    if (category === 'video') setIsVideoRequested(true);
    setIsPreviewOpen(true);
  };

  const closePreview = () => {
    setIsPreviewOpen(false);
  };

  return (
    <>
    <Sheet open={!!file} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-80 overflow-y-auto p-0 sm:w-96" showCloseButton={false}>
        <SheetHeader className="flex flex-row items-center justify-between border-b px-4 py-3">
          <SheetTitle className="truncate pr-2 text-sm">{file?.name}</SheetTitle>
          <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </SheetHeader>

        <div className="flex flex-col gap-4 p-4">
          <div className="flex h-48 w-full items-center justify-center overflow-hidden rounded-lg bg-muted/30">
            {urlLoading ? (
              <Skeleton className="size-full rounded-lg" />
            ) : category === 'image' && url ? (
              <button
                type="button"
                className="flex size-full cursor-zoom-in items-center justify-center"
                onClick={openPreview}
                title="Open preview"
              >
                <img src={url} alt={file?.name} className="max-h-full max-w-full object-contain" />
              </button>
            ) : category === 'video' ? (
              <button
                type="button"
                className="relative flex size-full items-center justify-center bg-muted/30"
                onClick={openPreview}
                title="Play video"
              >
                {url ? (
                  <img src={url} alt={file?.name} className="size-full object-contain" />
                ) : (
                  <FileVideo className="size-16 text-purple-400" />
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                  <div className="flex size-10 items-center justify-center rounded-full bg-background/85 shadow-sm">
                    <Play className="ml-0.5 size-4 fill-current" />
                  </div>
                </div>
              </button>
            ) : category === 'audio' && url ? (
              <div className="flex flex-col items-center gap-3">
                <FileAudio className="size-16 text-pink-400" />
                <audio src={url} controls className="w-full max-w-xs" />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                {category === 'pdf' ? (
                  <FileText className="size-16 text-red-400" />
                ) : category === 'text' ? (
                  <FileText className="size-16 text-blue-400" />
                ) : category === 'archive' ? (
                  <FileArchive className="size-16 text-amber-400" />
                ) : (
                  <File className="size-16 text-muted-foreground" />
                )}
                <Badge variant="secondary" className="text-xs">
                  {getFileExtension(file?.name ?? '')}
                </Badge>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button className="flex-1 gap-2" onClick={handleDownload} disabled={!file}>
              <Download className="size-3.5" />
              Download
            </Button>
            {canDelete && (
              <Button
                variant="outline"
                size="icon"
                className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={handleDelete}
                disabled={deleting}
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </div>

          <Separator />

          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              File Info
            </h4>
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Type</dt>
              <dd className="truncate font-medium capitalize">{category}</dd>

              <dt className="text-muted-foreground">Size</dt>
              <dd className="font-medium">{formatFileSize(file?.size)}</dd>

              <dt className="text-muted-foreground">Modified</dt>
              <dd className="font-medium">{formatDateTime(file?.lastModified)}</dd>
            </dl>
          </div>

          <Separator />

          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Path
            </h4>
            <p className="break-all rounded-md bg-muted px-2 py-1.5 font-mono text-xs text-muted-foreground">
              {file?.path}
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>

    <Dialog open={isPreviewOpen} onOpenChange={(open) => !open && closePreview()}>
      <DialogContent className="max-w-[min(96vw,1100px)] gap-3 p-3">
        <DialogTitle className="truncate pr-8 text-sm">{file?.name}</DialogTitle>
        <div className="flex max-h-[82vh] min-h-48 items-center justify-center overflow-hidden rounded-lg bg-black">
          {category === 'image' && url ? (
            <img src={url} alt={file?.name} className="max-h-[82vh] max-w-full object-contain" />
          ) : category === 'video' && videoLoading ? (
            <Skeleton className="h-64 w-full max-w-2xl rounded-none bg-muted/40" />
          ) : category === 'video' && videoUrl ? (
            <video
              src={videoUrl}
              controls
              autoPlay
              className="max-h-[82vh] w-full max-w-full"
            />
          ) : (
            <FileVideo className="size-16 text-purple-400" />
          )}
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
