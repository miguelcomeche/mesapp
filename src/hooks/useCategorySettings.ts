import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface CategorySetting {
  id: string;
  restaurant_id: string;
  category_name: string;
  auto_marchar_enabled: boolean;
  auto_marchar_station: 'bar' | 'kitchen' | null;
  production_station_id?: string | null;
}

export function useCategorySettings(restaurantId: string | null) {
  const [settings, setSettings] = useState<CategorySetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchSettings = useCallback(async () => {
    if (!restaurantId) return;

    const { data, error } = await supabase
      .from('category_settings')
      .select('*')
      .eq('restaurant_id', restaurantId);

    if (error) {
      console.error('Error fetching category settings:', error);
      return;
    }

    setSettings((data || []) as unknown as CategorySetting[]);
    setIsLoading(false);
  }, [restaurantId]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const getSettingForCategory = useCallback(
    (categoryName: string): CategorySetting | undefined => {
      return settings.find(s => s.category_name === categoryName);
    },
    [settings]
  );

  const isAutoMarchar = useCallback(
    (categoryName: string): boolean => {
      const setting = getSettingForCategory(categoryName);
      return setting?.auto_marchar_enabled === true;
    },
    [getSettingForCategory]
  );

  const getAutoMarcharStation = useCallback(
    (categoryName: string): 'bar' | 'kitchen' | null => {
      const setting = getSettingForCategory(categoryName);
      return setting?.auto_marchar_enabled ? (setting.auto_marchar_station || null) : null;
    },
    [getSettingForCategory]
  );

  const upsertSetting = async (
    categoryName: string,
    enabled: boolean,
    station: 'bar' | 'kitchen'
  ) => {
    if (!restaurantId) return;

    const existing = getSettingForCategory(categoryName);

    if (existing) {
      const { error } = await supabase
        .from('category_settings')
        .update({ auto_marchar_enabled: enabled, auto_marchar_station: station })
        .eq('id', existing.id);

      if (error) {
        toast({ title: 'Error', description: 'No se pudo actualizar la configuración.', variant: 'destructive' });
        return;
      }
    } else {
      const { error } = await supabase
        .from('category_settings')
        .insert({
          restaurant_id: restaurantId,
          category_name: categoryName,
          auto_marchar_enabled: enabled,
          auto_marchar_station: station,
        });

      if (error) {
        toast({ title: 'Error', description: 'No se pudo crear la configuración.', variant: 'destructive' });
        return;
      }
    }

    await fetchSettings();
    toast({ title: 'Guardado', description: `Auto-marchar ${enabled ? 'activado' : 'desactivado'} para ${categoryName}.` });
  };

  const setCategoryStation = async (categoryName: string, productionStationId: string | null) => {
    if (!restaurantId) return;
    const existing = getSettingForCategory(categoryName);
    if (existing) {
      const { error } = await supabase
        .from('category_settings')
        .update({ production_station_id: productionStationId } as never)
        .eq('id', existing.id);
      if (error) {
        toast({ title: 'Error', description: 'No se pudo asignar la partida.', variant: 'destructive' });
        return;
      }
    } else {
      const { error } = await supabase
        .from('category_settings')
        .insert({
          restaurant_id: restaurantId,
          category_name: categoryName,
          auto_marchar_enabled: false,
          auto_marchar_station: null,
          production_station_id: productionStationId,
        } as never);
      if (error) {
        toast({ title: 'Error', description: 'No se pudo asignar la partida.', variant: 'destructive' });
        return;
      }
    }
    await fetchSettings();
    toast({ title: 'Partida actualizada' });
  };

  return {
    settings,
    isLoading,
    isAutoMarchar,
    getAutoMarcharStation,
    getSettingForCategory,
    upsertSetting,
    setCategoryStation,
    fetchSettings,
  };
}
