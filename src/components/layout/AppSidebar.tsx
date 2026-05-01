import { useState } from 'react';
import { FolderOpen, Globe, Lock, Shield, HardDrive, ChevronRight } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { useFileBrowserStore } from '@/store/useFileBrowserStore';
import { useFolderContents } from '@/hooks/useStorage';
import { cn } from '@/lib/utils';

interface RootFolder {
  label: string;
  path: string;
  icon: React.ElementType;
}

function getRootFolders(identityId: string | null, isAdmin: boolean): RootFolder[] {
  const folders: RootFolder[] = [
    { label: 'Public', path: 'public/', icon: Globe },
  ];
  if (isAdmin) {
    folders.push({ label: 'Admin', path: 'admin/', icon: Shield });
  }
  folders.push({
    label: 'My Files',
    path: identityId ? `private/${identityId}/` : 'private/',
    icon: Lock,
  });
  return folders;
}

function SidebarFolderItem({ folder, depth = 0 }: { folder: RootFolder; depth?: number }) {
  const { currentPath, setCurrentPath } = useFileBrowserStore();
  const isActive = currentPath === folder.path || currentPath.startsWith(folder.path);
  const [open, setOpen] = useState(isActive);
  // Don't fetch private path until identityId is resolved (avoids 403)
  const isResolved = !folder.path.startsWith('private/') || folder.path.split('/').length > 2;
  const { data } = useFolderContents(isResolved ? folder.path : '');
  const subFolders = data?.folders ?? [];

  if (subFolders.length === 0) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          isActive={currentPath === folder.path}
          onClick={() => setCurrentPath(folder.path)}
          className="gap-2"
        >
          <folder.icon className="size-4 shrink-0" />
          <span className="truncate">{folder.label}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="group/collapsible">
      <SidebarMenuItem>
        <SidebarMenuButton
          isActive={currentPath === folder.path}
          onClick={() => {
            setCurrentPath(folder.path);
            setOpen((o) => !o);
          }}
          className="gap-2"
        >
          <folder.icon className="size-4 shrink-0" />
          <span className="truncate flex-1">{folder.label}</span>
          <ChevronRight className="size-3 shrink-0 transition-transform group-data-open/collapsible:rotate-90" />
        </SidebarMenuButton>
        <CollapsibleContent>
          <SidebarMenuSub className="mx-0 border-l-0 px-0 py-1 pl-4">
            {subFolders.map((sub) => (
              <SidebarMenuSubItem key={sub.path}>
                <SidebarMenuSubButton
                  isActive={currentPath === sub.path}
                  onClick={() => setCurrentPath(sub.path)}
                  className="h-8 w-full gap-2"
                >
                  <FolderOpen className={cn('size-3.5 shrink-0', depth === 0 && 'text-muted-foreground')} />
                  <span className="truncate">{sub.name}</span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

export function AppSidebar() {
  const { identityId, isAdmin } = useFileBrowserStore();
  const rootFolders = getRootFolders(identityId, isAdmin);

  return (
    <Sidebar variant="inset">
      <SidebarHeader className="border-b border-sidebar-border pb-3">
        <div className="flex items-center gap-2 px-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <HardDrive className="size-4" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">S3 Drive</span>
            <span className="text-xs text-muted-foreground">File Browser</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Storage</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {rootFolders.map((folder) => (
                <SidebarFolderItem key={folder.path} folder={folder} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border pt-3">
        <div className="px-2 text-xs text-muted-foreground">
          us-east-1 · AWS S3
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
