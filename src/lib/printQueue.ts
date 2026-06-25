import { supabase } from '@/integrations/supabase/client';

export type PrintDestination = 'cocina' | 'barra' | 'cliente';

export interface PrintQueueItem {
  qty: number;
  name: string;
  modifiers?: string[];
  price?: number;
}

export interface PrintQueueContent {
  table: string;
  order_ref: string;
  items: PrintQueueItem[];
  total?: number;
  note?: string;
}

export interface EnqueueArgs {
  restaurantId: string;
  destination: PrintDestination;
  content: PrintQueueContent;
  sessionId?: string | null;
}

/**
 * Inserts a row into the print queue (public.print_jobs) using the
 * simplified { destination, content } shape. Existing legacy columns
 * (type, data, station) are populated for compatibility with the
 * existing Local Print Bridge worker.
 */
export async function enqueuePrintJob({
  restaurantId,
  destination,
  content,
  sessionId = null,
}: EnqueueArgs): Promise<{ id: string | null; error: any }> {
  // Sanitize items
  const items = (content.items || []).map((it) => ({
    qty: Number(it.qty) || 0,
    name: String(it.name ?? ''),
    modifiers: Array.isArray(it.modifiers) ? it.modifiers.filter(Boolean) : [],
    price:
      destination === 'cliente'
        ? Number(it.price ?? 0)
        : it.price != null
          ? Number(it.price)
          : 0,
  }));

  const safeContent: PrintQueueContent = {
    table: content.table || '',
    order_ref: content.order_ref || '',
    items,
    total: destination === 'cliente' ? Number(content.total ?? 0) : Number(content.total ?? 0),
    note: content.note || '',
  };

  const station =
    destination === 'cocina' ? 'kitchen' : destination === 'barra' ? 'bar' : null;

  const row: any = {
    restaurant_id: restaurantId,
    destination,
    content: safeContent,
    // Legacy compatibility fields so existing workers / queries don't break.
    type: destination === 'cliente' ? 'ticket_cliente' : 'kds',
    template_type: destination === 'cliente' ? 'cliente' : station,
    station,
    data: safeContent,
    session_id: sessionId,
    status: 'pending',
  };

  const { data, error } = await (supabase as any)
    .from('print_jobs')
    .insert(row)
    .select('id')
    .single();

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[printQueue] enqueue error', error, row);
    return { id: null, error };
  }
  return { id: (data as any)?.id ?? null, error: null };
}