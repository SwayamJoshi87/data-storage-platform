import { useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { Topbar } from '@/components/layout/Topbar';
import { FileGrid } from '@/components/files/FileGrid';
import { FileDetail } from '@/components/files/FileDetail';
import { UploadZone, useUploadTrigger } from '@/components/files/UploadZone';
import { useFileBrowserStore, buildUrlHash, parseUrlHash } from '@/store/useFileBrowserStore';
import { useFolderContents } from '@/hooks/useStorage';
import type { StorageFile } from '@/hooks/useStorage';

function FileBrowserContent() {
  const {
    selectedFilePath,
    setSelectedFilePath,
    currentPath,
    identityId,
    setIdentityId,
    setIsAdmin,
  } = useFileBrowserStore();
  const { user } = useUser();
  const { trigger: triggerUpload } = useUploadTrigger();
  const resolvedPath = currentPath === 'private/' && !identityId ? '' : currentPath;
  const { data } = useFolderContents(resolvedPath);

  // Stamp the initial history entry so popstate can restore it.
  useEffect(() => {
    const { path, viewer } = parseUrlHash(window.location.hash);
    const p = path ?? currentPath;
    const v = viewer ?? null;
    history.replaceState({ path: p, viewer: v }, '', buildUrlHash(p, v));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle browser back/forward.
  useEffect(() => {
    const handlePop = (e: PopStateEvent) => {
      const state = e.state as { path: string; viewer: string | null } | null;
      if (state?.path) {
        useFileBrowserStore.setState({
          currentPath: state.path,
          mediaViewerPath: state.viewer ?? null,
          selectedFilePath: null,
        });
      }
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  // Derive identity + admin flag from Clerk user.
  // Admin role is set via Clerk Dashboard → user publicMetadata: { role: "admin" }
  useEffect(() => {
    if (!user) return;
    setIdentityId(user.id);
    const isAdminFlag = (user.publicMetadata as { role?: string })?.role === 'admin';
    setIsAdmin(Boolean(isAdminFlag));
  }, [user, setIdentityId, setIsAdmin]);

  // Redirect private/ → private/{identityId}/ once the identity resolves.
  useEffect(() => {
    if (identityId && currentPath === 'private/') {
      const newPath = `private/${identityId}/`;
      history.replaceState({ path: newPath, viewer: null }, '', buildUrlHash(newPath, null));
      useFileBrowserStore.setState({
        currentPath: newPath,
        selectedFilePath: null,
        mediaViewerPath: null,
      });
    }
  }, [currentPath, identityId]);

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
