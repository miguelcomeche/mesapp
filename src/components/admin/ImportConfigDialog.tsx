import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  targetRestaurantId: string;
  targetRestaurantName: string;
  candidates: { id: string; name: string }[];
}

export function ImportConfigDialog({ open, onOpenChange, targetRestaurantId, targetRestaurantName, candidates }: Props) {
  const [source, setSource] = useState<string>('');
  const [include, setInclude] = useState({
    categories: true,
    products: true,
    modifiers: true,
    tables: false,
    settings: false,
  });
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setSource('');
      setConfirming(false);
      setInclude({ categories: true, products: true, modifiers: true, tables: false, settings: false });
    }
  }, [open]);

  const run = async () => {
    if (!source) return;
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke('restaurant-import-config', {
      body: { source_restaurant_id: source, target_restaurant_id: targetRestaurantId, include },
    });
    setSubmitting(false);
    if (error || (data as any)?.error) {
      toast({ title: 'Error', description: (error?.message ?? (data as any)?.error) || 'No se pudo importar', variant: 'destructive' });
      return;
    }
    toast({ title: 'Configuración importada' });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importar configuración</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Destino: <strong>{targetRestaurantName}</strong></p>
          <div className="space-y-2">
            <Label>Restaurante de origen</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger><SelectValue placeholder="Selecciona un restaurante" /></SelectTrigger>
              <SelectContent>
                {candidates.filter(c => c.id !== targetRestaurantId).map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Datos a copiar</Label>
            <div className="border border-border rounded-md divide-y divide-border">
              {([
                ['categories', 'Categorías'],
                ['products', 'Productos'],
                ['modifiers', 'Modificadores'],
                ['tables', 'Mesas'],
                ['settings', 'Configuración (módulos, auto-marchar)'],
              ] as [keyof typeof include, string][]).map(([k, label]) => (
                <label key={k} className="flex items-center justify-between px-3 py-2 cursor-pointer">
                  <span className="text-sm">{label}</span>
                  <Checkbox
                    checked={include[k]}
                    onCheckedChange={(v) => setInclude(prev => ({ ...prev, [k]: !!v }))}
                  />
                </label>
              ))}
            </div>
          </div>
          {confirming && (
            <p className="text-sm text-destructive">
              Esta acción copiará los datos seleccionados al restaurante destino. ¿Continuar?
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancelar</Button>
          {!confirming ? (
            <Button onClick={() => setConfirming(true)} disabled={!source}>Continuar</Button>
          ) : (
            <Button onClick={run} disabled={submitting}>{submitting ? 'Importando…' : 'Confirmar importación'}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}