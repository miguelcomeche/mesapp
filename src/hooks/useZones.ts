import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Zone {
  id: string;
  restaurant_id: string;
  name: string;
  slug: string;
  active: boolean;
  display_order: number;
  color: string | null;
  created_at: string;
  updated_at: string;
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function useZones(restaurantId: string | null) {
  const [zones, setZones] = useState<Zone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchZones = useCallback(async () => {
    if (!restaurantId) return;
    const { data, error } = await (supabase as any)
      .from('zones')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('display_order', { ascending: true })
      .order('name', { ascending: true });
    if (error) {
      toast({ title: 'Error al cargar zonas', description: error.message, variant: 'destructive' });
      return;
    }
    setZones((data ?? []) as Zone[]);
    setIsLoading(false);
  }, [restaurantId, toast]);

  useEffect(() => {
    fetchZones();
    const channel = supabase
      .channel('zones-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'zones' }, () => {
        fetchZones();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchZones]);

  const createZone = async (input: { name: string; active?: boolean; display_order?: number; color?: string | null }) => {
    if (!restaurantId) return null;
    const name = input.name.trim();
    if (!name) return null;
    const { data, error } = await (supabase as any)
      .from('zones')
      .insert({
        restaurant_id: restaurantId,
        name,
        slug: slugify(name),
        active: input.active ?? true,
        display_order: input.display_order ?? zones.length,
        color: input.color ?? null,
      })
      .select()
      .single();
    if (error) {
      toast({ title: 'Error al crear zona', description: error.message, variant: 'destructive' });
      return null;
    }
    await fetchZones();
    return data as Zone;
  };

  const updateZone = async (id: string, patch: Partial<Zone>) => {
    const update: any = { ...patch };
    if (patch.name) update.slug = slugify(patch.name);
    const { error } = await (supabase as any)
      .from('zones')
      .update(update)
      .eq('id', id);
    if (error) {
      toast({ title: 'Error al actualizar zona', description: error.message, variant: 'destructive' });
      return false;
    }
    await fetchZones();
    return true;
  };

  const deleteZone = async (id: string) => {
    const { error } = await (supabase as any)
      .from('zones')
      .delete()
      .eq('id', id);
    if (error) {
      const msg = error.message?.includes('Esta zona tiene')
        ? 'Esta zona tiene mesas o elementos. Muévelos o elimínalos antes de borrar la zona.'
        : error.message;
      toast({ title: 'No se puede eliminar', description: msg, variant: 'destructive' });
      return false;
    }
    await fetchZones();
    return true;
  };

  const reorderZones = async (orderedIds: string[]) => {
    const updates = orderedIds.map((id, idx) =>
      (supabase as any).from('zones').update({ display_order: idx }).eq('id', id)
    );
    await Promise.all(updates);
    await fetchZones();
  };

  return { zones, isLoading, fetchZones, createZone, updateZone, deleteZone, reorderZones };
}