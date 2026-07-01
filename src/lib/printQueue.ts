import { supabase } from '@/integrations/supabase/client';
import {
  renderCustomerTicketText,
  type CustomerTicketPayload,
} from '@/lib/customerTicketPrint';

export type PrintDestination = 'cocina' | 'barra' | 'cliente' | 'factura';

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
  /** Pre-rendered 42-char-wide ticket text (clients only). */
  thermal_text?: string;
  /** Pre-rendered ticket lines (clients only). */
  lines?: string[];
  /**
   * Restaurant fiscal header (name, CIF/NIF, address, phone…). Sent so any
   * downstream renderer (Pi bridge fallback template) has real data and
   * never falls back to a generic "MESAPP" brand.
   */
  restaurant?: Record<string, any> | null;
}

export interface EnqueueArgs {
  restaurantId: string;
  destination: PrintDestination;
  content: PrintQueueContent;
  sessionId?: string | null;
  /**
   * Optional full customer-ticket payload. When provided AND destination === 'cliente',
   * the same generator used by legacy `customer_ticket` jobs renders the full
   * ticket (restaurant header, CIF/NIF, base imponible, IVA, total) and the
   * resulting `thermal_text` + `lines` are embedded inside `content`.
   */
  customerTicket?: CustomerTicketPayload | null;
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
  customerTicket = null,
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
    total: Number(content.total ?? 0),
    note: content.note || '',
  };

  // Preserve any pre-rendered thermal text/lines the caller already built
  // (invoice template, customer ticket, etc.) so the Raspberry Pi bridge
  // prints exactly what we generated instead of falling back to its own
  // renderer.
  if (content.thermal_text) safeContent.thermal_text = content.thermal_text;
  if (content.lines && content.lines.length) safeContent.lines = content.lines;
  if (content.restaurant) safeContent.restaurant = content.restaurant;

  // Enrich client tickets with the fully formatted ticket text/lines so the
  // print bridge can render header + fiscal data without extra lookups.
  if (destination === 'cliente' && customerTicket) {
    try {
      const { thermal_text, lines } = renderCustomerTicketText(customerTicket, 42);
      safeContent.thermal_text = thermal_text;
      safeContent.lines = lines;
      // Override items/total so any fallback renderer that ignores
      // thermal_text/lines still sees the SAME filtered items (partial
      // payments) and the SAME total that we printed.
      safeContent.items = customerTicket.items.map((it) => ({
        qty: Number(it.quantity) || 0,
        name: String(it.name ?? ''),
        modifiers: (it.modifiers || []).map((m: any) => m?.name).filter(Boolean),
        price: Number(it.line_total ?? it.total ?? 0),
      }));
      safeContent.total = Number(customerTicket.totals?.total ?? 0);
      // Attach restaurant fiscal header (no MESAPP fallback ever).
      safeContent.restaurant = customerTicket.restaurant as any;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[printQueue] failed to render customer ticket text', e);
    }
  }

  const station =
    destination === 'cocina' ? 'kitchen' : destination === 'barra' ? 'bar' : null;

  // Map destination -> legacy type / template_type used by the Pi worker.
  let legacyType: string;
  let templateType: string | null;
  if (destination === 'factura') {
    legacyType = 'factura';
    templateType = 'factura';
  } else if (destination === 'cliente') {
    legacyType = 'ticket_cliente';
    templateType = 'cliente';
  } else {
    legacyType = 'kds';
    templateType = station;
  }

  const row: any = {
    restaurant_id: restaurantId,
    destination,
    content: safeContent,
    // Legacy compatibility fields so existing workers / queries don't break.
    type: legacyType,
    template_type: templateType,
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