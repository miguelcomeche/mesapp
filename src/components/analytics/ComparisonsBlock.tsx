import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { formatEUR, pct } from '@/lib/analytics';
import { cn } from '@/lib/utils';

interface Props {
  currentRevenue: number;
  previousRevenue: number;
  label: string;
}

export function ComparisonCard({ currentRevenue, previousRevenue, label }: Props) {
  const delta = pct(currentRevenue, previousRevenue);
  const isUp = delta > 0.5;
  const isDown = delta < -0.5;
  const Icon = isUp ? ArrowUpRight : isDown ? ArrowDownRight : Minus;
  const color = isUp ? 'text-status-available' : isDown ? 'text-status-attention' : 'text-muted-foreground';
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline justify-between gap-2">
          <div>
            <div className="text-2xl font-bold">{formatEUR(currentRevenue)}</div>
            <div className="text-xs text-muted-foreground">vs {formatEUR(previousRevenue)}</div>
          </div>
          <div className={cn('flex items-center gap-1 text-lg font-semibold', color)}>
            <Icon className="h-5 w-5" />
            {Math.abs(delta).toFixed(1)}%
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ComparisonsBlock({
  todayVsYesterday,
  weekVsLast,
  monthVsLast,
}: {
  todayVsYesterday: { current: number; previous: number };
  weekVsLast: { current: number; previous: number };
  monthVsLast: { current: number; previous: number };
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <ComparisonCard
        label="Hoy vs Ayer"
        currentRevenue={todayVsYesterday.current}
        previousRevenue={todayVsYesterday.previous}
      />
      <ComparisonCard
        label="Esta semana vs semana anterior"
        currentRevenue={weekVsLast.current}
        previousRevenue={weekVsLast.previous}
      />
      <ComparisonCard
        label="Este mes vs mes anterior"
        currentRevenue={monthVsLast.current}
        previousRevenue={monthVsLast.previous}
      />
    </div>
  );
}