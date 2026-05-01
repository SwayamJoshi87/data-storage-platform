import { X, Download, Trash2, Link, FileText, FileImage, FileVideo, FileAudio, FileArchive, File } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useFileUrl } from '@/hooks/useStorage';
import { useDeleteFile } from '@/hooks/useStorage';
import { getFileCategory, formatFileSize, formatDateTime, getFileExtension } from '@/lib/fileUtils';
import type { StorageFile } from '@/hooks/useStorage';
import { useFileBrowserStore, isReadOnlyPath } from '@/store/useFileBrowserStore';

interface FileDetailProps {
  file: StorageFile | null;
  onClose: () => void;
}

export function FileDetail({ file, onClose }: FileDetailProps) {
  const { data: url, isLoading: urlLoading } = useFileUrl(file?.path ?? null);
  const { mutate: deleteFile, isPending: deleting } = useDeleteFile();
  const category = file ? getFileCategory(file.name) : 'other';
  const { isAdmin } = useFileBrowserStore();
  const readOnly = file ? isReadOnlyPath(file.path, isAdmin) : false;

  const handleDownload = () => {
    if (!url || !file) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
  };

  const handleCopy = () => {
    if (url) navigator.clipboard.writeText(url);
  };

  const handleDelete = () => {
    if (!file) return;
    deleteFile(file.path, { onSuccess: onClose });
  };

  return (
    <Sheet open={!!file} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-80 overflow-y-auto p-0 sm:w-96">
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
              <img src={url} alt={file?.name} className="max-h-full max-w-full object-contain" />
            ) : category === 'video' && url ? (
              <video
                src={url}
                controls
                className="max-h-full max-w-full rounded-lg"
                preload="metadata"
              />
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
                ) : category === 'image' ? (
                  <FileImage className="size-16 text-emerald-400" />
                ) : category === 'video' ? (
                  <FileVideo className="size-16 text-purple-400" />
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
            <Button className="flex-1 gap-2" onClick={handleDownload} disabled={!url}>
              <Download className="size-3.5" />
              Download
            </Button>
            <Button variant="outline" size="icon" onClick={handleCopy} disabled={!url}>
              <Link className="size-3.5" />
            </Button>
            {!readOnly && (
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
  );
}
