import { useEffect, useState } from 'react';
import { PlatformLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { usePlatformSettings, PlatformSettings } from '@/hooks/usePlatformSettings';
import { toast } from '@/hooks/use-toast';

export default function PlatformSettingsPage() {
  const { settings, loading, save } = usePlatformSettings();
  const [form, setForm] = useState<PlatformSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (settings) setForm(settings); }, [settings]);

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    const { error } = await save({
      platform_name: form.platform_name,
      base_domain: form.base_domain,
      support_email: form.support_email,
      maintenance_mode: form.maintenance_mode,
      allow_demo_restaurants: form.allow_demo_restaurants,
      primary_color: form.primary_color,
      secondary_color: form.secondary_color,
      logo_url: form.logo_url,
    });
    setSaving(false);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else toast({ title: 'Configuración guardada' });
  };

  if (loading || !form) {
    return (
      <PlatformLayout>
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
      </PlatformLayout>
    );
  }

  return (
    <PlatformLayout>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configuración plataforma</h1>
          <p className="text-sm text-muted-foreground">Ajustes globales de Mesapp</p>
        </div>

        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">General</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nombre plataforma</Label>
              <Input value={form.platform_name} onChange={(e) => setForm({ ...form, platform_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Dominio base</Label>
              <Input value={form.base_domain} onChange={(e) => setForm({ ...form, base_domain: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Email soporte</Label>
            <Input type="email" value={form.support_email ?? ''} onChange={(e) => setForm({ ...form, support_email: e.target.value })} />
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Branding</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Color primario</Label>
              <Input type="color" value={form.primary_color ?? '#000000'} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Color secundario</Label>
              <Input type="color" value={form.secondary_color ?? '#000000'} onChange={(e) => setForm({ ...form, secondary_color: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>URL del logo</Label>
            <Input value={form.logo_url ?? ''} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} placeholder="https://..." />
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Seguridad y mantenimiento</h2>
          <div className="flex items-center justify-between">
            <div>
              <Label>Modo mantenimiento</Label>
              <p className="text-xs text-muted-foreground">Bloquea el acceso a todos los restaurantes</p>
            </div>
            <Switch checked={form.maintenance_mode} onCheckedChange={(v) => setForm({ ...form, maintenance_mode: v })} />
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Configuración demo</h2>
          <div className="flex items-center justify-between">
            <div>
              <Label>Permitir restaurantes demo</Label>
              <p className="text-xs text-muted-foreground">Habilita la creación de restaurantes tipo demo</p>
            </div>
            <Switch checked={form.allow_demo_restaurants} onCheckedChange={(v) => setForm({ ...form, allow_demo_restaurants: v })} />
          </div>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</Button>
        </div>
      </div>
    </PlatformLayout>
  );
}