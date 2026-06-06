import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { TicketKind, TicketTemplate, defaultBlocksFor, defaultTemplateSettings, KIND_LABELS } from '@/types/tickets';

export function useTicketTemplates(restaurantId: string | null) {
  const [templates, setTemplates] = useState<TicketTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchAll = useCallback(async () => {
    if (!restaurantId) return;
    setIsLoading(true);
    const { data, error } = await (supabase as any)
      .from('ticket_templates')
      .select('*')
      .eq('restaurant_id', restaurantId);
    if (error) {
      toast({ title: 'Error al cargar plantillas', description: error.message, variant: 'destructive' });
      setIsLoading(false);
      return;
    }
    let rows = (data ?? []) as TicketTemplate[];
    // Auto-seed missing kinds
    const kinds: TicketKind[] = ['customer', 'kitchen', 'bar', 'delivery'];
    const missing = kinds.filter((k) => !rows.some((r) => r.kind === k));
    if (missing.length > 0) {
      const inserts = missing.map((k) => ({
        restaurant_id: restaurantId,
        kind: k,
        name: KIND_LABELS[k],
        paper_width: 80,
        settings: defaultTemplateSettings(),
        blocks: defaultBlocksFor(k),
        is_default: true,
      }));
      const { data: seeded, error: seedErr } = await (supabase as any)
        .from('ticket_templates')
        .insert(inserts)
        .select();
      if (seedErr) {
        toast({ title: 'Error al crear plantillas por defecto', description: seedErr.message, variant: 'destructive' });
      } else if (seeded) {
        rows = [...rows, ...(seeded as TicketTemplate[])];
      }
    }
    setTemplates(rows);
    setIsLoading(false);
  }, [restaurantId, toast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const saveTemplate = async (tpl: TicketTemplate): Promise<boolean> => {
    const { error } = await (supabase as any)
      .from('ticket_templates')
      .update({
        name: tpl.name,
        paper_width: tpl.paper_width,
        settings: tpl.settings,
        blocks: tpl.blocks,
      })
      .eq('id', tpl.id);
    if (error) {
      toast({ title: 'Error al guardar', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Plantilla guardada' });
    setTemplates((prev) => prev.map((t) => (t.id === tpl.id ? tpl : t)));
    return true;
  };

  const resetTemplate = async (kind: TicketKind): Promise<TicketTemplate | null> => {
    if (!restaurantId) return null;
    const blocks = defaultBlocksFor(kind);
    const settings = defaultTemplateSettings();
    const existing = templates.find((t) => t.kind === kind);
    if (!existing) return null;
    const updated: TicketTemplate = { ...existing, blocks, settings, paper_width: 80, name: KIND_LABELS[kind] };
    const ok = await saveTemplate(updated);
    if (!ok) return null;
    toast({ title: 'Plantilla restaurada' });
    return updated;
  };

  const duplicateTemplate = async (kind: TicketKind): Promise<void> => {
    toast({
      title: 'Duplicado registrado',
      description: 'Se guardó una copia como borrador en la consola (próximamente: borradores múltiples).',
    });
    const src = templates.find((t) => t.kind === kind);
    if (src) console.log('[TicketTemplates] duplicated draft', { kind, src });
  };

  return { templates, isLoading, fetchAll, saveTemplate, resetTemplate, duplicateTemplate };
}