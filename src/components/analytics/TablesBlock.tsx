import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDuration, formatEUR } from '@/lib/analytics';

interface TableRowData {
  tableId: string;
  number: string;
  revenue: number;
  sessions: number;
  minutes: number;
}

interface Props {
  ranking: TableRowData[];
  avgTime: Array<TableRowData & { avgMinutes: number }>;
  avgTicket: Array<TableRowData & { avgTicket: number }>;
}

export function TablesBlock({ ranking, avgTime, avgTicket }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Mesas — facturación</CardTitle>
        </CardHeader>
        <CardContent>
          <MiniTable rows={ranking} valueLabel="Facturación" format={(r: any) => formatEUR(r.revenue)} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Tiempo medio por mesa</CardTitle>
        </CardHeader>
        <CardContent>
          <MiniTable rows={avgTime} valueLabel="Tiempo" format={(r: any) => formatDuration(r.avgMinutes)} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Ticket medio por mesa</CardTitle>
        </CardHeader>
        <CardContent>
          <MiniTable rows={avgTicket} valueLabel="Ticket" format={(r: any) => formatEUR(r.avgTicket)} />
        </CardContent>
      </Card>
    </div>
  );
}

function MiniTable({
  rows,
  valueLabel,
  format,
}: {
  rows: any[];
  valueLabel: string;
  format: (r: any) => string;
}) {
  if (!rows.length) return <p className="py-6 text-sm text-muted-foreground">Sin datos.</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Mesa</TableHead>
          <TableHead className="text-right">{valueLabel}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.slice(0, 10).map((r) => (
          <TableRow key={r.tableId}>
            <TableCell className="font-medium">Mesa {r.number}</TableCell>
            <TableCell className="text-right">{format(r)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}