// @ts-nocheck — migrated in Step 2/7/8
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useDeleteFolder, useFolderSummary, type StorageFolder } from '@/hooks/useStorage';

interface DeleteFolderDialogProps {
  folder: StorageFolder | null;
  onOpenChange: (open: boolean) => void;
}

export function DeleteFolderDialog({ folder, onOpenChange }: DeleteFolderDialogProps) {
  const open = Boolean(folder);
  const { data, isLoading } = useFolderSummary(open ? folder?.path ?? '' : '');
  const { mutate: deleteFolder, isPending } = useDeleteFolder();
  const folderCount = data?.folderCount ?? 0;
  const fileCount = data?.fileCount ?? 0;
  const hasData = data ? !data.isEmpty : false;

  const handleDelete = () => {
    if (!folder) return;
    deleteFolder(folder.path, {
      onSuccess: () => onOpenChange(false),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-96">
        <DialogTitle className="flex items-center gap-2">
          <Trash2 className="size-4 text-destructive" />
          Delete folder
        </DialogTitle>

        <div className="grid gap-3 text-sm">
          <p>
            Delete <span className="font-medium">{folder?.name}</span>?
          </p>

          {isLoading ? (
            <Skeleton className="h-14 w-full" />
          ) : hasData ? (
            <div className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p>
                This folder contains files or subfolders. Deleting it will remove {fileCount} file
                {fileCount === 1 ? '' : 's'} and {folderCount} subfolder
                {folderCount === 1 ? '' : 's'}.
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground">
              This folder appears empty.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={isPending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={isPending || isLoading} onClick={handleDelete}>
            {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
