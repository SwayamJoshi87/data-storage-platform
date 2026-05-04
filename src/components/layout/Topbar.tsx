import { useNavigate, useParams } from 'react-router-dom';
import { Search, Upload, LogOut, User, LayoutGrid, List, SortAsc, SortDesc } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useUser, useClerk } from '@clerk/clerk-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useFileBrowserStore } from '@/store/useFileBrowserStore';
import { useVaults } from '@/hooks/useApi';

interface TopbarProps {
  onUploadClick?: () => void;
}

export function Topbar({ onUploadClick }: TopbarProps) {
  const navigate = useNavigate();
  const { vaultId } = useParams<{ vaultId?: string }>();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { data: vaults } = useVaults();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  const { viewMode, setViewMode, sortOrder, setSortOrder, searchQuery, setSearchQuery } =
    useFileBrowserStore();

  const currentVault = vaultId ? vaults?.find((v) => v.id === vaultId) : null;
  const rawName = user?.primaryEmailAddress?.emailAddress ?? user?.username ?? '';
  const userInitial = (rawName[0] ?? 'U').toUpperCase();

  useEffect(() => {
    if (!accountMenuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!accountMenuRef.current?.contains(e.target as Node)) setAccountMenuOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setAccountMenuOpen(false); };
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
          <BreadcrumbItem>
            {currentVault ? (
              <BreadcrumbLink className="cursor-pointer" onClick={() => navigate('/')}>
                Vaults
              </BreadcrumbLink>
            ) : (
              <BreadcrumbPage>Vaults</BreadcrumbPage>
            )}
          </BreadcrumbItem>
          {currentVault && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{currentVault.name}</BreadcrumbPage>
              </BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto flex items-center gap-2">
        {vaultId && (
          <div className="relative hidden sm:flex">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search files..."
              className="h-8 w-48 pl-8 text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        )}

        {vaultId && (
          <>
            <ToggleGroup className="hidden sm:flex">
              <ToggleGroupItem value="grid" size="sm" className="size-8 p-0"
                pressed={viewMode === 'grid'} onPressedChange={() => setViewMode('grid')}>
                <LayoutGrid className="size-3.5" />
              </ToggleGroupItem>
              <ToggleGroupItem value="list" size="sm" className="size-8 p-0"
                pressed={viewMode === 'list'} onPressedChange={() => setViewMode('list')}>
                <List className="size-3.5" />
              </ToggleGroupItem>
            </ToggleGroup>

            <Button variant="ghost" size="icon" className="size-8"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>
              {sortOrder === 'asc' ? <SortAsc className="size-3.5" /> : <SortDesc className="size-3.5" />}
            </Button>

            {onUploadClick && (
              <Button size="sm" className="h-8 gap-1.5" onClick={onUploadClick}>
                <Upload className="size-3.5" />
                <span className="hidden sm:inline">Upload</span>
              </Button>
            )}
          </>
        )}

        <ThemeToggle />

        <div ref={accountMenuRef} className="relative">
          <button
            type="button"
            className="inline-flex size-8 items-center justify-center rounded-full hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-haspopup="menu"
            aria-expanded={accountMenuOpen}
            onClick={() => setAccountMenuOpen((o) => !o)}
          >
            <Avatar className="size-7">
              <AvatarFallback className="text-xs">{userInitial}</AvatarFallback>
            </Avatar>
          </button>

          {accountMenuOpen && (
            <div role="menu" className="absolute right-0 top-10 z-50 w-56 rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10">
              <div className="truncate px-2 py-1.5 text-xs text-muted-foreground">{rawName || 'User'}</div>
              <Separator className="-mx-1 my-1" />
              <button type="button" role="menuitem"
                className="flex w-full cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground opacity-70" disabled>
                <User className="size-3.5" /> Profile
              </button>
              <Separator className="-mx-1 my-1" />
              <button type="button" role="menuitem"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-destructive hover:bg-destructive/10"
                onClick={() => { setAccountMenuOpen(false); void signOut(); }}>
                <LogOut className="size-3.5" /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
