import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Building2, Check, ChevronsUpDown, Globe, Search, Store } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface RestaurantRow {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'inactive';
  type: 'production' | 'demo';
}

interface Props {
  collapsed?: boolean;
}

export function PlatformRestaurantSwitcher({ collapsed = false }: Props) {
  const { user, hasRole } = useAuth();
  const { tenant, setTenantSlug } = useTenant();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<RestaurantRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState(false);

  const isPlatformAdmin = hasRole('platform_admin');
  const isPlatformContext = location.pathname.startsWith('/admin');

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);
    if (isPlatformAdmin) {
      supabase
        .from('restaurants')
        .select('id, name, slug, status, type')
        .order('name')
        .then(({ data, error }) => {
          if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
          else setItems((data as RestaurantRow[]) ?? []);
          setLoading(false);
        });
    } else {
      supabase
        .rpc('get_user_restaurants' as any, { _user: user.id } as any)
        .then(({ data, error }: any) => {
          if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
          else {
            const list = ((data as any[]) ?? []).map((r) => ({
              id: r.restaurant_id,
              name: r.name,
              slug: r.slug,
              status: r.status,
              type: 'production' as const,
            }));
            setItems(list);
          }
          setLoading(false);
        });
    }
  }, [isPlatformAdmin, open, user]);

  // Non-platform users with a single restaurant don't need a switcher.
  // Show it only when they could meaningfully switch (will be checked after load), but render trigger anyway with current context.

  const choose = async (r: RestaurantRow) => {
    if (switching) return;
    setSwitching(true);
    setTenantSlug(r.slug);
    toast({ title: 'Restaurante activo', description: r.name });
    setOpen(false);
    // Navigate out of /admin if currently there, then reload to refresh tenant-scoped data.
    if (isPlatformContext) {
      window.location.assign('/dashboard');
    } else {
      setTimeout(() => window.location.reload(), 150);
    }
  };

  const choosePlatform = () => {
    setOpen(false);
    navigate('/admin/restaurants');
  };

  const filtered = items.filter((r) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return r.name.toLowerCase().includes(q) || r.slug.toLowerCase().includes(q);
  });

  const activeIcon = isPlatformContext ? Globe : Store;
  const activeLabel = isPlatformContext ? 'Plataforma' : tenant?.name ?? 'Selecciona…';
  const activeSub = isPlatformContext ? 'Vista global' : 'Restaurante activo';

  const trigger = collapsed ? (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <PopoverTrigger asChild>
          <button
            className="nav-link w-full justify-center px-2 mb-2"
            aria-label="Cambiar contexto"
          >
            {activeIcon === Globe ? <Globe className="w-5 h-5 text-primary" /> : <Store className="w-5 h-5 text-primary" />}
          </button>
        </PopoverTrigger>
      </TooltipTrigger>
      <TooltipContent side="right" className="bg-popover text-popover-foreground">
        {activeSub}: {activeLabel}
      </TooltipContent>
    </Tooltip>
  ) : (
    <PopoverTrigger asChild>
      <button
        className="nav-link w-full mb-2"
        aria-label="Cambiar contexto"
      >
        {activeIcon === Globe ? <Globe className="w-5 h-5 text-primary" /> : <Store className="w-5 h-5 text-primary" />}
        <span className="flex-1 text-left min-w-0">
          <span className="block text-xs text-muted-foreground leading-none">{activeSub}</span>
          <span className="block text-sm font-medium truncate">{activeLabel}</span>
        </span>
        <ChevronsUpDown className="w-4 h-4 text-muted-foreground" />
      </button>
    </PopoverTrigger>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {trigger}
      <PopoverContent side="right" align="start" className="w-80 p-0 bg-popover">
        {isPlatformAdmin && (
          <div className="p-1 border-b border-border">
            <button
              onClick={choosePlatform}
              className={cn(
                'w-full flex items-center gap-2 px-2 py-2 rounded-md text-left text-sm hover:bg-secondary transition-colors',
                isPlatformContext && 'bg-secondary'
              )}
            >
              <Globe className="w-4 h-4 text-primary shrink-0" />
              <span className="flex-1 min-w-0">
                <span className="block font-medium truncate">Plataforma</span>
                <span className="block text-xs text-muted-foreground truncate">Vista global de administración</span>
              </span>
              {isPlatformContext && <Check className="w-4 h-4 text-primary shrink-0" />}
            </button>
          </div>
        )}
        <div className="p-2 border-b border-border">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar restaurante…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
        </div>
        <div className="max-h-80 overflow-y-auto p-1">
          {loading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Cargando…</div>
          ) : filtered.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Sin resultados</div>
          ) : (
            filtered.map((r) => {
              const isActive = !isPlatformContext && tenant?.restaurant_id === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => choose(r)}
                  disabled={switching}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-2 rounded-md text-left text-sm hover:bg-secondary transition-colors disabled:opacity-50',
                    isActive && 'bg-secondary'
                  )}
                >
                  <Store className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block font-medium truncate">{r.name}</span>
                    <span className="block text-xs text-muted-foreground truncate">{r.slug}</span>
                  </span>
                  {r.type === 'demo' && <Badge variant="outline" className="text-[10px]">Demo</Badge>}
                  {r.status === 'inactive' && <Badge variant="secondary" className="text-[10px]">Inactivo</Badge>}
                  {isActive && <Check className="w-4 h-4 text-primary shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}