import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { useFileBrowserStore } from '@/store/useFileBrowserStore';
import { AppShell } from '@/components/layout/AppShell';
import { FileGrid } from '@/components/files/FileGrid';
import { FileDetail } from '@/components/files/FileDetail';
import { UploadZone, useUploadTrigger } from '@/components/files/UploadZone';
import { useVaults } from '@/hooks/useApi';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function FileBrowser() {
  const { vaultId } = useParams<{ vaultId: string }>();
  const navigate = useNavigate();
  const { user, isLoaded } = useUser();
  const { setIsAdmin, selectedFileId, setSelectedFileId } = useFileBrowserStore();
  const { data: vaults } = useVaults();
  const { trigger: triggerUpload } = useUploadTrigger();

  useEffect(() => {
    if (!isLoaded || !user) return;
    setIsAdmin(user.publicMetadata?.isAdmin === true);
  }, [isLoaded, user, setIsAdmin]);

  // Redirect if vault not found once vaults are loaded
  useEffect(() => {
    if (vaults && vaultId && !vaults.find((v) => v.id === vaultId)) {
      navigate('/', { replace: true });
    }
  }, [vaults, vaultId, navigate]);

  const currentVault = vaults?.find((v) => v.id === vaultId) ?? null;

  if (!vaultId) return null;

  return (
    <AppShell onUploadClick={triggerUpload}>
      <UploadZone vaultId={vaultId} defaultTier={currentVault?.defaultTier ?? 'frozen'}>
        <ScrollArea className="h-full flex-1">
          <FileGrid vaultId={vaultId} />
        </ScrollArea>
      </UploadZone>
      <FileDetail fileId={selectedFileId} onClose={() => setSelectedFileId(null)} />
    </AppShell>
  );
}
