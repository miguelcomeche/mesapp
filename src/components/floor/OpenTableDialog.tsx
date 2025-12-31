import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Users } from 'lucide-react';
import { Table } from '@/types/database';

interface OpenTableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  table: Table | null;
  onConfirm: (guestCount: number) => void;
}

export default function OpenTableDialog({
  open,
  onOpenChange,
  table,
  onConfirm,
}: OpenTableDialogProps) {
  const [guestCount, setGuestCount] = useState('2');

  const handleConfirm = () => {
    const count = parseInt(guestCount) || 1;
    onConfirm(count);
    setGuestCount('2');
  };

  const handleClose = () => {
    setGuestCount('2');
    onOpenChange(false);
  };

  if (!table) return null;

  const quickCounts = [1, 2, 3, 4, 5, 6].filter(n => n <= table.capacity);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Abrir Mesa {table.number}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Table info */}
          <div className="rounded-lg bg-muted/50 p-4 text-center">
            <div className="h-16 w-16 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl font-bold text-primary">{table.number}</span>
            </div>
            <p className="text-sm text-muted-foreground">{table.section}</p>
            <p className="text-sm text-muted-foreground flex items-center justify-center gap-1 mt-1">
              <Users className="h-4 w-4" />
              Capacidad: {table.capacity} personas
            </p>
          </div>

          {/* Guest count */}
          <div className="space-y-3">
            <Label>Número de comensales</Label>
            
            <div className="flex gap-2 flex-wrap justify-center">
              {quickCounts.map(count => (
                <Button
                  key={count}
                  variant={parseInt(guestCount) === count ? 'default' : 'outline'}
                  size="lg"
                  className="h-12 w-12"
                  onClick={() => setGuestCount(count.toString())}
                >
                  {count}
                </Button>
              ))}
            </div>

            {table.capacity > 6 && (
              <div className="flex items-center gap-3 justify-center mt-3">
                <Label htmlFor="guestCount">Otro:</Label>
                <Input
                  id="guestCount"
                  type="number"
                  min="1"
                  max={table.capacity}
                  value={guestCount}
                  onChange={(e) => setGuestCount(e.target.value)}
                  className="w-20 text-center"
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm}>
            Abrir mesa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
