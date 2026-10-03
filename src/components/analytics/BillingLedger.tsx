import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Download, FileLock2, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatEUR } from '@/lib/analytics';
import { dailyClosingSummary, fetchLedger, TicketCalc } from '@/lib/ledger';
import { exportLedgerCsv, exportLedgerPdf, exportLedgerXlsx } from '@/lib/ledgerExport';
import { cn } from '@/lib/utils';

type P = 'today' | 'yesterday' | 'week' | 'month' | 'prevMonth' | 'quarter' | 'prevQuarter' | 'year' | 'custom';
const PRESETS: Array<[P, string]> = [
  ['today', 'Hoy'], ['yesterday', 'Ayer'], ['week', 'Esta semana'], ['month', 'Este mes'], ['prevMonth', 'Mes anterior'],
  ['quarter', 'Este trimestre'], ['prevQuarter', 'Trimestre anterior'], ['year', 'Este año'],
];
const sod = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const eod = (d: Date) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
function range(p: P, custom?: { from?: Date; to?: Date }) {
  const n = new Date();
  const q = Math.floor(n.getMonth() / 3);
  switch (p) {
    case 'today': return { from: sod(n), to: eod(n) };
    case 'yesterday': { const y = new Date(n); y.setDate(y.getDate() - 1); return { from: sod(y), to: eod(y) }; }
    case 'week': { const f = new Date(n); f.setDate(f.getDate() - ((f.getDay() + 6) % 7)); return { from: sod(f), to: eod(n) }; }
    case 'month': return { from: new Date(n.getFullYear(), n.getMonth(), 1), to: eod(n) };
    case 'prevMonth': return { from: new Date(n.getFullYear(), n.getMonth() - 1, 1), to: eod(new Date(n.getFullYear(), n.getMonth(), 0)) };
    case 'quarter': return { from: new Date(n.getFullYear(), q * 3, 1), to: eod(n) };
    case 'prevQuarter': return { from: new Date(n.getFullYear(), q * 3 - 3, 1), to: eod(new Date(n.getFullYear(), q * 3, 0)) };
    case 'year': return { from: new Date(n.getFullYear(), 0, 1), to: eod(n) };
    case 'custom': return { from: sod(custom?.from ?? n), to: eod(custom?.to ?? custom?.from ?? n) };
  }
}
const fmtDay = (k: string) => k.split('-').reverse().join('/');
const INV_LABEL: Record<string, string> = { completa: 'Factura emitida', simplificado: 'Factura simplificada', rectificativa: 'Factura rectificativa' };

