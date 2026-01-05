import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Reservation, ReservationSource, STATUS_LABELS } from '@/types/database';
import { Info } from 'lucide-react';
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

interface EditReservationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservation: Reservation | null;
  onConfirm: (reservationId: string, data: {
    guest_name: string;
    guest_phone?: string;
    guest_email?: string;
    party_size: number;
    scheduled_time: string;
    source: ReservationSource;
    notes?: string;
  }) => Promise<void>;
  canEdit: boolean;
}

export default function EditReservationDialog({
  open,
  onOpenChange,
  reservation,
  onConfirm,
  canEdit,
}: EditReservationDialogProps) {
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

  // Load reservation data when dialog opens
  useEffect(() => {
    if (reservation && open) {
      // Convert scheduled_time to local datetime format for input
      const scheduledDate = new Date(reservation.scheduled_time);
      const localDateTime = new Date(scheduledDate.getTime() - scheduledDate.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);

      setFormData({
        guest_name: reservation.guest_name,
        guest_phone: reservation.guest_phone || '',
        guest_email: reservation.guest_email || '',
        party_size: reservation.party_size,
        scheduled_time: localDateTime,
        source: reservation.source,
        notes: reservation.notes || '',
      });
      setErrors({});
    }
  }, [reservation, open]);

  const handleClose = () => {
    setErrors({});
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (!reservation || !canEdit) return;
    
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
      await onConfirm(reservation.id, {
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

  if (!reservation) return null;

  const showLargePartyWarning = formData.party_size > 8;
  const isReadOnly = !canEdit;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{canEdit ? 'Editar Reserva' : 'Ver Reserva'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Guest Name */}
          <div className="space-y-2">
            <Label htmlFor="edit_guest_name">Nombre del cliente *</Label>
            <Input
              id="edit_guest_name"
              value={formData.guest_name}
              onChange={(e) => setFormData({ ...formData, guest_name: e.target.value })}
              placeholder="Nombre completo"
              maxLength={100}
              disabled={isReadOnly}
            />
            {errors.guest_name && (
              <p className="text-sm text-destructive">{errors.guest_name}</p>
            )}
          </div>

          {/* Contact Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit_guest_phone">Teléfono</Label>
              <Input
                id="edit_guest_phone"
                type="tel"
                value={formData.guest_phone}
                onChange={(e) => setFormData({ ...formData, guest_phone: e.target.value })}
                placeholder="+34 600 000 000"
                maxLength={20}
                disabled={isReadOnly}
              />
              {errors.guest_phone && (
                <p className="text-sm text-destructive">{errors.guest_phone}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_guest_email">Email</Label>
              <Input
                id="edit_guest_email"
                type="email"
                value={formData.guest_email}
                onChange={(e) => setFormData({ ...formData, guest_email: e.target.value })}
                placeholder="cliente@email.com"
                maxLength={255}
                disabled={isReadOnly}
              />
              {errors.guest_email && (
                <p className="text-sm text-destructive">{errors.guest_email}</p>
              )}
            </div>
          </div>

          {/* Party Size & DateTime */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit_party_size">Comensales *</Label>
              <Input
                id="edit_party_size"
                type="number"
                min={1}
                max={50}
                value={formData.party_size}
                onChange={(e) => setFormData({ ...formData, party_size: parseInt(e.target.value) || 1 })}
                disabled={isReadOnly}
              />
              {errors.party_size && (
                <p className="text-sm text-destructive">{errors.party_size}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_scheduled_time">Fecha y hora *</Label>
              <Input
                id="edit_scheduled_time"
                type="datetime-local"
                value={formData.scheduled_time}
                onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
                disabled={isReadOnly}
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
            <Label htmlFor="edit_source">Origen</Label>
            <Select
              value={formData.source}
              onValueChange={(value) => setFormData({ ...formData, source: value as ReservationSource })}
              disabled={isReadOnly}
            >
              <SelectTrigger id="edit_source">
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
            <Label htmlFor="edit_notes">Notas</Label>
            <Textarea
              id="edit_notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Alergias, preferencias, ocasión especial..."
              maxLength={500}
              rows={2}
              disabled={isReadOnly}
            />
          </div>

          {/* Status info (read-only) */}
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-sm text-muted-foreground">
              Estado: <span className="font-medium text-foreground">{STATUS_LABELS.reservation[reservation.status]}</span>
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Creada: {new Date(reservation.created_at).toLocaleString('es-ES')}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            {canEdit ? 'Cancelar' : 'Cerrar'}
          </Button>
          {canEdit && (
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
