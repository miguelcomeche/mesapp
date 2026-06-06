export const formatEUR = (n: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(
    Number.isFinite(n) ? n : 0,
  );

export const formatDuration = (minutes: number) => {
  if (!Number.isFinite(minutes) || minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} min`;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
};

export const pct = (current: number, prev: number) => {
  if (!prev) return current ? 100 : 0;
  return ((current - prev) / prev) * 100;
};

export type DatePreset =
  | 'today'
  | 'yesterday'
  | 'last7'
  | 'last30'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisYear'
  | 'custom';

export interface DateRange {
  from: Date;
  to: Date;
  label: string;
}

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const endOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

export function rangeFromPreset(preset: DatePreset, custom?: { from: Date; to: Date }): DateRange {
  const now = new Date();
  switch (preset) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now), label: 'Hoy' };
    case 'yesterday': {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { from: startOfDay(y), to: endOfDay(y), label: 'Ayer' };
    }
    case 'last7': {
      const f = new Date(now);
      f.setDate(f.getDate() - 6);
      return { from: startOfDay(f), to: endOfDay(now), label: 'Últimos 7 días' };
    }
    case 'last30': {
      const f = new Date(now);
      f.setDate(f.getDate() - 29);
      return { from: startOfDay(f), to: endOfDay(now), label: 'Últimos 30 días' };
    }
    case 'thisMonth': {
      const f = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: startOfDay(f), to: endOfDay(now), label: 'Este mes' };
    }
    case 'lastMonth': {
      const f = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const t = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: startOfDay(f), to: endOfDay(t), label: 'Mes anterior' };
    }
    case 'thisYear': {
      const f = new Date(now.getFullYear(), 0, 1);
      return { from: startOfDay(f), to: endOfDay(now), label: 'Este año' };
    }
    case 'custom':
      return {
        from: startOfDay(custom?.from ?? now),
        to: endOfDay(custom?.to ?? now),
        label: 'Personalizado',
      };
  }
}

export function previousRange(r: DateRange): DateRange {
  const ms = r.to.getTime() - r.from.getTime();
  const to = new Date(r.from.getTime() - 1);
  const from = new Date(to.getTime() - ms);
  return { from, to, label: 'Periodo anterior' };
}

export function toCSV(rows: Array<Record<string, unknown>>): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n');
}

export function downloadFile(filename: string, content: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}