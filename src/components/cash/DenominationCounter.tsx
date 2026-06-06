import { Input } from '@/components/ui/input';
import { DENOMINATIONS, fmtEuro, sumDenominations } from '@/lib/cash';

interface Props {
  counts: Record<string, number>;
  onChange: (counts: Record<string, number>) => void;
}

export function DenominationCounter({ counts, onChange }: Props) {
  const update = (k: string, v: number) => onChange({ ...counts, [k]: Math.max(0, v || 0) });
  const total = sumDenominations(counts);
  const bills = DENOMINATIONS.filter((d) => d.type === 'bill');
  const coins = DENOMINATIONS.filter((d) => d.type === 'coin');

  const renderRow = (d: { value: number; label: string }) => {
    const k = String(d.value);
    const qty = counts[k] || 0;
    return (
      <div key={k} className="flex items-center gap-3">
        <div className="w-20 text-sm font-medium text-foreground">{d.label}</div>
        <Input
          type="number"
          min={0}
          value={qty || ''}
          onChange={(e) => update(k, parseInt(e.target.value, 10))}
          className="w-24"
        />
        <div className="text-sm text-muted-foreground ml-auto tabular-nums">{fmtEuro(qty * d.value)}</div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-2">Billetes</h4>
          <div className="space-y-2">{bills.map(renderRow)}</div>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-2">Monedas</h4>
          <div className="space-y-2">{coins.map(renderRow)}</div>
        </div>
      </div>
      <div className="flex items-center justify-between pt-3 border-t border-border">
        <span className="text-sm text-muted-foreground">Total arqueado</span>
        <span className="text-2xl font-bold text-foreground tabular-nums">{fmtEuro(total)}</span>
      </div>
    </div>
  );
}