import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

type Kind = 'auth' | 'waiter';
type AuthRole = 'platform_admin' | 'admin' | 'restaurant_admin' | 'manager';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}

const AUTH_ROLE_LABELS: Record<AuthRole, string> = {
  platform_admin: 'Platform admin',
  admin: 'Admin global',
  restaurant_admin: 'Admin del restaurante',
  manager: 'Encargado',
};

export function GlobalUserCreateDialog({ open, onOpenChange, onCreated }: Props) {
  const [kind, setKind] = useState<Kind>('auth');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<AuthRole>('manager');
  const [restaurantId, setRestaurantId] = useState<string>('');
  const [pin, setPin] = useState('');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restaurants, setRestaurants] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!open) return;
    setKind('auth'); setName(''); setEmail(''); setPassword('');
    setRole('manager'); setRestaurantId(''); setPin(''); setActive(true);
    supabase.from('restaurants').select('id, name').order('name').then(({ data }) => {
      setRestaurants(((data as any[]) ?? []).map((r) => ({ id: r.id, name: r.name })));
    });
  }, [open]);

  const needsRestaurant = kind === 'waiter' || role === 'restaurant_admin' || role === 'manager';
  const isGlobalRole = kind === 'auth' && (role === 'platform_admin' || role === 'admin');

  const handleSave = async () => {
    setSaving(true);
    try {
      if (kind === 'waiter') {
        if (!name.trim()) throw new Error('El nombre es obligatorio');
        if (!restaurantId) throw new Error('Selecciona un restaurante');
        if (!/^\d{4,8}$/.test(pin)) throw new Error('El PIN debe tener entre 4 y 8 dígitos');
        const { error } = await supabase.from('waiters' as any).insert({
          restaurant_id: restaurantId, name: name.trim(), pin, active,
        } as any);
        if (error) {
          if ((error as any).code === '23505') throw new Error('Ya existe un camarero activo con ese PIN en este restaurante');
          throw error;
        }
        toast({ title: 'Camarero creado correctamente.' });
      } else {
        if (!name.trim() || !email.trim() || password.length < 8) {
          throw new Error('Nombre, email y contraseña (mín. 8) son obligatorios');
        }
        if (needsRestaurant && !restaurantId) throw new Error('Selecciona un restaurante para este rol');

        if (isGlobalRole) {
          // Global role: invoke create-user against any restaurant just to bootstrap the auth profile,
          // then overwrite global roles with the selected one.
          // Fallback: use the first available restaurant when none selected.
          const anchorRid = restaurantId || restaurants[0]?.id;
          if (!anchorRid) throw new Error('No hay restaurantes disponibles');
          const { data, error } = await supabase.functions.invoke('admin-create-user', {
            body: {
              name, email, password,
              role: 'restaurant_admin', // any auth role to create user; we replace global role below
              status: active ? 'active' : 'inactive',
              restaurant_id: anchorRid,
            },
          });
          if (error) throw error;
          const userId = (data as any)?.user_id;
          if ((data as any)?.error || !userId) throw new Error((data as any)?.error || 'No se pudo crear el usuario');

          // Replace global role with selected one (platform_admin or admin)
          await supabase.from('user_roles').delete().eq('user_id', userId);
          await supabase.from('user_roles').insert({ user_id: userId, role } as any);

          // If the user did not explicitly pick a restaurant, remove the bootstrap membership for platform_admin
          if (!restaurantId && role === 'platform_admin') {
            await supabase.from('restaurant_users' as any).delete()
              .eq('user_id', userId).eq('restaurant_id', anchorRid);
          }
        } else {
          const { data, error } = await supabase.functions.invoke('admin-create-user', {
            body: {
              name, email, password, role,
              status: active ? 'active' : 'inactive',
              restaurant_id: restaurantId,
            },
          });
          if (error) throw error;
          if ((data as any)?.error) throw new Error((data as any).error);
        }
        toast({ title: 'Usuario creado' });
      }
      onCreated();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message ?? 'No se pudo crear', variant: 'destructive' });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Crear usuario</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo de usuario</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as Kind)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auth">Usuario con acceso (email + contraseña)</SelectItem>
                <SelectItem value="waiter">Camarero operativo (solo PIN)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Nombre</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          {kind === 'auth' && (
            <>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Contraseña temporal</Label>
                <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" />
              </div>
              <div className="space-y-2">
                <Label>Rol</Label>
                <Select value={role} onValueChange={(v) => setRole(v as AuthRole)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(AUTH_ROLE_LABELS) as AuthRole[]).map((r) => (
                      <SelectItem key={r} value={r}>{AUTH_ROLE_LABELS[r]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {(kind === 'waiter' || (kind === 'auth' && !isGlobalRole) || (kind === 'auth' && isGlobalRole)) && (
            <div className="space-y-2">
              <Label>
                Restaurante {needsRestaurant ? '' : <span className="text-muted-foreground">(opcional)</span>}
              </Label>
              <Select value={restaurantId} onValueChange={setRestaurantId}>
                <SelectTrigger><SelectValue placeholder="Selecciona un restaurante" /></SelectTrigger>
                <SelectContent>
                  {restaurants.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isGlobalRole && (
                <p className="text-xs text-muted-foreground">Los roles globales no requieren restaurante.</p>
              )}
            </div>
          )}

          {kind === 'waiter' && (
            <div className="space-y-2">
              <Label>PIN del camarero</Label>
              <Input
                inputMode="numeric" pattern="\d*" maxLength={8}
                value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="4-8 dígitos"
              />
            </div>
          )}

          <div className="flex items-center justify-between">
            <Label>Estado: {active ? 'Activo' : 'Inactivo'}</Label>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Guardando…' : 'Crear'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}