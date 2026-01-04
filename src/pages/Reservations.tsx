import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useReservations, useTables, useTableSessions } from '@/hooks/useRestaurantData';
import { usePermissions } from '@/hooks/usePermissions';
import { Reservation, STATUS_LABELS, ReservationSource } from '@/types/database';
import { cn } from '@/lib/utils';
import {
  Search,
  Plus,
  Calendar,
  Users,
  Phone,
  Mail,
  CheckCircle,
  XCircle,
  UserCheck,
  Loader2,
} from 'lucide-react';
import SeatReservationDialog from '@/components/reservations/SeatReservationDialog';
import CreateReservationDialog from '@/components/reservations/CreateReservationDialog';
import { useToast } from '@/hooks/use-toast';

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pendiente', className: 'status-reserved' },
  pending_confirmation: { label: 'Pendiente confirmación', className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  confirmed: { label: 'Confirmada', className: 'status-available' },
  seated: { label: 'Sentado', className: 'status-occupied' },
  completed: { label: 'Completada', className: 'text-muted-foreground bg-muted' },
  cancelled: { label: 'Cancelada', className: 'status-attention' },
  no_show: { label: 'No show', className: 'status-attention' },
};

const statusFilterLabels: Record<string, string> = {
  all: 'Todas las Reservas',
  pending: 'Pendientes',
  pending_confirmation: 'Pendiente confirmación',
  confirmed: 'Confirmadas',
  seated: 'Sentados',
};

