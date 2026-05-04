import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { HardDrive, Plus, Snowflake, Flame, Wind, Thermometer, Vault } from 'lucide-react';
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
} from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { useVaults } from '@/hooks/useApi';
import type { Tier } from '@/hooks/useApi';
import { CreateVaultDialog } from '@/components/vault/CreateVaultDialog';

const TIER_ICONS: Record<Tier, React.ElementType> = {
  hot:    Flame,
  warm:   Thermometer,
  cold:   Wind,
  frozen: Snowflake,
};

const TIER_COLORS: Record<Tier, string> = {
  hot:    'text-orange-400',
  warm:   'text-yellow-400',
  cold:   'text-blue-400',
  frozen: 'text-indigo-400',
};

export function AppSidebar() {
  const navigate = useNavigate();
  const { vaultId } = useParams<{ vaultId?: string }>();
  const { data: vaults, isLoading } = useVaults();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
      <Sidebar variant="inset">
        <SidebarHeader className="border-b border-sidebar-border pb-3">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-2 hover:opacity-80 transition-opacity"
          >
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <HardDrive className="size-4" />
            </div>
            <div className="flex flex-col leading-tight text-left">
              <span className="text-sm font-semibold">Vault Storage</span>
              <span className="text-xs text-muted-foreground">Cold storage platform</span>
            </div>
          </button>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Vaults</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {isLoading ? (
                  <div className="space-y-1 px-2">
                    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full rounded-md" />)}
                  </div>
                ) : vaults && vaults.length > 0 ? (
                  vaults.map((vault) => {
                    const TierIcon = TIER_ICONS[vault.defaultTier];
                    return (
                      <SidebarMenuItem key={vault.id}>
                        <SidebarMenuButton
                          isActive={vaultId === vault.id}
                          onClick={() => navigate(`/vault/${vault.id}`)}
                          className="gap-2"
                        >
                          <Vault className="size-4 shrink-0" />
                          <span className="flex-1 truncate">{vault.name}</span>
                          <TierIcon className={`size-3 shrink-0 ${TIER_COLORS[vault.defaultTier]}`} />
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })
                ) : (
                  <p className="px-3 py-2 text-xs text-muted-foreground">No vaults yet</p>
                )}

                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => setCreateOpen(true)}
                    className="gap-2 text-muted-foreground hover:text-foreground"
                  >
                    <Plus className="size-4 shrink-0" />
                    <span>New vault</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="border-t border-sidebar-border pt-3">
          <div className="px-2 text-xs text-muted-foreground">
            AWS S3 · Glacier Deep Archive
          </div>
        </SidebarFooter>
      </Sidebar>

      <CreateVaultDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
