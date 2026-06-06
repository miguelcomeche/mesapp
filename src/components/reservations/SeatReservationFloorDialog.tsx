import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Users, AlertTriangle } from 'lucide-react';
import { Table, Reservation } from '@/types/database';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useZones } from '@/hooks/useZones';
import { useFloorPlanElements } from '@/hooks/useFloorPlanElements';
import { FloorPlanTable } from '@/components/floor/FloorPlanTable';
import { FloorElement } from '@/components/floor/FloorElement';
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

interface SeatReservationFloorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservation: Reservation | null;
  tables: Table[];
  sessions: { table_id: string; id: string; guest_count: number; started_at: string }[];
  onConfirm: (tableId: string) => void;
}

export default function SeatReservationFloorDialog({
  open,
  onOpenChange,
  reservation,
  tables,
  sessions,
  onConfirm,
}: SeatReservationFloorDialogProps) {
  const { restaurantId } = useAuth();
  const { zones } = useZones(restaurantId);
  const { elements } = useFloorPlanElements(restaurantId);
  const activeZones = useMemo(() => zones.filter((z) => z.active), [zones]);
  const [selectedZone, setSelectedZone] = useState<string>('');
  const [pendingCapacityTable, setPendingCapacityTable] = useState<Table | null>(null);

  if (!reservation) return null;

  const occupiedTableIds = new Set(sessions.map((s) => s.table_id));
  const currentZone = selectedZone || activeZones[0]?.name || '';

  const availableTablesCount = tables.filter(
    (t) =>
      !occupiedTableIds.has(t.id) &&
      (t.status === 'available' || t.status === 'reserved') &&
      t.capacity >= reservation.party_size,
  ).length;

  const confirmSeat = (tableId: string) => {
    onConfirm(tableId);
    onOpenChange(false);
  };

  const handleTableClick = (table: Table) => {
    const occupied = occupiedTableIds.has(table.id);
    if (occupied) return;
    if (table.capacity < reservation.party_size) {
      setPendingCapacityTable(table);
      return;
    }
    confirmSeat(table.id);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            Sentar reserva
            <Badge variant="outline" className="font-normal">
              <Users className="h-3 w-3 mr-1" />
              {reservation.party_size} personas
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Reservation summary */}
          <div className="rounded-lg bg-muted/50 p-3 flex items-center justify-between">
            <div>
              <span className="font-semibold">{reservation.guest_name}</span>
              <span className="text-muted-foreground mx-2">•</span>
              <span className="text-muted-foreground">
                {new Date(reservation.scheduled_time).toLocaleTimeString('es-ES', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </span>
            </div>
            <span className="text-sm text-muted-foreground">
              {availableTablesCount} mesa{availableTablesCount !== 1 ? 's' : ''} disponible{availableTablesCount !== 1 ? 's' : ''}
            </span>
          </div>

          {availableTablesCount === 0 && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-4 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
              <p className="text-sm text-amber-200">
                No hay mesas disponibles con capacidad para {reservation.party_size} personas.
              </p>
            </div>
          )}

          {activeZones.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
              No hay zonas configuradas en el plano de sala.
            </div>
          ) : (
            <Tabs value={currentZone} onValueChange={setSelectedZone}>
              <TabsList className="flex-wrap h-auto">
                {activeZones.map((z) => (
                  <TabsTrigger key={z.id} value={z.name} className="px-6">
                    {z.name}
                  </TabsTrigger>
                ))}
              </TabsList>
              {activeZones.map((z) => (
                <TabsContent key={z.id} value={z.name} className="mt-4">
                  <FloorPlanView
                    tables={tables.filter((t) => t.section === z.name)}
                    elements={elements.filter((e) => e.zone === z.name)}
                    occupiedTableIds={occupiedTableIds}
                    requiredCapacity={reservation.party_size}
                    onTableClick={handleTableClick}
                  />
                </TabsContent>
              ))}
            </Tabs>
          )}

          {/* Legend */}
          <div className="flex items-center gap-6 text-sm pt-2 border-t">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-[hsl(var(--status-available)/.3)] border-2 border-[hsl(var(--status-available))]" />
              <span className="text-muted-foreground">Disponible</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-[hsl(var(--status-reserved)/.3)] border-2 border-[hsl(var(--status-reserved))]" />
              <span className="text-muted-foreground">Reservada</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-muted/50 border-2 border-muted-foreground/30" />
              <span className="text-muted-foreground">Ocupada</span>
            </div>
            <p className="text-muted-foreground ml-auto">
              Haz clic en una mesa disponible para sentar
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    <AlertDialog open={!!pendingCapacityTable} onOpenChange={(o) => !o && setPendingCapacityTable(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Capacidad insuficiente</AlertDialogTitle>
          <AlertDialogDescription>
            La mesa tiene menos capacidad que la reserva. ¿Deseas continuar?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (pendingCapacityTable) confirmSeat(pendingCapacityTable.id);
              setPendingCapacityTable(null);
            }}
          >
            Continuar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

function FloorPlanView({
  tables,
  elements,
  occupiedTableIds,
  requiredCapacity,
  onTableClick,
}: {
  tables: Table[];
  elements: ReturnType<typeof useFloorPlanElements>['elements'];
  occupiedTableIds: Set<string>;
  requiredCapacity: number;
  onTableClick: (table: Table) => void;
}) {
  const width = Math.max(
    600,
    ...tables.map((t) => (t.position_x ?? 0) + (t.width ?? 80) + 40),
    ...elements.map((e) => e.x + e.width + 40),
  );
  const height = Math.max(
    350,
    ...tables.map((t) => (t.position_y ?? 0) + (t.height ?? 80) + 40),
    ...elements.map((e) => e.y + e.height + 40),
  );

  return (
    <div
      className="relative overflow-auto rounded-xl border border-border bg-card/50"
      style={{ maxHeight: '45vh' }}
    >
      <div
        className="relative"
        style={{
          width: `${width}px`,
          height: `${height}px`,
          minWidth: '100%',
          backgroundImage: 'radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      >
        {elements.map((el) => (
          <FloorElement key={el.id} element={el} isEditing={false} isSelected={false} />
        ))}

        {tables.map((table) => {
          const occupied = occupiedTableIds.has(table.id);
          const insufficient = table.capacity < requiredCapacity;
          return (
            <div
              key={table.id}
              className={cn(
                occupied && 'opacity-40 pointer-events-none',
                insufficient && !occupied && 'opacity-70',
              )}
            >
              <FloorPlanTable
                table={table}
                onClick={() => onTableClick(table)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
