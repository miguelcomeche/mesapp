import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { closeCashSession, useCurrentCashSession, useCashSummary } from '@/hooks/useCashSession';
import { fmtEuro, sumDenominations } from '@/lib/cash';
import { DenominationCounter } from '@/components/cash/DenominationCounter';
import { SignaturePad } from '@/components/cash/SignaturePad';

export default function CloseCashSessionPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();
  const { session, refresh } = useCurrentCashSession();
  const { summary } = useCashSummary(session?.id);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [counted, setCounted] = useState<string>('');
  const [signature, setSignature] = useState<string | null>(null);
  const [signedBy, setSignedBy] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const denomTotal = useMemo(() => sumDenominations(counts), [counts]);
  const effectiveCounted = counted !== '' ? Number(counted.replace(',', '.')) : denomTotal;
  const expected = summary?.expected_amount ?? 0;
  const diff = (effectiveCounted || 0) - expected;

  if (!session) {
    return (
      <div className="glass-card p-8 text-center">
        <p className="text-muted-foreground">No hay caja abierta para cerrar.</p>
      </div>
    );
  }

  const submit = async () => {
    setBusy(true);
    try {
      await closeCashSession({
        sessionId: session.id,
        countedAmount: effectiveCounted || 0,
        denominations: Object.keys(counts).length ? counts : null,
        signature,
        signedByName: signedBy || profile?.name || null,
        notes: notes || null,
      });
      await refresh();
      toast({ title: 'Caja cerrada', description: `Diferencia ${fmtEuro(diff)}` });
      navigate('/caja/historial');
    } catch (err: any) {
      toast({ title: 'No se pudo cerrar la caja', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-6">
        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Resumen del turno</h3>
          {!summary ? (
            <p className="text-sm text-muted-foreground">Calculando…</p>
          ) : (
            <div className="space-y-2 text-sm">
              <Row label="Fondo inicial" value={fmtEuro(summary.opening_amount)} />
              <Row label="Ventas efectivo" value={fmtEuro(summary.cash_sales)} />
              <Row label="Ventas tarjeta" value={fmtEuro(summary.card_sales)} />
              <Row label="Otros métodos" value={fmtEuro(summary.other_sales)} />
              <Row label="Propinas efectivo" value={fmtEuro(summary.tips_cash)} />
              <Row label="Propinas tarjeta" value={fmtEuro(summary.tips_card)} />
              <Row label="Entradas de caja" value={fmtEuro(summary.cash_in_total)} />
              <Row label="Salidas de caja" value={`- ${fmtEuro(summary.cash_out_total)}`} />
              <div className="border-t border-border pt-2 mt-2">
                <Row label="Caja esperada" value={fmtEuro(summary.expected_amount)} bold />
              </div>
            </div>
          )}
        </div>

        <div className="glass-card p-6 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Firma de cierre</h3>
          <div>
            <Label>Responsable</Label>
            <Input value={signedBy} onChange={(e) => setSignedBy(e.target.value)} placeholder={profile?.name ?? ''} />
          </div>
          <SignaturePad value={signature} onChange={setSignature} />
          <div>
            <Label>Notas</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Arqueo</h3>
          <DenominationCounter counts={counts} onChange={setCounts} />
          <div className="mt-4 space-y-2">
            <Label>Dinero contado (€)</Label>
            <Input
              type="number"
              step="0.01"
              value={counted}
              placeholder={String(denomTotal.toFixed(2))}
              onChange={(e) => setCounted(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Si lo dejas vacío usamos el total del arqueo.</p>
          </div>
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Esperado</span>
            <span className="font-semibold tabular-nums">{fmtEuro(expected)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Contado</span>
            <span className="font-semibold tabular-nums">{fmtEuro(effectiveCounted || 0)}</span>
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
            <span className="text-sm text-muted-foreground">Diferencia</span>
            <span className={`text-xl font-bold tabular-nums ${Math.abs(diff) < 0.01 ? 'text-status-available' : 'text-destructive'}`}>
              {diff >= 0 ? '+' : ''}{fmtEuro(diff)}
            </span>
          </div>
          <div className="mt-2 text-center text-sm">
            <span className={`status-badge ${Math.abs(diff) < 0.01 ? 'bg-status-available/15 text-status-available' : 'bg-destructive/15 text-destructive'}`}>
              {Math.abs(diff) < 0.01 ? 'Cuadrada' : 'Descuadrada'}
            </span>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => navigate('/caja')}>Cancelar</Button>
          <Button onClick={submit} disabled={busy}>{busy ? 'Cerrando…' : 'Cerrar caja'}</Button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${bold ? 'font-bold text-foreground text-base' : 'text-foreground'}`}>{value}</span>
    </div>
  );
}