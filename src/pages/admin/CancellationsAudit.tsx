import { useEffect, useMemo, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface AuditRow {
  id: string;
  created_at: string;
  action_type: string;
  reason: string | null;
  product_name_snapshot: string | null;
  quantity_snapshot: number | null;
  unit_price_snapshot: number | null;
  performed_by_role: string | null;
  performed_by_user_id: string | null;
  performed_by_waiter_id: string | null;
  table_session_id: string | null;
  restaurant_id: string;
}

function toDateInput(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function CancellationsAudit() {
  const { restaurantId, hasRole } = useAuth();
  const isPlatformAdmin = hasRole('platform_admin');
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const today = new Date();
  const lastMonth = new Date(today.getTime() - 30 * 86400000);
  const [from, setFrom] = useState(toDateInput(lastMonth));
  const [to, setTo] = useState(toDateInput(today));

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      let q = supabase
        .from('order_item_audit_logs' as any)
        .select('*')
        .gte('created_at', `${from}T00:00:00`)
        .lte('created_at', `${to}T23:59:59`)
        .order('created_at', { ascending: false })
        .limit(500);
      if (!isPlatformAdmin && restaurantId) {
        q = q.eq('restaurant_id', restaurantId);
      }
      const { data } = await q;
      setRows((data as any) ?? []);
      setLoading(false);
    };
    load();
  }, [from, to, restaurantId, isPlatformAdmin]);

  const kpis = useMemo(() => {
    const cancelled = rows.filter(r => r.action_type === 'cancelled');
    const deleted = rows.filter(r => r.action_type === 'deleted');
    const value = (list: AuditRow[]) =>
      list.reduce((s, r) => s + Number(r.quantity_snapshot || 0) * Number(r.unit_price_snapshot || 0), 0);
    return {
      cancelledCount: cancelled.length,
      cancelledValue: value(cancelled),
      deletedCount: deleted.length,
      deletedValue: value(deleted),
    };
  }, [rows]);

  const byReason = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach(r => {
      const k = r.reason || 'Sin motivo';
      map.set(k, (map.get(k) ?? 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const topProducts = useMemo(() => {
    const map = new Map<string, { qty: number; value: number }>();
    rows.forEach(r => {
      const k = r.product_name_snapshot || 'Producto';
      const prev = map.get(k) ?? { qty: 0, value: 0 };
      const qty = Number(r.quantity_snapshot || 0);
      prev.qty += qty;
      prev.value += qty * Number(r.unit_price_snapshot || 0);
      map.set(k, prev);
    });
    return Array.from(map.entries()).sort((a, b) => b[1].qty - a[1].qty).slice(0, 10);
  }, [rows]);

  return (
    <MainLayout>
      <div className="space-y-6 max-w-6xl">
        <div>
          <h1 className="text-2xl font-bold">Anulaciones y borrados</h1>
          <p className="text-sm text-muted-foreground">Auditoría de productos eliminados o anulados.</p>
        </div>

        <Card className="p-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label>Desde</Label>
            <Input type="date" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Hasta</Label>
            <Input type="date" value={to} onChange={e => setTo(e.target.value)} />
          </div>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Items anulados</p>
            <p className="text-2xl font-bold">{kpis.cancelledCount}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Valor anulado</p>
            <p className="text-2xl font-bold">{kpis.cancelledValue.toFixed(2)}€</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Items borrados</p>
            <p className="text-2xl font-bold">{kpis.deletedCount}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Valor borrado</p>
            <p className="text-2xl font-bold">{kpis.deletedValue.toFixed(2)}€</p>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-4">
            <h2 className="font-semibold mb-3">Por motivo</h2>
            <div className="space-y-1 text-sm">
              {byReason.length === 0 && <p className="text-muted-foreground">Sin datos.</p>}
              {byReason.map(([reason, count]) => (
                <div key={reason} className="flex justify-between border-b border-border/30 py-1">
                  <span>{reason}</span>
                  <Badge variant="secondary">{count}</Badge>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="font-semibold mb-3">Productos más afectados</h2>
            <div className="space-y-1 text-sm">
              {topProducts.length === 0 && <p className="text-muted-foreground">Sin datos.</p>}
              {topProducts.map(([name, v]) => (
                <div key={name} className="flex justify-between border-b border-border/30 py-1">
                  <span>{name}</span>
                  <span className="text-muted-foreground">{v.qty} · {v.value.toFixed(2)}€</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card className="p-4">
          <h2 className="font-semibold mb-3">Historial</h2>
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay registros en el periodo.</p>
          ) : (
            <div className="space-y-1 text-sm">
              {rows.map(r => (
                <div key={r.id} className="grid grid-cols-12 gap-2 items-center border-b border-border/30 py-2">
                  <span className="col-span-3 text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString('es-ES')}
                  </span>
                  <Badge variant={r.action_type === 'cancelled' ? 'destructive' : 'secondary'} className="col-span-1 justify-self-start">
                    {r.action_type === 'cancelled' ? 'Anulado' : r.action_type === 'deleted' ? 'Borrado' : r.action_type}
                  </Badge>
                  <span className="col-span-3 truncate">{r.product_name_snapshot ?? 'Producto'}</span>
                  <span className="col-span-1">{Number(r.quantity_snapshot ?? 0)}x</span>
                  <span className="col-span-2 truncate text-muted-foreground">{r.reason ?? '—'}</span>
                  <span className="col-span-2 text-xs text-muted-foreground">{r.performed_by_role ?? ''}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </MainLayout>
  );
}