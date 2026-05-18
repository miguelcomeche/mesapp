import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ModuleKey, RestaurantModules, RestaurantStatus, RestaurantType } from '@/types/database';

export interface TenantInfo {
  restaurant_id: string;
  name: string;
  slug: string;
  status: RestaurantStatus;
  type: RestaurantType;
  modules: RestaurantModules;
}

interface TenantContextValue {
  tenant: TenantInfo | null;
  slug: string;
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  setTenantSlug: (slug: string) => void;
}

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

const FALLBACK_SLUG = 'santachiara';

function resolveSlugFromHostname(): string {
  if (typeof window === 'undefined') return FALLBACK_SLUG;
  const params = new URLSearchParams(window.location.search);
  const qsSlug = params.get('tenant');
  if (qsSlug) {
    localStorage.setItem('tenantSlug', qsSlug);
    return qsSlug.toLowerCase();
  }
  const stored = localStorage.getItem('tenantSlug');
  const host = window.location.hostname;

  // Preview / sandbox / lovable infrastructure → use stored or fallback
  if (
    host === 'localhost' ||
    host.startsWith('127.') ||
    host.includes('id-preview--') ||
    host.endsWith('.lovableproject.com')
  ) {
    return (stored || FALLBACK_SLUG).toLowerCase();
  }

  const parts = host.split('.');
  // mesapp.lovable.app  → no subdomain → fallback
  // {slug}.mesapp.com   → slug
  // {slug}.mesapp.lovable.app → slug
  if (parts.length >= 3 && parts[0] !== 'www' && parts[0] !== 'mesapp') {
    return parts[0].toLowerCase();
  }
  return (stored || FALLBACK_SLUG).toLowerCase();
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const [slug, setSlug] = useState<string>(() => resolveSlugFromHostname());
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTenant = async (s: string) => {
    setIsLoading(true);
    setError(null);
    const { data, error } = await supabase.rpc('get_tenant_by_slug' as never, { _slug: s } as never);
    if (error) {
      setError(error.message);
      setTenant(null);
    } else {
      const row = data ? (Array.isArray(data) ? data[0] : (data as any)) : null;
      if (!row) {
        setError(`Restaurante "${s}" no encontrado`);
        setTenant(null);
      } else {
        const r = row as any;
        setTenant({
          restaurant_id: r.restaurant_id,
          name: r.name,
          slug: r.slug,
          status: r.status,
          type: r.type,
          modules: {
            restaurant_id: r.restaurant_id,
            pos_enabled: r.pos_enabled,
            reservations_enabled: r.reservations_enabled,
            public_booking_enabled: r.public_booking_enabled,
            menu_enabled: r.menu_enabled,
            payments_enabled: r.payments_enabled,
            kitchen_bar_enabled: r.kitchen_bar_enabled,
            analytics_enabled: r.analytics_enabled,
            tickets_enabled: r.tickets_enabled,
            printing_enabled: r.printing_enabled,
          },
        });
      }
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchTenant(slug);
  }, [slug]);

  const setTenantSlug = (s: string) => {
    localStorage.setItem('tenantSlug', s);
    setSlug(s.toLowerCase());
  };

  return (
    <TenantContext.Provider
      value={{ tenant, slug, isLoading, error, reload: () => fetchTenant(slug), setTenantSlug }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used within TenantProvider');
  return ctx;
}

export function useModuleEnabled(key: ModuleKey): boolean {
  const { tenant } = useTenant();
  if (!tenant) return false;
  return Boolean(tenant.modules[key]);
}