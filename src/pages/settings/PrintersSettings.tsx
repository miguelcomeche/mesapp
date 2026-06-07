import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Pencil, Plus, Printer as PrinterIcon, Trash2, Wifi, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from '@/hooks/use-toast';

type PType = 'browser_print' | 'escpos' | 'epson_epos';
type PStation = 'cocina' | 'barra' | 'tickets';
type TestStatus = 'idle' | 'testing' | 'connected' | 'no_connection' | 'timeout' | 'print_error';
type Protocol = 'http' | 'https';

interface Printer {
  id?: string;
  name: string;
  type: PType;
  ip_address: string | null;
  port: number | null;
  station: PStation;
  active: boolean;
  protocol?: Protocol | null;
  endpoint_path?: string | null;
  last_connected_at?: string | null;
  last_printed_at?: string | null;
}

const typeLabels: Record<PType, string> = {
  browser_print: 'Navegador', epson_epos: 'Epson ePOS', escpos: 'ESC/POS',
};
const stationLabels: Record<PStation, string> = { cocina: 'Cocina', barra: 'Barra', tickets: 'Ticket Cliente' };

const DEFAULT_EPOS_PATH = '/cgi-bin/epos/service.cgi';
const empty: Printer = {
  name: '', type: 'browser_print', ip_address: '', port: null, station: 'cocina', active: true,
  protocol: 'http', endpoint_path: null,
};

const IPV4_RE = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const isValidIp = (ip: string | null) => !!ip && IPV4_RE.test(ip.trim());
const defaultPortFor = (t: PType, proto: Protocol = 'http'): number | null =>
  t === 'epson_epos' ? (proto === 'https' ? 443 : 8008) : t === 'escpos' ? 9100 : null;
const needsNetwork = (t: PType) => t === 'epson_epos' || t === 'escpos';

const statusLabels: Record<TestStatus, string> = {
  idle: '—',
  testing: 'Probando…',
  connected: 'Conectada',
  no_connection: 'Sin conexión',
  timeout: 'Tiempo agotado',
  print_error: 'Error de impresión',
};
const statusVariant = (s: TestStatus): 'default' | 'secondary' | 'destructive' | 'outline' => {
  if (s === 'connected') return 'default';
  if (s === 'testing' || s === 'idle') return 'secondary';
  return 'destructive';
};

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return await Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)),
  ]);
}

function escposTestXml(text: string) {
  return `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
<s:Body><epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print">
<text lang="es"/><text align="center"/><text>${text}\n</text><feed line="2"/><cut/>
</epos-print></s:Body></s:Envelope>`;
}

async function runPrinterTest(
  p: Printer,
  opts: { print: boolean }
): Promise<{ status: TestStatus; httpStatus?: number; error?: string; opaque?: boolean }> {
  if (p.type === 'browser_print') {
    if (opts.print) window.print();
    return { status: 'connected' };
  }
  if (!isValidIp(p.ip_address) || !p.port) return { status: 'no_connection', error: 'IP o puerto inválidos' };
  const proto: Protocol = (p.protocol as Protocol) || 'http';
  const path = (p.endpoint_path && p.endpoint_path.trim()) || DEFAULT_EPOS_PATH;
  const url = `${proto}://${p.ip_address}:${p.port}${path.startsWith('/') ? path : '/' + path}?devid=local_printer&timeout=10000`;
  try {
    if (p.type === 'epson_epos') {
      const body = opts.print
        ? escposTestXml('*** PRUEBA ***')
        : escposTestXml('PING');
      // First try a CORS request so we can read the response body.
      try {
        const res = await withTimeout(fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '""' },
          body,
        }), 6000);
        const txt = await res.text().catch(() => '');
        if (/success="true"/i.test(txt)) return { status: 'connected', httpStatus: res.status };
        const m = txt.match(/code="([^"]+)"/i);
        if (m) return { status: 'print_error', httpStatus: res.status, error: `ePOS code ${m[1]}` };
        if (res.ok) return { status: 'connected', httpStatus: res.status };
        // HTTP error from device (e.g. 404 endpoint, 401 auth)
        const hint = res.status === 404 ? ' — endpoint incorrecto' : res.status === 401 ? ' — autenticación requerida' : '';
        return { status: 'print_error', httpStatus: res.status, error: `HTTP ${res.status} ${res.statusText}${hint}` };
      } catch (corsErr: any) {
        // CORS / mixed-content / self-signed SSL blocks reading the response.
        // Fire a no-cors request — if it doesn't throw, the printer received the command.
        try {
          await withTimeout(fetch(url, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/xml; charset=utf-8' },
            body,
          }), 6000);
          return {
            status: 'connected',
            opaque: true,
            error: 'Respuesta opaca (CORS/SSL): comando enviado, no se puede leer la respuesta',
          };
        } catch (e: any) {
          const msg = String(e?.message || corsErr?.message || e || '');
          if (msg.includes('timeout')) return { status: 'timeout', error: 'Tiempo de espera agotado' };
          if (proto === 'https') return { status: 'no_connection', error: `Error TLS/SSL o red: ${msg}` };
          return { status: 'no_connection', error: `CORS o red: ${msg}` };
        }
      }
    }
    // ESC/POS raw TCP — no browser support. Best-effort reachability via no-cors.
    await withTimeout(fetch(`${proto}://${p.ip_address}:${p.port}/`, { mode: 'no-cors' }), 4000);
    return { status: 'connected' };
  } catch (e: any) {
    const msg = String(e?.message || e || '');
    if (msg.includes('timeout')) return { status: 'timeout', error: 'Tiempo de espera agotado' };
    return { status: 'no_connection', error: msg || 'No se pudo conectar' };
  }
}

