import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatEUR } from '@/lib/analytics';
import { format, parseISO, startOfWeek, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';

interface Props {
  data: Array<{ date: string; amount: number }>;
}

type Bucket = 'day' | 'week' | 'month';

export function SalesTrendChart({ data }: Props) {
  const [bucket, setBucket] = useState<Bucket>('day');
  const grouped = useMemo(() => {
    if (bucket === 'day')
      return data.map((d) => ({ label: format(parseISO(d.date), 'd MMM', { locale: es }), amount: d.amount }));
    const map = new Map<string, number>();
    data.forEach((d) => {
      const date = parseISO(d.date);
      const key =
        bucket === 'week'
          ? format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd')
          : format(startOfMonth(date), 'yyyy-MM');
      map.set(key, (map.get(key) ?? 0) + d.amount);
    });
    return Array.from(map.entries()).map(([k, v]) => ({
      label:
        bucket === 'week'
          ? `Sem. ${format(parseISO(k), 'd MMM', { locale: es })}`
          : format(parseISO(`${k}-01`), 'MMM yyyy', { locale: es }),
      amount: v,
    }));
  }, [data, bucket]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg">Evolución de ventas</CardTitle>
        <Tabs value={bucket} onValueChange={(v) => setBucket(v as Bucket)}>
          <TabsList>
            <TabsTrigger value="day">Día</TabsTrigger>
            <TabsTrigger value="week">Semana</TabsTrigger>
            <TabsTrigger value="month">Mes</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        <div className="h-72 w-full">
          <ResponsiveContainer>
            <LineChart data={grouped} margin={{ left: 8, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v) => `${v}€`} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: number) => formatEUR(v)} />
              <Line type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}