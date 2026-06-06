import { Button } from '@/components/ui/button';
import { useCurrentCashSession, useCashSummary, useCashHistory } from '@/hooks/useCashSession';
import { fmtEuro } from '@/lib/cash';
import { Printer } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';

export default function DailyCashReportPage() {
  const { tenant } = useTenant();
  const { session } = useCurrentCashSession();
  const { summary } = useCashSummary(session?.id);
  const { items } = useCashHistory();

  // If no open session, show last closed
  const closed = !session && items.length > 0 ? items[0] : null;
  const data = session && summary ? {
    title: 'Turno actual (en curso)',
    opening: summary.opening_amount,
    cash: summary.cash_sales, card: summary.card_sales, other: summary.other_sales,
    tipsCash: summary.tips_cash, tipsCard: summary.tips_card,
    inT: summary.cash_in_total, outT: summary.cash_out_total,
    expected: summary.expected_amount, counted: null as number | null, diff: null as number | null,
    responsable: session.opened_by_name,
    opened_at: session.opened_at, closed_at: null as string | null,
  } : closed ? {
    title: 'Último cierre',
    opening: Number(closed.opening_amount),
    cash: Number(closed.cash_sales), card: Number(closed.card_sales), other: Number(closed.other_sales),
    tipsCash: Number(closed.tips_cash), tipsCard: Number(closed.tips_card),
    inT: Number(closed.cash_in_total), outT: Number(closed.cash_out_total),
    expected: Number(closed.expected_amount ?? 0),
    counted: closed.counted_amount != null ? Number(closed.counted_amount) : null,
    diff: closed.difference != null ? Number(closed.difference) : null,
    responsable: closed.closed_by_name ?? closed.opened_by_name,
    opened_at: closed.opened_at, closed_at: closed.closed_at,
  } : null;

  if (!data) {
    return <div className="glass-card p-8 text-center text-muted-foreground">Sin datos para el diario aún.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end print:hidden">
        <Button variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4" /> Imprimir / PDF</Button>
      </div>
      <div className="glass-card p-8 max-w-2xl mx-auto space-y-4 print:shadow-none print:border-0">
        <div className="text-center border-b border-border pb-3">
          <h2 className="text-xl font-bold text-foreground">DIARIO DE CAJA</h2>
          <p className="text-sm text-muted-foreground">{tenant?.name ?? ''}</p>
          <p className="text-xs text-muted-foreground">{data.title} · Responsable: {data.responsable ?? '—'}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(data.opened_at).toLocaleString('es-ES')}
            {data.closed_at ? ` → ${new Date(data.closed_at).toLocaleString('es-ES')}` : ''}
          </p>
        </div>

        <Section title="APERTURA">
          <Line label="Fondo inicial" value={fmtEuro(data.opening)} />
        </Section>

        <Section title="VENTAS">
          <Line label="Tarjeta" value={fmtEuro(data.card)} />
          <Line label="Efectivo" value={fmtEuro(data.cash)} />
          <Line label="Otros" value={fmtEuro(data.other)} />
          <Line label="Total" value={fmtEuro(data.cash + data.card + data.other)} bold />
        </Section>

        <Section title="MOVIMIENTOS">
          <Line label="Entradas" value={fmtEuro(data.inT)} />
          <Line label="Salidas" value={`- ${fmtEuro(data.outT)}`} />
        </Section>

        <Section title="PROPINAS">
          <Line label="Efectivo" value={fmtEuro(data.tipsCash)} />
          <Line label="Tarjeta" value={fmtEuro(data.tipsCard)} />
        </Section>

        <Section title="CIERRE">
          <Line label="Esperado" value={fmtEuro(data.expected)} bold />
          {data.counted != null && <Line label="Real" value={fmtEuro(data.counted)} bold />}
          {data.diff != null && (
            <Line
              label="Diferencia"
              value={`${data.diff >= 0 ? '+' : ''}${fmtEuro(data.diff)}`}
              bold
              danger={Math.abs(data.diff) > 0.01}
            />
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-bold tracking-wider text-muted-foreground mb-1">{title}</h3>
      <div className="space-y-1">{children}</div>
    </div>
  );
}
function Line({ label, value, bold, danger }: { label: string; value: string; bold?: boolean; danger?: boolean }) {
  return (
    <div className={`flex justify-between text-sm ${bold ? 'font-semibold' : ''} ${danger ? 'text-destructive' : 'text-foreground'}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}