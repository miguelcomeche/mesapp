import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, ExternalLink, Pencil, Power, Users, Sparkles, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ModuleKey, Restaurant, RestaurantModules } from '@/types/database';
import { RestaurantFormDialog, RestaurantWithModules } from '@/components/admin/RestaurantFormDialog';
import { ImportConfigDialog } from '@/components/admin/ImportConfigDialog';
import { toast } from '@/hooks/use-toast';

const moduleShortLabels: Record<ModuleKey, string> = {
  pos_enabled: 'TPV',
  reservations_enabled: 'Reservas',
  public_booking_enabled: 'Reserva pública',
  menu_enabled: 'Carta',
  payments_enabled: 'Pagos',
  kitchen_bar_enabled: 'Cocina/Barra',
  analytics_enabled: 'Analíticas',
  tickets_enabled: 'Tickets',
  printing_enabled: 'Impresión',
};

export default function AdminRestaurantsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<RestaurantWithModules[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<RestaurantWithModules | null>(null);
  const [open, setOpen] = useState(false);
  const [importTarget, setImportTarget] = useState<RestaurantWithModules | null>(null);

  const seedDemo = async (r: RestaurantWithModules) => {
    if (r.type !== 'demo') return;
    if (!confirm(`¿Cargar datos demo en "${r.name}"? Se añadirán mesas y productos de ejemplo.`)) return;
    const { data, error } = await supabase.functions.invoke('restaurant-seed-demo', {
      body: { restaurant_id: r.id },
    });
    if (error || (data as any)?.error) {
      toast({ title: 'Error', description: (error?.message ?? (data as any)?.error) || 'No se pudo cargar', variant: 'destructive' });
    } else {
      toast({ title: 'Datos demo cargados' });
    }
  };

  const load = async () => {
    setLoading(true);
    const { data: rs } = await supabase.from('restaurants').select('*').order('created_at', { ascending: false });
    const { data: ms } = await supabase.from('restaurant_modules' as any).select('*');
    const modByRid = new Map<string, RestaurantModules>();
    (ms as any[] | null)?.forEach(m => modByRid.set(m.restaurant_id, m));
    const merged: RestaurantWithModules[] = ((rs as any[]) ?? []).map(r => ({
      ...(r as Restaurant),
      modules: modByRid.get(r.id),
    }));
    setItems(merged);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleStatus = async (r: RestaurantWithModules) => {
    const next = r.status === 'active' ? 'inactive' : 'active';
    const { error } = await supabase.from('restaurants').update({ status: next } as any).eq('id', r.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: next === 'active' ? 'Restaurante activado' : 'Restaurante desactivado' });
      load();
    }
  };

  const openNew = () => { setEditing(null); setOpen(true); };
  const openEdit = (r: RestaurantWithModules) => { setEditing(r); setOpen(true); };

  const openTenant = (slug: string) => {
    const host = window.location.hostname;
    const isLocal =
      host === 'localhost' || host.startsWith('127.') ||
      host.includes('id-preview--') || host.endsWith('.lovableproject.com');
    if (isLocal) {
      const url = new URL(window.location.href);
      url.searchParams.set('tenant', slug);
      url.pathname = '/dashboard';
      window.open(url.toString(), '_blank');
    } else {
      window.open(`https://${slug}.mesapp.com`, '_blank');
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Restaurantes</h1>
            <p className="text-sm text-muted-foreground">Administra los restaurantes de la plataforma</p>
          </div>
          <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" />Crear restaurante</Button>
        </div>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Módulos</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Cargando…</TableCell></TableRow>
              ) : items.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No hay restaurantes</TableCell></TableRow>
              ) : items.map(r => {
                const enabledModules = r.modules
                  ? (Object.keys(moduleShortLabels) as ModuleKey[]).filter(k => r.modules?.[k])
                  : [];
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell><code className="text-xs">{r.slug}</code></TableCell>
                    <TableCell className="text-xs text-muted-foreground">https://{r.slug}.mesapp.com</TableCell>
                    <TableCell>
                      <Badge variant={r.status === 'active' ? 'default' : 'secondary'}>
                        {r.status === 'active' ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{r.type === 'production' ? 'Producción' : 'Demo'}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {enabledModules.map(k => (
                          <Badge key={k} variant="secondary" className="text-xs">{moduleShortLabels[k]}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(r)} title="Editar">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => navigate(`/admin/restaurants/${r.id}/users`)} title="Usuarios">
                          <Users className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setImportTarget(r)} title="Importar configuración">
                          <Download className="w-4 h-4" />
                        </Button>
                        {r.type === 'demo' && (
                          <Button size="sm" variant="ghost" onClick={() => seedDemo(r)} title="Cargar datos demo">
                            <Sparkles className="w-4 h-4" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => toggleStatus(r)} title={r.status === 'active' ? 'Desactivar' : 'Activar'}>
                          <Power className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openTenant(r.slug)} title="Abrir restaurante">
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </div>

      <RestaurantFormDialog
        open={open}
        onOpenChange={setOpen}
        restaurant={editing}
        onSaved={load}
      />

      {importTarget && (
        <ImportConfigDialog
          open={!!importTarget}
          onOpenChange={(o) => !o && setImportTarget(null)}
          targetRestaurantId={importTarget.id}
          targetRestaurantName={importTarget.name}
          candidates={items.map(i => ({ id: i.id, name: i.name }))}
        />
      )}
    </MainLayout>
  );
}