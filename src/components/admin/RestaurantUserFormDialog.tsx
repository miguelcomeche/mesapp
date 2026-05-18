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
  user_id: string;
  name: string;
  email: string;
  role: RestaurantRole;
  status: RestaurantUserStatus;
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
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(member?.name ?? '');
      setEmail(member?.email ?? '');
      setPassword('');
      setRole(member?.role ?? 'waiter');
      setActive((member?.status ?? 'active') === 'active');
    }
  }, [open, member]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (isEdit && member) {
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
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message ?? 'No se pudo guardar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar usuario' : 'Crear usuario'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nombre</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={isEdit} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isEdit} />
          </div>
          {!isEdit && (
            <div className="space-y-2">
              <Label>Contraseña temporal</Label>
              <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" />
            </div>
          )}
          <div className="space-y-2">
            <Label>Rol</Label>
            <Select value={role} onValueChange={(v) => setRole(v as RestaurantRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(roleLabels) as RestaurantRole[]).map((r) => (
                  <SelectItem key={r} value={r}>{roleLabels[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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