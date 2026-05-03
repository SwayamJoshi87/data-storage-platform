// @ts-nocheck — migrated in Step 2/7/8
import { useEffect, useRef, useState } from 'react';
import {
  Search,
  Upload,
  LogOut,
  User,
  LayoutGrid,
  List,
  SortAsc,
  SortDesc,
  Shield,
  FolderPlus,
} from 'lucide-react';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useFileBrowserStore, canWritePath } from '@/store/useFileBrowserStore';
import { CreateFolderDialog } from '@/components/files/CreateFolderDialog';

function buildBreadcrumbs(path: string, identityId: string | null) {
  const parts = path.replace(/\/$/, '').split('/').filter(Boolean);
  const crumbs: { label: string; path: string }[] = [{ label: 'Home', path: '' }];

  let acc = '';
  for (const part of parts) {
    acc += part + '/';
    let label = part;
    if (identityId && part === identityId) label = 'My Files';
    crumbs.push({ label, path: acc });
  }

  return crumbs;
}

interface TopbarProps {
  onUploadClick: () => void;
}

export function Topbar({ onUploadClick }: TopbarProps) {
  const { user, signOut } = useAuthenticator();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const {
    currentPath,
    setCurrentPath,
    viewMode,
    setViewMode,
    sortOrder,
    setSortOrder,
    searchQuery,
    setSearchQuery,
    identityId,
    isAdmin,
  } = useFileBrowserStore();

  const crumbs = buildBreadcrumbs(currentPath, identityId);
  const rawName = user?.signInDetails?.loginId ?? user?.username ?? '';
  const userInitial = (rawName[0] ?? 'U').toUpperCase();
  const canUpload = canWritePath(currentPath, { isAdmin, identityId });

  useEffect(() => {
    if (!accountMenuOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setAccountMenuOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAccountMenuOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [accountMenuOpen]);

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mx-1 h-4" />

      <Breadcrumb className="hidden md:flex">
        <BreadcrumbList>
          {crumbs.map((crumb, i) => (
            <span key={crumb.path} className="flex items-center gap-1">
              {i > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {i === crumbs.length - 1 ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    className="cursor-pointer capitalize"
                    onClick={() => crumb.path && setCurrentPath(crumb.path)}
                  >
                    {crumb.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </span>
          ))}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto flex items-center gap-2">
        <div className="relative hidden sm:flex">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search files..."
            className="h-8 w-48 pl-8 text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <ToggleGroup className="hidden sm:flex">
          <ToggleGroupItem
            value="grid"
            size="sm"
            className="size-8 p-0"
            pressed={viewMode === 'grid'}
            onPressedChange={() => setViewMode('grid')}
          >
            <LayoutGrid className="size-3.5" />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="list"
            size="sm"
            className="size-8 p-0"
            pressed={viewMode === 'list'}
            onPressedChange={() => setViewMode('list')}
          >
            <List className="size-3.5" />
          </ToggleGroupItem>
        </ToggleGroup>

        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          title={sortOrder === 'asc' ? 'Sort descending' : 'Sort ascending'}
          onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
        >
          {sortOrder === 'asc' ? (
            <SortAsc className="size-3.5" />
          ) : (
            <SortDesc className="size-3.5" />
          )}
        </Button>

        {canUpload && (
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => setCreateFolderOpen(true)}
            >
              <FolderPlus className="size-3.5" />
              <span className="hidden sm:inline">Folder</span>
            </Button>
            <Button size="sm" className="h-8 gap-1.5" onClick={onUploadClick}>
              <Upload className="size-3.5" />
              <span className="hidden sm:inline">Upload</span>
            </Button>
          </>
        )}

        <ThemeToggle />

        <div ref={accountMenuRef} className="relative">
          <button
            type="button"
            className="inline-flex size-8 items-center justify-center rounded-full hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-haspopup="menu"
            aria-expanded={accountMenuOpen}
            title="Account"
            onClick={() => setAccountMenuOpen((open) => !open)}
          >
            <Avatar className="size-7">
              <AvatarFallback className="text-xs">{userInitial}</AvatarFallback>
            </Avatar>
          </button>

          {accountMenuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-10 z-50 w-56 rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10"
            >
              <div className="truncate px-2 py-1.5 text-xs text-muted-foreground">
                {rawName || 'User'}
              </div>
              <Separator className="-mx-1 my-1" />
              <button
                type="button"
                role="menuitem"
                className="flex w-full cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground opacity-70"
                disabled
              >
                <User className="size-3.5" />
                Profile
              </button>
              {isAdmin && (
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                  onClick={() => setAccountMenuOpen(false)}
                >
                  <Shield className="size-3.5" />
                  Admin Dashboard
                </button>
              )}
              <Separator className="-mx-1 my-1" />
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-destructive hover:bg-destructive/10"
                onClick={() => {
                  setAccountMenuOpen(false);
                  signOut();
                }}
              >
                <LogOut className="size-3.5" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>

      <CreateFolderDialog
        open={createFolderOpen}
        currentPath={currentPath}
        onOpenChange={setCreateFolderOpen}
      />
    </header>
  );
}
