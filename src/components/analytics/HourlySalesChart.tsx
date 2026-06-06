import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatEUR } from '@/lib/analytics';

interface Props {
  data: Array<{ hour: number; amount: number }>;
}

export function HourlySalesChart({ data }: Props) {
  const positives = data.filter((d) => d.amount > 0);
  const display = positives.length
    ? data.slice(
        Math.max(0, Math.min(...positives.map((d) => d.hour)) - 1),
        Math.max(...positives.map((d) => d.hour)) + 2,
      )
    : data;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Ventas por hora</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          <ResponsiveContainer>
            <BarChart data={display}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="hour" tickFormatter={(h) => `${h}h`} tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v) => `${v}€`} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(v: number) => formatEUR(v)}
                labelFormatter={(h) => `${h}:00 - ${(Number(h) + 1) % 24}:00`}
              />
              <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}