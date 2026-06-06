import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMemo } from 'react';
import { DateRange, previousRange } from '@/lib/analytics';

export interface AnalyticsParams {
  restaurantId: string | null;
  range: DateRange;
}

interface SessionRow {
  id: string;
  table_id: string;
  guest_count: number;
  started_at: string;
  closed_at: string | null;
  status: string;
  total_amount: number;
}
interface OrderItemRow {
  id: string;
  quantity: number;
  unit_price: number;
  status: string;
  menu_item_id: string;
  order_id: string;
  session_id: string;
  created_at: string;
}
interface PaymentRow {
  id: string;
  session_id: string;
  amount: number;
  tip: number | null;
  processed_at: string;
  method: string;
}
interface MenuItemRow {
  id: string;
  name: string;
  category: string;
}
interface TableRow {
  id: string;
  number: string;
  section: string | null;
}

async function fetchRange(restaurantId: string, range: DateRange) {
  const fromIso = range.from.toISOString();
  const toIso = range.to.toISOString();

  const sessionsP = supabase
    .from('table_sessions')
    .select('id,table_id,guest_count,started_at,closed_at,status,total_amount')
    .eq('restaurant_id', restaurantId)
    .gte('started_at', fromIso)
    .lte('started_at', toIso);

  const menuP = supabase.from('menu_items').select('id,name,category').eq('restaurant_id', restaurantId);
  const tablesP = supabase.from('tables').select('id,number,section').eq('restaurant_id', restaurantId);

  const [sessionsRes, menuRes, tablesRes] = await Promise.all([
    sessionsP,
    menuP,
    tablesP,
  ]);

  if (sessionsRes.error) throw sessionsRes.error;
  if (menuRes.error) throw menuRes.error;
  if (tablesRes.error) throw tablesRes.error;

  const sessions = (sessionsRes.data ?? []) as unknown as SessionRow[];
  const sessionIds = sessions.map((s) => s.id);

  let orderItems: OrderItemRow[] = [];
  let payments: PaymentRow[] = [];
  if (sessionIds.length) {
    const [ordersRes, paymentsRes] = await Promise.all([
      supabase
        .from('orders')
        .select('id,session_id,created_at,order_items(id,quantity,unit_price,status,menu_item_id,created_at)')
        .in('session_id', sessionIds),
      supabase
        .from('payments')
        .select('id,session_id,amount,tip,processed_at,method')
        .in('session_id', sessionIds),
    ]);
    if (ordersRes.error) throw ordersRes.error;
    if (paymentsRes.error) throw paymentsRes.error;
    orderItems = (ordersRes.data ?? []).flatMap((o: any) =>
      (o.order_items ?? []).map((oi: any) => ({
        id: oi.id,
        quantity: oi.quantity,
        unit_price: Number(oi.unit_price),
        status: oi.status,
        menu_item_id: oi.menu_item_id,
        order_id: o.id,
        session_id: o.session_id,
        created_at: oi.created_at,
      })),
    );
    payments = (paymentsRes.data ?? []).map((p: any) => ({
      id: p.id,
      session_id: p.session_id,
      amount: Number(p.amount),
      tip: p.tip ? Number(p.tip) : 0,
      processed_at: p.processed_at,
      method: p.method,
    }));
  }

  return {
    sessions,
    payments,
    menu: (menuRes.data ?? []) as MenuItemRow[],
    tables: (tablesRes.data ?? []) as TableRow[],
    orderItems,
  };
}

