import { useEffect } from 'react';
import { ChevronLeft, ChevronRight, Download, Info, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { downloadFile, usePresignedFileUrl } from '@/hooks/useStorage';
import { getFileCategory } from '@/lib/fileUtils';
import type { StorageFile } from '@/hooks/useStorage';

interface MediaViewerProps {
  files: StorageFile[];
  openPath: string | null;
  onOpenPathChange: (path: string | null) => void;
  onShowInfo: (path: string) => void;
}

export function MediaViewer({
  files,
  openPath,
  onOpenPathChange,
  onShowInfo,
}: MediaViewerProps) {
  const currentIndex = openPath ? files.findIndex((file) => file.path === openPath) : -1;
  const currentFile = currentIndex >= 0 ? files[currentIndex] : null;
  const category = currentFile ? getFileCategory(currentFile.name) : 'other';
  const isImage = category === 'image';
  const isVideo = category === 'video';
  const isOpen = Boolean(openPath && currentFile);
  const previous2File = currentIndex > 1 ? files[currentIndex - 2] : null;
  const previousFile = currentIndex > 0 ? files[currentIndex - 1] : null;
  const nextFile = currentIndex >= 0 && currentIndex < files.length - 1 ? files[currentIndex + 1] : null;
  const next2File = currentIndex >= 0 && currentIndex < files.length - 2 ? files[currentIndex + 2] : null;
  const previous2Category = previous2File ? getFileCategory(previous2File.name) : 'other';
  const previousCategory = previousFile ? getFileCategory(previousFile.name) : 'other';
  const nextCategory = nextFile ? getFileCategory(nextFile.name) : 'other';
  const next2Category = next2File ? getFileCategory(next2File.name) : 'other';
  const shouldPresignPrevious2 = previous2Category === 'image' || previous2Category === 'video';
  const shouldPresignPrevious = previousCategory === 'image' || previousCategory === 'video';
  const shouldPresignNext = nextCategory === 'image' || nextCategory === 'video';
  const shouldPresignNext2 = next2Category === 'image' || next2Category === 'video';
  const { data: mediaUrl, isLoading: mediaLoading } = usePresignedFileUrl(
    currentFile?.path ?? null,
    isOpen && (isImage || isVideo),
  );
  const { data: previous2Url } = usePresignedFileUrl(
    previous2File?.path ?? null,
    isOpen && shouldPresignPrevious2,
  );
  const { data: previousUrl } = usePresignedFileUrl(
    previousFile?.path ?? null,
    isOpen && shouldPresignPrevious,
  );
  const { data: nextUrl } = usePresignedFileUrl(
    nextFile?.path ?? null,
    isOpen && shouldPresignNext,
  );
  const { data: next2Url } = usePresignedFileUrl(
    next2File?.path ?? null,
    isOpen && shouldPresignNext2,
  );
  const canGoPrevious = currentIndex > 0;
  const canGoNext = currentIndex >= 0 && currentIndex < files.length - 1;

  const goPrevious = () => {
    if (canGoPrevious) onOpenPathChange(files[currentIndex - 1].path);
  };

  const goNext = () => {
    if (canGoNext) onOpenPathChange(files[currentIndex + 1].path);
  };

  const handleDownload = async () => {
    if (!currentFile) return;

    const blob = await downloadFile(currentFile.path);
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = currentFile.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  };

  const handleShowInfo = () => {
    if (!currentFile) return;
    onShowInfo(currentFile.path);
  };

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') goPrevious();
      if (event.key === 'ArrowRight') goNext();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  useEffect(() => {
    const imageUrls = [
      previous2Category === 'image' ? previous2Url : null,
      previousCategory === 'image' ? previousUrl : null,
      nextCategory === 'image' ? nextUrl : null,
      next2Category === 'image' ? next2Url : null,
    ];

    imageUrls.forEach((url) => {
      if (!url) return;
      const image = new Image();
      image.src = url;
    });
  }, [
    previous2Category,
    previous2Url,
    previousCategory,
    previousUrl,
    nextCategory,
    nextUrl,
    next2Category,
    next2Url,
  ]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onOpenPathChange(null)}>
      <DialogContent
        showCloseButton={false}
        className="h-[calc(100vh-1.5rem)] w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] grid-rows-[auto_1fr] gap-0 overflow-hidden border border-white/10 bg-black p-0 text-white ring-0 sm:max-w-[calc(100vw-1.5rem)]"
      >
        <div className="flex h-12 items-center gap-2 border-b border-white/10 bg-black/90 px-3">
          <DialogTitle className="min-w-0 flex-1 truncate text-sm font-medium text-white">
            {currentFile?.name}
          </DialogTitle>
          <span className="shrink-0 text-xs text-white/60">
            {currentIndex + 1} / {files.length}
          </span>
          <Button variant="ghost" size="icon-sm" className="text-white hover:bg-white/10 hover:text-white" title="File info" onClick={handleShowInfo}>
            <Info className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" className="text-white hover:bg-white/10 hover:text-white" title="Download" onClick={handleDownload}>
            <Download className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" className="text-white hover:bg-white/10 hover:text-white" title="Close" onClick={() => onOpenPathChange(null)}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="relative flex min-h-0 items-center justify-center bg-black">
          {isImage && mediaLoading ? (
            <Skeleton className="h-full w-full rounded-none bg-white/10" />
          ) : isImage && mediaUrl ? (
            <img
              src={mediaUrl}
              alt={currentFile?.name}
              className="max-h-full max-w-full object-contain"
            />
          ) : isVideo && mediaLoading ? (
            <Skeleton className="h-full w-full rounded-none bg-white/10" />
          ) : isVideo && mediaUrl ? (
            <video
              key={currentFile?.path}
              src={mediaUrl}
              controls
              autoPlay
              className="max-h-full max-w-full"
            />
          ) : null}

          <Button
            variant="secondary"
            size="icon-lg"
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/85 text-black hover:bg-white disabled:opacity-20"
            title="Previous"
            onClick={goPrevious}
            disabled={!canGoPrevious}
          >
            <ChevronLeft className="size-5" />
          </Button>
          <Button
            variant="secondary"
            size="icon-lg"
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/85 text-black hover:bg-white disabled:opacity-20"
            title="Next"
            onClick={goNext}
            disabled={!canGoNext}
          >
            <ChevronRight className="size-5" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
