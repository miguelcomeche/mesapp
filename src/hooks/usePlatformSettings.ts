import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PlatformSettings {
  id: number;
  platform_name: string;
  base_domain: string;
  support_email: string | null;
  maintenance_mode: boolean;
  allow_demo_restaurants: boolean;
  primary_color: string | null;
  secondary_color: string | null;
  logo_url: string | null;
}

export function usePlatformSettings() {
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('platform_settings' as any)
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    setSettings((data as any) ?? null);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (patch: Partial<PlatformSettings>) => {
    const { error } = await supabase
      .from('platform_settings' as any)
      .update(patch as any)
      .eq('id', 1);
    if (!error) await load();
    return { error };
  };

  return { settings, loading, save, reload: load };
}