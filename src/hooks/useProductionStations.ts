import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ProductionStation {
  id: string;
  restaurant_id: string;
  name: string;
  color: string;
  sort_order: number;
  printer_id: string | null;
  station: 'kitchen' | 'bar';
  active: boolean;
  created_at: string;
  updated_at: string;
}

export function useProductionStations(restaurantId: string | null) {
  const [stations, setStations] = useState<ProductionStation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetch = useCallback(async () => {
    if (!restaurantId) {
      setStations([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const { data, error } = await supabase
      .from('production_stations' as never)
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('sort_order', { ascending: true });
    if (error) {
      console.error('production_stations fetch', error);
      toast({ title: 'Error', description: 'No se pudieron cargar las partidas', variant: 'destructive' });
    } else {
      setStations((data as unknown as ProductionStation[]) || []);
    }
    setIsLoading(false);
  }, [restaurantId, toast]);

  useEffect(() => { fetch(); }, [fetch]);

  const create = async (input: { name: string; color: string; printer_id: string | null; station: 'kitchen' | 'bar'; active?: boolean; }) => {
    if (!restaurantId) return;
    const next = stations.length;
    const { error } = await supabase
      .from('production_stations' as never)
      .insert({ ...input, restaurant_id: restaurantId, sort_order: next, active: input.active ?? true } as never);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Partida creada' });
    fetch();
  };

  const update = async (id: string, patch: Partial<ProductionStation>) => {
    const { error } = await supabase
      .from('production_stations' as never)
      .update(patch as never)
      .eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    fetch();
  };

  const remove = async (id: string) => {
    const { data, error } = await supabase.rpc('delete_production_station_safe' as never, { _station: id } as never);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    const res = (data as any) || {};
    if (res.action === 'blocked') {
      toast({
        title: 'No se puede eliminar',
        description: 'Esta partida tiene categorías vinculadas. Debe reasignarlas antes de eliminarla.',
        variant: 'destructive',
      });
      return;
    }
    toast({ title: 'Partida eliminada' });
    fetch();
  };

  const reorder = async (orderedIds: string[]) => {
    await Promise.all(orderedIds.map((id, idx) =>
      supabase.from('production_stations' as never).update({ sort_order: idx } as never).eq('id', id)
    ));
    fetch();
  };

  return { stations, isLoading, refetch: fetch, create, update, remove, reorder };
}