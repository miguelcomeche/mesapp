import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
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

const GLOBAL_ROLES: UserRole[] = ['platform_admin', 'admin', 'manager', 'waiter'];
const LABELS: Record<UserRole, string> = {
  platform_admin: 'Platform admin',
  admin: 'Admin',
  manager: 'Encargado',
  waiter: 'Camarero',
};

export function GlobalUserEditDialog({ open, onOpenChange, user, onSaved }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('active');
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name); setEmail(user.email); setStatus(user.status); setRoles(user.global_roles ?? []);
    }
  }, [user]);

  const toggleRole = (r: UserRole) => {
    setRoles((cur) => cur.includes(r) ? cur.filter(x => x !== r) : [...cur, r]);
  };

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
      toast({ title: 'Usuario actualizado' });
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}