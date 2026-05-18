import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { ModuleKey, Restaurant, RestaurantModules, RestaurantStatus, RestaurantType } from '@/types/database';

export interface RestaurantWithModules extends Restaurant {
  modules?: RestaurantModules;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurant?: RestaurantWithModules | null;
  onSaved: () => void;
}

const moduleLabels: Record<ModuleKey, string> = {
  pos_enabled: 'TPV (POS)',
  reservations_enabled: 'Reservas',
  public_booking_enabled: 'Reserva pública',
  menu_enabled: 'Carta',
  payments_enabled: 'Pagos',
  kitchen_bar_enabled: 'Cocina / Barra',
  analytics_enabled: 'Analíticas',
  tickets_enabled: 'Tickets',
  printing_enabled: 'Impresión',
};

const defaultModules = (rid: string): RestaurantModules => ({
  restaurant_id: rid,
  pos_enabled: true,
  reservations_enabled: false,
  public_booking_enabled: false,
  menu_enabled: true,
  payments_enabled: true,
  kitchen_bar_enabled: false,
  analytics_enabled: false,
  tickets_enabled: false,
  printing_enabled: false,
});

export function RestaurantFormDialog({ open, onOpenChange, restaurant, onSaved }: Props) {
  const isEdit = !!restaurant;
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [type, setType] = useState<RestaurantType>('production');
  const [status, setStatus] = useState<RestaurantStatus>('active');
  const [modules, setModules] = useState<RestaurantModules>(defaultModules(''));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (restaurant) {
      setName(restaurant.name);
      setSlug(restaurant.slug);
      setType(restaurant.type);
      setStatus(restaurant.status);
      setModules(restaurant.modules ?? defaultModules(restaurant.id));
    } else {
      setName('');
      setSlug('');
      setType('production');
      setStatus('active');
      setModules(defaultModules(''));
    }
  }, [restaurant, open]);

  const handleSubmit = async () => {
    if (!name.trim() || !slug.trim()) {
      toast({ title: 'Campos requeridos', description: 'Nombre y slug son obligatorios', variant: 'destructive' });
      return;
    }
    const cleanSlug = slug.trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(cleanSlug)) {
      toast({ title: 'Slug inválido', description: 'Sólo minúsculas, números y guiones', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      let restaurantId = restaurant?.id;
      if (isEdit && restaurantId) {
        const { error } = await supabase
          .from('restaurants')
          .update({ name, slug: cleanSlug, type, status } as any)
          .eq('id', restaurantId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('restaurants')
          .insert({ name, slug: cleanSlug, type, status } as any)
          .select('id')
          .single();
        if (error) throw error;
        restaurantId = data.id;
      }

      if (restaurantId) {
        const { error: modErr } = await supabase
          .from('restaurant_modules' as any)
          .upsert(
            { ...modules, restaurant_id: restaurantId } as any,
            { onConflict: 'restaurant_id' }
          );
        if (modErr) throw modErr;
      }

      toast({ title: isEdit ? 'Restaurante actualizado' : 'Restaurante creado' });
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar restaurante' : 'Crear restaurante'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Nombre</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Mi Restaurante" />
          </div>
          <div className="space-y-2">
            <Label>Slug (subdominio)</Label>
            <Input
              value={slug}
              onChange={e => setSlug(e.target.value.toLowerCase())}
              placeholder="mirestaurante"
            />
            <p className="text-xs text-muted-foreground">
              URL: https://{slug || 'slug'}.mesapp.com
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={v => setType(v as RestaurantType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="production">Producción</SelectItem>
                  <SelectItem value="demo">Demo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={status} onValueChange={v => setStatus(v as RestaurantStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="inactive">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <Label>Módulos</Label>
            <div className="border border-border rounded-md divide-y divide-border">
              {(Object.keys(moduleLabels) as ModuleKey[]).map(key => (
                <div key={key} className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm">{moduleLabels[key]}</span>
                  <Switch
                    checked={Boolean(modules[key])}
                    onCheckedChange={v => setModules(prev => ({ ...prev, [key]: v }))}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}