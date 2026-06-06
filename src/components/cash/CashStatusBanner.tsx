import { AlertCircle, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { useCurrentCashSession } from '@/hooks/useCashSession';
import { fmtEuro } from '@/lib/cash';

export function CashStatusBanner() {
  const { session, loading } = useCurrentCashSession();
  if (loading) return null;

  if (!session) {
    return (
      <div className="glass-card p-4 border border-destructive/40 flex items-center gap-4">
        <AlertCircle className="w-5 h-5 text-destructive" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">No hay caja abierta</p>
          <p className="text-xs text-muted-foreground">Debe abrir una caja antes de comenzar a operar.</p>
        </div>
        <Button asChild size="sm">
          <Link to="/caja/apertura">Abrir caja</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="glass-card p-4 flex items-center gap-4 border border-status-available/30">
      <Wallet className="w-5 h-5 text-status-available" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-foreground">Caja abierta</p>
        <p className="text-xs text-muted-foreground">
          {session.opened_by_name ?? 'Responsable'} · Fondo {fmtEuro(session.opening_amount)} ·{' '}
          {new Date(session.opened_at).toLocaleString('es-ES')}
        </p>
      </div>
      <Button asChild size="sm" variant="outline">
        <Link to="/caja/cierre">Cerrar caja</Link>
      </Button>
    </div>
  );
}