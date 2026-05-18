import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FloorPlanElement, FloorElementType } from '@/types/database';
import { useToast } from '@/hooks/use-toast';

export function useFloorPlanElements(restaurantId: string | null) {
  const [elements, setElements] = useState<FloorPlanElement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchElements = useCallback(async () => {
    if (!restaurantId) return;
    const { data, error } = await (supabase as any)
      .from('floor_plan_elements')
      .select('*')
      .eq('restaurant_id', restaurantId);
    if (error) {
      toast({ title: 'Error al cargar elementos', description: error.message, variant: 'destructive' });
      return;
    }
    setElements((data ?? []) as FloorPlanElement[]);
    setIsLoading(false);
  }, [restaurantId, toast]);

  useEffect(() => {
    fetchElements();
    const channel = supabase
      .channel('floor-elements-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'floor_plan_elements' }, () => {
        fetchElements();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchElements]);

  const createElement = async (input: {
    type: FloorElementType;
    zone: string;
    label?: string | null;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  }) => {
    if (!restaurantId) return null;
    const defaults = defaultsFor(input.type);
    const { data, error } = await (supabase as any)
      .from('floor_plan_elements')
      .insert({
        restaurant_id: restaurantId,
        type: input.type,
        zone: input.zone,
        label: input.label ?? defaults.label,
        x: input.x ?? 100,
        y: input.y ?? 100,
        width: input.width ?? defaults.width,
        height: input.height ?? defaults.height,
      })
      .select()
      .single();
    if (error) {
      toast({ title: 'Error al crear elemento', description: error.message, variant: 'destructive' });
      return null;
    }
    await fetchElements();
    return data as FloorPlanElement;
  };

  const updateElement = async (id: string, patch: Partial<FloorPlanElement>) => {
    const { error } = await (supabase as any)
      .from('floor_plan_elements')
      .update(patch)
      .eq('id', id);
    if (error) {
      toast({ title: 'Error al actualizar elemento', description: error.message, variant: 'destructive' });
      return false;
    }
    return true;
  };

  const removeElement = async (id: string) => {
    const { error } = await (supabase as any)
      .from('floor_plan_elements')
      .delete()
      .eq('id', id);
    if (error) {
      toast({ title: 'Error al eliminar elemento', description: error.message, variant: 'destructive' });
      return false;
    }
    await fetchElements();
    return true;
  };

  const duplicateElement = async (id: string) => {
    const src = elements.find((e) => e.id === id);
    if (!src) return null;
    return createElement({
      type: src.type,
      zone: src.zone,
      label: src.label,
      x: src.x + 20,
      y: src.y + 20,
      width: src.width,
      height: src.height,
    });
  };

  return { elements, isLoading, fetchElements, createElement, updateElement, removeElement, duplicateElement };
}

function defaultsFor(type: FloorElementType): { label: string; width: number; height: number } {
  switch (type) {
    case 'bar':
      return { label: 'BARRA', width: 160, height: 40 };
    case 'wall':
      return { label: '', width: 200, height: 8 };
    case 'separator':
      return { label: '', width: 120, height: 4 };
    case 'text':
      return { label: 'Etiqueta', width: 100, height: 24 };
    case 'zone_block':
      return { label: 'Zona', width: 200, height: 120 };
    case 'decoration':
      return { label: '', width: 40, height: 40 };
  }
}