import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export type RestaurantRole = 'restaurant_admin' | 'manager' | 'waiter';
export type RestaurantUserStatus = 'active' | 'inactive';

export interface RestaurantMember {
  // For auth-backed members: real user_id. For waiters: synthetic id of `waiter:<uuid>`.
  user_id: string;
  kind: 'auth' | 'waiter';
  waiter_id?: string;
  name: string;
  email: string | null;
  role: RestaurantRole;
  status: RestaurantUserStatus;
  waiter_pin?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  restaurantId: string;
  member?: RestaurantMember | null;
  onSaved: () => void;
}

const roleLabels: Record<RestaurantRole, string> = {
  restaurant_admin: 'Administrador del restaurante',
  manager: 'Encargado',
  waiter: 'Camarero',
};

export function RestaurantUserFormDialog({ open, onOpenChange, restaurantId, member, onSaved }: Props) {
  const isEdit = !!member;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<RestaurantRole>('waiter');
  const [active, setActive] = useState(true);
  const [waiterPin, setWaiterPin] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(member?.name ?? '');
      setEmail(member?.email ?? '');
      setPassword('');
      setRole(member?.role ?? 'waiter');
      setActive((member?.status ?? 'active') === 'active');
      setWaiterPin(member?.waiter_pin ?? '');
    }
  }, [open, member]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const pin = waiterPin.trim();

      // === WAITER (PIN-only, no auth user) ===
      if (role === 'waiter') {
        if (!name.trim()) {
          toast({ title: 'Falta el nombre', variant: 'destructive' });
          setSaving(false);
          return;
        }
        if (!/^\d{4,8}$/.test(pin)) {
          toast({ title: 'PIN inválido', description: 'El PIN debe tener entre 4 y 8 dígitos numéricos', variant: 'destructive' });
          setSaving(false);
          return;
        }
        if (isEdit && member?.kind === 'waiter' && member.waiter_id) {
          const { error } = await supabase
            .from('waiters' as any)
            .update({ name: name.trim(), pin, active } as any)
            .eq('id', member.waiter_id)
            .eq('restaurant_id', restaurantId);
          if (error) throw error;
          toast({ title: 'Camarero actualizado' });
        } else {
          const { error } = await supabase
            .from('waiters' as any)
            .insert({ restaurant_id: restaurantId, name: name.trim(), pin, active } as any);
          if (error) {
            if ((error as any).code === '23505') {
              throw new Error('Ya existe un camarero activo con ese PIN en este restaurante');
            }
            throw error;
          }
          toast({ title: 'Camarero creado correctamente.' });
        }
      } else {
        // === AUTH USER (admin/manager) ===
        if (isEdit && member?.kind === 'auth') {
          const { error } = await supabase
            .from('restaurant_users' as any)
            .update({ role, status: active ? 'active' : 'inactive' } as any)
            .eq('user_id', member.user_id)
            .eq('restaurant_id', restaurantId);
          if (error) throw error;
          toast({ title: 'Usuario actualizado' });
        } else {
          if (!name.trim() || !email.trim() || password.length < 8) {
            toast({ title: 'Datos incompletos', description: 'Nombre, correo y contraseña (mín. 8) son obligatorios', variant: 'destructive' });
            setSaving(false);
            return;
          }
          const { data, error } = await supabase.functions.invoke('admin-create-user', {
            body: { name, email, password, role, status: active ? 'active' : 'inactive', restaurant_id: restaurantId },
          });
          if (error) throw error;
          if ((data as any)?.error) throw new Error((data as any).error);
          toast({ title: 'Usuario creado' });
        }
      }
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message ?? 'No se pudo guardar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const isWaiter = role === 'waiter';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? (isWaiter ? 'Editar camarero' : 'Editar usuario') : (isWaiter ? 'Crear camarero' : 'Crear usuario')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nombre</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={isEdit && !isWaiter} />
          </div>
          {!isWaiter && (
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isEdit} />
            </div>
          )}
          {!isWaiter && !isEdit && (
            <div className="space-y-2">
              <Label>Contraseña temporal</Label>
              <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" />
            </div>
          )}
          <div className="space-y-2">
            <Label>Rol</Label>
            <Select value={role} onValueChange={(v) => setRole(v as RestaurantRole)} disabled={isEdit}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(roleLabels) as RestaurantRole[]).map((r) => (
                  <SelectItem key={r} value={r}>{roleLabels[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isWaiter && (
            <div className="space-y-2">
              <Label>PIN del camarero</Label>
              <Input
                inputMode="numeric"
                pattern="\d*"
                maxLength={8}
                value={waiterPin}
                onChange={(e) => setWaiterPin(e.target.value.replace(/\D/g, ''))}
                placeholder="4-8 dígitos"
              />
              <p className="text-xs text-muted-foreground">Debe ser único dentro del restaurante.</p>
            </div>
          )}
          <div className="flex items-center justify-between">
            <Label>Estado: {active ? 'Activo' : 'Inactivo'}</Label>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}