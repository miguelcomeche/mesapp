import { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import PermissionGuard from '@/components/auth/PermissionGuard';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { Plus, Pencil, Trash2, Users, Shield, UserCheck } from 'lucide-react';
import { Profile, UserRole } from '@/types/database';
import { useToast } from '@/hooks/use-toast';

const ROLES: { value: UserRole; label: string; description: string }[] = [
  { value: 'admin', label: 'Gerente / Propietario', description: 'Acceso completo a todas las funciones' },
  { value: 'manager', label: 'Encargado', description: 'Puede editar mesas y aplicar descuentos' },
  { value: 'waiter', label: 'Camarero', description: 'Solo acceso operativo' },
];

interface UserWithRoles extends Profile {
  roles: UserRole[];
}

export default function UserSettings() {
  const { canManageUsers, canAccessFullSettings } = usePermissions();
  const { restaurantId } = useAuth();
  const { toast } = useToast();
  
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Dialog states
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('waiter');

  useEffect(() => {
    fetchUsers();
  }, [restaurantId]);

  const fetchUsers = async () => {
    if (!restaurantId) return;
    
    // Fetch profiles in the restaurant
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .eq('restaurant_id', restaurantId);
    
    if (profilesError) {
      toast({ title: 'Error', description: 'No se pudieron cargar los usuarios', variant: 'destructive' });
      return;
    }
    
    // Fetch roles for each user
    const userIds = profiles.map(p => p.id);
    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id, role')
      .in('user_id', userIds);
    
    if (rolesError) {
      console.error('Error fetching roles:', rolesError);
    }
    
    // Combine profiles with roles
    const usersWithRoles: UserWithRoles[] = profiles.map(profile => ({
      ...profile as Profile,
      roles: roles?.filter(r => r.user_id === profile.id).map(r => r.role as UserRole) || [],
    }));
    
    setUsers(usersWithRoles);
    setIsLoading(false);
  };

  const handleOpenRoleDialog = (user: UserWithRoles) => {
    setSelectedUser(user);
    setSelectedRole(user.roles[0] || 'waiter');
    setRoleDialogOpen(true);
  };

  const handleUpdateRole = async () => {
    if (!selectedUser) return;

    // First, delete existing roles
    const { error: deleteError } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', selectedUser.id);
    
    if (deleteError) {
      toast({ title: 'Error', description: 'No se pudo actualizar el rol', variant: 'destructive' });
      return;
    }

    // Then insert new role
    const { error: insertError } = await supabase
      .from('user_roles')
      .insert({
        user_id: selectedUser.id,
        role: selectedRole,
      });
    
    if (insertError) {
      toast({ title: 'Error', description: 'No se pudo asignar el rol', variant: 'destructive' });
      return;
    }

    toast({ title: 'Rol actualizado', description: `${selectedUser.name} ahora es ${ROLES.find(r => r.value === selectedRole)?.label}.` });
    setRoleDialogOpen(false);
    fetchUsers();
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return <Badge className="bg-purple-500">Gerente</Badge>;
      case 'manager':
        return <Badge className="bg-blue-500">Encargado</Badge>;
      case 'waiter':
        return <Badge variant="secondary">Camarero</Badge>;
      default:
        return <Badge variant="outline">Sin rol</Badge>;
    }
  };

  return (
    <PermissionGuard allowed={canAccessFullSettings}>
      <MainLayout title="Gestión de Usuarios">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Usuarios y Roles</h1>
              <p className="text-muted-foreground">Gestiona los permisos del equipo</p>
            </div>
          </div>

          {/* Role Legend */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Niveles de acceso
            </h3>
            <div className="grid gap-3 md:grid-cols-3">
              {ROLES.map(role => (
                <div key={role.value} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  {getRoleBadge(role.value)}
                  <div>
                    <p className="font-medium text-sm">{role.label}</p>
                    <p className="text-xs text-muted-foreground">{role.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Users List */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {users.map(user => (
              <Card key={user.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <UserCheck className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{user.name}</h3>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex gap-1">
                    {user.roles.length > 0 ? (
                      user.roles.map(role => (
                        <span key={role}>{getRoleBadge(role)}</span>
                      ))
                    ) : (
                      <Badge variant="outline">Sin rol</Badge>
                    )}
                  </div>
                  
                  {canManageUsers && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenRoleDialog(user)}
                    >
                      <Pencil className="mr-1 h-3 w-3" />
                      Cambiar rol
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>

          {users.length === 0 && !isLoading && (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No hay usuarios en este restaurante</p>
            </div>
          )}
        </div>

        {/* Role Dialog */}
        <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cambiar rol de {selectedUser?.name}</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Selecciona el nuevo rol</Label>
                <Select
                  value={selectedRole}
                  onValueChange={(value) => setSelectedRole(value as UserRole)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map(role => (
                      <SelectItem key={role.value} value={role.value}>
                        <div className="flex flex-col">
                          <span>{role.label}</span>
                          <span className="text-xs text-muted-foreground">{role.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="p-3 rounded-lg bg-muted/50 text-sm">
                <p className="font-medium mb-1">Permisos del rol seleccionado:</p>
                <ul className="list-disc list-inside text-muted-foreground">
                  {selectedRole === 'admin' && (
                    <>
                      <li>Gestión completa del menú y productos</li>
                      <li>Configuración de mesas y zonas</li>
                      <li>Gestión de usuarios y roles</li>
                      <li>Aplicar descuentos</li>
                      <li>Acceso a todas las configuraciones</li>
                    </>
                  )}
                  {selectedRole === 'manager' && (
                    <>
                      <li>Editar mesas (estado, capacidad, zona)</li>
                      <li>Aplicar descuentos durante pagos</li>
                      <li>Ver configuraciones (sin editar)</li>
                      <li>Operación normal de servicio</li>
                    </>
                  )}
                  {selectedRole === 'waiter' && (
                    <>
                      <li>Gestión de mesas y pedidos</li>
                      <li>Registrar pagos (sin descuentos)</li>
                      <li>Sin acceso a configuraciones</li>
                    </>
                  )}
                </ul>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setRoleDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleUpdateRole}>
                Guardar cambios
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </MainLayout>
    </PermissionGuard>
  );
}
