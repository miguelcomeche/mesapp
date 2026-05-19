import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface WaiterRow {
  id: string;
  name: string;
  pin: string;
  active: boolean;
}

interface Props {
  open: boolean;
  restaurantId: string | null;
  onCancel: () => void;
  onSelected: (waiterId: string) => void;
}

export default function WaiterSelectDialog({ open, restaurantId, onCancel, onSelected }: Props) {
  const [waiters, setWaiters] = useState<WaiterRow[]>([]);
  const [selected, setSelected] = useState<WaiterRow | null>(null);
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !restaurantId) return;
    setSelected(null);
    setPin('');
    setLoading(true);
    supabase
      .from('waiters' as any)
      .select('id, name, pin, active')
      .eq('restaurant_id', restaurantId)
      .eq('active', true)
      .order('name')
      .then(({ data, error }) => {
        setLoading(false);
        if (error) {
          toast({ title: 'Error', description: error.message, variant: 'destructive' });
          return;
        }
        setWaiters((data as any) ?? []);
      });
  }, [open, restaurantId]);

  const handleConfirm = () => {
    if (!selected) return;
    if (pin !== selected.pin) {
      toast({ title: 'PIN incorrecto', variant: 'destructive' });
      setPin('');
      return;
    }
    onSelected(selected.id);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{selected ? 'Introduce PIN' : 'Selecciona camarero'}</DialogTitle>
          <DialogDescription>
            {selected
              ? `Introduce el PIN de ${selected.name} para continuar.`
              : 'Elige el camarero que va a realizar la operación.'}
          </DialogDescription>
        </DialogHeader>

        {!selected ? (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {loading ? (
              <p className="text-sm text-muted-foreground text-center py-6">Cargando…</p>
            ) : waiters.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No hay camareros activos. Crea uno desde Ajustes → Usuarios.
              </p>
            ) : (
              waiters.map((w) => (
                <Button
                  key={w.id}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => { setSelected(w); setPin(''); }}
                >
                  {w.name}
                </Button>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <Label>PIN</Label>
            <Input
              type="password"
              inputMode="numeric"
              autoFocus
              maxLength={8}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); }}
              placeholder="••••"
            />
          </div>
        )}

        <DialogFooter>
          {selected && (
            <Button variant="ghost" onClick={() => { setSelected(null); setPin(''); }}>
              Volver
            </Button>
          )}
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          {selected && (
            <Button onClick={handleConfirm} disabled={pin.length < 4}>Confirmar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}