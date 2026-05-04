import { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Download, FileImage, FileVideo, Info, Play, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useFileDownloadUrl } from '@/hooks/useApi';
import { getFileCategory } from '@/lib/fileUtils';
import type { VaultFile } from '@/hooks/useApi';

// Only hot/warm files can be previewed — cold/frozen require retrieval (Step 8)
function ThumbItem({ file, isActive, onClick }: { file: VaultFile; isActive: boolean; onClick: () => void }) {
  const category = getFileCategory(file.path);
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (isActive) ref.current?.scrollIntoView({ behavior: 'smooth', inline: 'center' }); }, [isActive]);

  return (
    <button ref={ref} type="button" onClick={onClick}
      className={cn('relative h-11 w-16 shrink-0 overflow-hidden rounded border-2 transition-all focus-visible:outline-none',
        isActive ? 'border-white' : 'border-transparent opacity-50 hover:opacity-90')}>
      <div className="flex size-full items-center justify-center bg-white/10">
        {category === 'video'
          ? <FileVideo className="size-4 text-white/50" />
          : <FileImage className="size-4 text-white/50" />}
      </div>
      {category === 'video' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex size-5 items-center justify-center rounded-full bg-black/60">
            <Play className="ml-0.5 size-2 fill-white text-white" />
          </div>
        </div>
      )}
    </button>
  );
}

interface MediaViewerProps {
  files: VaultFile[];
  openFileId: string | null;
  onOpenFileIdChange: (id: string | null) => void;
  onShowInfo: (id: string) => void;
}

export function MediaViewer({ files, openFileId, onOpenFileIdChange, onShowInfo }: MediaViewerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const swipeStartX = useRef<number | null>(null);

  const currentIndex = openFileId ? files.findIndex((f) => f.id === openFileId) : -1;
  const currentFile = currentIndex >= 0 ? files[currentIndex] : null;
  const category = currentFile ? getFileCategory(currentFile.path) : 'other';
  const isImage = category === 'image';
  const isVideo = category === 'video';
  const isOpen = Boolean(openFileId && currentFile);

  const prevFile = currentIndex > 0 ? files[currentIndex - 1] : null;
  const nextFile = currentIndex < files.length - 1 ? files[currentIndex + 1] : null;
  const prev2File = currentIndex > 1 ? files[currentIndex - 2] : null;
  const next2File = currentIndex < files.length - 2 ? files[currentIndex + 2] : null;

  const { data: mediaUrl, isLoading: mediaLoading } = useFileDownloadUrl(isOpen ? openFileId : null);
  // Pre-warm adjacent presigned URLs
  useFileDownloadUrl(isOpen && prevFile ? prevFile.id : null);
  useFileDownloadUrl(isOpen && nextFile ? nextFile.id : null);
  useFileDownloadUrl(isOpen && prev2File ? prev2File.id : null);
  useFileDownloadUrl(isOpen && next2File ? next2File.id : null);

  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex >= 0 && currentIndex < files.length - 1;
  const goPrev = () => { if (canGoPrev) onOpenFileIdChange(files[currentIndex - 1].id); };
  const goNext = () => { if (canGoNext) onOpenFileIdChange(files[currentIndex + 1].id); };

  const handleDownload = () => {
    if (!mediaUrl || !currentFile) return;
    const a = document.createElement('a');
    a.href = mediaUrl;
    a.download = currentFile.path;
    a.click();
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onEnd = () => video.pause();
    video.addEventListener('webkitendfullscreen', onEnd);
    return () => video.removeEventListener('webkitendfullscreen', onEnd);
  }, [mediaUrl]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') return;
    swipeStartX.current = e.clientX;
  };
  const handlePointerUp = (e: React.PointerEvent) => {
    if (swipeStartX.current === null) return;
    const delta = e.clientX - swipeStartX.current;
    swipeStartX.current = null;
    if (Math.abs(delta) > 50) { if (delta < 0) goNext(); else goPrev(); }
  };

  const showFilmstrip = files.length > 1;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onOpenFileIdChange(null)}>
      <DialogContent showCloseButton={false} className={cn(
        'h-[calc(100dvh-0.75rem)] w-[calc(100vw-0.75rem)] max-w-[calc(100vw-0.75rem)]',
        'gap-0 overflow-hidden border border-white/10 bg-black p-0 text-white ring-0',
        'sm:max-w-[calc(100vw-0.75rem)]',
        showFilmstrip ? 'grid-rows-[auto_1fr_auto]' : 'grid-rows-[auto_1fr]',
      )}>
        {/* Toolbar */}
        <div className="flex h-12 shrink-0 items-center gap-1 border-b border-white/10 bg-black/90 px-3">
          <DialogTitle className="min-w-0 flex-1 truncate text-sm font-medium text-white">
            {currentFile?.path}
          </DialogTitle>
          <span className="shrink-0 px-1 text-xs text-white/50">{currentIndex + 1} / {files.length}</span>
          <Separator orientation="vertical" className="mx-1 h-5 bg-white/15" />
          <Button variant="ghost" size="icon-sm" className="shrink-0 text-white hover:bg-white/10 hover:text-white"
            onClick={() => currentFile && onShowInfo(currentFile.id)}><Info className="size-4" /></Button>
          <Button variant="ghost" size="icon-sm" className="shrink-0 text-white hover:bg-white/10 hover:text-white"
            onClick={handleDownload}><Download className="size-4" /></Button>
          <Button variant="ghost" size="icon-sm" className="shrink-0 text-white hover:bg-white/10 hover:text-white"
            onClick={() => onOpenFileIdChange(null)}><X className="size-4" /></Button>
        </div>

        {/* Media */}
        <div className="relative flex min-h-0 select-none items-center justify-center bg-black touch-pan-y"
          onPointerDown={handlePointerDown} onPointerUp={handlePointerUp}
          onPointerCancel={() => { swipeStartX.current = null; }}>
          {(isImage || isVideo) && mediaLoading ? (
            <Skeleton className="h-full w-full rounded-none bg-white/10" />
          ) : isImage && mediaUrl ? (
            <img src={mediaUrl} alt={currentFile?.path}
              className="max-h-full max-w-full object-contain pointer-events-none" draggable={false} />
          ) : isVideo && mediaUrl ? (
            <video ref={videoRef} key={currentFile?.id} src={mediaUrl}
              controls autoPlay playsInline className="max-h-full max-w-full" />
          ) : null}

          {canGoPrev && (
            <button type="button" onClick={goPrev} aria-label="Previous"
              className="absolute left-0 top-0 flex h-full w-14 items-center justify-start pl-2 sm:w-20 sm:pl-4">
              <div className="flex size-9 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm hover:bg-black/70 sm:size-10">
                <ChevronLeft className="size-5 text-white" />
              </div>
            </button>
          )}
          {canGoNext && (
            <button type="button" onClick={goNext} aria-label="Next"
              className="absolute right-0 top-0 flex h-full w-14 items-center justify-end pr-2 sm:w-20 sm:pr-4">
              <div className="flex size-9 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm hover:bg-black/70 sm:size-10">
                <ChevronRight className="size-5 text-white" />
              </div>
            </button>
          )}
        </div>

        {/* Filmstrip */}
        {showFilmstrip && (
          <div className="flex h-16 shrink-0 items-center gap-1.5 overflow-x-auto border-t border-white/10 bg-black/90 px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {files.map((file, i) => (
              <ThumbItem key={file.id} file={file} isActive={i === currentIndex}
                onClick={() => onOpenFileIdChange(file.id)} />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
