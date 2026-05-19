import { useEffect, useState, useRef } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { ModuleKey } from '@/types/database';

const moduleLabels: Record<ModuleKey, string> = {
  pos_enabled: 'TPV',
  reservations_enabled: 'Reservas',
  public_booking_enabled: 'Reserva pública',
  menu_enabled: 'Carta',
  payments_enabled: 'Pagos',
  kitchen_bar_enabled: 'Cocina / Barra',
  analytics_enabled: 'Analíticas',
  tickets_enabled: 'Tickets',
  printing_enabled: 'Impresión',
};

export default function RestaurantSettings() {
  const { tenant, reload } = useTenant();
  const { hasRole, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>(null);
  const [modules, setModules] = useState<Record<ModuleKey, boolean> | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const rid = tenant?.restaurant_id;

  const load = async () => {
    if (!rid) return;
    setLoading(true);
    const { data: r } = await supabase.from('restaurants').select('*').eq('id', rid).maybeSingle();
    const { data: m } = await supabase.from('restaurant_modules' as any).select('*').eq('restaurant_id', rid).maybeSingle();
    setForm(r);
    setModules((m as any) ?? {
      pos_enabled: true, reservations_enabled: false, public_booking_enabled: false,
      menu_enabled: true, payments_enabled: true, kitchen_bar_enabled: false,
      analytics_enabled: false, tickets_enabled: false, printing_enabled: false,
    });

    let edit = hasRole('platform_admin') || hasRole('admin');
    if (!edit && user) {
      const { data: isRA } = await supabase.rpc('has_restaurant_role' as any, {
        _user: user.id, _restaurant: rid, _role: 'restaurant_admin'
      } as any);
      edit = !!isRA;
    }
    setCanEdit(edit);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [rid, user?.id]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !rid) return;
    const ext = file.name.split('.').pop() || 'png';
    const path = `${rid}/logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('restaurant-branding').upload(path, file, { upsert: true });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    const { data } = supabase.storage.from('restaurant-branding').getPublicUrl(path);
    setForm({ ...form, logo_url: data.publicUrl });
    toast({ title: 'Logo subido' });
  };

  const handleSave = async () => {
    if (!rid || !form) return;
    const slug = (form.slug || '').trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(slug)) {
      toast({ title: 'Slug inválido', description: 'Sólo minúsculas, números y guiones', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      // Slug uniqueness check
      const { data: ex } = await supabase.from('restaurants').select('id').eq('slug', slug).neq('id', rid).maybeSingle();
      if (ex) throw new Error('El slug ya está en uso');

      const { error } = await supabase.from('restaurants').update({
        name: form.name, slug, status: form.status, type: form.type,
        address: form.address, city: form.city, postal_code: form.postal_code,
        country: form.country, phone: form.phone, email: form.email,
        tax_id: form.tax_id, currency: form.currency, timezone: form.timezone,
        logo_url: form.logo_url, primary_color: form.primary_color, secondary_color: form.secondary_color,
      } as any).eq('id', rid);
      if (error) throw error;

      if (modules) {
        const { error: me } = await supabase.from('restaurant_modules' as any)
          .upsert({ ...modules, restaurant_id: rid } as any, { onConflict: 'restaurant_id' });
        if (me) throw me;
      }
      toast({ title: 'Cambios guardados' });
      await reload();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  if (loading || !form || !modules) {
    return <MainLayout><div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div></MainLayout>;
  }

  const disabled = !canEdit;

  return (
    <MainLayout>
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Restaurante</h1>
            <p className="text-sm text-muted-foreground">Configuración del negocio</p>
          </div>
          {!canEdit && <span className="text-xs text-muted-foreground">Sólo lectura</span>}
        </div>

        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Información comercial</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Nombre comercial</Label><Input value={form.name ?? ''} onChange={e => setForm({...form, name: e.target.value})} disabled={disabled}/></div>
            <div className="space-y-2"><Label>Slug</Label><Input value={form.slug ?? ''} onChange={e => setForm({...form, slug: e.target.value.toLowerCase()})} disabled={disabled}/></div>
            <div className="space-y-2"><Label>Estado</Label>
              <Select value={form.status} onValueChange={v => setForm({...form, status: v})} disabled={disabled}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="inactive">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Tipo</Label>
              <Select value={form.type} onValueChange={v => setForm({...form, type: v})} disabled={disabled}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="production">Producción</SelectItem>
                  <SelectItem value="demo">Demo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>CIF/NIF</Label><Input value={form.tax_id ?? ''} onChange={e => setForm({...form, tax_id: e.target.value})} disabled={disabled}/></div>
            <div className="space-y-2"><Label>Teléfono</Label><Input value={form.phone ?? ''} onChange={e => setForm({...form, phone: e.target.value})} disabled={disabled}/></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email ?? ''} onChange={e => setForm({...form, email: e.target.value})} disabled={disabled}/></div>
            <div className="space-y-2"><Label>Moneda</Label><Input value={form.currency ?? ''} onChange={e => setForm({...form, currency: e.target.value.toUpperCase()})} disabled={disabled}/></div>
            <div className="space-y-2"><Label>Zona horaria</Label><Input value={form.timezone ?? ''} onChange={e => setForm({...form, timezone: e.target.value})} disabled={disabled}/></div>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Dirección</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2"><Label>Dirección</Label><Input value={form.address ?? ''} onChange={e => setForm({...form, address: e.target.value})} disabled={disabled}/></div>
            <div className="space-y-2"><Label>Ciudad</Label><Input value={form.city ?? ''} onChange={e => setForm({...form, city: e.target.value})} disabled={disabled}/></div>
            <div className="space-y-2"><Label>Código postal</Label><Input value={form.postal_code ?? ''} onChange={e => setForm({...form, postal_code: e.target.value})} disabled={disabled}/></div>
            <div className="space-y-2"><Label>País</Label><Input value={form.country ?? ''} onChange={e => setForm({...form, country: e.target.value})} disabled={disabled}/></div>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Branding</h2>
          <div className="flex items-start gap-4">
            {form.logo_url && <img src={form.logo_url} alt="Logo" className="w-20 h-20 object-contain border border-border rounded" />}
            <div className="flex-1 space-y-2">
              <Label>Logo</Label>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={disabled}>
                <Upload className="w-4 h-4 mr-2"/>Subir logo
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Color primario</Label><Input type="color" value={form.primary_color ?? '#000000'} onChange={e => setForm({...form, primary_color: e.target.value})} disabled={disabled}/></div>
            <div className="space-y-2"><Label>Color secundario</Label><Input type="color" value={form.secondary_color ?? '#000000'} onChange={e => setForm({...form, secondary_color: e.target.value})} disabled={disabled}/></div>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Módulos</h2>
          <div className="border border-border rounded-md divide-y divide-border">
            {(Object.keys(moduleLabels) as ModuleKey[]).map(k => (
              <div key={k} className="flex items-center justify-between px-3 py-2">
                <span className="text-sm">{moduleLabels[k]}</span>
                <Switch checked={!!modules[k]} onCheckedChange={v => setModules({...modules, [k]: v})} disabled={disabled}/>
              </div>
            ))}
          </div>
        </Card>

        {canEdit && (
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</Button>
          </div>
        )}
      </div>
    </MainLayout>
  );
}