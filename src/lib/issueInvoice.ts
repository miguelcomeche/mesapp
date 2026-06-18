import { supabase } from '@/integrations/supabase/client';
import { computeInvoice, InvoiceLineInput } from './invoiceCalc';

export type IssueInvoiceInput = {
  restaurant_id: string;
  type: 'simplificado' | 'completa' | 'rectificativa';
  session_id?: string | null;
  payment_id?: string | null;
  cash_session_id?: string | null;
  table_number?: string | null;
  waiter_name?: string | null;
  issued_by_user_id?: string | null;
  issued_by_waiter_id?: string | null;
  payment_method?: string | null;
  customer?: {
    id?: string | null;
    legal_name?: string | null;
    tax_id?: string | null;
    address?: string | null;
    postal_code?: string | null;
    city?: string | null;
    country?: string | null;
    email?: string | null;
    phone?: string | null;
    save?: boolean;
  } | null;
  rectifies_invoice_id?: string | null;
  rectification_reason?:
    | 'datos_cliente'
    | 'importe'
    | 'devolucion'
    | 'anulacion_parcial'
    | 'otro'
    | null;
  rectification_notes?: string | null;
  lines: InvoiceLineInput[];
};

export async function issueInvoice(input: IssueInvoiceInput) {
  // 1. Restaurant snapshot
  const { data: rest, error: restErr } = await supabase
    .from('restaurants')
    .select('commercial_name,legal_name,tax_id,address,postal_code,city,country,phone,name')
    .eq('id', input.restaurant_id)
    .single();
  if (restErr || !rest) throw restErr || new Error('No restaurant');
  const r = rest as any;

  // 2. Number
  const { data: numRows, error: numErr } = await supabase.rpc(
    'issue_invoice_number' as never,
    { _restaurant: input.restaurant_id, _type: input.type } as never
  );
  if (numErr) throw numErr;
  const arr = numRows as any;
  const numRow = arr && Array.isArray(arr) ? arr[0] : arr;
  if (!numRow) throw new Error('No se pudo generar número de factura');
  const n = numRow as any;

  // 3. Compute totals
  const { lines, totals } = computeInvoice(input.lines);

  // 4. Save customer if requested
  let customer_id: string | null = input.customer?.id ?? null;
  if (input.customer?.save && !customer_id && input.customer.legal_name) {
    const { data: cust } = await supabase
      .from('invoice_customers')
      .insert({
        restaurant_id: input.restaurant_id,
        legal_name: input.customer.legal_name,
        tax_id: input.customer.tax_id ?? null,
        address: input.customer.address ?? null,
        postal_code: input.customer.postal_code ?? null,
        city: input.customer.city ?? null,
        country: input.customer.country ?? 'ES',
        email: input.customer.email ?? null,
        phone: input.customer.phone ?? null,
      })
      .select('id')
      .maybeSingle();
    customer_id = (cust as any)?.id ?? null;
  }

  // 5. Insert invoice
  const { data: inv, error: invErr } = await supabase
    .from('invoices')
    .insert({
      restaurant_id: input.restaurant_id,
      series_id: n.series_id,
      invoice_number: n.invoice_number,
      number_seq: n.seq,
      year: n.year,
      type: input.type,
      status: 'emitida',
      rest_commercial_name: r.commercial_name || r.name,
      rest_legal_name: r.legal_name,
      rest_tax_id: r.tax_id,
      rest_address: r.address,
      rest_postal_code: r.postal_code,
      rest_city: r.city,
      rest_country: r.country,
      rest_phone: r.phone,
      customer_id,
      customer_legal_name: input.customer?.legal_name ?? null,
      customer_tax_id: input.customer?.tax_id ?? null,
      customer_address: input.customer?.address ?? null,
      customer_postal_code: input.customer?.postal_code ?? null,
      customer_city: input.customer?.city ?? null,
      customer_country: input.customer?.country ?? null,
      customer_email: input.customer?.email ?? null,
      customer_phone: input.customer?.phone ?? null,
      session_id: input.session_id ?? null,
      payment_id: input.payment_id ?? null,
      cash_session_id: input.cash_session_id ?? null,
      table_number: input.table_number ?? null,
      waiter_name: input.waiter_name ?? null,
      issued_by_user_id: input.issued_by_user_id ?? null,
      issued_by_waiter_id: input.issued_by_waiter_id ?? null,
      subtotal: totals.subtotal,
      tax_total: totals.tax_total,
      total: totals.total,
      payment_method: input.payment_method ?? null,
      currency: 'EUR',
      rectifies_invoice_id: input.rectifies_invoice_id ?? null,
      rectification_reason: input.rectification_reason ?? null,
      rectification_notes: input.rectification_notes ?? null,
    })
    .select('id,invoice_number')
    .single();
  if (invErr || !inv) throw invErr;

  // 6. Insert items
  const { error: itemsErr } = await supabase.from('invoice_items').insert(
    lines.map((l) => ({
      invoice_id: (inv as any).id,
      position: l.position,
      product_name: l.product_name,
      quantity: l.quantity,
      unit_price: l.unit_price,
      vat_rate: l.vat_rate,
      base_amount: l.base_amount,
      tax_amount: l.tax_amount,
      total_amount: l.total_amount,
    }))
  );
  if (itemsErr) throw itemsErr;

  // 7. Tax breakdown
  if (totals.breakdown.length > 0) {
    await supabase.from('invoice_tax_breakdown').insert(
      totals.breakdown.map((b) => ({
        invoice_id: (inv as any).id,
        vat_rate: b.vat_rate,
        base_amount: b.base_amount,
        tax_amount: b.tax_amount,
      }))
    );
  }

  // 8. If rectificativa → mark original as rectificada
  if (input.type === 'rectificativa' && input.rectifies_invoice_id) {
    await supabase
      .from('invoices')
      .update({ status: 'rectificada' })
      .eq('id', input.rectifies_invoice_id);
  }

  return inv as { id: string; invoice_number: string };
}