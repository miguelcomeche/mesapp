import { supabase } from '@/integrations/supabase/client';

export type CustomerTicketPayload = {
  restaurant: {
    id: string;
    name: string;
    commercial_name?: string | null;
    legal_name?: string | null;
    tax_id?: string | null;
    address?: string | null;
    postal_code?: string | null;
    city?: string | null;
    province?: string | null;
    country?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    logo_url?: string | null;
  };
  table: { id: string | null; name: string | null; number: string | null };
  order: { id: string | null; number: string | null; created_at: string | null; closed_at: string };
  items: Array<{
    name: string;
    quantity: number;
    unit_price: number;
    line_total: number;
    total: number;
    unit_price_label?: string;
    line_total_label?: string;
    modifiers: Array<{ name: string; price?: number }>;
    notes?: string;
  }>;
  totals: { subtotal: number; discount: number; tax: number; tax_rate?: number; tax_base?: number; tax_amount?: number; total: number };
  payment: { method: string; method_label?: string; amount: number; amount_label?: string; paid_at: string };
  payments?: Array<{ method: string; method_label?: string; amount: number; amount_label?: string; tip?: number | null }>;
  waiter: { id: string | null; name: string | null };
  lines?: string[];
  meta?: { line_width: number; currency: string; locale: string };
};

export type PrintResult = {
  ok: boolean;
  jobId: string | null;
  status: 'printed' | 'failed' | 'no_printer';
  error?: string;
  printer?: { id: string; name: string; connection_mode: string } | null;
};

const log = (...args: any[]) => console.log('[CustomerTicketPrint]', ...args);

// ──────────────────────────────────────────────────────────────────────────────
// Safe formatting helpers for thermal printing
// ──────────────────────────────────────────────────────────────────────────────
const toNum = (v: any): number => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

export function safeFormatCurrency(amount: any, currency = 'EUR'): string {
  const n = toNum(amount);
  const symbol = currency === 'EUR' ? '€' : currency;
  return `${n.toFixed(2).replace('.', ',')} ${symbol}`;
}

