import { MetricCard } from '@/components/dashboard/MetricCard';
import { DollarSign, Receipt, Users, Clock, UtensilsCrossed, Flame } from 'lucide-react';
import { formatDuration, formatEUR } from '@/lib/analytics';

interface Props {
  revenue: number;
  ticketAvg: number;
  ticketCount: number;
  guests: number;
  avgMinutes: number;
  peakHour: { hour: number; amount: number };
}

export function KpiGrid({ revenue, ticketAvg, ticketCount, guests, avgMinutes, peakHour }: Props) {
  const peakLabel =
    peakHour.hour >= 0
      ? `${String(peakHour.hour).padStart(2, '0')}:00 - ${String((peakHour.hour + 1) % 24).padStart(2, '0')}:00`
      : '—';
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <MetricCard title="Facturación" value={formatEUR(revenue)} icon={<DollarSign className="h-6 w-6" />} />
      <MetricCard title="Ticket medio" value={formatEUR(ticketAvg)} icon={<Receipt className="h-6 w-6" />} />
      <MetricCard title="Mesas cerradas" value={ticketCount} icon={<UtensilsCrossed className="h-6 w-6" />} />
      <MetricCard title="Comensales atendidos" value={guests} icon={<Users className="h-6 w-6" />} />
      <MetricCard title="Tiempo medio de mesa" value={formatDuration(avgMinutes)} icon={<Clock className="h-6 w-6" />} />
      <MetricCard
        title="Hora punta"
        value={peakLabel}
        subtitle={peakHour.hour >= 0 ? formatEUR(peakHour.amount) : undefined}
        icon={<Flame className="h-6 w-6" />}
      />
    </div>
  );
}