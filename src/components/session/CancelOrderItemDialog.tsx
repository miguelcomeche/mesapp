import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';

const PRESETS = [
  'Error de comanda',
  'Producto agotado',
  'Cliente cambia de opinión',
  'Invitación / cortesía',
  'Error de cocina',
  'Otro',
];

export type CancelMode = 'cancel' | 'delete';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: CancelMode;
  productName?: string;
  requireReason?: boolean;
  onConfirm: (reason: string) => Promise<void> | void;
}

export function CancelOrderItemDialog({
  open,
  onOpenChange,
  mode,
  productName,
  requireReason = true,
  onConfirm,
}: Props) {
  const [preset, setPreset] = useState<string>(PRESETS[0]);
  const [otherText, setOtherText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setPreset(PRESETS[0]);
      setOtherText('');
      setSubmitting(false);
    }
  }, [open]);

  const reason = preset === 'Otro' ? otherText.trim() : preset;
  const invalid =
    (preset === 'Otro' && otherText.trim().length === 0) ||
    (requireReason && reason.length === 0);

  const title = mode === 'cancel' ? 'Anular producto' : 'Borrar producto';
  const cta = mode === 'cancel' ? 'Anular' : 'Borrar';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {productName && (
            <DialogDescription>
              {mode === 'cancel'
                ? `Se anulará "${productName}" y quedará registrado en auditoría.`
                : `Se borrará "${productName}" antes de enviarse. La acción queda auditada.`}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Motivo</Label>
            <RadioGroup value={preset} onValueChange={setPreset} className="gap-2">
              {PRESETS.map((p) => (
                <div key={p} className="flex items-center space-x-2">
                  <RadioGroupItem id={`reason-${p}`} value={p} />
                  <Label htmlFor={`reason-${p}`} className="font-normal cursor-pointer">{p}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {preset === 'Otro' && (
            <div className="space-y-2">
              <Label htmlFor="other-reason">Especifica el motivo</Label>
              <Textarea
                id="other-reason"
                value={otherText}
                onChange={(e) => setOtherText(e.target.value)}
                placeholder="Describe brevemente el motivo"
                maxLength={300}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            variant={mode === 'cancel' ? 'destructive' : 'default'}
            disabled={invalid || submitting}
            onClick={async () => {
              setSubmitting(true);
              try {
                await onConfirm(reason);
              } finally {
                setSubmitting(false);
              }
            }}
          >
            {submitting ? 'Procesando…' : cta}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}