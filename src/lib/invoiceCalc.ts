// Invoice calculations and formatting helpers (es-ES, EUR)

export type InvoiceLineInput = {
  product_name: string;
  quantity: number;
  unit_price: number; // VAT included
  vat_rate: number; // e.g. 10
};

export type InvoiceLineComputed = InvoiceLineInput & {
  position: number;
  base_amount: number;
  tax_amount: number;
  total_amount: number;
};

export type InvoiceTotals = {
  subtotal: number;
  tax_total: number;
  total: number;
  breakdown: { vat_rate: number; base_amount: number; tax_amount: number }[];
};

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function computeInvoice(lines: InvoiceLineInput[]): {
  lines: InvoiceLineComputed[];
  totals: InvoiceTotals;
} {
  const computed: InvoiceLineComputed[] = lines.map((l, i) => {
    const total = r2(l.unit_price * l.quantity);
    const base = r2(total / (1 + (l.vat_rate || 0) / 100));
    const tax = r2(total - base);
    return {
      ...l,
      position: i,
      total_amount: total,
      base_amount: base,
      tax_amount: tax,
    };
  });

  const byRate = new Map<number, { base_amount: number; tax_amount: number }>();
  for (const l of computed) {
    const cur = byRate.get(l.vat_rate) || { base_amount: 0, tax_amount: 0 };
    cur.base_amount = r2(cur.base_amount + l.base_amount);
    cur.tax_amount = r2(cur.tax_amount + l.tax_amount);
    byRate.set(l.vat_rate, cur);
  }
  const breakdown = Array.from(byRate.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([vat_rate, v]) => ({ vat_rate, ...v }));

  const subtotal = r2(breakdown.reduce((s, b) => s + b.base_amount, 0));
  const tax_total = r2(breakdown.reduce((s, b) => s + b.tax_amount, 0));
  const total = r2(subtotal + tax_total);
  return { lines: computed, totals: { subtotal, tax_total, total, breakdown } };
}

export const fmtEUR = (n: number) =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(n || 0));

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export const VAT_RATES = [0, 4, 10, 21];