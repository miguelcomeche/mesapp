import { enqueuePrintJob } from '@/lib/printQueue';
import {
  centerText,
  leftRight,
  separator,
  wrapText,
  safeFormatCurrency,
  safeFormatDateTime,
} from '@/lib/customerTicketPrint';

export type InvoiceThermalPayload = {
  restaurant: {
    commercial_name?: string | null;
    legal_name?: string | null;
    name?: string | null;
    tax_id?: string | null;
    address?: string | null;
    postal_code?: string | null;
    city?: string | null;
    country?: string | null;
    phone?: string | null;
  };
  invoice: {
    number: string;
    type: 'simplificado' | 'completa' | 'rectificativa';
    issued_at: string;
    payment_method?: string | null;
    table_number?: string | null;
    waiter_name?: string | null;
    rectifies_invoice_number?: string | null;
  };
  customer?: {
    legal_name?: string | null;
    tax_id?: string | null;
    address?: string | null;
    postal_code?: string | null;
    city?: string | null;
    country?: string | null;
  } | null;
  items: Array<{
    product_name: string;
    quantity: number;
    unit_price: number;
    vat_rate: number;
    total_amount: number;
  }>;
  breakdown: Array<{ vat_rate: number; base_amount: number; tax_amount: number }>;
  totals: { subtotal: number; tax_total: number; total: number };
};

function paymentLabel(m?: string | null): string {
  const k = String(m || '').toLowerCase();
  if (!k) return '';
  if (k === 'cash' || k === 'efectivo') return 'Efectivo';
  if (k === 'card' || k === 'tarjeta') return 'Tarjeta';
  if (k === 'split' || k === 'mixto') return 'Mixto';
  return m || '';
}

/**
 * Render an invoice as thermal-printer text (42 cols, 80mm).
 * Same visual style as renderCustomerTicketText so the Raspberry Pi bridge
 * can print it via `content.thermal_text` / `content.lines`.
 */
export function renderInvoiceThermalText(
  p: InvoiceThermalPayload,
  w = 42,
): { lines: string[]; thermal_text: string } {
  const lines: string[] = [];
  const push = (s: string | string[]) =>
    Array.isArray(s) ? lines.push(...s) : lines.push(s);
  const blank = () => lines.push('');

  const r = p.restaurant || {};
  const headerName =
    (r.commercial_name && r.commercial_name.trim()) ||
    (r.name && r.name.trim()) ||
    (r.legal_name && r.legal_name.trim()) ||
    '';

  if (headerName) {
    push(centerText(headerName.toUpperCase(), w));
    blank();
  }
  if (r.legal_name && r.legal_name !== headerName) push(centerText(r.legal_name, w));
  if (r.tax_id) push(centerText(`CIF/NIF: ${r.tax_id}`, w));
  if (r.address) push(wrapText(r.address, w).map((l) => centerText(l, w)));
  const cityLine = [r.postal_code, r.city].filter(Boolean).join(' ');
  if (cityLine) push(centerText(cityLine, w));
  if (r.phone) push(centerText(`Tel: ${r.phone}`, w));
  blank();
  push(separator(w));
  blank();

  const rawTitle =
    p.invoice.type === 'rectificativa'
      ? 'FACTURA RECTIFICATIVA'
      : p.invoice.type === 'simplificado'
        ? 'TICKET SIMPLIFICADO'
        : 'FACTURA';
  // Highlight the title with a double-line frame so it stands out from
  // the regular customer ticket ("CLIENTE") layout.
  const bar = '='.repeat(w);
  push(bar);
  push(centerText(rawTitle, w));
  push(bar);
  push(centerText(`Nº ${p.invoice.number}`, w));
  if (p.invoice.rectifies_invoice_number) {
    push(centerText(`Rectifica: ${p.invoice.rectifies_invoice_number}`, w));
  }
  blank();
  push(`Fecha: ${safeFormatDateTime(p.invoice.issued_at)}`);
  if (p.invoice.table_number) push(`Mesa:  ${p.invoice.table_number}`);
  if (p.invoice.waiter_name) push(`Camarero: ${p.invoice.waiter_name}`);
  blank();

  // Customer
  const c = p.customer;
  if (c && (c.legal_name || c.tax_id)) {
    push(separator(w));
    push('CLIENTE:');
    if (c.legal_name) push(wrapText(c.legal_name, w));
    if (c.tax_id) push(`NIF/CIF: ${c.tax_id}`);
    if (c.address) push(wrapText(c.address, w));
    const cCity = [c.postal_code, c.city].filter(Boolean).join(' ');
    if (cCity) push(cCity);
    if (c.country) push(c.country);
    blank();
  }

  // Items — columns: description / qty x unit_price = total
  push(separator(w));
  push(leftRight('Descripción', 'Importe', w));
  push(separator(w));
  for (const it of p.items) {
    const qty = Number(it.quantity) || 0;
    const total = Number(it.total_amount) || 0;
    const left = it.product_name;
    const right = safeFormatCurrency(total);
    if (left.length + right.length + 1 > w) {
      push(wrapText(left, w));
      push(leftRight('', right, w));
    } else {
      push(leftRight(left, right, w));
    }
    // Sub-line: qty x unit_price · IVA rate
    push(
      leftRight(
        `   ${qty} x ${safeFormatCurrency(it.unit_price)}`,
        `IVA ${it.vat_rate}%`,
        w,
      ),
    );
  }
  push(separator(w));

  // VAT breakdown
  for (const b of p.breakdown) {
    push(leftRight(`Base ${b.vat_rate}%:`, safeFormatCurrency(b.base_amount), w));
    push(leftRight(`IVA  ${b.vat_rate}%:`, safeFormatCurrency(b.tax_amount), w));
  }
  push(separator(w));
  push(leftRight('Base imponible:', safeFormatCurrency(p.totals.subtotal), w));
  push(leftRight('Total IVA:', safeFormatCurrency(p.totals.tax_total), w));
  push(bar);
  push(leftRight('TOTAL FACTURA:', safeFormatCurrency(p.totals.total), w));
  push(bar);
  blank();

  const pm = paymentLabel(p.invoice.payment_method);
  if (pm) {
    push(leftRight('Forma de pago:', pm, w));
    blank();
  }

  push(separator(w));
  push(centerText('Gracias', w));
  blank();
  blank();

  return { lines, thermal_text: lines.join('\n') };
}

/**
 * Enqueue an invoice for thermal printing via print_jobs.
 * Uses destination='cliente' so the existing print-bridge / Raspberry Pi
 * worker picks it up without any edge-function changes. The pre-rendered
 * `thermal_text` + `lines` are embedded in `content` so the Pi prints
 * exactly what we generate here.
 */
export async function enqueueInvoiceThermalPrint(
  restaurantId: string,
  payload: InvoiceThermalPayload,
  opts?: { sessionId?: string | null },
): Promise<{ id: string | null; error: any }> {
  const { lines, thermal_text } = renderInvoiceThermalText(payload, 42);
  return enqueuePrintJob({
    restaurantId,
    destination: 'factura',
    sessionId: opts?.sessionId ?? null,
    content: {
      table: payload.invoice.table_number || '',
      order_ref: payload.invoice.number,
      items: payload.items.map((it) => ({
        qty: Number(it.quantity) || 0,
        name: it.product_name,
        price: Number(it.total_amount) || 0,
      })),
      total: Number(payload.totals.total) || 0,
      note: `FACTURA ${payload.invoice.number}`,
      thermal_text,
      lines,
    },
  });
}