import { supabase } from '@/integrations/supabase/client';

export type CustomerTicketPayload = {
  restaurant: { id: string; name: string; address?: string | null; tax_id?: string | null };
  table: { id: string | null; name: string | null; number: string | null };
  order: { id: string | null; number: string | null; created_at: string | null; closed_at: string };
  items: Array<{
    name: string;
    quantity: number;
    unit_price: number;
    total: number;
    modifiers: Array<{ name: string; price?: number }>;
    notes?: string;
  }>;
  totals: { subtotal: number; discount: number; tax: number; total: number };
  payment: { method: string; amount: number; paid_at: string };
  payments?: Array<{ method: string; amount: number; tip?: number | null }>;
  waiter: { id: string | null; name: string | null };
};

export type PrintResult = {
  ok: boolean;
  jobId: string | null;
  status: 'printed' | 'failed' | 'no_printer';
  error?: string;
  printer?: { id: string; name: string; connection_mode: string } | null;
};

const log = (...args: any[]) => console.log('[CustomerTicketPrint]', ...args);

async function selectCustomerTicketPrinter(restaurantId: string) {
  // Schema enum supports: cocina, barra, tickets — "tickets" is our customer-ticket station.
  const { data, error } = await (supabase as any)
    .from('printers')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('active', true)
    .in('station', ['tickets']);
  if (error) {
    log('printer query error', error);
    return null;
  }
  if (!data || data.length === 0) return null;
  // Prefer station "tickets" (only option in current enum); fallback would go here.
  return data[0];
}

export async function printCustomerTicket(
  restaurantId: string,
  payload: CustomerTicketPayload,
  opts?: { sessionId?: string | null; existingJobId?: string | null }
): Promise<PrintResult> {
  log('triggered', { restaurantId, sessionId: opts?.sessionId, retryOf: opts?.existingJobId });

  const printer = await selectCustomerTicketPrinter(restaurantId);
  log('printer selected', printer?.id, printer?.name, printer?.connection_mode);

  // Create or reuse print_job
  let jobId = opts?.existingJobId ?? null;
  const baseJob: any = {
    restaurant_id: restaurantId,
    type: 'customer_ticket',
    template_type: 'ticket_cliente',
    station: 'ticket_cliente',
    status: 'pending',
    data: payload as any,
    payload_json: payload as any,
    session_id: opts?.sessionId ?? null,
    printer_id: printer?.id ?? null,
  };

  if (jobId) {
    await (supabase as any).from('print_jobs').update({
      status: 'pending',
      error_message: null,
      printer_id: printer?.id ?? null,
      payload_json: payload as any,
      data: payload as any,
    }).eq('id', jobId);
  } else {
    const { data: inserted, error: insErr } = await (supabase as any)
      .from('print_jobs')
      .insert(baseJob)
      .select('id')
      .single();
    if (insErr || !inserted) {
      log('insert error', insErr);
      return { ok: false, jobId: null, status: 'failed', error: insErr?.message || 'No se pudo crear el trabajo de impresión.' };
    }
    jobId = inserted.id as string;
  }
  log('print_job', jobId);

  if (!printer) {
    const msg = 'No hay ninguna impresora activa configurada para tickets de cliente.';
    await (supabase as any).from('print_jobs').update({
      status: 'failed', error_message: msg,
    }).eq('id', jobId);
    return { ok: false, jobId, status: 'no_printer', error: msg, printer: null };
  }

  // Mark as printing and increment attempts
  const { data: cur } = await (supabase as any)
    .from('print_jobs').select('attempts').eq('id', jobId).maybeSingle();
  const attempts = ((cur as any)?.attempts ?? 0) + 1;
  await (supabase as any).from('print_jobs').update({
    status: 'printing', attempts,
  }).eq('id', jobId);

  // Only Local Print Bridge mode supported for auto-print here. Direct ePOS works manually via test print.
  const mode = (printer.connection_mode || 'epos_direct') as string;
  if (mode !== 'local_bridge') {
    const msg = `La impresora "${printer.name}" no está en modo Puente Local. Configúrala como "Puente local" para imprimir tickets automáticamente.`;
    log('unsupported mode', mode);
    await (supabase as any).from('print_jobs').update({
      status: 'failed', error_message: msg,
    }).eq('id', jobId);
    return { ok: false, jobId, status: 'failed', error: msg, printer };
  }

  const bridge = String(printer.bridge_url || '').trim().replace(/\/+$/, '');
  if (!bridge) {
    const msg = 'La impresora no tiene URL del puente local configurada.';
    await (supabase as any).from('print_jobs').update({
      status: 'failed', error_message: msg,
    }).eq('id', jobId);
    return { ok: false, jobId, status: 'failed', error: msg, printer };
  }

  const url = `${bridge}/print`;
  log('POST', url);

  const body = {
    print_job_id: jobId,
    restaurant_id: restaurantId,
    printer_id: printer.id,
    printer_ip: printer.ip_address,
    printer_port: printer.port ?? 9100,
    printer_protocol: 'escpos',
    station: 'ticket_cliente',
    template: 'ticket_cliente',
    template_type: 'ticket_cliente',
    payload,
  };

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (printer.bridge_token) headers['Authorization'] = `Bearer ${printer.bridge_token}`;

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(url, {
      method: 'POST', headers, body: JSON.stringify(body), signal: ctrl.signal,
    });
    clearTimeout(t);
    log('bridge status', res.status);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const msg = `Bridge HTTP ${res.status}: ${text || res.statusText}`;
      await (supabase as any).from('print_jobs').update({
        status: 'failed', error_message: msg,
      }).eq('id', jobId);
      return { ok: false, jobId, status: 'failed', error: msg, printer };
    }
    const now = new Date().toISOString();
    await (supabase as any).from('print_jobs').update({
      status: 'printed', printed_at: now, last_successful_print: now, error_message: null,
    }).eq('id', jobId);
    await (supabase as any).from('printers').update({
      last_printed_at: now, last_connected_at: now,
    }).eq('id', printer.id);
    log('printed OK');
    return { ok: true, jobId, status: 'printed', printer };
  } catch (e: any) {
    const isAbort = e?.name === 'AbortError';
    const isNet = String(e?.message || '').toLowerCase().includes('failed to fetch') || isAbort;
    const msg = isNet
      ? 'El puente de impresión local no está conectado.'
      : `Error de red al imprimir: ${e?.message || e}`;
    log('bridge error', msg);
    await (supabase as any).from('print_jobs').update({
      status: 'failed', error_message: msg,
    }).eq('id', jobId);
    return { ok: false, jobId, status: 'failed', error: msg, printer };
  }
}

