import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ModifierGroup, Modifier } from '@/types/database';
import { useToast } from '@/hooks/use-toast';

export function useModifiers(restaurantId: string | null) {
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchModifiers = useCallback(async () => {
    if (!restaurantId) return;
    
    // Fetch modifier groups
    const { data: groups, error: groupsError } = await supabase
      .from('modifier_groups')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('display_order');
    
    if (groupsError) {
      toast({ title: 'Error al cargar modificadores', description: groupsError.message, variant: 'destructive' });
      setIsLoading(false);
      return;
    }

    // Fetch all modifiers for these groups
    const groupIds = groups.map(g => g.id);
    if (groupIds.length === 0) {
      setModifierGroups([]);
      setIsLoading(false);
      return;
    }

    const { data: modifiers, error: modifiersError } = await supabase
      .from('modifiers')
      .select('*')
      .in('modifier_group_id', groupIds)
      .eq('available', true)
      .order('display_order');

    if (modifiersError) {
      toast({ title: 'Error al cargar modificadores', description: modifiersError.message, variant: 'destructive' });
      setIsLoading(false);
      return;
    }

    // Combine groups with their modifiers
    const groupsWithModifiers: ModifierGroup[] = groups.map(group => ({
      ...group,
      modifiers: modifiers.filter(m => m.modifier_group_id === group.id) as Modifier[],
    }));

    setModifierGroups(groupsWithModifiers);
    setIsLoading(false);
  }, [restaurantId, toast]);

  useEffect(() => {
    fetchModifiers();
  }, [fetchModifiers]);

  // Get modifier groups applicable to a specific category
  const getModifiersForCategory = useCallback((category: string): ModifierGroup[] => {
    return modifierGroups.filter(group => 
      group.applicable_categories.includes(category)
    );
  }, [modifierGroups]);

  return { modifierGroups, isLoading, fetchModifiers, getModifiersForCategory };
}

export interface SelectedModifier {
  modifier: Modifier;
  groupName: string;
}
