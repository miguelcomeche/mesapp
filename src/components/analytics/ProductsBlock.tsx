import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Award } from 'lucide-react';
import { formatEUR } from '@/lib/analytics';

interface Product {
  id: string;
  name: string;
  category: string;
  units: number;
  revenue: number;
}

interface Props {
  byRevenue: Product[];
  byUnits: Product[];
  top: Product | null;
}

export function ProductsBlock({ byRevenue, byUnits, top }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Producto más rentable</CardTitle>
        </CardHeader>
        <CardContent>
          {top ? (
            <div className="space-y-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Award className="h-6 w-6" />
              </div>
              <h3 className="text-2xl font-bold uppercase leading-tight text-foreground">{top.name}</h3>
              <p className="text-sm text-muted-foreground">{top.category}</p>
              <div className="pt-2">
                <div className="text-3xl font-bold text-primary">{formatEUR(top.revenue)}</div>
                <div className="text-sm text-muted-foreground">{top.units} unidades</div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sin datos en el rango.</p>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Ranking de productos</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="rev">
            <TabsList>
              <TabsTrigger value="rev">Por facturación</TabsTrigger>
              <TabsTrigger value="units">Por unidades</TabsTrigger>
            </TabsList>
            <TabsContent value="rev">
              <ProductTable products={byRevenue} highlight="revenue" />
            </TabsContent>
            <TabsContent value="units">
              <ProductTable products={byUnits} highlight="units" />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function ProductTable({ products, highlight }: { products: Product[]; highlight: 'revenue' | 'units' }) {
  if (!products.length) return <p className="py-6 text-sm text-muted-foreground">Sin datos en el rango.</p>;
  return (
    <div className="max-h-[420px] overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">#</TableHead>
            <TableHead>Producto</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead className="text-right">Unidades</TableHead>
            <TableHead className="text-right">Facturación</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((p, i) => (
            <TableRow key={p.id}>
              <TableCell className="text-muted-foreground">{i + 1}</TableCell>
              <TableCell className="font-medium">{p.name}</TableCell>
              <TableCell className="text-muted-foreground">{p.category}</TableCell>
              <TableCell className={`text-right ${highlight === 'units' ? 'font-semibold text-foreground' : ''}`}>{p.units}</TableCell>
              <TableCell className={`text-right ${highlight === 'revenue' ? 'font-semibold text-foreground' : ''}`}>{formatEUR(p.revenue)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}