import { useEffect } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { useAuthenticator } from '@aws-amplify/ui-react';
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

function readCognitoGroups(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((group): group is string => typeof group === 'string');
  }

  return typeof value === 'string' ? [value] : [];
}

function FileBrowserContent() {
  const {
    selectedFilePath,
    setSelectedFilePath,
    currentPath,
    identityId,
    setCurrentPath,
    setIdentityId,
    setIsAdmin,
  } = useFileBrowserStore();
  const { user } = useAuthenticator();
  const { trigger: triggerUpload } = useUploadTrigger();
  const resolvedPath = currentPath === 'private/' && !identityId ? '' : currentPath;
  const { data } = useFolderContents(resolvedPath);

  useEffect(() => {
    fetchAuthSession().then((session) => {
      if (session.identityId) setIdentityId(session.identityId);

      const tokenPayloads = [
        session.tokens?.idToken?.payload,
        session.tokens?.accessToken?.payload,
      ];
      const groupsFromSession = tokenPayloads.flatMap((payload) =>
        readCognitoGroups(payload?.['cognito:groups']),
      );

      // Also check the Amplify UI 'user' object as a fallback
      const legacyUser = user as {
        signInUserSession?: { idToken?: { payload?: Record<string, unknown> } };
      };
      const groupsFromUser = readCognitoGroups(
        legacyUser.signInUserSession?.idToken?.payload?.['cognito:groups'],
      );

      const isAdminFlag = [...groupsFromSession, ...groupsFromUser].includes('admin');
      setIsAdmin(Boolean(isAdminFlag));
    });
  }, [setIdentityId, setIsAdmin, user]);

  useEffect(() => {
    if (identityId && currentPath === 'private/') {
      setCurrentPath(`private/${identityId}/`);
    }
  }, [currentPath, identityId, setCurrentPath]);

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

      <FileDetail file={selectedFile} onClose={() => setSelectedFilePath(null)} />
    </SidebarProvider>
  );
}

export default FileBrowserContent;
