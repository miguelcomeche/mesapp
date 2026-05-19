import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { UserRole } from '@/types/database';

export interface GlobalUser {
  user_id: string;
  name: string;
  email: string;
  status: string;
  global_roles: UserRole[];
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  user: GlobalUser | null;
  onSaved: () => void;
}

const GLOBAL_ROLES: UserRole[] = ['platform_admin', 'admin'];
const LABELS: Record<UserRole, string> = {
  platform_admin: 'Platform admin',
  admin: 'Admin',
  manager: 'Encargado',
  waiter: 'Camarero',
};

type RestRole = 'restaurant_admin' | 'manager' | 'waiter';
const REST_ROLE_LABELS: Record<RestRole, string> = {
  restaurant_admin: 'Admin del restaurante',
  manager: 'Encargado',
  waiter: 'Camarero',
};

interface RestaurantOption { id: string; name: string }
interface Assignment { restaurant_id: string; role: RestRole }

export function GlobalUserEditDialog({ open, onOpenChange, user, onSaved }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('active');
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [saving, setSaving] = useState(false);
  const [restaurants, setRestaurants] = useState<RestaurantOption[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [originalAssignments, setOriginalAssignments] = useState<Assignment[]>([]);
  const [addRestaurantId, setAddRestaurantId] = useState<string>('');
  const [addRole, setAddRole] = useState<RestRole>('manager');

  useEffect(() => {
    if (user && open) {
      setName(user.name); setEmail(user.email); setStatus(user.status); setRoles(user.global_roles ?? []);
      // load restaurants list + existing memberships
      (async () => {
        const [{ data: rData }, { data: mData }] = await Promise.all([
          supabase.from('restaurants').select('id, name').order('name'),
          supabase.from('restaurant_users' as any)
            .select('restaurant_id, role')
            .eq('user_id', user.user_id),
        ]);
        setRestaurants(((rData as any[]) ?? []).map((r) => ({ id: r.id, name: r.name })));
        const current = ((mData as any[]) ?? []).map((m) => ({ restaurant_id: m.restaurant_id, role: m.role as RestRole }));
        setAssignments(current);
        setOriginalAssignments(current);
      })();
    }
  }, [user, open]);

  const toggleRole = (r: UserRole) => {
    setRoles((cur) => cur.includes(r) ? cur.filter(x => x !== r) : [...cur, r]);
  };

  const addAssignment = () => {
    if (!addRestaurantId) return;
    if (assignments.some((a) => a.restaurant_id === addRestaurantId)) {
      toast({ title: 'Ya está vinculado', variant: 'destructive' });
      return;
    }
    setAssignments((cur) => [...cur, { restaurant_id: addRestaurantId, role: addRole }]);
    setAddRestaurantId('');
  };
  const removeAssignment = (rid: string) => setAssignments((cur) => cur.filter((a) => a.restaurant_id !== rid));
  const changeAssignmentRole = (rid: string, role: RestRole) =>
    setAssignments((cur) => cur.map((a) => (a.restaurant_id === rid ? { ...a, role } : a)));

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error: pErr } = await supabase.from('profiles')
        .update({ name, email, status } as any).eq('id', user.user_id);
      if (pErr) throw pErr;

      // Replace global roles
      await supabase.from('user_roles').delete().eq('user_id', user.user_id);
      if (roles.length > 0) {
        const rows = roles.map(role => ({ user_id: user.user_id, role }));
        const { error: rErr } = await supabase.from('user_roles').insert(rows as any);
        if (rErr) throw rErr;
      }

      // Sync restaurant assignments (add new, update changed, remove deleted)
      const origMap = new Map(originalAssignments.map((a) => [a.restaurant_id, a.role]));
      const curMap = new Map(assignments.map((a) => [a.restaurant_id, a.role]));
      const toRemove = [...origMap.keys()].filter((rid) => !curMap.has(rid));
      const toUpsert = assignments.filter((a) => origMap.get(a.restaurant_id) !== a.role);
      if (toRemove.length > 0) {
        const { error: dErr } = await supabase
          .from('restaurant_users' as any)
          .delete()
          .eq('user_id', user.user_id)
          .in('restaurant_id', toRemove);
        if (dErr) throw dErr;
      }
      if (toUpsert.length > 0) {
        const rows = toUpsert.map((a) => ({
          user_id: user.user_id,
          restaurant_id: a.restaurant_id,
          role: a.role,
          status: 'active',
        }));
        const { error: uErr } = await supabase
          .from('restaurant_users' as any)
          .upsert(rows as any, { onConflict: 'user_id,restaurant_id' });
        if (uErr) throw uErr;
      }

      toast({ title: 'Usuario actualizado' });
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const isPA = roles.includes('platform_admin');
  const availableToAdd = restaurants.filter((r) => !assignments.some((a) => a.restaurant_id === r.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Editar usuario</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-2">
            <Label>Nombre</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="flex items-center justify-between">
            <Label>Estado activo</Label>
            <Switch checked={status === 'active'} onCheckedChange={(v) => setStatus(v ? 'active' : 'inactive')} />
          </div>
          <div className="space-y-2">
            <Label>Roles globales</Label>
            <div className="space-y-2 border border-border rounded-md p-3">
              {GLOBAL_ROLES.map(r => (
                <div key={r} className="flex items-center justify-between">
                  <span className="text-sm">{LABELS[r]}</span>
                  <Switch checked={roles.includes(r)} onCheckedChange={() => toggleRole(r)} />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Restaurantes vinculados</Label>
            {isPA ? (
              <p className="text-xs text-muted-foreground border border-border rounded-md p-3">
                Los platform admin tienen <strong>Acceso global</strong> a todos los restaurantes. No se requieren vinculaciones.
              </p>
            ) : (
              <div className="border border-border rounded-md p-3 space-y-2">
                {assignments.length === 0 && (
                  <p className="text-xs text-muted-foreground">Sin restaurantes vinculados.</p>
                )}
                {assignments.map((a) => {
                  const rest = restaurants.find((r) => r.id === a.restaurant_id);
                  return (
                    <div key={a.restaurant_id} className="flex items-center gap-2">
                      <span className="flex-1 text-sm truncate">{rest?.name ?? a.restaurant_id}</span>
                      <Select value={a.role} onValueChange={(v) => changeAssignmentRole(a.restaurant_id, v as RestRole)}>
                        <SelectTrigger className="w-44 h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(Object.keys(REST_ROLE_LABELS) as RestRole[]).map((r) => (
                            <SelectItem key={r} value={r}>{REST_ROLE_LABELS[r]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button size="icon" variant="ghost" onClick={() => removeAssignment(a.restaurant_id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  );
                })}
                {availableToAdd.length > 0 && (
                  <div className="flex items-center gap-2 pt-2 border-t border-border">
                    <Select value={addRestaurantId} onValueChange={setAddRestaurantId}>
                      <SelectTrigger className="flex-1 h-8"><SelectValue placeholder="Añadir restaurante…" /></SelectTrigger>
                      <SelectContent>
                        {availableToAdd.map((r) => (
                          <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={addRole} onValueChange={(v) => setAddRole(v as RestRole)}>
                      <SelectTrigger className="w-44 h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(REST_ROLE_LABELS) as RestRole[]).map((r) => (
                          <SelectItem key={r} value={r}>{REST_ROLE_LABELS[r]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="icon" variant="outline" onClick={addAssignment} disabled={!addRestaurantId}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}