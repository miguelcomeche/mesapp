import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useCurrentCashSession, useCashMovements, registerCashMovement } from '@/hooks/useCashSession';
import { fmtEuro, MOVEMENT_REASONS_IN, MOVEMENT_REASONS_OUT, toCSV, downloadFile } from '@/lib/cash';
import { ArrowDownCircle, ArrowUpCircle, Plus, Download } from 'lucide-react';

export default function CashMovementsPage() {
  const { session } = useCurrentCashSession();
  const { movements, refresh } = useCashMovements(session?.id);
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<'in' | 'out'>('out');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const reasons = type === 'in' ? MOVEMENT_REASONS_IN : MOVEMENT_REASONS_OUT;

  const submit = async () => {
    if (!session) return;
    const amt = Number(amount.replace(',', '.'));
    if (!amt || amt <= 0) {
      toast({ title: 'Importe inválido', variant: 'destructive' });
      return;
    }
    if (!reason) {
      toast({ title: 'Selecciona un motivo', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      await registerCashMovement({ sessionId: session.id, type, amount: amt, reason, notes: notes || null });
      await refresh();
      toast({ title: type === 'in' ? 'Entrada registrada' : 'Salida registrada', description: fmtEuro(amt) });
      setOpen(false);
      setAmount(''); setReason(''); setNotes('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = () => {
    const rows = movements.map((m) => ({
      fecha: new Date(m.created_at).toLocaleString('es-ES'),
      tipo: m.type === 'in' ? 'Entrada' : 'Salida',
      importe: Number(m.amount).toFixed(2),
      motivo: m.reason,
      notas: m.notes ?? '',
      usuario: m.created_by_name ?? '',
    }));
    downloadFile(`movimientos-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(rows));
  };

  if (!session) {
    return <div className="glass-card p-8 text-center text-muted-foreground">Abra una caja para registrar movimientos.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{movements.length} movimientos en el turno actual</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv}><Download className="w-4 h-4" /> Exportar</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-4 h-4" /> Nuevo movimiento</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Movimiento de caja</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant={type === 'in' ? 'default' : 'outline'} onClick={() => setType('in')}>
                    <ArrowDownCircle className="w-4 h-4" /> Entrada
                  </Button>
                  <Button type="button" variant={type === 'out' ? 'default' : 'outline'} onClick={() => setType('out')}>
                    <ArrowUpCircle className="w-4 h-4" /> Salida
                  </Button>
                </div>
                <div>
                  <Label>Importe (€)</Label>
                  <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
                </div>
                <div>
                  <Label>Motivo</Label>
                  <Select value={reason} onValueChange={setReason}>
                    <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                    <SelectContent>
                      {reasons.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Observaciones</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button onClick={submit} disabled={busy}>{busy ? 'Guardando…' : 'Registrar'}</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/30">
            <tr>
              <th className="text-left p-3 font-medium text-muted-foreground">Fecha</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Tipo</th>
              <th className="text-right p-3 font-medium text-muted-foreground">Importe</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Motivo</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Notas</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Usuario</th>
            </tr>
          </thead>
          <tbody>
            {movements.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Sin movimientos</td></tr>
            ) : (
              movements.map((m) => (
                <tr key={m.id} className="border-t border-border">
                  <td className="p-3 text-muted-foreground">{new Date(m.created_at).toLocaleString('es-ES')}</td>
                  <td className="p-3">
                    <span className={`status-badge ${m.type === 'in' ? 'bg-status-available/15 text-status-available' : 'bg-destructive/15 text-destructive'}`}>
                      {m.type === 'in' ? 'Entrada' : 'Salida'}
                    </span>
                  </td>
                  <td className="p-3 text-right tabular-nums font-medium">
                    {m.type === 'out' ? '-' : '+'}{fmtEuro(m.amount)}
                  </td>
                  <td className="p-3 text-foreground">{m.reason}</td>
                  <td className="p-3 text-muted-foreground">{m.notes ?? '—'}</td>
                  <td className="p-3 text-muted-foreground">{m.created_by_name ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}