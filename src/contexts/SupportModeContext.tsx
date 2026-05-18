import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

interface SupportSession {
  restaurant_id: string;
  restaurant_name: string;
  slug: string;
  previous_restaurant_id: string | null;
}

interface SupportModeContextValue {
  support: SupportSession | null;
  enterSupport: (s: { restaurant_id: string; restaurant_name: string; slug: string }) => Promise<void>;
  exitSupport: () => Promise<void>;
}

const KEY = 'mesapp.supportMode';
const SupportModeContext = createContext<SupportModeContextValue | undefined>(undefined);

export function SupportModeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [support, setSupport] = useState<SupportSession | null>(() => {
    try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
  });

  useEffect(() => {
    if (support) localStorage.setItem(KEY, JSON.stringify(support));
    else localStorage.removeItem(KEY);
  }, [support]);

  const enterSupport = useCallback(async (s: { restaurant_id: string; restaurant_name: string; slug: string }) => {
    if (!user) return;
    const { data: prof } = await supabase.from('profiles').select('restaurant_id').eq('id', user.id).maybeSingle();
    const previous = (prof as any)?.restaurant_id ?? null;
    await supabase.from('profiles').update({ restaurant_id: s.restaurant_id } as any).eq('id', user.id);
    localStorage.setItem('tenantSlug', s.slug);
    setSupport({ ...s, previous_restaurant_id: previous });
  }, [user]);

  const exitSupport = useCallback(async () => {
    if (!support || !user) return;
    await supabase.from('profiles').update({ restaurant_id: support.previous_restaurant_id } as any).eq('id', user.id);
    setSupport(null);
  }, [support, user]);

  return (
    <SupportModeContext.Provider value={{ support, enterSupport, exitSupport }}>
      {children}
    </SupportModeContext.Provider>
  );
}

export function useSupportMode() {
  const ctx = useContext(SupportModeContext);
  if (!ctx) throw new Error('useSupportMode must be used within SupportModeProvider');
  return ctx;
}
