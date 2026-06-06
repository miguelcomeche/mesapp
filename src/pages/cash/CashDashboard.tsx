import { useEffect, useState } from 'react';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { useCurrentCashSession, useCashSummary } from '@/hooks/useCashSession';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { fmtEuro } from '@/lib/cash';
import { Banknote, CreditCard, Coins, Wallet, Receipt, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--status-available))', 'hsl(var(--muted-foreground))'];

export default function CashDashboard() {
  const { restaurantId } = useAuth();
  const { session } = useCurrentCashSession();
  const { summary } = useCashSummary(session?.id);
  const [hourly, setHourly] = useState<{ hour: string; amount: number }[]>([]);
  const [todayTotals, setTodayTotals] = useState({ revenue: 0, count: 0, tips: 0 });

  useEffect(() => {
    if (!restaurantId) return;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    supabase
      .from('payments')
      .select('amount, tip, method, processed_at')
      .eq('restaurant_id', restaurantId)
      .eq('voided', false)
      .gte('processed_at', start.toISOString())
      .then(({ data }) => {
        const rows = (data as any[]) || [];
        const buckets: Record<string, number> = {};
        for (let h = 0; h < 24; h++) buckets[String(h).padStart(2, '0')] = 0;
        let rev = 0, tips = 0;
        rows.forEach((p) => {
          const h = String(new Date(p.processed_at).getHours()).padStart(2, '0');
          buckets[h] = (buckets[h] || 0) + Number(p.amount);
          rev += Number(p.amount);
          tips += Number(p.tip || 0);
        });
        setHourly(Object.entries(buckets).map(([hour, amount]) => ({ hour, amount })));
        setTodayTotals({ revenue: rev, count: rows.length, tips });
      });
  }, [restaurantId, session?.id]);

  const pie = [
    { name: 'Efectivo', value: summary?.cash_sales ?? 0 },
    { name: 'Tarjeta', value: summary?.card_sales ?? 0 },
    { name: 'Otros', value: summary?.other_sales ?? 0 },
  ].filter((p) => p.value > 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Ventas hoy" value={fmtEuro(todayTotals.revenue)} icon={<TrendingUp className="w-6 h-6" />} />
        <MetricCard title="Ticket medio" value={fmtEuro(todayTotals.count ? todayTotals.revenue / todayTotals.count : 0)} icon={<Receipt className="w-6 h-6" />} />
        <MetricCard title="Cobros" value={String(todayTotals.count)} icon={<Wallet className="w-6 h-6" />} />
        <MetricCard title="Propinas" value={fmtEuro(todayTotals.tips)} icon={<Coins className="w-6 h-6" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="glass-card p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-foreground mb-4">Ventas por hora</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourly}>
                <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} formatter={(v: any) => fmtEuro(Number(v))} />
                <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Métodos de pago (turno)</h3>
          {pie.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">Sin cobros aún</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pie} dataKey="value" nameKey="name" outerRadius={80}>
                    {pie.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => fmtEuro(Number(v))} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {session && summary && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Resumen del turno actual</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <Row label="Fondo inicial" value={fmtEuro(summary.opening_amount)} />
            <Row label="Ventas efectivo" value={fmtEuro(summary.cash_sales)} icon={<Banknote className="w-3 h-3" />} />
            <Row label="Ventas tarjeta" value={fmtEuro(summary.card_sales)} icon={<CreditCard className="w-3 h-3" />} />
            <Row label="Otros" value={fmtEuro(summary.other_sales)} />
            <Row label="Propinas efectivo" value={fmtEuro(summary.tips_cash)} />
            <Row label="Propinas tarjeta" value={fmtEuro(summary.tips_card)} />
            <Row label="Entradas" value={fmtEuro(summary.cash_in_total)} />
            <Row label="Salidas" value={fmtEuro(summary.cash_out_total)} />
          </div>
          <div className="mt-4 pt-4 border-t border-border flex justify-between">
            <span className="text-sm text-muted-foreground">Caja esperada</span>
            <span className="text-xl font-bold text-foreground">{fmtEuro(summary.expected_amount)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground flex items-center gap-1">{icon}{label}</p>
      <p className="text-base font-semibold text-foreground tabular-nums">{value}</p>
    </div>
  );
}