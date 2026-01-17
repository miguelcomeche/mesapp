import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useReservations, useTables, useTableSessions } from '@/hooks/useRestaurantData';
import { usePermissions } from '@/hooks/usePermissions';
import { Reservation, STATUS_LABELS, ReservationSource, ReservationStatus } from '@/types/database';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Users,
  User,
  Phone,
  Mail,
  FileText,
  MapPin,
  Tag,
  CheckCircle,
  XCircle,
  UserX,
  UserCheck,
  Edit,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import SeatReservationFloorDialog from '@/components/reservations/SeatReservationFloorDialog';
import EditReservationDialog from '@/components/reservations/EditReservationDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const statusConfig: Record<ReservationStatus, { label: string; className: string; icon: React.ReactNode }> = {
  pending: { 
    label: 'Pendiente', 
    className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    icon: <Clock className="w-4 h-4" />
  },
  pending_confirmation: { 
    label: 'Pendiente confirmación', 
    className: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    icon: <AlertTriangle className="w-4 h-4" />
  },
  confirmed: { 
    label: 'Confirmada', 
    className: 'bg-green-500/20 text-green-400 border-green-500/30',
    icon: <CheckCircle className="w-4 h-4" />
  },
  seated: { 
    label: 'Sentado', 
    className: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    icon: <UserCheck className="w-4 h-4" />
  },
  completed: { 
    label: 'Completada', 
    className: 'bg-muted text-muted-foreground',
    icon: <CheckCircle className="w-4 h-4" />
  },
  cancelled: { 
    label: 'Cancelada', 
    className: 'bg-red-500/20 text-red-400 border-red-500/30',
    icon: <XCircle className="w-4 h-4" />
  },
  no_show: { 
    label: 'No show', 
    className: 'bg-red-500/20 text-red-400 border-red-500/30',
    icon: <UserX className="w-4 h-4" />
  },
};

