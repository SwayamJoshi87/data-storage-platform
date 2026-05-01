import { useRef, useState, useCallback } from 'react';
import { Upload, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { uploadFile } from '@/hooks/useStorage';
import { useFileBrowserStore, isReadOnlyPath } from '@/store/useFileBrowserStore';
import { useQueryClient } from '@tanstack/react-query';

interface UploadZoneProps {
  children: React.ReactNode;
}

export function UploadZone({ children }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const { currentPath, uploadQueue, addUpload, updateUpload, removeUpload, isAdmin } = useFileBrowserStore();

  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);

      for (const file of fileArray) {
        const id = crypto.randomUUID();
        const targetPath = currentPath + file.name;

        addUpload({ id, name: file.name, path: targetPath, progress: 0, status: 'uploading' });

        try {
          await uploadFile(targetPath, file, (pct) => {
            updateUpload(id, { progress: pct });
          });
          updateUpload(id, { status: 'done', progress: 100 });
          qc.invalidateQueries({ queryKey: ['storage', 'list', currentPath] });
          setTimeout(() => removeUpload(id), 3000);
        } catch (err) {
          updateUpload(id, {
            status: 'error',
            error: err instanceof Error ? err.message : 'Upload failed',
          });
          setTimeout(() => removeUpload(id), 5000);
        }
      }
    },
    [currentPath, addUpload, updateUpload, removeUpload, qc],
  );

  const readOnly = isReadOnlyPath(currentPath, isAdmin);

  const onDragEnter = (e: React.DragEvent) => {
    if (readOnly) return;
    e.preventDefault();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    if (readOnly) return;
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  };

  const onDragOver = (e: React.DragEvent) => {
    if (readOnly) return;
    e.preventDefault();
  };

  const onDrop = (e: React.DragEvent) => {
    if (readOnly) return;
    e.preventDefault();
    setIsDragging(false);
    dragCounter.current = 0;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) return;
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
      e.target.value = '';
    }
  };

  const activeUploads = uploadQueue.filter((u) => u.status !== 'done');

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={onFileInputChange}
        id="file-upload-input"
      />

      {children}

      {isDragging && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-primary bg-primary/10 backdrop-blur-sm">
          <Upload className="size-12 text-primary" />
          <p className="text-lg font-semibold text-primary">Drop files to upload</p>
          <p className="text-sm text-muted-foreground">to {currentPath}</p>
        </div>
      )}

      {activeUploads.length > 0 && (
        <div className="absolute bottom-4 right-4 z-40 flex flex-col gap-2 w-72">
          {activeUploads.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-1.5 rounded-lg border bg-card p-3 shadow-lg"
            >
              <div className="flex items-center gap-2">
                {item.status === 'uploading' && (
                  <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />
                )}
                {item.status === 'done' && (
                  <CheckCircle className="size-3.5 shrink-0 text-emerald-500" />
                )}
                {item.status === 'error' && (
                  <AlertCircle className="size-3.5 shrink-0 text-destructive" />
                )}
                <span className="flex-1 truncate text-xs font-medium">{item.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-5"
                  onClick={() => removeUpload(item.id)}
                >
                  <X className="size-3" />
                </Button>
              </div>
              {item.status === 'uploading' && (
                <Progress value={item.progress} className="h-1" />
              )}
              {item.status === 'error' && (
                <p className="text-xs text-destructive">{item.error}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function useUploadTrigger() {
  return {
    trigger: () => {
      const input = document.getElementById('file-upload-input') as HTMLInputElement;
      input?.click();
    },
  };
}
