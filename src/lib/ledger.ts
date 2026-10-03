// Single accounting calculation layer for Libro diario de ventas.
// Used by the screen, PDF, XLSX and CSV exports so all figures match.
import { supabase } from '@/integrations/supabase/client';

export interface RawLedger {
  restaurant: Record<string, any>;
  from: string;
  to: string;
  tickets: Array<{
    id: string; ticket_number: number | null; closed_at: string; started_at: string;
    table: string | null; waiter: string | null; guests: number;
    items: Array<{ name: string; qty: number; unit_price: number; vat: number; status: string; complimentary: boolean; deleted: boolean; mods: number }>;
  }>;
  payments: Array<{ id: string; session_id: string; amount: number; tip: number; method: string; discount: number; voided: boolean; processed_at: string; void_reason: string | null }>;
  refunds: Array<{ id: string; payment_id: string; session_id: string; amount: number; method: string; reason: string; created_at: string; created_by_name: string | null }>;
  invoices: Array<{ id: string; invoice_number: string; issued_at: string; customer: string | null; tax_id: string | null; session_id: string | null; subtotal: number; tax_total: number; total: number; type: string; status: string }>;
  cash_sessions: Array<Record<string, any>>;
}

export interface VatRow { rate: number; base: number; vat: number; total: number }
export interface TicketCalc {
  id: string; number: string; date: string; closedAt: Date; table: string; waiter: string;
  gross: number; discount: number; refunds: number; net: number; base: number; vat: number;
  cash: number; card: number; other: number; collected: number; diff: number;
  status: 'Completado' | 'Devuelto' | 'Devolución parcial';
  valid: boolean; vatRows: VatRow[];
  invoice: { id: string; number: string; type: string; status: string } | null;
}
export interface DayCalc {
  date: string; tickets: number; gross: number; discount: number; refunds: number; net: number;
  base: number; vat: number; cash: number; card: number; other: number; collected: number; diff: number;
  vatRows: VatRow[];
}
export interface PaymentLine { date: Date; ticket: string; method: string; amount: number; status: string; reference: string }
export interface Ledger {
  raw: RawLedger;
  tickets: TicketCalc[];
  days: DayCalc[];
  totals: Omit<DayCalc, 'date'>;
  vat: VatRow[];
  paymentLines: PaymentLine[];
  refundLines: Array<{ date: Date; ticket: string; amount: number; method: string; reason: string; kind: string }>;
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const methodBucket = (m: string): 'cash' | 'card' | 'other' => (m === 'cash' ? 'cash' : m === 'card' ? 'card' : 'other');
export const METHOD_LABEL: Record<string, string> = { cash: 'Efectivo', card: 'Tarjeta', split: 'Mixto', other: 'Otros' };

function mergeVat(target: Map<number, VatRow>, rows: VatRow[]) {
  rows.forEach((v) => {
    const c = target.get(v.rate) ?? { rate: v.rate, base: 0, vat: 0, total: 0 };
    c.base += v.base; c.vat += v.vat; c.total += v.total;
    target.set(v.rate, c);
  });
}
const finishVat = (m: Map<number, VatRow>) =>
  Array.from(m.values()).sort((a, b) => a.rate - b.rate).map((v) => ({ rate: v.rate, base: r2(v.base), vat: r2(v.vat), total: r2(v.total) }));

export function computeLedger(raw: RawLedger): Ledger {
  const paysBySession = new Map<string, RawLedger['payments']>();
  raw.payments.forEach((p) => paysBySession.set(p.session_id, [...(paysBySession.get(p.session_id) ?? []), p]));
  const refBySession = new Map<string, RawLedger['refunds']>();
  raw.refunds.forEach((r) => refBySession.set(r.session_id, [...(refBySession.get(r.session_id) ?? []), r]));
  const invBySession = new Map<string, RawLedger['invoices'][number]>();
  raw.invoices.forEach((i) => { if (i.session_id) invBySession.set(i.session_id, i); });

  const ticketNo = new Map<string, string>();
  const tickets: TicketCalc[] = raw.tickets.map((t) => {
    const number = t.ticket_number ? `#${String(t.ticket_number).padStart(5, '0')}` : '—';
    ticketNo.set(t.id, number);
    const lines = t.items
      .filter((i) => i.status !== 'cancelled' && !i.deleted)
      .map((i) => ({ amount: Number(i.qty) * (Number(i.unit_price) + Number(i.mods || 0)), vat: Number(i.vat ?? 10) }));
    const gross = lines.reduce((a, l) => a + l.amount, 0);
    const pays = paysBySession.get(t.id) ?? [];
    const refs = refBySession.get(t.id) ?? [];
    const live = pays.filter((p) => !p.voided);
    const discount = live.reduce((a, p) => a + Number(p.discount || 0), 0);
    const voidedAmt = pays.filter((p) => p.voided).reduce((a, p) => a + Number(p.amount), 0);
    const refundAmt = refs.reduce((a, r) => a + Number(r.amount), 0);
    // A voided payment means the sale it covered was returned.
    const refunds = Math.min(gross - discount, voidedAmt + refundAmt);
    const net = r2(gross - discount - refunds);
    const factor = gross > 0 ? net / gross : 0;
    const vm = new Map<number, VatRow>();
    lines.forEach((l) => {
      const total = l.amount * factor;
      const base = total / (1 + l.vat / 100);
      mergeVat(vm, [{ rate: l.vat, base, vat: total - base, total }]);
    });
    const vatRows = finishVat(vm);
    const coll = { cash: 0, card: 0, other: 0 };
    live.forEach((p) => { coll[methodBucket(p.method)] += Number(p.amount); });
    refs.forEach((r) => { coll[methodBucket(r.method)] -= Number(r.amount); });
    const collected = r2(coll.cash + coll.card + coll.other);
    const base = r2(vatRows.reduce((a, v) => a + v.base, 0));
    const vat = r2(net - base);
    const valid = net > 0.004;
    const inv = invBySession.get(t.id);
    const closedAt = new Date(t.closed_at);
    return {
      id: t.id, number, date: dayKey(closedAt), closedAt,
      table: t.table ?? '—', waiter: t.waiter ?? '—',
      gross: r2(gross), discount: r2(discount), refunds: r2(refunds), net, base, vat,
      cash: r2(coll.cash), card: r2(coll.card), other: r2(coll.other), collected, diff: r2(net - collected),
      status: refunds > 0 ? (valid ? 'Devolución parcial' : 'Devuelto') : 'Completado',
      valid, vatRows,
      invoice: inv ? { id: inv.id, number: inv.invoice_number, type: inv.type, status: inv.status } : null,
    };
  });

  const dayMap = new Map<string, { d: DayCalc; vm: Map<number, VatRow> }>();
  const totalVm = new Map<number, VatRow>();
  const blank = (date: string): DayCalc => ({ date, tickets: 0, gross: 0, discount: 0, refunds: 0, net: 0, base: 0, vat: 0, cash: 0, card: 0, other: 0, collected: 0, diff: 0, vatRows: [] });
  const totals = blank('');
  tickets.forEach((t) => {
    const e = dayMap.get(t.date) ?? { d: blank(t.date), vm: new Map() };
    for (const tgt of [e.d, totals]) {
      if (t.valid) tgt.tickets += 1;
      (['gross', 'discount', 'refunds', 'net', 'base', 'vat', 'cash', 'card', 'other', 'collected', 'diff'] as const).forEach((k) => { tgt[k] = r2(tgt[k] + t[k]); });
    }
    mergeVat(e.vm, t.vatRows); mergeVat(totalVm, t.vatRows);
    dayMap.set(t.date, e);
  });
  const days = Array.from(dayMap.values()).map(({ d, vm }) => ({ ...d, vatRows: finishVat(vm) })).sort((a, b) => a.date.localeCompare(b.date));

  const paymentLines: PaymentLine[] = raw.payments.map((p) => ({
    date: new Date(p.processed_at), ticket: ticketNo.get(p.session_id) ?? '—',
    method: METHOD_LABEL[p.method] ?? p.method, amount: r2(Number(p.amount)),
    status: p.voided ? 'Anulado' : 'Cobrado', reference: p.void_reason ? `Anulación: ${p.void_reason}` : '',
  }));
  const refundLines = [
    ...raw.payments.filter((p) => p.voided).map((p) => ({ date: new Date(p.processed_at), ticket: ticketNo.get(p.session_id) ?? '—', amount: r2(Number(p.amount)), method: METHOD_LABEL[p.method] ?? p.method, reason: p.void_reason ?? '', kind: 'Cobro anulado' })),
    ...raw.refunds.map((r) => ({ date: new Date(r.created_at), ticket: ticketNo.get(r.session_id) ?? '—', amount: r2(Number(r.amount)), method: METHOD_LABEL[r.method] ?? r.method, reason: r.reason, kind: 'Devolución' })),
  ];

  const { date: _d, ...tot } = totals;
  return { raw, tickets, days, totals: { ...tot, vatRows: finishVat(totalVm) }, vat: finishVat(totalVm), paymentLines, refundLines };
}

export async function fetchLedger(restaurantId: string, from: Date, to: Date): Promise<Ledger> {
  const { data, error } = await supabase.rpc('sales_ledger' as any, { _restaurant: restaurantId, _from: from.toISOString(), _to: to.toISOString() } as any);
  if (error) throw error;
  return computeLedger(data as unknown as RawLedger);
}

export function dailyClosingSummary(l: Ledger, date: string) {
  const day = l.days.find((d) => d.date === date);
  const ts = l.tickets.filter((t) => t.date === date && t.valid);
  const cs = l.raw.cash_sessions.filter((c) => dayKey(new Date(c.opened_at)) === date);
  return {
    restaurant: l.raw.restaurant,
    date,
    first_ticket: ts[0]?.number ?? null,
    last_ticket: ts[ts.length - 1]?.number ?? null,
    sales: day ?? null,
    cash_register: cs.map((c) => ({
      opening: c.opening_amount, cash_sales: c.cash_sales, cash_in: c.cash_in_total, cash_out: c.cash_out_total,
      expected: c.expected_amount, counted: c.counted_amount, difference: c.difference, status: c.status,
    })),
    reconciliation: day ? { sales: day.net, payments: day.collected, difference: day.diff } : null,
  };
}
