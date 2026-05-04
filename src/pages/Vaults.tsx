import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HardDrive, Plus, Snowflake, Flame, Wind, Thermometer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useVaults } from '@/hooks/useApi';
import type { Vault, Tier } from '@/hooks/useApi';
import { CreateVaultDialog } from '@/components/vault/CreateVaultDialog';
import { formatDate } from '@/lib/fileUtils';
import { AppShell } from '@/components/layout/AppShell';

const TIER_META: Record<Tier, { label: string; color: string; icon: React.ElementType; price: string }> = {
  hot:    { label: 'Hot',    color: 'bg-orange-500/15 text-orange-400 border-orange-500/30',   icon: Flame,       price: '$0.023/GB/mo' },
  warm:   { label: 'Warm',   color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',   icon: Thermometer, price: '$0.015/GB/mo' },
  cold:   { label: 'Cold',   color: 'bg-blue-500/15 text-blue-400 border-blue-500/30',         icon: Wind,        price: '$0.004/GB/mo' },
  frozen: { label: 'Frozen', color: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',   icon: Snowflake,   price: '$0.001/GB/mo' },
};

function TierBadge({ tier }: { tier: Tier }) {
  const { label, color, icon: Icon } = TIER_META[tier];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${color}`}>
      <Icon className="size-3" />
      {label}
    </span>
  );
}

function VaultCard({ vault, onClick }: { vault: Vault; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col gap-3 rounded-xl border bg-card p-5 text-left transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
          <HardDrive className="size-5 text-primary" />
        </div>
        <TierBadge tier={vault.defaultTier} />
      </div>

      <div className="min-w-0">
        <p className="truncate font-semibold">{vault.name}</p>
        {vault.description && (
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{vault.description}</p>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Created {formatDate(vault.createdAt)}
      </p>
    </button>
  );
}

function EmptyVaults({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
        <HardDrive className="size-8 text-muted-foreground/60" />
      </div>
      <div>
        <p className="text-lg font-semibold">No vaults yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Create your first vault to start storing files securely.
        </p>
      </div>
      <Button onClick={onCreateClick} className="gap-2">
        <Plus className="size-4" />
        Create vault
      </Button>
    </div>
  );
}

export default function Vaults() {
  const navigate = useNavigate();
  const { data: vaults, isLoading } = useVaults();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <AppShell>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Vaults</h1>
            <p className="text-sm text-muted-foreground">Your secure storage vaults</p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="size-4" />
            New vault
          </Button>
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : vaults && vaults.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {vaults.map((vault) => (
              <VaultCard
                key={vault.id}
                vault={vault}
                onClick={() => navigate(`/vault/${vault.id}`)}
              />
            ))}
          </div>
        ) : (
          <EmptyVaults onCreateClick={() => setCreateOpen(true)} />
        )}
      </div>

      <CreateVaultDialog open={createOpen} onOpenChange={setCreateOpen} />
    </AppShell>
  );
}
