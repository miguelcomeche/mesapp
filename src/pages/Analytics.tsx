import { useMemo, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { AnalyticsFilters } from '@/components/analytics/AnalyticsFilters';
import { KpiGrid } from '@/components/analytics/KpiGrid';
import { SalesTrendChart } from '@/components/analytics/SalesTrendChart';
import { ProductsBlock } from '@/components/analytics/ProductsBlock';
import { CategoriesBlock } from '@/components/analytics/CategoriesBlock';
import { HourlySalesChart } from '@/components/analytics/HourlySalesChart';
import { TablesBlock } from '@/components/analytics/TablesBlock';
import { ComparisonsBlock } from '@/components/analytics/ComparisonsBlock';
import { ExportBar } from '@/components/analytics/ExportBar';
import { DatePreset, DateRange, rangeFromPreset } from '@/lib/analytics';
import { Loader2 } from 'lucide-react';

export default function Analytics() {
  const { restaurantId, hasRole } = useAuth();
  const [preset, setPreset] = useState<DatePreset>('last7');
  const [range, setRange] = useState<DateRange>(() => rangeFromPreset('last7'));

  const canExport = hasRole(['admin', 'platform_admin']);

  const { current, previous, isLoading } = useAnalytics({ restaurantId, range });

  // Comparativas independientes (memoizadas para que el queryKey no cambie en cada render)
  const cmpRanges = useMemo(
    () => ({
      today: rangeFromPreset('today'),
      yesterday: rangeFromPreset('yesterday'),
      week: rangeFromPreset('last7'),
      month: rangeFromPreset('thisMonth'),
      prevMonth: rangeFromPreset('lastMonth'),
    }),
    // se recalcula al cambiar de día, suficiente
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [new Date().toDateString()],
  );
  const today = useAnalytics({ restaurantId, range: cmpRanges.today });
  const yesterday = useAnalytics({ restaurantId, range: cmpRanges.yesterday });
  const week = useAnalytics({ restaurantId, range: cmpRanges.week });
  const month = useAnalytics({ restaurantId, range: cmpRanges.month });
  const prevMonth = useAnalytics({ restaurantId, range: cmpRanges.prevMonth });

  const exportData = useMemo(() => {
    if (!current) return null;
    return {
      kpis: {
        Facturación: current.kpis.revenue.toFixed(2),
        Ticket_medio: current.kpis.ticketAvg.toFixed(2),
        Mesas_cerradas: current.kpis.ticketCount,
        Comensales: current.kpis.guests,
        Tiempo_medio_min: Math.round(current.kpis.avgMinutes),
        Hora_punta: current.kpis.peakHour.hour >= 0 ? `${current.kpis.peakHour.hour}:00` : '—',
      },
      products: current.productsByRevenue.map((p) => ({
        Producto: p.name,
        Categoría: p.category,
        Unidades: p.units,
        Facturación: p.revenue.toFixed(2),
      })),
      categories: current.categories.map((c) => ({
        Categoría: c.category,
        Facturación: c.revenue.toFixed(2),
        Unidades: c.units,
      })),
      tables: current.tablesRanking.map((t) => ({
        Mesa: t.number,
        Facturación: t.revenue.toFixed(2),
        Sesiones: t.sessions,
      })),
      salesByDay: current.salesByDay.map((d) => ({ Fecha: d.date, Importe: d.amount.toFixed(2) })),
    };
  }, [current]);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-baseline justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Analíticas</h1>
            <p className="text-sm text-muted-foreground">{range.label}: visión ejecutiva del restaurante</p>
          </div>
        </div>

        <AnalyticsFilters
          preset={preset}
          range={range}
          onChange={(p, r) => {
            setPreset(p);
            setRange(r);
          }}
          rightSlot={canExport && exportData ? <ExportBar filenameBase={`mesapp-analiticas-${range.from.toISOString().slice(0, 10)}`} data={exportData} /> : null}
        />

        {!restaurantId ? (
          <p className="py-12 text-center text-muted-foreground">Selecciona un restaurante para ver analíticas.</p>
        ) : isLoading || !current ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="mr-2 h-6 w-6 animate-spin" /> Cargando analíticas...
          </div>
        ) : (
          <>
            <KpiGrid {...current.kpis} />

            <SalesTrendChart data={current.salesByDay} />

            <ProductsBlock byRevenue={current.productsByRevenue} byUnits={current.productsByUnits} top={current.topProduct} />

            <CategoriesBlock categories={current.categories} />

            <HourlySalesChart data={current.salesByHour} />

            <TablesBlock ranking={current.tablesRanking} avgTime={current.tableAvgTime} avgTicket={current.tableAvgTicket} />

            <ComparisonsBlock
              todayVsYesterday={{
                current: today.current?.kpis.revenue ?? 0,
                previous: yesterday.current?.kpis.revenue ?? 0,
              }}
              weekVsLast={{
                current: week.current?.kpis.revenue ?? 0,
                previous: week.previous?.kpis.revenue ?? 0,
              }}
              monthVsLast={{
                current: month.current?.kpis.revenue ?? 0,
                previous: prevMonth.current?.kpis.revenue ?? 0,
              }}
            />

            {previous && (
              <p className="text-center text-xs text-muted-foreground">
                Comparativa de rango: facturación periodo anterior {previous.kpis.revenue.toFixed(2)} €
              </p>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
}