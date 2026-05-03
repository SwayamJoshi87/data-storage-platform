// @ts-nocheck — migrated in Step 2/7/8
import { useEffect, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileVideo,
  FileImage,
  Info,
  Play,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { downloadFile, useFileObjectUrl, usePresignedFileUrl } from '@/hooks/useStorage';
import { getFileCategory } from '@/lib/fileUtils';
import { getThumbnailPath } from '@/lib/thumbnailUtils';
import type { StorageFile } from '@/hooks/useStorage';

// ---------------------------------------------------------------------------
// Filmstrip thumbnail — one per media file
// ---------------------------------------------------------------------------
function ThumbItem({
  file,
  isActive,
  onClick,
}: {
  file: StorageFile;
  isActive: boolean;
  onClick: () => void;
}) {
  const category = getFileCategory(file.name);
  const thumbPath = category === 'video' ? getThumbnailPath(file.path) : file.path;
  const { data: thumbUrl } = useFileObjectUrl(thumbPath);
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isActive) {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [isActive]);

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className={cn(
        'relative h-11 w-16 shrink-0 overflow-hidden rounded border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
        isActive ? 'border-white' : 'border-transparent opacity-50 hover:opacity-90',
      )}
    >
      {thumbUrl ? (
        <img src={thumbUrl} alt={file.name} className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center bg-white/10">
          {category === 'video' ? (
            <FileVideo className="size-4 text-white/50" />
          ) : (
            <FileImage className="size-4 text-white/50" />
          )}
        </div>
      )}
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

// ---------------------------------------------------------------------------
// Main viewer
// ---------------------------------------------------------------------------
interface MediaViewerProps {
  files: StorageFile[];
  openPath: string | null;
  onOpenPathChange: (path: string | null) => void;
  onShowInfo: (path: string) => void;
}

export function MediaViewer({ files, openPath, onOpenPathChange, onShowInfo }: MediaViewerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const swipeStartX = useRef<number | null>(null);

  const currentIndex = openPath ? files.findIndex((f) => f.path === openPath) : -1;
  const currentFile = currentIndex >= 0 ? files[currentIndex] : null;
  const category = currentFile ? getFileCategory(currentFile.name) : 'other';
  const isImage = category === 'image';
  const isVideo = category === 'video';
  const isOpen = Boolean(openPath && currentFile);

  const previous2File = currentIndex > 1 ? files[currentIndex - 2] : null;
  const previousFile = currentIndex > 0 ? files[currentIndex - 1] : null;
  const nextFile = currentIndex >= 0 && currentIndex < files.length - 1 ? files[currentIndex + 1] : null;
  const next2File = currentIndex >= 0 && currentIndex < files.length - 2 ? files[currentIndex + 2] : null;

  const p2cat = previous2File ? getFileCategory(previous2File.name) : 'other';
  const pcat = previousFile ? getFileCategory(previousFile.name) : 'other';
  const ncat = nextFile ? getFileCategory(nextFile.name) : 'other';
  const n2cat = next2File ? getFileCategory(next2File.name) : 'other';

  const { data: mediaUrl, isLoading: mediaLoading } = usePresignedFileUrl(
    currentFile?.path ?? null,
    isOpen && (isImage || isVideo),
  );
  const { data: p2Url } = usePresignedFileUrl(previous2File?.path ?? null, isOpen && (p2cat === 'image' || p2cat === 'video'));
  const { data: pUrl } = usePresignedFileUrl(previousFile?.path ?? null, isOpen && (pcat === 'image' || pcat === 'video'));
  const { data: nUrl } = usePresignedFileUrl(nextFile?.path ?? null, isOpen && (ncat === 'image' || ncat === 'video'));
  const { data: n2Url } = usePresignedFileUrl(next2File?.path ?? null, isOpen && (n2cat === 'image' || n2cat === 'video'));

  const canGoPrevious = currentIndex > 0;
  const canGoNext = currentIndex >= 0 && currentIndex < files.length - 1;

  const goPrevious = () => { if (canGoPrevious) onOpenPathChange(files[currentIndex - 1].path); };
  const goNext = () => { if (canGoNext) onOpenPathChange(files[currentIndex + 1].path); };

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

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrevious();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  // Preload adjacent images
  useEffect(() => {
    [
      p2cat === 'image' ? p2Url : null,
      pcat === 'image' ? pUrl : null,
      ncat === 'image' ? nUrl : null,
      n2cat === 'image' ? n2Url : null,
    ].forEach((url) => {
      if (!url) return;
      const img = new Image();
      img.src = url;
    });
  }, [p2cat, p2Url, pcat, pUrl, ncat, nUrl, n2cat, n2Url]);

  // iOS: when native fullscreen ends, pause the video so the viewer
  // doesn't appear frozen behind the fullscreen chrome
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handleEnd = () => video.pause();
    video.addEventListener('webkitendfullscreen', handleEnd);
    return () => video.removeEventListener('webkitendfullscreen', handleEnd);
  }, [mediaUrl]);

  // Swipe left/right to navigate
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only track touch-like pointers, not mouse clicks on video controls
    if (e.pointerType === 'mouse') return;
    swipeStartX.current = e.clientX;
  };
  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (swipeStartX.current === null) return;
    const delta = e.clientX - swipeStartX.current;
    swipeStartX.current = null;
    if (Math.abs(delta) > 50) {
      if (delta < 0) goNext();
      else goPrevious();
    }
  };
  const handlePointerCancel = () => { swipeStartX.current = null; };

  const showFilmstrip = files.length > 1;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onOpenPathChange(null)}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          // Full viewport — use dvh so mobile browser chrome doesn't clip content
          'h-[calc(100dvh-0.75rem)] w-[calc(100vw-0.75rem)] max-w-[calc(100vw-0.75rem)]',
          'gap-0 overflow-hidden border border-white/10 bg-black p-0 text-white ring-0',
          'sm:max-w-[calc(100vw-0.75rem)]',
          // 3-row grid: toolbar | media | filmstrip
          showFilmstrip ? 'grid-rows-[auto_1fr_auto]' : 'grid-rows-[auto_1fr]',
        )}
      >
        {/* ── Toolbar ───────────────────────────────────────────────────── */}
        <div className="flex h-12 shrink-0 items-center gap-1 border-b border-white/10 bg-black/90 px-3">
          <DialogTitle className="min-w-0 flex-1 truncate text-sm font-medium text-white">
            {currentFile?.name}
          </DialogTitle>
          <span className="shrink-0 px-1 text-xs text-white/50">
            {currentIndex + 1} / {files.length}
          </span>
          <Separator orientation="vertical" className="mx-1 h-5 bg-white/15" />
          <Button
            variant="ghost"
            size="icon-sm"
            className="shrink-0 text-white hover:bg-white/10 hover:text-white"
            title="File info"
            onClick={() => currentFile && onShowInfo(currentFile.path)}
          >
            <Info className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="shrink-0 text-white hover:bg-white/10 hover:text-white"
            title="Download"
            onClick={handleDownload}
          >
            <Download className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="shrink-0 text-white hover:bg-white/10 hover:text-white"
            title="Close"
            onClick={() => onOpenPathChange(null)}
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* ── Media area ────────────────────────────────────────────────── */}
        <div
          className="relative flex min-h-0 select-none items-center justify-center bg-black touch-pan-y"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
        >
          {isImage && mediaLoading ? (
            <Skeleton className="h-full w-full rounded-none bg-white/10" />
          ) : isImage && mediaUrl ? (
            <img
              src={mediaUrl}
              alt={currentFile?.name}
              className="max-h-full max-w-full object-contain pointer-events-none"
              draggable={false}
            />
          ) : isVideo && mediaLoading ? (
            <Skeleton className="h-full w-full rounded-none bg-white/10" />
          ) : isVideo && mediaUrl ? (
            <video
              ref={videoRef}
              key={currentFile?.path}
              src={mediaUrl}
              controls
              autoPlay
              // Prevents iOS from auto-entering native fullscreen, which can
              // leave the viewer in a stuck state after the user exits fullscreen
              playsInline
              className="max-h-full max-w-full"
            />
          ) : null}

          {/* Previous — full-height tap zone on mobile, icon button on desktop */}
          {canGoPrevious && (
            <button
              type="button"
              onClick={goPrevious}
              aria-label="Previous"
              className="absolute left-0 top-0 flex h-full w-14 items-center justify-start pl-2 sm:w-20 sm:pl-4"
            >
              <div className="flex size-9 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm transition-colors hover:bg-black/70 sm:size-10">
                <ChevronLeft className="size-5 text-white" />
              </div>
            </button>
          )}

          {/* Next — same treatment */}
          {canGoNext && (
            <button
              type="button"
              onClick={goNext}
              aria-label="Next"
              className="absolute right-0 top-0 flex h-full w-14 items-center justify-end pr-2 sm:w-20 sm:pr-4"
            >
              <div className="flex size-9 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm transition-colors hover:bg-black/70 sm:size-10">
                <ChevronRight className="size-5 text-white" />
              </div>
            </button>
          )}
        </div>

        {/* ── Filmstrip ─────────────────────────────────────────────────── */}
        {showFilmstrip && (
          <div className="flex h-16 shrink-0 items-center gap-1.5 overflow-x-auto border-t border-white/10 bg-black/90 px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {files.map((file, index) => (
              <ThumbItem
                key={file.path}
                file={file}
                isActive={index === currentIndex}
                onClick={() => onOpenPathChange(file.path)}
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
