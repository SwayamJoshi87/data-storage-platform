import { useState } from 'react';
import { Flame, Snowflake, Thermometer, Wind } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCreateVault } from '@/hooks/useApi';
import type { Tier } from '@/hooks/useApi';
import { cn } from '@/lib/utils';

const TIERS: { value: Tier; label: string; desc: string; price: string; icon: React.ElementType; color: string }[] = [
  { value: 'hot',    label: 'Hot',    desc: 'Instant access',   price: '$0.023/GB/mo', icon: Flame,       color: 'border-orange-500/40 bg-orange-500/10 text-orange-400' },
  { value: 'warm',   label: 'Warm',   desc: 'Infrequent access', price: '$0.015/GB/mo', icon: Thermometer, color: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400' },
  { value: 'cold',   label: 'Cold',   desc: 'Rare access',       price: '$0.004/GB/mo', icon: Wind,        color: 'border-blue-500/40 bg-blue-500/10 text-blue-400' },
  { value: 'frozen', label: 'Frozen', desc: 'Long-term archive', price: '$0.001/GB/mo', icon: Snowflake,   color: 'border-indigo-500/40 bg-indigo-500/10 text-indigo-400' },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateVaultDialog({ open, onOpenChange }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tier, setTier] = useState<Tier>('frozen');
  const { mutate: createVault, isPending } = useCreateVault();

  const reset = () => {
    setName('');
    setDescription('');
    setTier('frozen');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createVault(
      { name: name.trim(), description: description.trim() || undefined, defaultTier: tier },
      { onSuccess: () => { onOpenChange(false); reset(); } },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="grid gap-5">
          <DialogTitle>Create vault</DialogTitle>

          <div className="grid gap-3">
            <Input
              autoFocus
              placeholder="Vault name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isPending}
              required
            />
            <Input
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isPending}
            />
          </div>

          <div className="grid gap-2">
            <p className="text-sm font-medium">Default storage tier</p>
            <div className="grid grid-cols-2 gap-2">
              {TIERS.map(({ value, label, desc, price, icon: Icon, color }) => (
                <button
                  key={value}
                  type="button"
                  disabled={isPending}
                  onClick={() => setTier(value)}
                  className={cn(
                    'flex flex-col gap-1.5 rounded-lg border p-3 text-left transition-colors',
                    tier === value ? color : 'border-border hover:bg-accent',
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <Icon className="size-3.5" />
                    <span className="text-sm font-medium">{label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                  <p className="text-xs font-mono text-muted-foreground">{price}</p>
                </button>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" disabled={isPending} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !name.trim()}>
              Create vault
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