export default function Reservations() {
  const navigate = useNavigate();
  const { user, restaurantId } = useAuth();
  const { toast } = useToast();
  const permissions = usePermissions();
  
  const { reservations, isLoading, updateReservationStatus, assignTableToReservation, createReservation } = useReservations(restaurantId);
  const { tables } = useTables(restaurantId);
  const { createSession } = useTableSessions(restaurantId);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [showSeatDialog, setShowSeatDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Permission checks
  const canManageReservations = permissions.isOwner || permissions.isManager;

  const filteredReservations = reservations.filter((res) => {
    const matchesSearch = res.guest_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || res.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  const handleConfirmReservation = async (reservation: Reservation) => {
    const success = await updateReservationStatus(reservation.id, 'confirmed');
    if (success) {
      toast({ title: 'Reserva confirmada', description: `Reserva de ${reservation.guest_name} confirmada.` });
    }
  };

  const handleCancelReservation = async (reservation: Reservation) => {
    const success = await updateReservationStatus(reservation.id, 'cancelled');
    if (success) {
      toast({ title: 'Reserva cancelada', description: `Reserva de ${reservation.guest_name} cancelada.` });
    }
  };

  const handleSeatClick = (reservation: Reservation) => {
    setSelectedReservation(reservation);
    setShowSeatDialog(true);
  };

  const handleSeatReservation = async (tableId: string) => {
    if (!selectedReservation) return;
    
    await assignTableToReservation(selectedReservation.id, tableId);
    await updateReservationStatus(selectedReservation.id, 'seated');
    
    const session = await createSession(
      tableId,
      selectedReservation.party_size,
      user?.id || null,
      selectedReservation.id
    );
    
    setShowSeatDialog(false);
    setSelectedReservation(null);
    
    if (session) {
      toast({ title: 'Reserva sentada', description: `${selectedReservation.guest_name} ha sido sentado en la mesa.` });
      navigate(`/session/${session.id}`);
    }
  };

  const handleCreateReservation = async (data: {
    guest_name: string;
    guest_phone?: string;
    guest_email?: string;
    party_size: number;
    scheduled_time: string;
    source: ReservationSource;
    notes?: string;
  }) => {
    await createReservation(data);
  };

  // Check if reservation can be seated (waiters can only seat confirmed reservations)
  const canSeatReservation = (reservation: Reservation) => {
    if (canManageReservations) {
      return reservation.status === 'pending' || reservation.status === 'pending_confirmation' || reservation.status === 'confirmed';
    }
    // Waiters can only seat confirmed reservations
    return reservation.status === 'confirmed';
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Reservas</h1>
            <p className="text-muted-foreground mt-1">
              Hoy, {formatDate(new Date())}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar clientes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-56"
              />
            </div>
            <Button variant="outline">
              <Calendar className="w-4 h-4" />
              Cambiar Fecha
            </Button>
            {canManageReservations && (
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="w-4 h-4" />
                Nueva Reserva
              </Button>
            )}
          </div>
        </div>

        {/* Status Filters */}
        <div className="flex flex-wrap gap-2">
          {Object.keys(statusFilterLabels).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                statusFilter === status
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              )}
            >
              {statusFilterLabels[status]}
            </button>
          ))}
        </div>

        {/* Reservations List */}
        {reservations.length === 0 ? (
          <div className="text-center py-16">
            <Calendar className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No hay reservas</h3>
            <p className="text-muted-foreground mb-6">
              Aún no hay reservas para hoy
            </p>
            {canManageReservations && (
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Crear primera reserva
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredReservations.map((reservation) => {
              const status = statusConfig[reservation.status] || statusConfig.pending;
              const sourceLabel = STATUS_LABELS.reservationSource[reservation.source as ReservationSource] || reservation.source;
              
              return (
                <div
                  key={reservation.id}
                  className="glass-card p-5 animate-fade-in hover:border-primary/30 transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      {/* Time */}
                      <div className="text-center min-w-[80px]">
                        <div className="text-2xl font-bold text-foreground">
                          {formatTime(reservation.scheduled_time)}
                        </div>
                      </div>

                      {/* Guest Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <h3 className="text-lg font-semibold text-foreground">
                            {reservation.guest_name}
                          </h3>
                          <span className={cn('status-badge', status.className)}>
                            {status.label}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground bg-secondary px-2 py-1 rounded">
                            {sourceLabel}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <Users className="w-4 h-4" />
                            {reservation.party_size} comensales
                          </span>
                          {reservation.guest_phone && (
                            <span className="flex items-center gap-1.5">
                              <Phone className="w-4 h-4" />
                              {reservation.guest_phone}
                            </span>
                          )}
                          {reservation.guest_email && (
                            <span className="flex items-center gap-1.5">
                              <Mail className="w-4 h-4" />
                              {reservation.guest_email}
                            </span>
                          )}
                          {reservation.table && (
                            <span className="text-primary font-medium">
                              Mesa {reservation.table.number}
                            </span>
                          )}
                        </div>

                        {reservation.notes && (
                          <p className="mt-2 text-sm text-muted-foreground italic">
                            "{reservation.notes}"
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {canSeatReservation(reservation) && (
                        <Button 
                          size="sm" 
                          variant="success"
                          onClick={() => handleSeatClick(reservation)}
                        >
                          <UserCheck className="w-4 h-4" />
                          Sentar
                        </Button>
                      )}
                      {canManageReservations && (reservation.status === 'pending' || reservation.status === 'pending_confirmation') && (
                        <>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleConfirmReservation(reservation)}
                          >
                            <CheckCircle className="w-4 h-4" />
                            Confirmar
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="text-destructive"
                            onClick={() => handleCancelReservation(reservation)}
                          >
                            <XCircle className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {filteredReservations.length === 0 && reservations.length > 0 && (
          <div className="text-center py-16">
            <Calendar className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No se encontraron reservas</h3>
            <p className="text-muted-foreground">
              Prueba con otro término de búsqueda o filtro
            </p>
          </div>
        )}
      </div>

      {/* Seat Reservation Dialog */}
      <SeatReservationDialog
        open={showSeatDialog}
        onOpenChange={setShowSeatDialog}
        reservation={selectedReservation}
        tables={tables}
        onConfirm={handleSeatReservation}
      />

      {/* Create Reservation Dialog */}
      <CreateReservationDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onConfirm={handleCreateReservation}
      />
    </MainLayout>
  );
}
