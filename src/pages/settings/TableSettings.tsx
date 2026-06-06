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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Pencil, Trash2, LayoutGrid, Users } from 'lucide-react';
import { Table, TableStatus } from '@/types/database';
import { useToast } from '@/hooks/use-toast';
import { ZoneManager } from '@/components/settings/ZoneManager';
import { useZones } from '@/hooks/useZones';

const STATUSES: { value: TableStatus; label: string }[] = [
  { value: 'available', label: 'Disponible' },
  { value: 'occupied', label: 'Ocupada' },
  { value: 'reserved', label: 'Reservada' },
  { value: 'needs_attention', label: 'Atención' },
];

export default function TableSettings() {
  const { canEditTables, canCreateTables, canDeleteTables, canAccessSettings, canManageZones } = usePermissions();
  const { restaurantId } = useAuth();
  const { toast } = useToast();
  const { zones: zoneList } = useZones(restaurantId);
  const activeZones = zoneList.filter((z) => z.active);
  
  const [tables, setTables] = useState<Table[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  
  // Dialog states
  const [tableDialogOpen, setTableDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [deletingTable, setDeletingTable] = useState<Table | null>(null);
  
  // Form states
  const [tableForm, setTableForm] = useState({
    number: '',
    capacity: '4',
    min_capacity: '1',
    max_capacity: '4',
    section: 'Principal',
  });

  useEffect(() => {
    fetchTables();
  }, [restaurantId]);

  const fetchTables = async () => {
    if (!restaurantId) return;
    
    const { data, error } = await supabase
      .from('tables')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('section')
      .order('number');
    
    if (error) {
      toast({ title: 'Error', description: 'No se pudieron cargar las mesas', variant: 'destructive' });
      return;
    }
    
    setTables(data as Table[]);
    setIsLoading(false);
  };

  const handleOpenTableDialog = (table?: Table) => {
    if (table) {
      setEditingTable(table);
      setTableForm({
        number: table.number,
        capacity: table.capacity.toString(),
        min_capacity: (table.min_capacity ?? 1).toString(),
        max_capacity: (table.max_capacity ?? table.capacity).toString(),
        section: table.section,
      });
    } else {
      setEditingTable(null);
      setTableForm({
        number: '',
        capacity: '4',
        min_capacity: '1',
        max_capacity: '4',
        section: selectedZone || activeZones[0]?.name || '',
      });
    }
    setTableDialogOpen(true);
  };

  const handleSaveTable = async () => {
    if (!restaurantId || !tableForm.number) {
      toast({ title: 'Error', description: 'Completa los campos obligatorios', variant: 'destructive' });
      return;
    }
    if (!tableForm.section) {
      toast({ title: 'Falta zona', description: 'La mesa debe pertenecer a una zona. Crea una zona primero.', variant: 'destructive' });
      return;
    }

    const min = Math.max(1, parseInt(tableForm.min_capacity) || 1);
    const def = Math.max(min, parseInt(tableForm.capacity) || 4);
    const max = Math.min(50, Math.max(def, parseInt(tableForm.max_capacity) || def));
    const tableData = {
      number: tableForm.number.trim(),
      capacity: def,
      min_capacity: min,
      max_capacity: max,
      section: tableForm.section,
      restaurant_id: restaurantId,
    } as any;

    if (editingTable) {
      const { error } = await supabase
        .from('tables')
        .update(tableData)
        .eq('id', editingTable.id);
      
      if (error) {
        toast({ title: 'Error', description: 'No se pudo actualizar la mesa', variant: 'destructive' });
        return;
      }
      toast({ title: 'Mesa actualizada', description: `Mesa ${tableForm.number} ha sido actualizada.` });
    } else {
      const { error } = await supabase
        .from('tables')
        .insert({ ...tableData, status: 'available' });
      
      if (error) {
        toast({ title: 'Error', description: 'No se pudo crear la mesa', variant: 'destructive' });
        return;
      }
      toast({ title: 'Mesa creada', description: `Mesa ${tableForm.number} ha sido añadida.` });
    }

    setTableDialogOpen(false);
    fetchTables();
  };

  const handleDeleteTable = async () => {
    if (!deletingTable) return;

    const { error } = await supabase
      .from('tables')
      .delete()
      .eq('id', deletingTable.id);
    
    if (error) {
      toast({ title: 'Error', description: 'No se pudo eliminar la mesa. Puede que tenga sesiones activas.', variant: 'destructive' });
      return;
    }

    toast({ title: 'Mesa eliminada', description: `Mesa ${deletingTable.number} ha sido eliminada.` });
    setDeleteDialogOpen(false);
    setDeletingTable(null);
    fetchTables();
  };

  const handleUpdateStatus = async (table: Table, status: TableStatus) => {
    const { error } = await supabase
      .from('tables')
      .update({ status })
      .eq('id', table.id);
    
    if (error) {
      toast({ title: 'Error', description: 'No se pudo actualizar el estado', variant: 'destructive' });
      return;
    }

    fetchTables();
  };

  const zones = [...new Set(tables.map(t => t.section))];
  const filteredTables = selectedZone 
    ? tables.filter(t => t.section === selectedZone)
    : tables;

  const getStatusColor = (status: TableStatus) => {
    switch (status) {
      case 'available': return 'bg-green-500';
      case 'occupied': return 'bg-red-500';
      case 'reserved': return 'bg-blue-500';
      case 'needs_attention': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <PermissionGuard allowed={canAccessSettings}>
      <MainLayout title="Configuración de Mesas">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Gestión de Mesas</h1>
              <p className="text-muted-foreground">Configura mesas, zonas y capacidades</p>
            </div>
            {canCreateTables && (
              <Button onClick={() => handleOpenTableDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Nueva mesa
              </Button>
            )}
          </div>

          {/* Zones Manager */}
          <ZoneManager restaurantId={restaurantId} canManage={canManageZones} />

          {/* Zone Filter */}
          <div className="flex gap-2 flex-wrap">
            <Badge
              variant={selectedZone === null ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setSelectedZone(null)}
            >
              Todas ({tables.length})
            </Badge>
            {zones.map(zone => (
              <Badge
                key={zone}
                variant={selectedZone === zone ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => setSelectedZone(zone)}
              >
                {zone} ({tables.filter(t => t.section === zone).length})
              </Badge>
            ))}
          </div>

          {/* Tables Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredTables.map(table => (
              <Card key={table.id} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(table.status)}`} />
                    <div>
                      <h3 className="font-bold text-lg">Mesa {table.number}</h3>
                      <p className="text-sm text-muted-foreground">{table.section}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="gap-1">
                    <Users className="h-3 w-3" />
                    {table.capacity}
                  </Badge>
                </div>

                {canEditTables && (
                  <div className="space-y-3">
                    <Select
                      value={table.status}
                      onValueChange={(value) => handleUpdateStatus(table, value as TableStatus)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map(s => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleOpenTableDialog(table)}
                      >
                        <Pencil className="mr-1 h-3 w-3" />
                        Editar
                      </Button>
                      {canDeleteTables && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setDeletingTable(table);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>

          {filteredTables.length === 0 && (
            <div className="text-center py-12">
              <LayoutGrid className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No hay mesas configuradas</p>
              {canCreateTables && (
                <Button className="mt-4" onClick={() => handleOpenTableDialog()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Añadir mesa
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Table Dialog */}
        <Dialog open={tableDialogOpen} onOpenChange={setTableDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingTable ? 'Editar mesa' : 'Nueva mesa'}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="number">Número de mesa *</Label>
                <Input
                  id="number"
                  value={tableForm.number}
                  onChange={(e) => setTableForm(prev => ({ ...prev, number: e.target.value }))}
                  placeholder="Ej: 1, A1, T-5"
                />
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Mínima</Label>
                  <Input type="number" min={1} max={50}
                    value={tableForm.min_capacity}
                    onChange={(e) => setTableForm(prev => ({ ...prev, min_capacity: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Por defecto</Label>
                  <Input type="number" min={1} max={50}
                    value={tableForm.capacity}
                    onChange={(e) => setTableForm(prev => ({ ...prev, capacity: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Máxima</Label>
                  <Input type="number" min={1} max={50}
                    value={tableForm.max_capacity}
                    onChange={(e) => setTableForm(prev => ({ ...prev, max_capacity: e.target.value }))} />
                </div>
              </div>

              <div className="space-y-2">
                  <Label htmlFor="section">Zona</Label>
                  <Select
                    value={tableForm.section}
                    onValueChange={(value) => setTableForm(prev => ({ ...prev, section: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {activeZones.map(zone => (
                        <SelectItem key={zone.id} value={zone.name}>
                          {zone.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
              </div>
              <p className="text-xs text-muted-foreground">Aforo máximo permitido: 50 personas.</p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setTableDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveTable}>
                {editingTable ? 'Guardar cambios' : 'Crear mesa'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar mesa?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. La mesa "{deletingTable?.number}" será eliminada permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteTable} className="bg-destructive text-destructive-foreground">
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </MainLayout>
    </PermissionGuard>
  );
}
