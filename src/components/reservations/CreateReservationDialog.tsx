import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ReservationSource, STATUS_LABELS } from '@/types/database';
import { AlertCircle, Info } from 'lucide-react';
import { z } from 'zod';

const reservationSchema = z.object({
  guest_name: z.string().trim().min(1, 'El nombre es obligatorio').max(100, 'Máximo 100 caracteres'),
  guest_phone: z.string().trim().max(20, 'Máximo 20 caracteres').optional(),
  guest_email: z.string().trim().email('Email inválido').max(255, 'Máximo 255 caracteres').optional().or(z.literal('')),
  party_size: z.number().min(1, 'Mínimo 1 comensal').max(50, 'Máximo 50 comensales'),
  scheduled_time: z.string().min(1, 'La fecha y hora son obligatorias'),
  source: z.enum(['manual', 'phone', 'walkin', 'covermanager', 'restoo']),
  notes: z.string().trim().max(500, 'Máximo 500 caracteres').optional(),
}).refine(data => {
  const hasPhone = data.guest_phone && data.guest_phone.trim().length > 0;
  const hasEmail = data.guest_email && data.guest_email.trim().length > 0;
  return hasPhone || hasEmail;
}, {
  message: 'Debe indicar teléfono o email de contacto',
  path: ['guest_phone'],
});

interface CreateReservationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: {
    guest_name: string;
    guest_phone?: string;
    guest_email?: string;
    party_size: number;
    scheduled_time: string;
    source: ReservationSource;
    notes?: string;
  }) => Promise<void>;
}

export default function CreateReservationDialog({
  open,
  onOpenChange,
  onConfirm,
}: CreateReservationDialogProps) {
  const [formData, setFormData] = useState({
    guest_name: '',
    guest_phone: '',
    guest_email: '',
    party_size: 2,
    scheduled_time: '',
    source: 'manual' as ReservationSource,
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClose = () => {
    setFormData({
      guest_name: '',
      guest_phone: '',
      guest_email: '',
      party_size: 2,
      scheduled_time: '',
      source: 'manual',
      notes: '',
    });
    setErrors({});
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    const result = reservationSchema.safeParse(formData);
    
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach(err => {
        if (err.path[0]) {
          fieldErrors[err.path[0].toString()] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);
    
    try {
      await onConfirm({
        guest_name: formData.guest_name.trim(),
        guest_phone: formData.guest_phone.trim() || undefined,
        guest_email: formData.guest_email.trim() || undefined,
        party_size: formData.party_size,
        scheduled_time: formData.scheduled_time,
        source: formData.source,
        notes: formData.notes.trim() || undefined,
      });
      handleClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const showLargePartyWarning = formData.party_size > 8;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Nueva Reserva</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Guest Name */}
          <div className="space-y-2">
            <Label htmlFor="guest_name">Nombre del cliente *</Label>
            <Input
              id="guest_name"
              value={formData.guest_name}
              onChange={(e) => setFormData({ ...formData, guest_name: e.target.value })}
              placeholder="Nombre completo"
              maxLength={100}
            />
            {errors.guest_name && (
              <p className="text-sm text-destructive">{errors.guest_name}</p>
            )}
          </div>

          {/* Contact Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="guest_phone">Teléfono</Label>
              <Input
                id="guest_phone"
                type="tel"
                value={formData.guest_phone}
                onChange={(e) => setFormData({ ...formData, guest_phone: e.target.value })}
                placeholder="+34 600 000 000"
                maxLength={20}
              />
              {errors.guest_phone && (
                <p className="text-sm text-destructive">{errors.guest_phone}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="guest_email">Email</Label>
              <Input
                id="guest_email"
                type="email"
                value={formData.guest_email}
                onChange={(e) => setFormData({ ...formData, guest_email: e.target.value })}
                placeholder="cliente@email.com"
                maxLength={255}
              />
              {errors.guest_email && (
                <p className="text-sm text-destructive">{errors.guest_email}</p>
              )}
            </div>
          </div>

          {/* Party Size & DateTime */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="party_size">Comensales *</Label>
              <Input
                id="party_size"
                type="number"
                min={1}
                max={50}
                value={formData.party_size}
                onChange={(e) => setFormData({ ...formData, party_size: parseInt(e.target.value) || 1 })}
              />
              {errors.party_size && (
                <p className="text-sm text-destructive">{errors.party_size}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="scheduled_time">Fecha y hora *</Label>
              <Input
                id="scheduled_time"
                type="datetime-local"
                value={formData.scheduled_time}
                onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
              />
              {errors.scheduled_time && (
                <p className="text-sm text-destructive">{errors.scheduled_time}</p>
              )}
            </div>
          </div>

          {/* Large Party Warning */}
          {showLargePartyWarning && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Reserva &gt;8: pendiente de confirmación por el restaurante.
              </AlertDescription>
            </Alert>
          )}

          {/* Source */}
          <div className="space-y-2">
            <Label htmlFor="source">Origen</Label>
            <Select
              value={formData.source}
              onValueChange={(value) => setFormData({ ...formData, source: value as ReservationSource })}
            >
              <SelectTrigger id="source">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(STATUS_LABELS.reservationSource) as ReservationSource[]).map((src) => (
                  <SelectItem key={src} value={src}>
                    {STATUS_LABELS.reservationSource[src]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Alergias, preferencias, ocasión especial..."
              maxLength={500}
              rows={2}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : 'Crear Reserva'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
