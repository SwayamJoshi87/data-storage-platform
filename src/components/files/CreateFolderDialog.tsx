// @ts-nocheck — migrated in Step 2/7/8
import { useEffect, useState } from 'react';
import { FolderPlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useCreateFolder } from '@/hooks/useStorage';

interface CreateFolderDialogProps {
  open: boolean;
  currentPath: string;
  onOpenChange: (open: boolean) => void;
}

function validateFolderName(value: string) {
  const name = value.trim();

  if (!name) return 'Folder name is required';
  if (name === '.' || name === '..') return 'Choose a different folder name';
  if (/[\\/]/.test(name)) return 'Folder names cannot include slashes';

  return null;
}

export function CreateFolderDialog({
  open,
  currentPath,
  onOpenChange,
}: CreateFolderDialogProps) {
  const [folderName, setFolderName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { mutate: createFolder, isPending } = useCreateFolder();

  useEffect(() => {
    if (!open) {
      setFolderName('');
      setError(null);
    }
  }, [open]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const validationError = validateFolderName(folderName);
    if (validationError) {
      setError(validationError);
      return;
    }

    createFolder(
      { parentPath: currentPath, name: folderName.trim() },
      {
        onSuccess: () => onOpenChange(false),
        onError: (err) => {
          setError(err instanceof Error ? err.message : 'Unable to create folder');
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-80">
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="size-4" />
            New folder
          </DialogTitle>

          <div className="grid gap-2">
            <Input
              autoFocus
              value={folderName}
              placeholder="Folder name"
              disabled={isPending}
              onChange={(event) => {
                setFolderName(event.target.value);
                setError(null);
              }}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="size-3.5 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
