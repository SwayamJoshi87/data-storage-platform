import { Search, Upload, LogOut, User, LayoutGrid, List, SortAsc, SortDesc } from 'lucide-react';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { useFileBrowserStore, isReadOnlyPath } from '@/store/useFileBrowserStore';

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
  const readOnly = isReadOnlyPath(currentPath, isAdmin);

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
          {sortOrder === 'asc' ? <SortAsc className="size-3.5" /> : <SortDesc className="size-3.5" />}
        </Button>

        {!readOnly && (
          <Button size="sm" className="gap-1.5 h-8" onClick={onUploadClick}>
            <Upload className="size-3.5" />
            <span className="hidden sm:inline">Upload</span>
          </Button>
        )}

        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex size-8 items-center justify-center rounded-full hover:bg-accent focus:outline-none">
            <Avatar className="size-7">
              <AvatarFallback className="text-xs">{userInitial}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">
              {rawName || 'User'}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <User className="mr-2 size-3.5" /> Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="text-destructive">
              <LogOut className="mr-2 size-3.5" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
