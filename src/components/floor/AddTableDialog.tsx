import { useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  zone: string;
  onConfirm: (input: { number: string; capacity: number; min_capacity: number; max_capacity: number }) => Promise<void> | void;
}

export function AddTableDialog({ open, onOpenChange, zone, onConfirm }: Props) {
  const [number, setNumber] = useState('');
  const [minCapacity, setMinCapacity] = useState(1);
  const [capacity, setCapacity] = useState(4);
  const [maxCapacity, setMaxCapacity] = useState(4);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!number.trim()) return;
    const min = Math.max(1, minCapacity);
    const def = Math.max(min, capacity);
    const max = Math.min(50, Math.max(def, maxCapacity));
    setSaving(true);
    await onConfirm({ number: number.trim(), capacity: def, min_capacity: min, max_capacity: max });
    setSaving(false);
    setNumber('');
    setMinCapacity(1);
    setCapacity(4);
    setMaxCapacity(4);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Añadir mesa a {zone}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Número</Label>
            <Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="Ej. 5" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Mínima</Label>
              <Input type="number" min={1} max={50} value={minCapacity}
                onChange={(e) => setMinCapacity(parseInt(e.target.value || '1', 10))} />
            </div>
            <div className="space-y-2">
              <Label>Por defecto</Label>
              <Input type="number" min={1} max={50} value={capacity}
                onChange={(e) => setCapacity(parseInt(e.target.value || '1', 10))} />
            </div>
            <div className="space-y-2">
              <Label>Máxima</Label>
              <Input type="number" min={1} max={50} value={maxCapacity}
                onChange={(e) => setMaxCapacity(parseInt(e.target.value || '1', 10))} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Aforo máximo permitido por mesa: 50 personas.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!number.trim() || saving}>Crear mesa</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}