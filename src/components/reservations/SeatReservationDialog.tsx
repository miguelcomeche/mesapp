import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users } from 'lucide-react';
import { Table, Reservation, STATUS_LABELS } from '@/types/database';

interface SeatReservationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservation: Reservation | null;
  tables: Table[];
  onConfirm: (tableId: string) => void;
}

export default function SeatReservationDialog({
  open,
  onOpenChange,
  reservation,
  tables,
  onConfirm,
}: SeatReservationDialogProps) {
  const [selectedTableId, setSelectedTableId] = useState<string>('');

  // Filter available tables with enough capacity
  const availableTables = tables.filter(
    table => table.status === 'available' && table.capacity >= (reservation?.party_size || 0)
  );

  // Tables that could work but are occupied
  const occupiedTables = tables.filter(
    table => table.status !== 'available' && table.capacity >= (reservation?.party_size || 0)
  );

  const handleConfirm = () => {
    if (selectedTableId) {
      onConfirm(selectedTableId);
      setSelectedTableId('');
    }
  };

  const handleClose = () => {
    setSelectedTableId('');
    onOpenChange(false);
  };

  if (!reservation) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Sentar reserva</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Reservation info */}
          <div className="rounded-lg bg-muted/50 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-lg">{reservation.guest_name}</span>
              <Badge variant="outline">
                <Users className="h-3 w-3 mr-1" />
                {reservation.party_size} personas
              </Badge>
            </div>
            {reservation.guest_phone && (
              <p className="text-sm text-muted-foreground">{reservation.guest_phone}</p>
            )}
            <p className="text-sm text-muted-foreground mt-1">
              Hora: {new Date(reservation.scheduled_time).toLocaleTimeString('es-ES', { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </p>
            {reservation.notes && (
              <p className="text-sm mt-2 italic">{reservation.notes}</p>
            )}
          </div>

          {/* Table selection */}
          <div className="space-y-3">
            <Label>Seleccionar mesa</Label>
            
            {availableTables.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                No hay mesas disponibles con capacidad para {reservation.party_size} personas.
              </div>
            ) : (
              <ScrollArea className="h-[200px]">
                <RadioGroup
                  value={selectedTableId}
                  onValueChange={setSelectedTableId}
                  className="space-y-2"
                >
                  {availableTables.map(table => (
                    <div key={table.id}>
                      <RadioGroupItem value={table.id} id={table.id} className="peer sr-only" />
                      <Label
                        htmlFor={table.id}
                        className="flex items-center justify-between rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-status-available/10 flex items-center justify-center">
                            <span className="font-bold text-status-available">{table.number}</span>
                          </div>
                          <div>
                            <p className="font-medium">Mesa {table.number}</p>
                            <p className="text-sm text-muted-foreground">{table.section}</p>
                          </div>
                        </div>
                        <Badge variant="outline">
                          <Users className="h-3 w-3 mr-1" />
                          {table.capacity}
                        </Badge>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </ScrollArea>
            )}

            {occupiedTables.length > 0 && (
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-2">
                  Mesas ocupadas con capacidad suficiente:
                </p>
                <div className="flex gap-2 flex-wrap">
                  {occupiedTables.map(table => (
                    <Badge key={table.id} variant="secondary">
                      Mesa {table.number} ({STATUS_LABELS.table[table.status]})
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedTableId}>
            Sentar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
