import { useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  zone: string;
  onConfirm: (input: { number: string; capacity: number }) => Promise<void> | void;
}

export function AddTableDialog({ open, onOpenChange, zone, onConfirm }: Props) {
  const [number, setNumber] = useState('');
  const [capacity, setCapacity] = useState(4);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!number.trim()) return;
    setSaving(true);
    await onConfirm({ number: number.trim(), capacity });
    setSaving(false);
    setNumber('');
    setCapacity(4);
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
          <div className="space-y-2">
            <Label>Capacidad</Label>
            <Input type="number" min={1} max={20} value={capacity} onChange={(e) => setCapacity(parseInt(e.target.value || '1', 10))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!number.trim() || saving}>Crear mesa</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}