import { useEffect, useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KeyRound, Pencil, Plus, Power, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from '@/hooks/use-toast';
import { RestaurantUserFormDialog, RestaurantMember } from '@/components/admin/RestaurantUserFormDialog';

const roleLabels: Record<RestaurantMember['role'], string> = {
  restaurant_admin: 'Admin restaurante',
  manager: 'Encargado',
  waiter: 'Camarero',
};

export default function UserSettings() {
  const { restaurantId, user } = useAuth();
  const { isOwner } = usePermissions();
  const [members, setMembers] = useState<RestaurantMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RestaurantMember | null>(null);
  const [resetTarget, setResetTarget] = useState<RestaurantMember | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RestaurantMember | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const load = async () => {
    if (!restaurantId) return;
    setLoading(true);
    const [{ data: authData, error: authErr }, { data: waiterData, error: waiterErr }] = await Promise.all([
      supabase.rpc('list_restaurant_members' as any, { _restaurant: restaurantId } as any),
      supabase.from('waiters' as any).select('id, name, pin, active, created_at').eq('restaurant_id', restaurantId).order('name'),
    ]);
    if (authErr) toast({ title: 'Error', description: authErr.message, variant: 'destructive' });
    if (waiterErr) toast({ title: 'Error', description: waiterErr.message, variant: 'destructive' });
    const auth: RestaurantMember[] = ((authData as any[]) ?? [])
      .filter((m) => m.role !== 'waiter')
      .map((m) => ({
        user_id: m.user_id,
        kind: 'auth' as const,
        name: m.name,
        email: m.email,
        role: m.role,
        status: m.status,
        waiter_pin: null,
      }));
    const waiters: RestaurantMember[] = ((waiterData as any[]) ?? []).map((w) => ({
      user_id: `waiter:${w.id}`,
      kind: 'waiter' as const,
      waiter_id: w.id,
      name: w.name,
      email: null,
      role: 'waiter' as const,
      status: w.active ? 'active' : 'inactive',
      waiter_pin: w.pin,
    }));
    setMembers([...auth, ...waiters]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [restaurantId]);

  const toggleStatus = async (m: RestaurantMember) => {
    if (m.kind === 'waiter' && m.waiter_id) {
      const nextActive = m.status !== 'active';
      const { error } = await supabase
        .from('waiters' as any)
        .update({ active: nextActive } as any)
        .eq('id', m.waiter_id)
        .eq('restaurant_id', restaurantId!);
      if (error) return toast({ title: 'Error', description: error.message, variant: 'destructive' });
      toast({ title: nextActive ? 'Camarero activado' : 'Camarero desactivado' });
      load();
      return;
    }
    const next = m.status === 'active' ? 'inactive' : 'active';
    const { error } = await supabase
      .from('restaurant_users' as any)
      .update({ status: next } as any)
      .eq('user_id', m.user_id)
      .eq('restaurant_id', restaurantId!);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else { toast({ title: next === 'active' ? 'Usuario activado' : 'Usuario desactivado' }); load(); }
  };

  const handleReset = async () => {
    if (!resetTarget || newPassword.length < 8) {
      toast({ title: 'Contraseña inválida', description: 'Mínimo 8 caracteres', variant: 'destructive' });
      return;
    }
    setResetting(true);
    const { data, error } = await supabase.functions.invoke('admin-reset-password', {
      body: { user_id: resetTarget.user_id, restaurant_id: restaurantId, password: newPassword },
    });
    setResetting(false);
    if (error || (data as any)?.error) {
      toast({ title: 'Error', description: (error?.message ?? (data as any)?.error) || 'No se pudo restablecer', variant: 'destructive' });
      return;
    }
    toast({ title: 'Contraseña restablecida' });
    setResetTarget(null);
    setNewPassword('');
  };

  const handleDelete = async () => {
    if (!deleteTarget || !restaurantId) return;
    setDeleting(true);
    try {
      if (deleteTarget.kind === 'waiter' && deleteTarget.waiter_id) {
        const { error } = await supabase.rpc('delete_waiter_safe' as any, {
          _restaurant: restaurantId, _waiter: deleteTarget.waiter_id,
        } as any);
        if (error) {
          if (error.message?.includes('WAITER_HAS_HISTORY')) {
            toast({
              title: 'No se puede eliminar',
              description: 'Este camarero ya tiene actividad registrada. Puedes desactivarlo, pero no eliminarlo.',
              variant: 'destructive',
            });
          } else {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
          }
          return;
        }
        toast({ title: 'Camarero eliminado' });
      } else {
        const { data, error } = await supabase.functions.invoke('admin-delete-user', {
          body: { user_id: deleteTarget.user_id, restaurant_id: restaurantId, mode: 'hard' },
        });
        const errMsg = error?.message ?? (data as any)?.error;
        if (errMsg) {
          toast({
            title: 'No se puede eliminar',
            description: errMsg,
            variant: 'destructive',
          });
          load();
          return;
        }
        toast({ title: 'Usuario eliminado' });
      }
      setDeleteTarget(null);
      load();
    } finally {
      setDeleting(false);
    }
  };

  const visibleMembers = members.filter((m) =>
    statusFilter === 'all' ? true : statusFilter === 'active' ? m.status === 'active' : m.status !== 'active'
  );

  return (
    <MainLayout title="Usuarios">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Usuarios</h1>
            <p className="text-sm text-muted-foreground">Gestiona el equipo de tu restaurante</p>
          </div>
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />Crear usuario
          </Button>
        </div>

        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <TabsList>
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="active">Activos</TabsTrigger>
            <TabsTrigger value="inactive">Inactivos</TabsTrigger>
          </TabsList>
        </Tabs>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>PIN</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Cargando…</TableCell></TableRow>
              ) : visibleMembers.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No hay usuarios</TableCell></TableRow>
              ) : visibleMembers.map(m => (
                <TableRow key={m.user_id}>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell className="text-sm">{m.email ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell><Badge variant="outline">{roleLabels[m.role]}</Badge></TableCell>
                  <TableCell className="text-sm font-mono">
                    {m.kind === 'waiter' ? (m.waiter_pin ? '••••' : '—') : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={m.status === 'active' ? 'default' : 'secondary'}>
                      {m.status === 'active' ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => { setEditing(m); setFormOpen(true); }} title="Editar">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleStatus(m)} title={m.status === 'active' ? 'Desactivar' : 'Activar'}>
                        <Power className="w-4 h-4" />
                      </Button>
                      {m.kind === 'auth' && (
                        <Button size="sm" variant="ghost" onClick={() => { setResetTarget(m); setNewPassword(''); }} title="Restablecer contraseña">
                          <KeyRound className="w-4 h-4" />
                        </Button>
                      )}
                      {isOwner && m.user_id !== user?.id && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleteTarget(m)}
                          title="Eliminar definitivamente"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      {restaurantId && (
        <RestaurantUserFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          restaurantId={restaurantId}
          member={editing}
          onSaved={load}
        />
      )}

      <Dialog open={!!resetTarget} onOpenChange={(o) => !o && setResetTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restablecer contraseña</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{resetTarget?.email}</p>
            <div className="space-y-2">
              <Label>Nueva contraseña</Label>
              <Input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 8 caracteres" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetTarget(null)} disabled={resetting}>Cancelar</Button>
            <Button onClick={handleReset} disabled={resetting}>{resetting ? 'Guardando…' : 'Restablecer'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && !deleting && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar usuario</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. ¿Seguro que quieres eliminar a <strong>{deleteTarget?.name}</strong> definitivamente?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Eliminando…' : 'Eliminar definitivamente'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}