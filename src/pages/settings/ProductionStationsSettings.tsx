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
import { ChevronDown, ChevronUp, Layers, Pencil, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { useProductionStations, ProductionStation } from '@/hooks/useProductionStations';
import PermissionGuard from '@/components/auth/PermissionGuard';

interface PrinterOpt { id: string; name: string }

interface Draft {
  id?: string;
  name: string;
  color: string;
  printer_id: string | null;
  station: 'kitchen' | 'bar';
  active: boolean;
}

const empty: Draft = { name: '', color: '#64748b', printer_id: null, station: 'kitchen', active: true };

export default function ProductionStationsSettings() {
  const { tenant } = useTenant();
  const { hasRole } = useAuth();
  const rid = tenant?.restaurant_id ?? null;
  const allowed = hasRole('platform_admin') || hasRole('admin');
  const { stations, isLoading, create, update, remove, reorder } = useProductionStations(rid);
  const [printers, setPrinters] = useState<PrinterOpt[]>([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(empty);

  useEffect(() => {
    if (!rid) return;
    supabase.from('printers' as any).select('id,name').eq('restaurant_id', rid).eq('active', true)
      .then(({ data }) => setPrinters((data as any[]) ?? []));
  }, [rid]);

  const openNew = () => { setDraft(empty); setOpen(true); };
  const openEdit = (s: ProductionStation) => {
    setDraft({ id: s.id, name: s.name, color: s.color, printer_id: s.printer_id, station: s.station, active: s.active });
    setOpen(true);
  };

  const save = async () => {
    if (!draft.name.trim()) return;
    if (draft.id) {
      await update(draft.id, {
        name: draft.name.trim(), color: draft.color,
        printer_id: draft.printer_id, station: draft.station, active: draft.active,
      });
    } else {
      await create({
        name: draft.name.trim(), color: draft.color,
        printer_id: draft.printer_id, station: draft.station, active: draft.active,
      });
    }
    setOpen(false);
  };

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...stations];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    reorder(next.map(s => s.id));
  };

  return (
    <PermissionGuard allowed={allowed}>
      <MainLayout>
        <div className="space-y-6 max-w-5xl">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Layers className="w-6 h-6" /> Partidas
              </h1>
              <p className="text-sm text-muted-foreground">
                Organiza centros de producción (Cocina, Barra, Pizzería…) y vincúlalos a sus impresoras.
              </p>
            </div>
            <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" />Nueva partida</Button>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Orden</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Routing</TableHead>
                  <TableHead>Impresora</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Cargando…</TableCell></TableRow>
                ) : stations.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No hay partidas creadas.</TableCell></TableRow>
                ) : stations.map((s, idx) => (
                  <TableRow key={s.id} className={!s.active ? 'opacity-60' : ''}>
                    <TableCell>
                      <div className="flex flex-col">
                        <Button size="icon" variant="ghost" className="h-6 w-6" disabled={idx === 0} onClick={() => move(idx, -1)}>
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" disabled={idx === stations.length - 1} onClick={() => move(idx, 1)}>
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="inline-block w-3 h-3 rounded-full" style={{ background: s.color }} />
                        <span className="font-medium">{s.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{s.station === 'kitchen' ? 'Cocina' : 'Barra'}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {printers.find(p => p.id === s.printer_id)?.name ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Switch checked={s.active} onCheckedChange={(v) => update(s.id, { active: v })} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => remove(s.id)}><Trash2 className="h-4 w-4" /></Button>
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
            <DialogHeader><DialogTitle>{draft.id ? 'Editar partida' : 'Nueva partida'}</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="Pizzería, Fríos, Postres…" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Color</Label>
                  <Input type="color" value={draft.color} onChange={e => setDraft({ ...draft, color: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Routing</Label>
                  <Select value={draft.station} onValueChange={v => setDraft({ ...draft, station: v as 'kitchen' | 'bar' })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kitchen">Cocina</SelectItem>
                      <SelectItem value="bar">Barra</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Impresora</Label>
                <Select
                  value={draft.printer_id ?? '__none'}
                  onValueChange={v => setDraft({ ...draft, printer_id: v === '__none' ? null : v })}
                >
                  <SelectTrigger><SelectValue placeholder="Sin impresora" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">— Sin impresora —</SelectItem>
                    {printers.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <Label>Activa</Label>
                <Switch checked={draft.active} onCheckedChange={v => setDraft({ ...draft, active: v })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={save}>Guardar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </MainLayout>
    </PermissionGuard>
  );
}