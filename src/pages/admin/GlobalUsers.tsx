import { useEffect, useState, useMemo } from 'react';
import { PlatformLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { KeyRound, Pencil, Power, ShieldCheck, ShieldOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { GlobalUserEditDialog, GlobalUser } from '@/components/admin/GlobalUserEditDialog';
import { UserRole } from '@/types/database';

interface Row extends GlobalUser {
  last_sign_in_at: string | null;
  restaurants: { restaurant_id: string; name: string; slug: string; role: string; status: string }[];
}

const ROLE_LABELS: Record<UserRole, string> = {
  platform_admin: 'Platform admin', admin: 'Admin', manager: 'Encargado', waiter: 'Camarero',
};

export default function GlobalUsersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editing, setEditing] = useState<Row | null>(null);
  const [resetTarget, setResetTarget] = useState<Row | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('list_global_users' as any);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setRows([]);
    } else {
      setRows((data as any[]) ?? []);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    return rows.filter(r => {
      if (s && !r.name?.toLowerCase().includes(s) && !r.email?.toLowerCase().includes(s)) return false;
      if (roleFilter !== 'all' && !(r.global_roles ?? []).includes(roleFilter as UserRole)) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      return true;
    });
  }, [rows, search, roleFilter, statusFilter]);

  const toggleStatus = async (r: Row) => {
    const next = r.status === 'active' ? 'inactive' : 'active';
    const { error } = await supabase.from('profiles').update({ status: next } as any).eq('id', r.user_id);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else { toast({ title: next === 'active' ? 'Usuario activado' : 'Usuario desactivado' }); load(); }
  };

  const togglePlatformAdmin = async (r: Row) => {
    const isPA = (r.global_roles ?? []).includes('platform_admin');
    if (isPA) {
      const { error } = await supabase.from('user_roles').delete().eq('user_id', r.user_id).eq('role', 'platform_admin');
      if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
      else { toast({ title: 'Platform admin retirado' }); load(); }
    } else {
      const { error } = await supabase.from('user_roles').insert({ user_id: r.user_id, role: 'platform_admin' } as any);
      if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
      else { toast({ title: 'Platform admin asignado' }); load(); }
    }
  };

  const handleReset = async () => {
    if (!resetTarget || newPassword.length < 8) {
      toast({ title: 'Contraseña inválida', description: 'Mínimo 8 caracteres', variant: 'destructive' });
      return;
    }
    setResetting(true);
    // Reuse admin-reset-password but pass any restaurant_id this user belongs to (platform admins bypass check)
    const rid = resetTarget.restaurants?.[0]?.restaurant_id ?? null;
    const { data, error } = await supabase.functions.invoke('admin-reset-password', {
      body: { user_id: resetTarget.user_id, restaurant_id: rid, password: newPassword, platform: true },
    });
    setResetting(false);
    if (error || (data as any)?.error) {
      toast({ title: 'Error', description: (error?.message ?? (data as any)?.error) || 'No se pudo restablecer', variant: 'destructive' });
    } else {
      toast({ title: 'Contraseña restablecida' });
      setResetTarget(null); setNewPassword('');
    }
  };

  return (
    <PlatformLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Usuarios globales</h1>
          <p className="text-sm text-muted-foreground">Gestiona todos los usuarios de la plataforma</p>
        </div>

        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input placeholder="Buscar por nombre o email…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger><SelectValue placeholder="Rol" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los roles</SelectItem>
                <SelectItem value="platform_admin">Platform admin</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="manager">Encargado</SelectItem>
                <SelectItem value="waiter">Camarero</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Activo</SelectItem>
                <SelectItem value="inactive">Inactivo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Roles globales</TableHead>
                <TableHead>Restaurantes vinculados</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Último acceso</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Cargando…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No hay usuarios</TableCell></TableRow>
              ) : filtered.map(r => {
                const isPA = (r.global_roles ?? []).includes('platform_admin');
                return (
                  <TableRow key={r.user_id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-sm">{r.email}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(r.global_roles ?? []).map(role => (
                          <Badge key={role} variant={role === 'platform_admin' ? 'default' : 'outline'} className="text-xs">{ROLE_LABELS[role]}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {isPA ? (
                          <Badge variant="default" className="text-xs">Acceso global</Badge>
                        ) : (
                          (r.restaurants ?? []).map(x => (
                            <Badge key={x.restaurant_id} variant="secondary" className="text-xs">{x.name}</Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.status === 'active' ? 'default' : 'secondary'}>
                        {r.status === 'active' ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.last_sign_in_at ? new Date(r.last_sign_in_at).toLocaleString('es-ES') : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(r)} title="Editar usuario">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => toggleStatus(r)} title={r.status === 'active' ? 'Desactivar' : 'Activar'}>
                          <Power className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => togglePlatformAdmin(r)} title={isPA ? 'Quitar platform admin' : 'Asignar platform admin'}>
                          {isPA ? <ShieldOff className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setResetTarget(r); setNewPassword(''); }} title="Restablecer contraseña">
                          <KeyRound className="w-4 h-4" />
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

      <GlobalUserEditDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        user={editing}
        onSaved={load}
      />

      <Dialog open={!!resetTarget} onOpenChange={(o) => !o && setResetTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Restablecer contraseña</DialogTitle></DialogHeader>
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
    </PlatformLayout>
  );
}