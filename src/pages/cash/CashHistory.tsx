import { useMemo, useState } from 'react';
import { useCashHistory } from '@/hooks/useCashSession';
import { fmtEuro, toCSV, downloadFile } from '@/lib/cash';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

export default function CashHistoryPage() {
  const { items } = useCashHistory();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [responsable, setResponsable] = useState('');

  const filtered = useMemo(() => {
    return items.filter((s) => {
      if (from && s.closed_at && new Date(s.closed_at) < new Date(from)) return false;
      if (to && s.closed_at && new Date(s.closed_at) > new Date(to + 'T23:59:59')) return false;
      if (responsable && !(s.closed_by_name ?? s.opened_by_name ?? '').toLowerCase().includes(responsable.toLowerCase())) return false;
      return true;
    });
  }, [items, from, to, responsable]);

  const exportCsv = () => {
    const rows = filtered.map((s) => ({
      apertura: new Date(s.opened_at).toLocaleString('es-ES'),
      cierre: s.closed_at ? new Date(s.closed_at).toLocaleString('es-ES') : '',
      responsable: s.closed_by_name ?? s.opened_by_name ?? '',
      fondo: Number(s.opening_amount).toFixed(2),
      ventas: (Number(s.cash_sales) + Number(s.card_sales) + Number(s.other_sales)).toFixed(2),
      esperado: s.expected_amount != null ? Number(s.expected_amount).toFixed(2) : '',
      contado: s.counted_amount != null ? Number(s.counted_amount).toFixed(2) : '',
      diferencia: s.difference != null ? Number(s.difference).toFixed(2) : '',
    }));
    downloadFile(`cierres-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(rows));
  };

  return (
    <div className="space-y-4">
      <div className="glass-card p-4 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <div>
          <Label>Desde</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <Label>Hasta</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div>
          <Label>Responsable</Label>
          <Input value={responsable} onChange={(e) => setResponsable(e.target.value)} placeholder="Nombre" />
        </div>
        <Button variant="outline" onClick={exportCsv}><Download className="w-4 h-4" /> Exportar CSV</Button>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/30">
            <tr>
              <th className="text-left p-3 font-medium text-muted-foreground">Apertura</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Cierre</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Responsable</th>
              <th className="text-right p-3 font-medium text-muted-foreground">Fondo</th>
              <th className="text-right p-3 font-medium text-muted-foreground">Ventas</th>
              <th className="text-right p-3 font-medium text-muted-foreground">Esperado</th>
              <th className="text-right p-3 font-medium text-muted-foreground">Real</th>
              <th className="text-right p-3 font-medium text-muted-foreground">Diferencia</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Sin cierres</td></tr>
            ) : (
              filtered.map((s) => {
                const sales = Number(s.cash_sales) + Number(s.card_sales) + Number(s.other_sales);
                const diff = Number(s.difference ?? 0);
                return (
                  <tr key={s.id} className="border-t border-border">
                    <td className="p-3 text-muted-foreground">{new Date(s.opened_at).toLocaleString('es-ES')}</td>
                    <td className="p-3 text-muted-foreground">{s.closed_at ? new Date(s.closed_at).toLocaleString('es-ES') : '—'}</td>
                    <td className="p-3 text-foreground">{s.closed_by_name ?? s.opened_by_name ?? '—'}</td>
                    <td className="p-3 text-right tabular-nums">{fmtEuro(s.opening_amount)}</td>
                    <td className="p-3 text-right tabular-nums">{fmtEuro(sales)}</td>
                    <td className="p-3 text-right tabular-nums">{fmtEuro(s.expected_amount ?? 0)}</td>
                    <td className="p-3 text-right tabular-nums">{fmtEuro(s.counted_amount ?? 0)}</td>
                    <td className={`p-3 text-right tabular-nums font-semibold ${Math.abs(diff) < 0.01 ? 'text-status-available' : 'text-destructive'}`}>
                      {diff >= 0 ? '+' : ''}{fmtEuro(diff)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}