import { useEffect } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { Topbar } from '@/components/layout/Topbar';
import { FileGrid } from '@/components/files/FileGrid';
import { FileDetail } from '@/components/files/FileDetail';
import { UploadZone, useUploadTrigger } from '@/components/files/UploadZone';
import { useFileBrowserStore } from '@/store/useFileBrowserStore';
import { useFolderContents } from '@/hooks/useStorage';
import type { StorageFile } from '@/hooks/useStorage';

function FileBrowserContent() {
  const { selectedFilePath, setSelectedFilePath, currentPath, setIdentityId, setIsAdmin } =
    useFileBrowserStore();
  const { trigger: triggerUpload } = useUploadTrigger();
  const { data } = useFolderContents(currentPath);

  useEffect(() => {
    fetchAuthSession().then((session) => {
      if (session.identityId) setIdentityId(session.identityId);
      const groups = session.tokens?.idToken?.payload['cognito:groups'] as string[] | undefined;
      setIsAdmin(groups?.includes('admin') ?? false);
    });
  }, [setIdentityId, setIsAdmin]);

  const selectedFile: StorageFile | null =
    data?.files.find((f) => f.path === selectedFilePath) ?? null;

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="flex flex-col overflow-hidden">
        <Topbar onUploadClick={triggerUpload} />
        <UploadZone>
          <ScrollArea className="h-full flex-1">
            <FileGrid />
          </ScrollArea>
        </UploadZone>
      </SidebarInset>

      <FileDetail
        file={selectedFile}
        onClose={() => setSelectedFilePath(null)}
      />
    </SidebarProvider>
  );
}

export default FileBrowserContent;
