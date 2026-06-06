export const DENOMINATIONS: { value: number; label: string; type: 'bill' | 'coin' }[] = [
  { value: 500, label: '500 €', type: 'bill' },
  { value: 200, label: '200 €', type: 'bill' },
  { value: 100, label: '100 €', type: 'bill' },
  { value: 50, label: '50 €', type: 'bill' },
  { value: 20, label: '20 €', type: 'bill' },
  { value: 10, label: '10 €', type: 'bill' },
  { value: 5, label: '5 €', type: 'bill' },
  { value: 2, label: '2 €', type: 'coin' },
  { value: 1, label: '1 €', type: 'coin' },
  { value: 0.5, label: '0,50 €', type: 'coin' },
  { value: 0.2, label: '0,20 €', type: 'coin' },
  { value: 0.1, label: '0,10 €', type: 'coin' },
  { value: 0.05, label: '0,05 €', type: 'coin' },
];

export function fmtEuro(value: number | null | undefined): string {
  return `${(Number(value || 0)).toFixed(2)} €`;
}

export function sumDenominations(counts: Record<string, number>): number {
  return DENOMINATIONS.reduce((sum, d) => sum + (counts[String(d.value)] || 0) * d.value, 0);
}

export const MOVEMENT_REASONS_IN = ['Cambio recibido', 'Aporte fondo', 'Devolución', 'Otro'];
export const MOVEMENT_REASONS_OUT = ['Taxi', 'Compra hielo', 'Compra urgente', 'Mercado', 'Repartidor', 'Retiro', 'Otro'];

export const DISCOUNT_REASONS = ['Cortesía', 'Cliente VIP', 'Incidencia', 'Promoción', 'Otro'];

export function toCSV(rows: Record<string, any>[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(';'), ...rows.map((r) => headers.map((h) => escape(r[h])).join(';'))].join('\n');
}

export function downloadFile(name: string, content: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}