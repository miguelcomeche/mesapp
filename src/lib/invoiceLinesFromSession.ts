import { supabase } from '@/integrations/supabase/client';

export interface InvoiceLineDraft {
  product_name: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
}

/**
 * Build invoice lines from raw order items (already loaded).
 * Same mapping used when issuing an invoice from an active table session:
 * skips cancelled/void items, appends modifier names to the description,
 * and folds modifier prices into the unit price so line totals match what
 * the customer paid.
 */
export function buildInvoiceLinesFromOrderItems(items: any[]): InvoiceLineDraft[] {
  const valid = (items || []).filter((it: any) => {
    const s = String(it?.status || '').toLowerCase();
    return s !== 'cancelled' && s !== 'canceled' && s !== 'void' && s !== 'deleted';
  });
  return valid.map((it: any) => {
    const mods = (it.order_item_modifiers || []) as any[];
    const modNames = mods.map((m) => m.modifier_name || m.name).filter(Boolean);
    const modsPrice = mods.reduce(
      (s, m) => s + Number(m.price ?? m.modifier_price ?? 0),
      0,
    );
    const baseName = it.menu_item?.name || it.product_name || 'Producto';
    const description = modNames.length ? `${baseName} (${modNames.join(', ')})` : baseName;
    return {
      product_name: description,
      quantity: Number(it.quantity || 1),
      unit_price: Number(it.unit_price || 0) + modsPrice,
      vat_rate: Number(it.menu_item?.vat_rate ?? 10),
    };
  });
}

/**
 * Fetch the orders + items for a table session and return invoice lines.
 * Returns [] when there are no detailed items (caller should fall back to
 * a generic "Consumición" line).
 */
export async function fetchInvoiceLinesForSession(sessionId: string): Promise<InvoiceLineDraft[]> {
  if (!sessionId) return [];
  const { data, error } = await (supabase as any)
    .from('orders')
    .select('items:order_items(*, menu_item:menu_items(*), order_item_modifiers(*))')
    .eq('session_id', sessionId);
  if (error || !data) return [];
  const allItems = (data as any[]).flatMap((o) => o.items || []);
  return buildInvoiceLinesFromOrderItems(allItems);
}

export function fallbackConsumicionLine(total: number): InvoiceLineDraft {
  return { product_name: 'Consumición', quantity: 1, unit_price: Number(total || 0), vat_rate: 10 };
}