function computeDerived(data: Awaited<ReturnType<typeof fetchRange>>) {
  const { sessions, payments, menu, tables, orderItems } = data;
  const menuById = new Map(menu.map((m) => [m.id, m]));
  const tablesById = new Map(tables.map((t) => [t.id, t]));

  const closedSessions = sessions.filter((s) => s.status === 'closed' && s.closed_at);
  const revenue = payments.reduce((a, p) => a + p.amount, 0);
  const ticketCount = closedSessions.length;
  const ticketAvg = ticketCount ? revenue / ticketCount : 0;
  const guests = closedSessions.reduce((a, s) => a + (s.guest_count ?? 0), 0);

  const avgMinutes = ticketCount
    ? closedSessions.reduce((a, s) => {
        const start = new Date(s.started_at).getTime();
        const end = new Date(s.closed_at!).getTime();
        return a + (end - start) / 60000;
      }, 0) / ticketCount
    : 0;

  // Sales by day (YYYY-MM-DD)
  const byDayMap = new Map<string, number>();
  payments.forEach((p) => {
    const d = new Date(p.processed_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    byDayMap.set(key, (byDayMap.get(key) ?? 0) + p.amount);
  });
  const salesByDay = Array.from(byDayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, amount]) => ({ date, amount }));

  // Sales by hour (0-23)
  const byHourMap = new Map<number, number>();
  for (let i = 0; i < 24; i++) byHourMap.set(i, 0);
  payments.forEach((p) => {
    const h = new Date(p.processed_at).getHours();
    byHourMap.set(h, (byHourMap.get(h) ?? 0) + p.amount);
  });
  const salesByHour = Array.from(byHourMap.entries()).map(([hour, amount]) => ({ hour, amount }));

  // Peak hour
  let peakHour = { hour: -1, amount: 0 };
  salesByHour.forEach((h) => {
    if (h.amount > peakHour.amount) peakHour = h;
  });

  // Product ranking
  const activeItems = orderItems.filter((oi) => oi.status !== 'cancelled');
  const prodMap = new Map<string, { id: string; name: string; category: string; units: number; revenue: number }>();
  activeItems.forEach((oi) => {
    const m = menuById.get(oi.menu_item_id);
    const name = m?.name ?? 'Producto eliminado';
    const category = m?.category ?? '—';
    const cur = prodMap.get(oi.menu_item_id) ?? { id: oi.menu_item_id, name, category, units: 0, revenue: 0 };
    cur.units += oi.quantity;
    cur.revenue += oi.quantity * oi.unit_price;
    prodMap.set(oi.menu_item_id, cur);
  });
  const productsAll = Array.from(prodMap.values());
  const productsByRevenue = [...productsAll].sort((a, b) => b.revenue - a.revenue).slice(0, 20);
  const productsByUnits = [...productsAll].sort((a, b) => b.units - a.units).slice(0, 20);
  const topProduct = productsByRevenue[0] ?? null;

  // Categories
  const catMap = new Map<string, { category: string; revenue: number; units: number }>();
  productsAll.forEach((p) => {
    const cur = catMap.get(p.category) ?? { category: p.category, revenue: 0, units: 0 };
    cur.revenue += p.revenue;
    cur.units += p.units;
    catMap.set(p.category, cur);
  });
  const categories = Array.from(catMap.values()).sort((a, b) => b.revenue - a.revenue);

  // Tables ranking — revenue from payments per session -> table
  const sessionsById = new Map(sessions.map((s) => [s.id, s]));
  const tableAgg = new Map<
    string,
    { tableId: string; number: string; revenue: number; sessions: number; minutes: number }
  >();
  const tablePayments = new Map<string, number>();
  payments.forEach((p) => {
    const s = sessionsById.get(p.session_id);
    if (!s) return;
    tablePayments.set(s.table_id, (tablePayments.get(s.table_id) ?? 0) + p.amount);
  });
  closedSessions.forEach((s) => {
    const t = tablesById.get(s.table_id);
    const cur = tableAgg.get(s.table_id) ?? {
      tableId: s.table_id,
      number: t?.number ?? '?',
      revenue: 0,
      sessions: 0,
      minutes: 0,
    };
    cur.sessions += 1;
    cur.minutes += (new Date(s.closed_at!).getTime() - new Date(s.started_at).getTime()) / 60000;
    tableAgg.set(s.table_id, cur);
  });
  tablePayments.forEach((amount, tableId) => {
    const t = tablesById.get(tableId);
    const cur = tableAgg.get(tableId) ?? {
      tableId,
      number: t?.number ?? '?',
      revenue: 0,
      sessions: 0,
      minutes: 0,
    };
    cur.revenue = amount;
    tableAgg.set(tableId, cur);
  });
  const tablesArr = Array.from(tableAgg.values());
  const tablesRanking = [...tablesArr].sort((a, b) => b.revenue - a.revenue).slice(0, 20);
  const tableAvgTime = [...tablesArr]
    .filter((t) => t.sessions > 0)
    .map((t) => ({ ...t, avgMinutes: t.minutes / t.sessions }))
    .sort((a, b) => b.avgMinutes - a.avgMinutes)
    .slice(0, 20);
  const tableAvgTicket = [...tablesArr]
    .filter((t) => t.sessions > 0)
    .map((t) => ({ ...t, avgTicket: t.revenue / t.sessions }))
    .sort((a, b) => b.avgTicket - a.avgTicket)
    .slice(0, 20);

  return {
    kpis: { revenue, ticketAvg, ticketCount, guests, avgMinutes, peakHour },
    salesByDay,
    salesByHour,
    productsByRevenue,
    productsByUnits,
    topProduct,
    categories,
    tablesRanking,
    tableAvgTime,
    tableAvgTicket,
    raw: data,
  };
}

export function useAnalytics({ restaurantId, range }: AnalyticsParams) {
  const currentQuery = useQuery({
    queryKey: ['analytics', restaurantId, range.from.toISOString(), range.to.toISOString()],
    enabled: !!restaurantId,
    queryFn: () => fetchRange(restaurantId!, range),
  });

  const prev = useMemo(() => previousRange(range), [range]);
  const prevQuery = useQuery({
    queryKey: ['analytics-prev', restaurantId, prev.from.toISOString(), prev.to.toISOString()],
    enabled: !!restaurantId,
    queryFn: () => fetchRange(restaurantId!, prev),
  });

  const current = useMemo(
    () => (currentQuery.data ? computeDerived(currentQuery.data) : null),
    [currentQuery.data],
  );
  const previous = useMemo(
    () => (prevQuery.data ? computeDerived(prevQuery.data) : null),
    [prevQuery.data],
  );

  return {
    isLoading: currentQuery.isLoading || prevQuery.isLoading,
    error: currentQuery.error || prevQuery.error,
    current,
    previous,
  };
}