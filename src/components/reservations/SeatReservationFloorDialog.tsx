import { useState } from 'react';
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

interface SeatReservationFloorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservation: Reservation | null;
  tables: Table[];
  sessions: { table_id: string; id: string; guest_count: number; started_at: string }[];
  onConfirm: (tableId: string) => void;
}

// Simplified floor plan table component for selection
function SelectableFloorTable({
  table,
  isAvailable,
  isSelected,
  hasEnoughCapacity,
  onClick,
}: {
  table: Table;
  isAvailable: boolean;
  isSelected: boolean;
  hasEnoughCapacity: boolean;
  onClick: () => void;
}) {
  const position = {
    x: table.position_x ?? 0,
    y: table.position_y ?? 0,
  };
  
  const isAuxiliary = table.number.startsWith('VD');
  const canSelect = isAvailable && hasEnoughCapacity;

  return (
    <div
      className={cn(
        'absolute w-20 h-20 rounded-xl flex flex-col items-center justify-center transition-all border-2 cursor-pointer',
        canSelect
          ? isSelected
            ? 'bg-primary border-primary text-primary-foreground shadow-lg scale-110'
            : 'bg-[hsl(var(--status-available)/.3)] border-[hsl(var(--status-available))] hover:scale-105 hover:shadow-md'
          : 'bg-muted/50 border-muted-foreground/30 opacity-50 cursor-not-allowed',
        isAuxiliary && 'w-16 h-16'
      )}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
      onClick={canSelect ? onClick : undefined}
    >
      <span className={cn('text-lg font-bold', isAuxiliary && 'text-sm')}>
        {table.number}
      </span>
      <div className="flex items-center gap-1 text-xs">
        <Users className="w-3 h-3" />
        <span>{table.capacity}</span>
      </div>
      {!hasEnoughCapacity && isAvailable && (
        <span className="text-[10px] text-destructive">Cap. insuf.</span>
      )}
    </div>
  );
}

export default function SeatReservationFloorDialog({
  open,
  onOpenChange,
  reservation,
  tables,
  sessions,
  onConfirm,
}: SeatReservationFloorDialogProps) {
  const [selectedZone, setSelectedZone] = useState<'Interior' | 'Terraza'>('Interior');
  
  if (!reservation) return null;

  // Get occupied table IDs
  const occupiedTableIds = new Set(sessions.map(s => s.table_id));
  
  // Filter tables for current zone
  const zoneTables = tables.filter(t => t.section === selectedZone);
  
  // Get default positions for tables without saved positions
  const getDefaultPosition = (index: number) => {
    const cols = 5;
    const spacing = 100;
    const startX = 50;
    const startY = 50;
    
    const row = Math.floor(index / cols);
    const col = index % cols;
    
    return {
      x: startX + col * spacing,
      y: startY + row * spacing,
    };
  };

  const getTablePosition = (table: Table, index: number) => {
    if (table.position_x != null && table.position_y != null) {
      return { x: table.position_x, y: table.position_y };
    }
    return getDefaultPosition(index);
  };

  // Compute canvas dimensions
  const tablesWithPositions = zoneTables.map((t, i) => ({
    ...t,
    position_x: getTablePosition(t, i).x,
    position_y: getTablePosition(t, i).y,
  }));

  const computedWidth = Math.max(
    600,
    ...tablesWithPositions.map(t => (t.position_x ?? 0) + 100)
  );
  const computedHeight = Math.max(
    350,
    ...tablesWithPositions.map(t => (t.position_y ?? 0) + 100)
  );

  // Count available tables with enough capacity
  const availableTablesCount = tables.filter(
    t => !occupiedTableIds.has(t.id) && t.status === 'available' && t.capacity >= reservation.party_size
  ).length;

  const handleTableClick = (table: Table) => {
    // Immediately seat when clicking an available table
    onConfirm(table.id);
    onOpenChange(false);
  };

  return (
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

          {/* Zone tabs */}
          <Tabs value={selectedZone} onValueChange={(v) => setSelectedZone(v as 'Interior' | 'Terraza')}>
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="Interior">Interior</TabsTrigger>
              <TabsTrigger value="Terraza">Terraza</TabsTrigger>
            </TabsList>

            <TabsContent value="Interior" className="mt-4">
              <FloorPlanView
                tables={tablesWithPositions.filter(t => t.section === 'Interior')}
                occupiedTableIds={occupiedTableIds}
                requiredCapacity={reservation.party_size}
                width={computedWidth}
                height={computedHeight}
                onTableClick={handleTableClick}
                zone="Interior"
              />
            </TabsContent>

            <TabsContent value="Terraza" className="mt-4">
              <FloorPlanView
                tables={tablesWithPositions.filter(t => t.section === 'Terraza')}
                occupiedTableIds={occupiedTableIds}
                requiredCapacity={reservation.party_size}
                width={computedWidth}
                height={computedHeight}
                onTableClick={handleTableClick}
                zone="Terraza"
              />
            </TabsContent>
          </Tabs>

          {/* Legend */}
          <div className="flex items-center gap-6 text-sm pt-2 border-t">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-[hsl(var(--status-available)/.3)] border-2 border-[hsl(var(--status-available))]" />
              <span className="text-muted-foreground">Disponible</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-muted/50 border-2 border-muted-foreground/30" />
              <span className="text-muted-foreground">Ocupada / Sin capacidad</span>
            </div>
            <p className="text-muted-foreground ml-auto">
              Haz clic en una mesa disponible para sentar
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Floor plan view component
function FloorPlanView({
  tables,
  occupiedTableIds,
  requiredCapacity,
  width,
  height,
  onTableClick,
  zone,
}: {
  tables: Table[];
  occupiedTableIds: Set<string>;
  requiredCapacity: number;
  width: number;
  height: number;
  onTableClick: (table: Table) => void;
  zone: 'Interior' | 'Terraza';
}) {
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
        {/* Bar block for Interior */}
        {zone === 'Interior' && (
          <div 
            className="absolute rounded-lg bg-muted/50 border border-border flex items-center justify-center"
            style={{
              left: '200px',
              top: '100px',
              width: '150px',
              height: '40px',
            }}
          >
            <span className="text-xs text-muted-foreground font-medium">BARRA</span>
          </div>
        )}

        {tables.map((table) => {
          const isAvailable = !occupiedTableIds.has(table.id) && table.status === 'available';
          const hasEnoughCapacity = table.capacity >= requiredCapacity;

          return (
            <SelectableFloorTable
              key={table.id}
              table={table}
              isAvailable={isAvailable}
              isSelected={false}
              hasEnoughCapacity={hasEnoughCapacity}
              onClick={() => onTableClick(table)}
            />
          );
        })}
      </div>
    </div>
  );
}
