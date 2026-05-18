import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { useZones, Zone } from '@/hooks/useZones';

interface Props {
  restaurantId: string | null;
  canManage: boolean;
}

export function ZoneManager({ restaurantId, canManage }: Props) {
  const { zones, createZone, updateZone, deleteZone, reorderZones } = useZones(restaurantId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Zone | null>(null);
  const [form, setForm] = useState({ name: '', active: true, display_order: 0, color: '' });

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', active: true, display_order: zones.length, color: '' });
    setDialogOpen(true);
  };

  const openEdit = (z: Zone) => {
    setEditing(z);
    setForm({ name: z.name, active: z.active, display_order: z.display_order, color: z.color ?? '' });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const payload = {
      name: form.name.trim(),
      active: form.active,
      display_order: Number(form.display_order) || 0,
      color: form.color.trim() || null,
    };
    if (!payload.name) return;
    if (editing) {
      const ok = await updateZone(editing.id, payload);
      if (ok) setDialogOpen(false);
    } else {
      const created = await createZone(payload);
      if (created) setDialogOpen(false);
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    const next = [...zones];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    await reorderZones(next.map((z) => z.id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Zonas</h2>
          <p className="text-sm text-muted-foreground">
            Cada zona aparece como una pestaña independiente en Plano de Sala.
          </p>
        </div>
        {canManage && (
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" /> Nueva zona
          </Button>
        )}
      </div>

      {zones.length === 0 ? (
        <Card className="p-6 text-center text-muted-foreground">
          No hay zonas creadas todavía.
        </Card>
      ) : (
        <div className="grid gap-3">
          {zones.map((z, idx) => (
            <Card key={z.id} className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {z.color && (
                  <span
                    className="w-4 h-4 rounded-full border border-border"
                    style={{ backgroundColor: z.color }}
                  />
                )}
                <div>
                  <div className="font-medium">{z.name}</div>
                  <div className="text-xs text-muted-foreground">Orden: {z.display_order}</div>
                </div>
                <Badge variant={z.active ? 'default' : 'outline'}>
                  {z.active ? 'Activa' : 'Inactiva'}
                </Badge>
              </div>
              {canManage && (
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => move(idx, -1)} disabled={idx === 0}>
                    <ArrowUp className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => move(idx, 1)} disabled={idx === zones.length - 1}>
                    <ArrowDown className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openEdit(z)}>
                    <Pencil className="w-3 h-3 mr-1" /> Editar zona
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => deleteZone(z.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar zona' : 'Nueva zona'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre de zona</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Ej. Terraza superior"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Zona activa</Label>
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setForm((p) => ({ ...p, active: v }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Orden</Label>
                <Input
                  type="number"
                  value={form.display_order}
                  onChange={(e) => setForm((p) => ({ ...p, display_order: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <Input
                  type="color"
                  value={form.color || '#3b82f6'}
                  onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name.trim()}>
              {editing ? 'Guardar cambios' : 'Crear zona'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}