export function buildCustomerTicketPayload(args: {
  restaurant: any;
  session: any;
  orders: any[];
  payments: Array<{ method: string; amount: number; tip?: number | null }>;
  primaryPayment: { method: string; amount: number };
  waiter: { id: string | null; name: string | null };
}): CustomerTicketPayload {
  const { restaurant, session, orders, payments, primaryPayment, waiter } = args;
  const items = orders
    .flatMap((o: any) => o.items || [])
    .filter((i: any) => i.status !== 'cancelled' && !i.deleted_at)
    .map((i: any) => ({
      name: i.menu_item?.name || 'Producto',
      quantity: Number(i.quantity),
      unit_price: Number(i.unit_price),
      total: Number(i.quantity) * Number(i.unit_price),
      modifiers: ((i.order_item_modifiers || i.modifiers || []) as any[]).map((m: any) => ({
        name: m.modifier_name || m.name || '',
        price: Number(m.price ?? m.modifier_price ?? 0),
      })),
      notes: i.notes || '',
    }));
  const subtotal = items.reduce((s, it) => s + it.total, 0);
  const total = Number(session?.total_amount ?? subtotal);
  const nowIso = new Date().toISOString();
  return {
    restaurant: {
      id: restaurant?.id || session?.restaurant_id,
      name: restaurant?.name || '',
      address: restaurant?.address ?? null,
      tax_id: restaurant?.tax_id ?? null,
    },
    table: {
      id: session?.table_id ?? null,
      name: session?.table?.name ?? null,
      number: session?.table?.number ? String(session.table.number) : null,
    },
    order: {
      id: orders[0]?.id ?? null,
      number: orders[0]?.number ?? null,
      created_at: session?.started_at ?? null,
      closed_at: nowIso,
    },
    items,
    totals: { subtotal, discount: 0, tax: 0, total },
    payment: { method: primaryPayment.method, amount: primaryPayment.amount, paid_at: nowIso },
    payments,
    waiter,
  };
}