function fmtDate(s?: string | null) {
  if (!s) return '—';
  try { return new Date(s).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }); } catch { return '—'; }
}

export default function PrintersSettings() {
  const { tenant } = useTenant();
  const rid = tenant?.restaurant_id;
  const [items, setItems] = useState<Printer[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Printer | null>(null);
  const [open, setOpen] = useState(false);
  const [editStatus, setEditStatus] = useState<TestStatus>('idle');
  const [busy, setBusy] = useState<null | 'conn' | 'print'>(null);
  const [rowStatus, setRowStatus] = useState<Record<string, TestStatus>>({});
  const [rowBusy, setRowBusy] = useState<Record<string, boolean>>({});

  const load = async () => {
    if (!rid) return;
    setLoading(true);
    const { data } = await supabase.from('printers' as any).select('*').eq('restaurant_id', rid).order('name');
    setItems((data as any[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [rid]);

  const openNew = () => { setEditing({ ...empty }); setEditStatus('idle'); setOpen(true); };
  const openEdit = (p: Printer) => { setEditing({ ...p }); setEditStatus('idle'); setOpen(true); };

  const ipError = editing && needsNetwork(editing.type) && (editing.ip_address ?? '').trim() !== '' && !isValidIp(editing.ip_address)
    ? 'Formato de IP inválido (ej. 192.168.1.50)'
    : null;
  const canSave = !!editing
    && editing.name.trim().length > 0
    && (!needsNetwork(editing.type) || (isValidIp(editing.ip_address) && !!editing.port));

  const save = async () => {
    if (!editing || !rid) return;
    if (!editing.name.trim()) { toast({ title: 'El nombre es obligatorio', variant: 'destructive' }); return; }
    if (needsNetwork(editing.type) && !isValidIp(editing.ip_address)) {
      toast({ title: 'IP inválida', description: 'Introduce una IP válida (ej. 192.168.1.50)', variant: 'destructive' });
      return;
    }
    if (needsNetwork(editing.type) && !editing.port) {
      toast({ title: 'Puerto obligatorio', variant: 'destructive' });
      return;
    }
    const row = {
      ...editing,
      restaurant_id: rid,
      ip_address: needsNetwork(editing.type) ? (editing.ip_address || '').trim() : null,
      port: needsNetwork(editing.type) ? Number(editing.port) : null,
    };
    const { error } = editing.id
      ? await supabase.from('printers' as any).update(row as any).eq('id', editing.id)
      : await supabase.from('printers' as any).insert(row as any);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Impresora guardada' }); setOpen(false); load(); }
  };

  const remove = async (p: Printer) => {
    if (!p.id || !confirm(`¿Eliminar "${p.name}"?`)) return;
    await supabase.from('printers' as any).delete().eq('id', p.id);
    load();
  };

  const toggle = async (p: Printer) => {
    if (!p.id) return;
    await supabase.from('printers' as any).update({ active: !p.active } as any).eq('id', p.id);
    load();
  };

  const onChangeType = (t: PType) => {
    if (!editing) return;
    const proto: Protocol = (editing.protocol as Protocol) || 'http';
    setEditing({
      ...editing,
      type: t,
      port: needsNetwork(t) ? (editing.port ?? defaultPortFor(t, proto)) : null,
      ip_address: needsNetwork(t) ? (editing.ip_address ?? '') : null,
      protocol: needsNetwork(t) ? proto : null,
      endpoint_path: t === 'epson_epos' ? (editing.endpoint_path ?? DEFAULT_EPOS_PATH) : null,
    });
    setEditStatus('idle');
  };

  const onChangeProtocol = (proto: Protocol) => {
    if (!editing) return;
    const prevDefault = defaultPortFor(editing.type, (editing.protocol as Protocol) || 'http');
    const nextDefault = defaultPortFor(editing.type, proto);
    const portIsDefault = editing.port == null || editing.port === prevDefault;
    setEditing({
      ...editing,
      protocol: proto,
      port: portIsDefault ? nextDefault : editing.port,
    });
    setEditStatus('idle');
  };

  const testEditing = async (print: boolean) => {
    if (!editing) return;
    if (needsNetwork(editing.type) && !isValidIp(editing.ip_address)) {
      setEditStatus('no_connection');
      toast({ title: 'IP inválida', variant: 'destructive' });
      return;
    }
    setBusy(print ? 'print' : 'conn');
    setEditStatus('testing');
    const r = await runPrinterTest(editing, { print });
    setEditStatus(r.status);
    setBusy(null);
    if (r.status === 'connected' && editing.id) {
      const patch: any = { last_connected_at: new Date().toISOString() };
      if (print) patch.last_printed_at = new Date().toISOString();
      await supabase.from('printers' as any).update(patch).eq('id', editing.id);
      setEditing({ ...editing, ...patch });
      load();
    }
    toast({
      title: statusLabels[r.status],
      description: [r.httpStatus ? `HTTP ${r.httpStatus}` : null, r.error].filter(Boolean).join(' · ') || undefined,
      variant: r.status === 'connected' ? 'default' : 'destructive',
    });
  };

  const testRow = async (p: Printer, print: boolean) => {
    if (!p.id) return;
    setRowBusy(b => ({ ...b, [p.id!]: true }));
    setRowStatus(s => ({ ...s, [p.id!]: 'testing' }));
    const r = await runPrinterTest(p, { print });
    setRowStatus(prev => ({ ...prev, [p.id!]: r.status }));
    setRowBusy(b => ({ ...b, [p.id!]: false }));
    if (r.status === 'connected') {
      const patch: any = { last_connected_at: new Date().toISOString() };
      if (print) patch.last_printed_at = new Date().toISOString();
      await supabase.from('printers' as any).update(patch).eq('id', p.id);
      load();
    }
    toast({
      title: statusLabels[r.status],
      description: [r.httpStatus ? `HTTP ${r.httpStatus}` : null, r.error].filter(Boolean).join(' · ') || undefined,
      variant: r.status === 'connected' ? 'default' : 'destructive',
    });
  };

  return (
    <MainLayout>
      <div className="space-y-6 max-w-5xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Impresoras</h1>
            <p className="text-sm text-muted-foreground">Configura las impresoras del restaurante</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <a href="/settings/printing/ticket-designer">Diseñador de Tickets</a>
            </Button>
            <Button onClick={openNew}><Plus className="w-4 h-4 mr-2"/>Nueva impresora</Button>
          </div>
        </div>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Estación</TableHead>
                <TableHead>Dirección</TableHead>
                <TableHead>Activa</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Última conexión</TableHead>
                <TableHead>Última impresión</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Cargando…</TableCell></TableRow>
              ) : items.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No hay impresoras</TableCell></TableRow>
              ) : items.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell><Badge variant="outline">{typeLabels[p.type]}</Badge></TableCell>
                  <TableCell><Badge variant="secondary">{stationLabels[p.station]}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {p.ip_address
                      ? `${(p.protocol ?? 'http')}://${p.ip_address}${p.port ? ':' + p.port : ''}${p.endpoint_path ?? ''}`
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <Switch checked={p.active} onCheckedChange={() => toggle(p)}/>
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const s = rowStatus[p.id!] ?? 'idle';
                      return <Badge variant={statusVariant(s)}>{statusLabels[s]}</Badge>;
                    })()}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{fmtDate(p.last_connected_at)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{fmtDate(p.last_printed_at)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" disabled={!!rowBusy[p.id!]} onClick={() => testRow(p, false)} title="Probar conexión">
                        {rowBusy[p.id!] ? <Loader2 className="w-4 h-4 animate-spin"/> : <Wifi className="w-4 h-4"/>}
                      </Button>
                      <Button size="sm" variant="ghost" disabled={!!rowBusy[p.id!]} onClick={() => testRow(p, true)} title="Probar impresión">
                        <PrinterIcon className="w-4 h-4"/>
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(p)} title="Editar"><Pencil className="w-4 h-4"/></Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(p)} title="Eliminar"><Trash2 className="w-4 h-4"/></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing?.id ? 'Editar impresora' : 'Nueva impresora'}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3 py-2">
              <div className="space-y-2"><Label>Nombre</Label><Input value={editing.name} onChange={e => setEditing({...editing, name: e.target.value})}/></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Tipo</Label>
                  <Select value={editing.type} onValueChange={v => onChangeType(v as PType)}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(typeLabels) as PType[]).map(k => <SelectItem key={k} value={k}>{typeLabels[k]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Estación</Label>
                  <Select value={editing.station} onValueChange={v => setEditing({...editing, station: v as PStation})}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(stationLabels) as PStation[]).map(k => <SelectItem key={k} value={k}>{stationLabels[k]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {needsNetwork(editing.type) && (
                  <>
                    <div className="space-y-2">
                      <Label>IP</Label>
                      <Input
                        placeholder="192.168.1.50"
                        value={editing.ip_address ?? ''}
                        onChange={e => setEditing({...editing, ip_address: e.target.value})}
                        aria-invalid={!!ipError}
                      />
                      {ipError && <p className="text-xs text-destructive">{ipError}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label>Puerto</Label>
                      <Input
                        type="number"
                        placeholder={String(defaultPortFor(editing.type, (editing.protocol as Protocol) || 'http') ?? '')}
                        value={editing.port ?? ''}
                        onChange={e => setEditing({...editing, port: e.target.value ? +e.target.value : null})}
                      />
                    </div>
                  </>
                )}
              </div>
              {editing.type === 'epson_epos' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Protocolo</Label>
                    <Select value={(editing.protocol as Protocol) || 'http'} onValueChange={v => onChangeProtocol(v as Protocol)}>
                      <SelectTrigger><SelectValue/></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="http">HTTP</SelectItem>
                        <SelectItem value="https">HTTPS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Endpoint ePOS</Label>
                    <Input
                      placeholder={DEFAULT_EPOS_PATH}
                      value={editing.endpoint_path ?? ''}
                      onChange={e => setEditing({...editing, endpoint_path: e.target.value })}
                    />
                  </div>
                </div>
              )}
              {needsNetwork(editing.type) && (
                <div className="flex items-center justify-between gap-2 rounded-md border border-border p-2">
                  <Badge variant={statusVariant(editStatus)}>
                    {editStatus === 'testing' && <Loader2 className="w-3 h-3 mr-1 animate-spin"/>}
                    {statusLabels[editStatus]}
                  </Badge>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={busy !== null || !isValidIp(editing.ip_address) || !editing.port} onClick={() => testEditing(false)}>
                      {busy === 'conn' ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Wifi className="w-4 h-4 mr-2"/>}
                      Probar conexión
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy !== null || !isValidIp(editing.ip_address) || !editing.port} onClick={() => testEditing(true)}>
                      {busy === 'print' ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <PrinterIcon className="w-4 h-4 mr-2"/>}
                      Probar impresión
                    </Button>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between">
                <Label>Activa</Label>
                <Switch checked={editing.active} onCheckedChange={v => setEditing({...editing, active: v})}/>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={!canSave}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}