export function BillingLedger({ restaurantId, canExport }: { restaurantId: string; canExport: boolean }) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [preset, setPreset] = useState<P>('month');
  const [custom, setCustom] = useState<{ from?: Date; to?: Date }>({});
  const r = useMemo(() => range(preset, custom), [preset, custom]);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [onlyDiff, setOnlyDiff] = useState(false);
  const [closing, setClosing] = useState(false);

  const q = useQuery({ queryKey: ['ledger', restaurantId, r.from.toISOString(), r.to.toISOString()], queryFn: () => fetchLedger(restaurantId, r.from, r.to) });
  const todayR = useMemo(() => range('today'), []);
  const tq = useQuery({ queryKey: ['ledger', restaurantId, 'today', todayR.from.toDateString()], queryFn: () => fetchLedger(restaurantId, todayR.from, todayR.to) });

  const l = q.data;
  const period = `${r.from.toLocaleDateString('es-ES')} – ${r.to.toLocaleDateString('es-ES')}`;
  const fname = `mesapp-facturacion-${r.from.toISOString().slice(0, 10)}_${r.to.toISOString().slice(0, 10)}`;
  const dayTickets: TicketCalc[] = l && openDay ? l.tickets.filter((t) => t.date === openDay && (!onlyDiff || Math.abs(t.diff) > 0.004)) : [];

  const generateClosing = async (date: string) => {
    if (!l) return;
    setClosing(true);
    const { error } = await supabase.from('daily_closings' as any).insert({ restaurant_id: restaurantId, closing_date: date, summary: dailyClosingSummary(l, date) } as any);
    setClosing(false);
    toast(error ? { title: 'Error', description: error.message, variant: 'destructive' } : { title: `Cierre diario ${fmtDay(date)} generado`, description: 'Guardado como registro de solo lectura.' });
  };

  const tt = tq.data?.totals;
  const cards: Array<[string, string]> = [
    ['Facturado hoy', formatEUR(tt?.net ?? 0)], ['Cobrado hoy', formatEUR(tt?.collected ?? 0)], ['Efectivo', formatEUR(tt?.cash ?? 0)],
    ['Tarjeta', formatEUR(tt?.card ?? 0)], ['IVA', formatEUR(tt?.vat ?? 0)], ['Nº tickets', String(tt?.tickets ?? 0)],
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {cards.map(([k, v]) => (
          <Card key={k} className="p-4"><p className="text-xs uppercase text-muted-foreground">{k}</p><p className="mt-1 text-xl font-bold">{v}</p></Card>
        ))}
      </div>

      <Card className="flex flex-wrap items-center gap-2 p-3">
        {PRESETS.map(([id, label]) => (
          <Button key={id} size="sm" variant={preset === id ? 'default' : 'outline'} onClick={() => setPreset(id)}>{label}</Button>
        ))}
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant={preset === 'custom' ? 'default' : 'outline'}><CalendarIcon className="mr-1 h-4 w-4" />Personalizado</Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="range" selected={custom as any} onSelect={(v: any) => { setCustom(v ?? {}); setPreset('custom'); }} numberOfMonths={2} className={cn('p-3 pointer-events-auto')} />
          </PopoverContent>
        </Popover>
        <span className="ml-2 text-sm text-muted-foreground">{period}</span>
        {canExport && l && (
          <div className="ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button size="sm"><Download className="mr-1 h-4 w-4" />Exportar para gestoría</Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => exportLedgerPdf(l, period, fname)}>PDF</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportLedgerXlsx(l, period, fname)}>Excel (XLSX)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportLedgerCsv(l, fname)}>CSV</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </Card>

      {q.isLoading || !l ? (
        <div className="flex justify-center py-16 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Calculando…</div>
      ) : q.error ? (
        <p className="text-destructive">{(q.error as Error).message}</p>
      ) : (
        <>
          <Card className="p-4">
            <h2 className="mb-3 text-lg font-semibold">Libro diario de ventas</h2>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  {['Fecha', 'Tickets', 'Bruto', 'Descuentos', 'Devoluciones', 'Neto', 'Base', 'IVA', 'Total facturado', 'Efectivo', 'Tarjeta', 'Otros', 'Total cobrado', 'Conciliación'].map((h) => <TableHead key={h} className="whitespace-nowrap">{h}</TableHead>)}
                </TableRow></TableHeader>
                <TableBody>
                  {l.days.length === 0 && <TableRow><TableCell colSpan={14} className="py-8 text-center text-muted-foreground">Sin ventas cerradas en este periodo</TableCell></TableRow>}
                  {l.days.map((d) => (
                    <TableRow key={d.date} className="cursor-pointer" onClick={() => { setOnlyDiff(false); setOpenDay(d.date); }}>
                      <TableCell className="font-medium">{fmtDay(d.date)}</TableCell>
                      <TableCell>{d.tickets}</TableCell>
                      {[d.gross, d.discount, d.refunds, d.net, d.base, d.vat, d.net, d.cash, d.card, d.other, d.collected].map((v, i) => <TableCell key={i} className="whitespace-nowrap">{formatEUR(v)}</TableCell>)}
                      <TableCell>
                        {Math.abs(d.diff) < 0.005
                          ? <span className="inline-flex items-center gap-1 text-primary"><CheckCircle2 className="h-4 w-4" />Conciliado</span>
                          : <button className="inline-flex items-center gap-1 text-destructive" onClick={(e) => { e.stopPropagation(); setOnlyDiff(true); setOpenDay(d.date); }}><AlertTriangle className="h-4 w-4" />Diferencia: {formatEUR(d.diff)}</button>}
                      </TableCell>
                    </TableRow>
                  ))}
                  {l.days.length > 0 && (
                    <TableRow className="font-bold">
                      <TableCell>TOTAL</TableCell><TableCell>{l.totals.tickets}</TableCell>
                      {[l.totals.gross, l.totals.discount, l.totals.refunds, l.totals.net, l.totals.base, l.totals.vat, l.totals.net, l.totals.cash, l.totals.card, l.totals.other, l.totals.collected, l.totals.diff].map((v, i) => <TableCell key={i} className="whitespace-nowrap">{formatEUR(v)}</TableCell>)}
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card className="p-4">
              <h2 className="mb-3 text-lg font-semibold">Desglose IVA</h2>
              <Table>
                <TableHeader><TableRow><TableHead>IVA</TableHead><TableHead>Base imponible</TableHead><TableHead>Cuota IVA</TableHead><TableHead>Total</TableHead></TableRow></TableHeader>
                <TableBody>{l.vat.map((v) => <TableRow key={v.rate}><TableCell>{v.rate}%</TableCell><TableCell>{formatEUR(v.base)}</TableCell><TableCell>{formatEUR(v.vat)}</TableCell><TableCell>{formatEUR(v.total)}</TableCell></TableRow>)}</TableBody>
              </Table>
            </Card>
            <Card className="p-4">
              <h2 className="mb-3 text-lg font-semibold">Métodos de pago</h2>
              <Table>
                <TableBody>
                  {([['Efectivo', l.totals.cash], ['Tarjeta', l.totals.card], ['Otros', l.totals.other], ['Total cobrado', l.totals.collected]] as const).map(([k, v]) => <TableRow key={k}><TableCell>{k}</TableCell><TableCell className="text-right font-medium">{formatEUR(v)}</TableCell></TableRow>)}
                </TableBody>
              </Table>
            </Card>
          </div>
        </>
      )}

      <Dialog open={!!openDay} onOpenChange={(o) => !o && setOpenDay(null)}>
        <DialogContent className="max-w-6xl">
          <DialogHeader><DialogTitle>Detalle de facturación — {openDay && fmtDay(openDay)}{onlyDiff && ' (tickets con diferencia)'}</DialogTitle></DialogHeader>
          <div className="max-h-[65vh] overflow-auto">
            <Table>
              <TableHeader><TableRow>{['Ticket', 'Hora', 'Mesa', 'Camarero', 'Base', 'IVA', 'Total', 'Efectivo', 'Tarjeta', 'Otros', 'Estado', 'Factura'].map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
              <TableBody>
                {dayTickets.map((t) => (
                  <TableRow key={t.id} className={cn(!t.valid && 'opacity-60')}>
                    <TableCell className="font-medium">{t.number}</TableCell>
                    <TableCell>{t.closedAt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</TableCell>
                    <TableCell>{t.table}</TableCell><TableCell>{t.waiter}</TableCell>
                    {[t.base, t.vat, t.net, t.cash, t.card, t.other].map((v, i) => <TableCell key={i} className="whitespace-nowrap">{formatEUR(v)}</TableCell>)}
                    <TableCell><Badge variant={t.status === 'Completado' ? 'secondary' : 'destructive'}>{t.status}</Badge>{Math.abs(t.diff) > 0.004 && <span className="ml-1 text-xs text-destructive">Dif. {formatEUR(t.diff)}</span>}</TableCell>
                    <TableCell>
                      {t.invoice
                        ? <Button size="sm" variant="link" className="h-auto p-0" onClick={() => navigate(`/facturacion?invoice=${t.invoice!.id}`)}>{t.invoice.number} · {INV_LABEL[t.invoice.type] ?? t.invoice.type}</Button>
                        : <Button size="sm" variant="outline" onClick={() => navigate(`/session/${t.id}`)}>Emitir factura</Button>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {canExport && openDay && (
            <div className="flex justify-end">
              <Button onClick={() => generateClosing(openDay)} disabled={closing}><FileLock2 className="mr-1 h-4 w-4" />Generar cierre diario</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