export function safeFormatDateTime(input: any): string {
  if (!input) return new Date().toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const d = new Date(input);
  if (isNaN(d.getTime())) return new Date().toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  return d.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function centerText(text: string, w = 42): string {
  const t = String(text ?? '');
  if (t.length >= w) return t.slice(0, w);
  const pad = Math.floor((w - t.length) / 2);
  return ' '.repeat(pad) + t;
}

export function leftRight(left: string, right: string, w = 42): string {
  const l = String(left ?? '');
  const r = String(right ?? '');
  const space = Math.max(1, w - l.length - r.length);
  if (l.length + r.length >= w) return (l + ' ' + r).slice(0, w);
  return l + ' '.repeat(space) + r;
}

export function separator(w = 42): string {
  return '-'.repeat(w);
}

export function wrapText(text: string, w = 42): string[] {
  const t = String(text ?? '');
  const out: string[] = [];
  for (let i = 0; i < t.length; i += w) out.push(t.slice(i, i + w));
  return out.length ? out : [''];
}

function roundMoney(value: number): number {
  return Math.round((toNum(value) + Number.EPSILON) * 100) / 100;
}

function formatTaxRate(rate: number): string {
  const n = toNum(rate) || 10;
  return Number.isInteger(n) ? String(n) : String(n).replace('.', ',');
}

function paymentMethodLabel(method: string): string {
  const key = String(method || '').toLowerCase();
  if (key === 'cash' || key === 'efectivo') return 'Efectivo';
  if (key === 'card' || key === 'tarjeta') return 'Tarjeta';
  if (key === 'split' || key === 'mixto') return 'Mixto';
  return method || 'Pago';
}

function resolveVatTotals(totals: CustomerTicketPayload['totals']) {
  const subtotal = roundMoney(totals?.subtotal);
  const discount = roundMoney(totals?.discount);
  const total = roundMoney(totals?.total);
  const taxRate = toNum(totals?.tax_rate) || 10;
  const divisor = 1 + taxRate / 100;
  const providedBase = toNum(totals?.tax_base);
  const taxBase = roundMoney(providedBase > 0 || total === 0 ? providedBase : total / divisor);
  const providedAmount = toNum(totals?.tax_amount ?? totals?.tax);
  const taxAmount = roundMoney(providedAmount > 0 || total === 0 ? providedAmount : total - taxBase);
  return { subtotal, discount, total, taxRate, taxBase, taxAmount };
}

function renderThermalTotalsLines(totals: CustomerTicketPayload['totals'], w = 42): string[] {
  const { subtotal, discount, total, taxRate, taxBase, taxAmount } = resolveVatTotals(totals);
  const lines: string[] = [];
  if (discount > 0) {
    lines.push(leftRight('Subtotal:', safeFormatCurrency(subtotal), w));
    lines.push(leftRight('Descuento:', `-${safeFormatCurrency(discount)}`, w));
  }
  lines.push(leftRight('Base imponible:', safeFormatCurrency(taxBase), w));
  lines.push(leftRight(`IVA ${formatTaxRate(taxRate)}%:`, safeFormatCurrency(taxAmount), w));
  lines.push(leftRight('TOTAL:', safeFormatCurrency(total), w));
  return lines;
}

function normalizeTicketPayload(payload: CustomerTicketPayload): CustomerTicketPayload {
  const vat = resolveVatTotals(payload.totals);
  return {
    ...payload,
    items: payload.items.map((item) => ({
      ...item,
      unit_price: roundMoney(item.unit_price),
      line_total: roundMoney(item.line_total ?? item.total),
      total: roundMoney(item.total ?? item.line_total),
      unit_price_label: safeFormatCurrency(item.unit_price),
      line_total_label: safeFormatCurrency(item.line_total ?? item.total),
    })),
    totals: {
      ...payload.totals,
      subtotal: vat.subtotal,
      discount: vat.discount,
      tax: vat.taxAmount,
      tax_rate: vat.taxRate,
      tax_base: vat.taxBase,
      tax_amount: vat.taxAmount,
      total: vat.total,
    },
    payment: {
      ...payload.payment,
      method_label: paymentMethodLabel(payload.payment.method),
      amount: roundMoney(payload.payment.amount),
      amount_label: safeFormatCurrency(payload.payment.amount),
    },
    payments: payload.payments?.map((payment) => ({
      ...payment,
      method_label: paymentMethodLabel(payment.method),
      amount: roundMoney(payment.amount),
      amount_label: safeFormatCurrency(payment.amount),
    })),
  };
}

function renderThermalLines(p: CustomerTicketPayload, w = 42): string[] {
  const lines: string[] = [];
  const push = (s: string | string[]) => Array.isArray(s) ? lines.push(...s) : lines.push(s);
  const blank = () => lines.push('');
  const r = p.restaurant;
  // Header priority: commercial_name > name > legal_name > "MESAPP"
  const headerName =
    (r.commercial_name && r.commercial_name.trim()) ||
    (r.name && r.name.trim()) ||
    (r.legal_name && r.legal_name.trim()) ||
    'MESAPP';
  console.log('[CustomerTicketPrint] header selected:', headerName, 'restaurant:', r);
  push(centerText(headerName.toUpperCase(), w));
  blank();
  if (r.legal_name && r.legal_name !== headerName) push(centerText(r.legal_name, w));
  if (r.tax_id) push(centerText(`CIF/NIF: ${r.tax_id}`, w));
  if (r.address) push(wrapText(r.address, w).map(l => centerText(l, w)));
  const cityLine = [r.postal_code, r.city, r.province].filter(Boolean).join(' ');
  if (cityLine) push(centerText(cityLine, w));
  if (r.phone) push(centerText(`Tel: ${r.phone}`, w));
  if (r.email) push(centerText(r.email, w));
  if (r.website) push(centerText(r.website, w));
  blank();
  push(separator(w));
  blank();
  push(centerText('TICKET CLIENTE', w));
  blank();
  push(`Fecha: ${safeFormatDateTime(p.payment.paid_at || p.order.closed_at || p.order.created_at)}`);
  const tableLabel = p.table.name || p.table.number || '-';
  push(`Mesa:  ${tableLabel}`);
  if (p.waiter?.name) push(`Camarero: ${p.waiter.name}`);
  if (p.order.number) push(`Pedido: #${p.order.number}`);
  blank();
  push(separator(w));
  for (const it of p.items) {
    const qty = toNum(it.quantity) || 1;
    const total = toNum(it.line_total ?? it.total ?? qty * toNum(it.unit_price));
    const left = `${qty} x ${it.name}`;
    const right = safeFormatCurrency(total);
    if (left.length + right.length + 1 > w) {
      push(left);
      push(leftRight('', right, w));
    } else {
      push(leftRight(left, right, w));
    }
    for (const m of it.modifiers || []) {
      if (m?.name) push(`  + ${m.name}`);
    }
    if (it.notes) push(`  » ${it.notes}`);
  }
  push(separator(w));
  const totalsLines = renderThermalTotalsLines(p.totals, w);
  log('ticket_cliente totals before print', resolveVatTotals(p.totals));
  log('ticket_cliente generated thermal totals lines', totalsLines);
  push(totalsLines);
  blank();
  push(leftRight(`${paymentMethodLabel(p.payment.method)}:`, safeFormatCurrency(p.payment.amount), w));
  blank();
  push(separator(w));
  push(centerText('Gracias por su visita', w));
  blank();
  blank();
  return lines;
}

async function selectCustomerTicketPrinter(restaurantId: string) {
  const { data, error } = await (supabase as any)
    .from('printers')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('active', true);
  if (error) {
    log('printer query error', error);
    return null;
  }
  if (!data || data.length === 0) return null;
  // Prefer any printer whose `stations` array includes "ticket_cliente".
  const match = (data as any[]).find(p =>
    Array.isArray(p.stations) && p.stations.includes('ticket_cliente')
  );
  if (match) return match;
  // Backwards compatibility with the legacy single `station` enum.
  const legacy = (data as any[]).find(p => p.station === 'tickets' || p.station === 'ticket_cliente');
  if (legacy) return legacy;
  // Last-resort fallback: if there is exactly one active Local Print Bridge
  // printer, allow it and log the fallback.
  const bridges = (data as any[]).filter(p => (p.connection_mode || '') === 'local_bridge');
  if (bridges.length === 1) {
    log('fallback: using only active local_bridge printer for ticket_cliente', bridges[0].id);
    return bridges[0];
  }
  return null;
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

  // Pre-render thermal lines so the bridge can fall back to plain text if needed.
  const lineWidth = (printer.paper_width === 58 ? 32 : 42);
  const renderedLines = renderThermalLines(payload, lineWidth);
  const payloadWithLines: CustomerTicketPayload = {
    ...payload,
    lines: renderedLines,
    meta: { line_width: lineWidth, currency: 'EUR', locale: 'es-ES' },
  };

  const host = printer.ip_address;
  const port = Number(printer.port ?? 9100);
  if (!host || !port) {
    const msg = `La impresora no tiene IP/puerto configurados (host=${host || 'vacío'}, port=${port || 'vacío'}).`;
    log('missing host/port');
    await (supabase as any).from('print_jobs').update({
      status: 'failed', error_message: msg,
    }).eq('id', jobId);
    return { ok: false, jobId, status: 'failed', error: msg, printer };
  }

  const body = {
    print_job_id: jobId,
    restaurant_id: restaurantId,
    printer_id: printer.id,
    // Include both naming conventions for bridge compatibility.
    host,
    port,
    protocol: 'escpos',
    printer_ip: host,
    printer_port: port,
    printer_protocol: 'escpos',
    station: 'ticket_cliente',
    template: 'ticket_cliente',
    template_type: 'ticket_cliente',
    payload: payloadWithLines,
    lines: renderedLines,
  };
  log('bridge body', { host, port, items: payload.items.length, lines: renderedLines.length });

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
    .map((i: any) => {
      const q = toNum(i.quantity) || 1;
      const up = toNum(i.unit_price);
      const lt = toNum(i.line_total ?? i.total ?? q * up);
      return {
        name: i.menu_item?.name || i.name || 'Producto',
        quantity: q,
        unit_price: up,
        line_total: lt,
        total: lt,
        modifiers: ((i.order_item_modifiers || i.modifiers || []) as any[]).map((m: any) => ({
          name: m.modifier_name || m.name || '',
          price: toNum(m.price ?? m.modifier_price ?? 0),
        })),
        notes: i.notes || '',
      };
    });
  const subtotal = items.reduce((s, it) => s + it.total, 0);
  const total = toNum(session?.total_amount ?? subtotal);
  const discount = Math.max(0, +(subtotal - total).toFixed(2));
  const taxRate = toNum((restaurant as any)?.tax_rate) || 10;
  const taxBase = +(total / (1 + taxRate / 100)).toFixed(2);
  const taxAmount = +(total - taxBase).toFixed(2);
  const nowIso = new Date().toISOString();
  const firstOrder = orders[0] || {};
  const tableName = session?.table?.name ?? firstOrder?.table_name ?? null;
  const tableNumber = session?.table?.number != null ? String(session.table.number) : null;
  return {
    restaurant: {
      id: restaurant?.id || session?.restaurant_id,
      name: restaurant?.name || '',
      commercial_name: restaurant?.commercial_name ?? restaurant?.name ?? null,
      legal_name: restaurant?.legal_name ?? null,
      tax_id: restaurant?.tax_id ?? null,
      address: restaurant?.address ?? null,
      postal_code: restaurant?.postal_code ?? null,
      city: restaurant?.city ?? null,
      province: restaurant?.province ?? null,
      country: restaurant?.country ?? null,
      phone: restaurant?.phone ?? null,
      email: restaurant?.email ?? null,
      website: restaurant?.website ?? null,
      logo_url: restaurant?.logo_url ?? null,
    },
    table: {
      id: session?.table_id ?? null,
      name: tableName,
      number: tableNumber,
    },
    order: {
      id: firstOrder?.id ?? null,
      number: firstOrder?.number ?? null,
      created_at: session?.started_at ?? null,
      closed_at: nowIso,
    },
    items,
    totals: { subtotal, discount, tax: taxAmount, tax_rate: taxRate, tax_base: taxBase, tax_amount: taxAmount, total },
    payment: { method: primaryPayment.method, amount: toNum(primaryPayment.amount), paid_at: nowIso },
    payments,
    waiter,
  };
}