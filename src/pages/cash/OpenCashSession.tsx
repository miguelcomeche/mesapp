import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { openCashSession, useCurrentCashSession } from '@/hooks/useCashSession';
import { fmtEuro } from '@/lib/cash';

export default function OpenCashSessionPage() {
  const { restaurantId, profile } = useAuth();
  const { session, refresh } = useCurrentCashSession();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [opening, setOpening] = useState('300');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  if (session) {
    return (
      <div className="glass-card p-8 text-center space-y-3">
        <p className="text-lg font-semibold text-foreground">Ya existe una caja abierta</p>
        <p className="text-sm text-muted-foreground">
          Responsable: {session.opened_by_name ?? '—'} · Fondo {fmtEuro(session.opening_amount)} · Abierta el{' '}
          {new Date(session.opened_at).toLocaleString('es-ES')}
        </p>
        <Button onClick={() => navigate('/caja/cierre')}>Ir al cierre</Button>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId) return;
    const amount = Number(opening.replace(',', '.'));
    if (isNaN(amount) || amount < 0) {
      toast({ title: 'Fondo inválido', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      await openCashSession(restaurantId, amount, notes || undefined);
      await refresh();
      toast({ title: 'Caja abierta', description: `Fondo inicial ${fmtEuro(amount)}` });
      navigate('/caja');
    } catch (err: any) {
      toast({ title: 'No se pudo abrir la caja', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-xl">
      <form onSubmit={submit} className="glass-card p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Apertura de caja</h2>
        <div>
          <Label>Fondo inicial (€)</Label>
          <Input type="number" step="0.01" min="0" value={opening} onChange={(e) => setOpening(e.target.value)} autoFocus />
        </div>
        <div>
          <Label>Responsable</Label>
          <Input value={profile?.name ?? ''} disabled />
        </div>
        <div>
          <Label>Notas (opcional)</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate('/caja')}>Cancelar</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Abriendo…' : 'Abrir caja'}</Button>
        </div>
      </form>
    </div>
  );
}