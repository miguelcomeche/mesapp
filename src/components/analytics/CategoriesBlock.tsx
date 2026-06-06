import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatEUR } from '@/lib/analytics';

interface Cat {
  category: string;
  revenue: number;
  units: number;
}

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--accent))',
  'hsl(var(--secondary))',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
];

export function CategoriesBlock({ categories }: { categories: Cat[] }) {
  const total = categories.reduce((a, c) => a + c.revenue, 0);
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Categorías — distribución</CardTitle>
        </CardHeader>
        <CardContent>
          {categories.length ? (
            <div className="h-72 w-full">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={categories} dataKey="revenue" nameKey="category" innerRadius={50} outerRadius={100}>
                    {categories.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatEUR(v)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-6 text-sm text-muted-foreground">Sin datos en el rango.</p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Ranking de categorías</CardTitle>
        </CardHeader>
        <CardContent>
          {categories.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Facturación</TableHead>
                  <TableHead className="text-right">% Total</TableHead>
                  <TableHead className="text-right">Unidades</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((c) => (
                  <TableRow key={c.category}>
                    <TableCell className="font-medium">{c.category}</TableCell>
                    <TableCell className="text-right">{formatEUR(c.revenue)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {total ? ((c.revenue / total) * 100).toFixed(1) : '0.0'}%
                    </TableCell>
                    <TableCell className="text-right">{c.units}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="py-6 text-sm text-muted-foreground">Sin datos en el rango.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}