const sourceConfig: Record<ReservationSource, { label: string; className: string }> = {
  manual: { label: 'Manual', className: 'bg-secondary text-muted-foreground' },
  phone: { label: 'Teléfono', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  walkin: { label: 'Walk-in', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
  covermanager: { label: 'CoverManager', className: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  restoo: { label: 'Restoo', className: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
};

export default function ReservationDetail() {
  const { reservationId } = useParams<{ reservationId: string }>();
  const navigate = useNavigate();
  const { user, restaurantId } = useAuth();
  const { toast } = useToast();
  const permissions = usePermissions();
  
  const { reservations, isLoading, updateReservationStatus, assignTableToReservation, updateReservation } = useReservations(restaurantId);
  const { tables } = useTables(restaurantId);
  const { sessions, createSession } = useTableSessions(restaurantId);
  
  const [showSeatDialog, setShowSeatDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showBlockedAlert, setShowBlockedAlert] = useState(false);
  const [blockedMessage, setBlockedMessage] = useState('');

  const reservation = reservations.find(r => r.id === reservationId);
  
  const canManageReservations = permissions.isOwner || permissions.isManager;

  const handleConfirm = async () => {
    if (!reservation) return;
    
    // Confirm action changes: PENDING -> CONFIRMED, PENDING_CONFIRMATION -> CONFIRMED
    if (reservation.status !== 'pending' && reservation.status !== 'pending_confirmation') {
      toast({ 
        title: 'Acción no permitida', 
        description: 'Solo se pueden confirmar reservas pendientes.',
        variant: 'destructive'
      });
      return;
    }
    
    const success = await updateReservationStatus(reservation.id, 'confirmed');
    if (success) {
      toast({ title: 'Reserva confirmada', description: `Reserva de ${reservation.guest_name} confirmada.` });
    }
  };

  const handleCancel = async () => {
    if (!reservation) return;
    const success = await updateReservationStatus(reservation.id, 'cancelled');
    if (success) {
      toast({ title: 'Reserva cancelada', description: `Reserva de ${reservation.guest_name} cancelada.` });
    }
  };

  const handleNoShow = async () => {
    if (!reservation) return;
    const success = await updateReservationStatus(reservation.id, 'no_show');
    if (success) {
      toast({ title: 'No show registrado', description: `${reservation.guest_name} marcado como no show.` });
    }
  };

  const handleSeatClick = () => {
    if (!reservation) return;
    
    // Prevent seating for CANCELLED/NO_SHOW
    if (reservation.status === 'cancelled') {
      setBlockedMessage('No se puede sentar una reserva cancelada.');
      setShowBlockedAlert(true);
      return;
    }
    
    if (reservation.status === 'no_show') {
      setBlockedMessage('No se puede sentar una reserva marcada como no show.');
      setShowBlockedAlert(true);
      return;
    }
    
    // Prevent seating for PENDING_CONFIRMATION until confirmed
    if (reservation.status === 'pending_confirmation') {
      setBlockedMessage('Esta reserva requiere confirmación del restaurante antes de poder sentar al cliente.');
      setShowBlockedAlert(true);
      return;
    }
    
    setShowSeatDialog(true);
  };

  const handleSeatReservation = async (tableId: string) => {
    if (!reservation) return;
    
    await assignTableToReservation(reservation.id, tableId);
    await updateReservationStatus(reservation.id, 'seated');
    
    const session = await createSession(
      tableId,
      reservation.party_size,
      user?.id || null,
      reservation.id
    );
    
    setShowSeatDialog(false);
    
    if (session) {
      toast({ title: 'Reserva sentada', description: `${reservation.guest_name} ha sido sentado en la mesa.` });
      navigate(`/session/${session.id}`);
    }
  };

  const handleUpdateReservation = async (reservationId: string, data: {
    guest_name: string;
    guest_phone?: string;
    guest_email?: string;
    party_size: number;
    scheduled_time: string;
    source: ReservationSource;
    notes?: string;
  }) => {
    await updateReservation(reservationId, data);
  };

  // Check if actions should be enabled
  const canConfirm = reservation && 
    (reservation.status === 'pending' || reservation.status === 'pending_confirmation') &&
    canManageReservations;
  
  const canCancel = reservation && 
    !['cancelled', 'no_show', 'completed', 'seated'].includes(reservation.status);
  
  const canNoShow = reservation && 
    ['pending', 'pending_confirmation', 'confirmed'].includes(reservation.status);
  
  const canSeat = reservation && 
    ['pending', 'confirmed'].includes(reservation.status);

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  if (!reservation) {
    return (
      <MainLayout>
        <div className="text-center py-16">
          <h2 className="text-xl font-semibold text-foreground mb-2">Reserva no encontrada</h2>
          <p className="text-muted-foreground mb-6">La reserva que buscas no existe o ha sido eliminada.</p>
          <Button onClick={() => navigate('/reservations')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a Reservas
          </Button>
        </div>
      </MainLayout>
    );
  }

  const status = statusConfig[reservation.status];
  const source = sourceConfig[reservation.source as ReservationSource] || sourceConfig.manual;
  const scheduledDate = new Date(reservation.scheduled_time);

  return (
    <MainLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/reservations')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">{reservation.guest_name}</h1>
            <p className="text-muted-foreground">
              {format(scheduledDate, "EEEE d 'de' MMMM 'a las' HH:mm", { locale: es })}
            </p>
          </div>
          <Badge className={cn('text-sm px-3 py-1 flex items-center gap-1.5', status.className)}>
            {status.icon}
            {status.label}
          </Badge>
        </div>

        {/* Main Content */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Reservation Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Detalles de la Reserva</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Fecha</p>
                  <p className="font-medium">{format(scheduledDate, "EEEE d 'de' MMMM yyyy", { locale: es })}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Hora</p>
                  <p className="font-medium">{format(scheduledDate, 'HH:mm')}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Nº personas</p>
                  <p className="font-medium">{reservation.party_size} comensales</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Tag className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Origen</p>
                  <Badge variant="outline" className={cn('mt-1', source.className)}>
                    {source.label}
                  </Badge>
                </div>
              </div>
              
              {reservation.table && (
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Mesa asignada</p>
                    <p className="font-medium">Mesa {reservation.table.number}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Contact & Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Información de Contacto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Nombre</p>
                  <p className="font-medium">{reservation.guest_name}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Teléfono</p>
                  {reservation.guest_phone ? (
                    <a href={`tel:${reservation.guest_phone}`} className="font-medium text-primary hover:underline">
                      {reservation.guest_phone}
                    </a>
                  ) : (
                    <p className="text-muted-foreground italic">No proporcionado</p>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  {reservation.guest_email ? (
                    <a href={`mailto:${reservation.guest_email}`} className="font-medium text-primary hover:underline">
                      {reservation.guest_email}
                    </a>
                  ) : (
                    <p className="text-muted-foreground italic">No proporcionado</p>
                  )}
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Notas</p>
                  {reservation.notes ? (
                    <p className="font-medium whitespace-pre-wrap">{reservation.notes}</p>
                  ) : (
                    <p className="text-muted-foreground italic">Sin notas</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Acciones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => setShowEditDialog(true)}>
                <Edit className="w-4 h-4 mr-2" />
                Editar
              </Button>
              
              {canConfirm && (
                <Button variant="outline" onClick={handleConfirm} className="text-green-500 border-green-500/30 hover:bg-green-500/10">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Confirmar
                </Button>
              )}
              
              {canCancel && (
                <Button variant="outline" onClick={handleCancel} className="text-red-500 border-red-500/30 hover:bg-red-500/10">
                  <XCircle className="w-4 h-4 mr-2" />
                  Cancelar
                </Button>
              )}
              
              {canNoShow && (
                <Button variant="outline" onClick={handleNoShow} className="text-orange-500 border-orange-500/30 hover:bg-orange-500/10">
                  <UserX className="w-4 h-4 mr-2" />
                  No show
                </Button>
              )}
              
              {(canSeat || reservation.status === 'pending_confirmation') && (
                <Button onClick={handleSeatClick}>
                  <UserCheck className="w-4 h-4 mr-2" />
                  Sentar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Seat Reservation Floor Dialog */}
      {reservation && (
        <SeatReservationFloorDialog
          open={showSeatDialog}
          onOpenChange={setShowSeatDialog}
          reservation={reservation}
          tables={tables}
          sessions={sessions.filter(s => s.status === 'active').map(s => ({
            table_id: s.table_id,
            id: s.id,
            guest_count: s.guest_count,
            started_at: s.started_at,
          }))}
          onConfirm={handleSeatReservation}
        />
      )}

      {/* Edit Reservation Dialog */}
      {reservation && (
        <EditReservationDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          reservation={reservation}
          onConfirm={handleUpdateReservation}
          canEdit={true}
        />
      )}

      {/* Blocked Action Alert */}
      <AlertDialog open={showBlockedAlert} onOpenChange={setShowBlockedAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Acción no permitida
            </AlertDialogTitle>
            <AlertDialogDescription>
              {blockedMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>Entendido</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}