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
import { Pencil, Plus, Printer as PrinterIcon, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from '@/hooks/use-toast';

type PType = 'browser_print' | 'network' | 'escpos' | 'epson_epos';
type PStation = 'cocina' | 'barra' | 'tickets';

interface Printer {
  id?: string;
  name: string;
  type: PType;
  ip_address: string | null;
  port: number | null;
  station: PStation;
  active: boolean;
}

const typeLabels: Record<PType, string> = {
  browser_print: 'Navegador', network: 'Red', escpos: 'ESC/POS', epson_epos: 'Epson ePOS',
};
const stationLabels: Record<PStation, string> = { cocina: 'Cocina', barra: 'Barra', tickets: 'Ticket Cliente' };

const empty: Printer = { name: '', type: 'browser_print', ip_address: '', port: 9100, station: 'cocina', active: true };

export default function PrintersSettings() {
  const { tenant } = useTenant();
  const rid = tenant?.restaurant_id;
  const [items, setItems] = useState<Printer[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Printer | null>(null);
  const [open, setOpen] = useState(false);
  const [testing, setTesting] = useState<Printer | null>(null);

  const load = async () => {
    if (!rid) return;
    setLoading(true);
    const { data } = await supabase.from('printers' as any).select('*').eq('restaurant_id', rid).order('name');
    setItems((data as any[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [rid]);

  const openNew = () => { setEditing({ ...empty }); setOpen(true); };
  const openEdit = (p: Printer) => { setEditing({ ...p }); setOpen(true); };

  const save = async () => {
    if (!editing || !rid) return;
    if (!editing.name.trim()) { toast({ title: 'El nombre es obligatorio', variant: 'destructive' }); return; }
    const row = { ...editing, restaurant_id: rid, port: editing.port ? Number(editing.port) : null };
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

  return (
    <MainLayout>
      <div className="space-y-6 max-w-5xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Impresoras</h1>
            <p className="text-sm text-muted-foreground">Configura las impresoras del restaurante</p>
          </div>
          <Button onClick={openNew}><Plus className="w-4 h-4 mr-2"/>Nueva impresora</Button>
        </div>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Estación</TableHead>
                <TableHead>Dirección</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Cargando…</TableCell></TableRow>
              ) : items.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No hay impresoras</TableCell></TableRow>
              ) : items.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell><Badge variant="outline">{typeLabels[p.type]}</Badge></TableCell>
                  <TableCell><Badge variant="secondary">{stationLabels[p.station]}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.ip_address ? `${p.ip_address}${p.port ? ':' + p.port : ''}` : '—'}</TableCell>
                  <TableCell>
                    <Switch checked={p.active} onCheckedChange={() => toggle(p)}/>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setTesting(p)} title="Probar impresión"><PrinterIcon className="w-4 h-4"/></Button>
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
                  <Select value={editing.type} onValueChange={v => setEditing({...editing, type: v as PType})}>
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
                <div className="space-y-2"><Label>IP</Label><Input value={editing.ip_address ?? ''} onChange={e => setEditing({...editing, ip_address: e.target.value})}/></div>
                <div className="space-y-2"><Label>Puerto</Label><Input type="number" value={editing.port ?? ''} onChange={e => setEditing({...editing, port: e.target.value ? +e.target.value : null})}/></div>
              </div>
              <div className="flex items-center justify-between">
                <Label>Activa</Label>
                <Switch checked={editing.active} onCheckedChange={v => setEditing({...editing, active: v})}/>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!testing} onOpenChange={(o) => !o && setTesting(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Prueba de impresión</DialogTitle></DialogHeader>
          <div className="bg-white text-black p-4 font-mono text-xs border border-border rounded">
            <div className="text-center font-bold mb-2">*** {tenant?.name} ***</div>
            <div>Impresora: {testing?.name}</div>
            <div>Estación: {testing && stationLabels[testing.station]}</div>
            <div>{new Date().toLocaleString('es-ES')}</div>
            <div className="border-t border-dashed my-2"/>
            <div>1x Café con leche ........ 1.80€</div>
            <div>2x Croissant ............. 3.60€</div>
            <div className="border-t border-dashed my-2"/>
            <div className="font-bold">TOTAL: 5.40€</div>
            <div className="text-center mt-2">— PRUEBA —</div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTesting(null)}>Cerrar</Button>
            <Button onClick={() => window.print()}>Imprimir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}