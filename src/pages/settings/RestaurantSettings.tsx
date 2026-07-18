import { useEffect, useState, useRef } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Upload, AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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

  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetReport, setResetReport] = useState<any>(null);
  const [confirmText, setConfirmText] = useState('');
  const canReset = hasRole('platform_admin') || hasRole('admin');

  const [opsResetOpen, setOpsResetOpen] = useState(false);
  const [opsResetting, setOpsResetting] = useState(false);
  const [opsResetReport, setOpsResetReport] = useState<any>(null);
  const [opsConfirmText, setOpsConfirmText] = useState('');

  const opsConfirmPhrase = `${((form?.commercial_name || form?.name || 'RESET') as string)
    .toString()
    .trim()
    .toUpperCase()} RESET`;

  const handleResetOperations = async () => {
    if (!rid) return;
    setOpsResetting(true);
    const { data, error } = await supabase.rpc('reset_restaurant_operations' as any, { _restaurant: rid } as any);
    setOpsResetting(false);
    if (error) {
      toast({ title: 'Error al reiniciar histórico', description: error.message, variant: 'destructive' });
      return;
    }
    setOpsResetReport(data);
    setOpsResetOpen(false);
    setOpsConfirmText('');
    toast({ title: 'Histórico operativo borrado', description: 'La configuración del restaurante se ha mantenido.' });
  };

  const handleResetProduction = async () => {
    if (!rid) return;
    setResetting(true);
    const { data, error } = await supabase.rpc('reset_restaurant_production' as any, { _restaurant: rid } as any);
    setResetting(false);
    if (error) {
      toast({ title: 'Error al reiniciar', description: error.message, variant: 'destructive' });
      return;
    }
    setResetReport(data);
    setResetOpen(false);
    setConfirmText('');
    toast({ title: 'Restaurante reiniciado', description: 'El restaurante está listo para configuración de producción.' });
  };

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
        commercial_name: form.commercial_name, legal_name: form.legal_name,
        address: form.address, city: form.city, postal_code: form.postal_code,
        province: form.province, country: form.country,
        phone: form.phone, email: form.email, website: form.website,
        tax_id: form.tax_id, currency: form.currency, timezone: form.timezone,
        logo_url: form.logo_url, primary_color: form.primary_color, secondary_color: form.secondary_color,
        waiters_can_cancel_items: !!form.waiters_can_cancel_items,
        require_cancellation_reason: !!form.require_cancellation_reason,
        print_cancellation_ticket: !!form.print_cancellation_ticket,
        uses_kds: form.uses_kds !== false,
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
            <div className="space-y-2"><Label>Nombre comercial</Label><Input value={form.commercial_name ?? ''} onChange={e => setForm({...form, commercial_name: e.target.value})} disabled={disabled} placeholder="Ej: QORI"/></div>
            <div className="space-y-2"><Label>Razón social</Label><Input value={form.legal_name ?? ''} onChange={e => setForm({...form, legal_name: e.target.value})} disabled={disabled} placeholder="Ej: Qori Restaurant SL"/></div>
            <div className="space-y-2"><Label>Nombre interno</Label><Input value={form.name ?? ''} onChange={e => setForm({...form, name: e.target.value})} disabled={disabled}/></div>
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
            <div className="space-y-2"><Label>Sitio web</Label><Input value={form.website ?? ''} onChange={e => setForm({...form, website: e.target.value})} disabled={disabled} placeholder="www.ejemplo.com"/></div>
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
            <div className="space-y-2"><Label>Provincia</Label><Input value={form.province ?? ''} onChange={e => setForm({...form, province: e.target.value})} disabled={disabled}/></div>
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

        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Anulaciones</h2>
          <p className="text-sm text-muted-foreground">Controla cómo se pueden anular productos en sala.</p>
        </Card>

        <Card className="p-6 space-y-4" data-inserted="kds-placeholder">
          <h2 className="text-lg font-semibold">Pantalla de cocina (KDS)</h2>
          <div className="border border-border rounded-md">
            <div className="flex items-center justify-between px-3 py-3">
              <div className="pr-4">
                <p className="text-sm">Este local usa pantalla de cocina</p>
                <p className="text-xs text-muted-foreground">
                  Si lo desactivas, la pantalla de cocina quedará vacía y las comandas saldrán únicamente por impresora.
                  Los productos siguen registrándose con normalidad en cuentas y facturación.
                </p>
              </div>
              <Switch
                checked={form.uses_kds !== false}
                onCheckedChange={v => setForm({ ...form, uses_kds: v })}
                disabled={disabled}
              />
            </div>
          </div>
        </Card>

        <Card className="p-6 space-y-4" data-legacy-cancellations>
          <h2 className="text-lg font-semibold">Anulaciones</h2>
          <p className="text-sm text-muted-foreground">Controla cómo se pueden anular productos en sala.</p>
          <div className="border border-border rounded-md divide-y divide-border">
            <div className="flex items-center justify-between px-3 py-2">
              <div>
                <p className="text-sm">Permitir a camareros anular productos</p>
                <p className="text-xs text-muted-foreground">Si se desactiva, sólo gerentes y admins pueden anular.</p>
              </div>
              <Switch
                checked={form.waiters_can_cancel_items ?? true}
                onCheckedChange={v => setForm({ ...form, waiters_can_cancel_items: v })}
                disabled={disabled}
              />
            </div>
            <div className="flex items-center justify-between px-3 py-2">
              <div>
                <p className="text-sm">Requerir motivo al anular</p>
                <p className="text-xs text-muted-foreground">El usuario debe seleccionar o escribir un motivo.</p>
              </div>
              <Switch
                checked={form.require_cancellation_reason ?? true}
                onCheckedChange={v => setForm({ ...form, require_cancellation_reason: v })}
                disabled={disabled}
              />
            </div>
            <div className="flex items-center justify-between px-3 py-2">
              <div>
                <p className="text-sm">Imprimir ticket de anulación en cocina/barra</p>
                <p className="text-xs text-muted-foreground">Se enviará un ticket con motivo a la partida correspondiente.</p>
              </div>
              <Switch
                checked={form.print_cancellation_ticket ?? true}
                onCheckedChange={v => setForm({ ...form, print_cancellation_ticket: v })}
                disabled={disabled}
              />
            </div>
          </div>
        </Card>

        {canEdit && (
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</Button>
          </div>
        )}

        {canReset && (
          <Card className="p-6 space-y-4 border-destructive/40">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive mt-0.5" />
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-destructive">Borrar histórico operativo</h2>
                <p className="text-sm text-muted-foreground">
                  Borra sesiones de mesa, pedidos, pagos, tickets, trabajos de impresión, sesiones de caja y reservas
                  de <strong>{form.name}</strong>. <strong>Se mantiene</strong> la carta, mesas, plano, zonas, camareros,
                  usuarios, impresoras, partidas, módulos y branding. Útil antes de entregar el restaurante en producción.
                </p>
              </div>
            </div>
            <Button variant="destructive" onClick={() => setOpsResetOpen(true)} disabled={opsResetting}>
              {opsResetting ? 'Borrando…' : 'Borrar histórico operativo'}
            </Button>

            {opsResetReport && (
              <div className="border border-border rounded-md p-4 text-sm space-y-1">
                <div className="font-semibold mb-2">Informe · {opsResetReport.restaurant_name}</div>
                {[
                  ['Pedidos', opsResetReport.orders_removed],
                  ['Líneas de pedido', opsResetReport.order_items_removed],
                  ['Modificadores de líneas', opsResetReport.order_item_modifiers_removed],
                  ['Sesiones de mesa', opsResetReport.sessions_removed],
                  ['Pagos', opsResetReport.payments_removed],
                  ['Líneas de pago', opsResetReport.payment_items_removed],
                  ['Anulaciones de pago', opsResetReport.payment_voids_removed],
                  ['Tickets de cocina/barra', opsResetReport.kitchen_tickets_removed],
                  ['Líneas de ticket', opsResetReport.ticket_items_removed],
                  ['Trabajos de impresión', opsResetReport.print_jobs_removed],
                  ['Sesiones de caja', opsResetReport.cash_sessions_removed],
                  ['Movimientos de caja', opsResetReport.cash_movements_removed],
                  ['Reservas', opsResetReport.reservations_removed],
                  ['Logs de anulación', opsResetReport.audit_logs_removed],
                  ['Mesas reseteadas a disponible', opsResetReport.tables_reset_to_available],
                ].map(([k, v]) => (
                  <div key={k as string} className="flex justify-between">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="font-mono">{v ?? 0}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {canReset && (
          <Card className="p-6 space-y-4 border-destructive/40">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive mt-0.5" />
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-destructive">Reset de producción</h2>
                <p className="text-sm text-muted-foreground">
                  Borra carta, plano de sala, mesas, zonas, reservas, sesiones, pedidos, pagos, tickets, impresoras y personal
                  (camareros, encargados y admins de restaurante) de <strong>{form.name}</strong>. No afecta a otros restaurantes,
                  al registro del restaurante, sus módulos, su branding ni a usuarios Platform Admin.
                </p>
              </div>
            </div>
            <Button variant="destructive" onClick={() => setResetOpen(true)} disabled={resetting}>
              {resetting ? 'Reiniciando…' : 'Reiniciar restaurante para producción'}
            </Button>

            {resetReport && (
              <div className="border border-border rounded-md p-4 text-sm space-y-1">
                <div className="font-semibold mb-2">Informe de validación · {resetReport.restaurant_name}</div>
                {[
                  ['Categorías', resetReport.categories_removed],
                  ['Productos', resetReport.products_removed],
                  ['Grupos de modificadores', resetReport.modifier_groups_removed],
                  ['Modificadores', resetReport.modifiers_removed],
                  ['Zonas', resetReport.zones_removed],
                  ['Mesas', resetReport.tables_removed],
                  ['Mesas combinadas', resetReport.table_groups_removed],
                  ['Elementos del plano', resetReport.floor_elements_removed],
                  ['Reservas', resetReport.reservations_removed],
                  ['Sesiones', resetReport.sessions_removed],
                  ['Pedidos', resetReport.orders_removed],
                  ['Líneas de pedido', resetReport.order_items_removed],
                  ['Tickets de cocina', resetReport.kitchen_tickets_removed],
                  ['Pagos', resetReport.payments_removed],
                  ['Impresoras', resetReport.printers_removed],
                  ['Camareros', resetReport.waiters_removed],
                  ['Usuarios del restaurante', resetReport.users_removed],
                ].map(([k, v]) => (
                  <div key={k as string} className="flex justify-between">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="font-mono">{v ?? 0}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>

      <AlertDialog open={resetOpen} onOpenChange={(o) => { setResetOpen(o); if (!o) setConfirmText(''); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Reiniciar {form.name} para producción?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción borra toda la carta, plano, mesas, reservas, sesiones, pedidos, pagos, impresoras y personal
              del restaurante actual. No se puede deshacer. Escribe <strong>RESET</strong> para confirmar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="RESET"
            autoFocus
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetProduction}
              disabled={confirmText !== 'RESET' || resetting}
              className="bg-destructive text-destructive-foreground"
            >
              {resetting ? 'Reiniciando…' : 'Sí, reiniciar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={opsResetOpen} onOpenChange={(o) => { setOpsResetOpen(o); if (!o) setOpsConfirmText(''); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar histórico operativo de {form.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a borrar todo el histórico operativo de <strong>{form.commercial_name || form.name}</strong>,
              pero se mantendrá la configuración, carta, mesas y camareros. Esta acción no se puede deshacer.
              Escribe <strong>{opsConfirmPhrase}</strong> para confirmar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={opsConfirmText}
            onChange={(e) => setOpsConfirmText(e.target.value)}
            placeholder={opsConfirmPhrase}
            autoFocus
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetOperations}
              disabled={opsConfirmText.trim().toUpperCase() !== opsConfirmPhrase || opsResetting}
              className="bg-destructive text-destructive-foreground"
            >
              {opsResetting ? 'Borrando…' : 'Sí, borrar histórico'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}