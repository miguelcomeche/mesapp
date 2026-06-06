import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TableGroup } from '@/types/database';
import { useToast } from '@/hooks/use-toast';

export function useTableGroups(restaurantId: string | null) {
  const [groups, setGroups] = useState<TableGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchGroups = useCallback(async () => {
    if (!restaurantId) return;
    const { data, error } = await (supabase as any)
      .from('table_groups')
      .select('*')
      .eq('restaurant_id', restaurantId);
    if (error) {
      toast({ title: 'Error al cargar grupos de mesas', description: error.message, variant: 'destructive' });
      setIsLoading(false);
      return;
    }
    setGroups((data ?? []) as TableGroup[]);
    setIsLoading(false);
  }, [restaurantId, toast]);

  useEffect(() => {
    fetchGroups();
    const channel = supabase
      .channel('table-groups-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'table_groups' }, () => fetchGroups())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchGroups]);

  const combine = async (tableIds: string[]) => {
    if (!restaurantId) return null;
    const { data, error } = await (supabase as any).rpc('combine_tables', {
      _restaurant: restaurantId,
      _table_ids: tableIds,
    });
    if (error) {
      toast({ title: 'No se pudieron combinar las mesas', description: error.message, variant: 'destructive' });
      return null;
    }
    toast({ title: 'Mesas combinadas' });
    await fetchGroups();
    return data as string;
  };

  const split = async (groupId: string) => {
    const { error } = await (supabase as any).rpc('split_table_group', { _group: groupId });
    if (error) {
      toast({ title: 'No se pudo separar el grupo', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Mesas separadas' });
    await fetchGroups();
    return true;
  };

  return { groups, isLoading, fetchGroups, combine, split };
}