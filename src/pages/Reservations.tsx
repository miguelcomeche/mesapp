import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useReservations, useTables, useTableSessions } from '@/hooks/useRestaurantData';
import { usePermissions } from '@/hooks/usePermissions';
import { Reservation, STATUS_LABELS, ReservationSource, ReservationStatus } from '@/types/database';
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
  Eye,
  UserX,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, isToday, isTomorrow, addDays, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import SeatReservationFloorDialog from '@/components/reservations/SeatReservationFloorDialog';
import CreateReservationDialog from '@/components/reservations/CreateReservationDialog';
import EditReservationDialog from '@/components/reservations/EditReservationDialog';
import { useToast } from '@/hooks/use-toast';
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

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pendiente', className: 'status-reserved' },
  pending_confirmation: { label: 'Pendiente confirmación', className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  confirmed: { label: 'Confirmada', className: 'status-available' },
  seated: { label: 'Sentado', className: 'status-occupied' },
  completed: { label: 'Completada', className: 'text-muted-foreground bg-muted' },
  cancelled: { label: 'Cancelada', className: 'status-attention' },
  no_show: { label: 'No show', className: 'status-attention' },
};

const sourceConfig: Record<ReservationSource, { label: string; className: string }> = {
  manual: { label: 'Manual', className: 'bg-secondary text-muted-foreground' },
  phone: { label: 'Teléfono', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  walkin: { label: 'Walk-in', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
  covermanager: { label: 'CoverManager', className: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  restoo: { label: 'Restoo', className: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
};

const statusFilterOptions: { value: string; label: string }[] = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'pending_confirmation', label: 'Pendiente confirmación' },
  { value: 'confirmed', label: 'Confirmadas' },
  { value: 'seated', label: 'Sentados' },
  { value: 'completed', label: 'Completadas' },
  { value: 'cancelled', label: 'Canceladas' },
  { value: 'no_show', label: 'No show' },
];

const sourceFilterOptions: { value: string; label: string }[] = [
  { value: 'all', label: 'Todos los orígenes' },
  { value: 'manual', label: 'Manual' },
  { value: 'phone', label: 'Teléfono' },
  { value: 'walkin', label: 'Walk-in' },
  { value: 'covermanager', label: 'CoverManager' },
  { value: 'restoo', label: 'Restoo' },
];

export default function Reservations() {
  const navigate = useNavigate();
  const { user, restaurantId } = useAuth();
  const { toast } = useToast();
  const permissions = usePermissions();
  
  const { reservations, isLoading, updateReservationStatus, assignTableToReservation, createReservation, updateReservation } = useReservations(restaurantId);
  const { tables } = useTables(restaurantId);
  const { sessions, createSession } = useTableSessions(restaurantId);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [showSeatDialog, setShowSeatDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showPendingConfirmationAlert, setShowPendingConfirmationAlert] = useState(false);

  // Permission checks
  const canManageReservations = permissions.isOwner || permissions.isManager;

  // Filter reservations by date first
  const reservationsForDate = useMemo(() => {
    const dayStart = startOfDay(selectedDate);
    const dayEnd = endOfDay(selectedDate);
    
    return reservations.filter(res => {
      const resDate = new Date(res.scheduled_time);
      return resDate >= dayStart && resDate <= dayEnd;
    });
  }, [reservations, selectedDate]);

  // Then apply other filters
  const filteredReservations = useMemo(() => {
    return reservationsForDate.filter((res) => {
      // Search filter (name, phone, email)
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = 
        !searchQuery ||
        res.guest_name.toLowerCase().includes(searchLower) ||
        (res.guest_phone && res.guest_phone.toLowerCase().includes(searchLower)) ||
        (res.guest_email && res.guest_email.toLowerCase().includes(searchLower));
      
      // Status filter
      const matchesStatus = statusFilter === 'all' || res.status === statusFilter;
      
      // Source filter
      const matchesSource = sourceFilter === 'all' || res.source === sourceFilter;
      
      return matchesSearch && matchesStatus && matchesSource;
    });
  }, [reservationsForDate, searchQuery, statusFilter, sourceFilter]);

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const formatDateHeader = (date: Date) => {
    if (isToday(date)) return 'Hoy';
    if (isTomorrow(date)) return 'Mañana';
    return format(date, "EEEE d 'de' MMMM", { locale: es });
  };

  const goToPreviousDay = () => setSelectedDate(prev => addDays(prev, -1));
  const goToNextDay = () => setSelectedDate(prev => addDays(prev, 1));
  const goToToday = () => setSelectedDate(new Date());

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

  const handleNoShow = async (reservation: Reservation) => {
    const success = await updateReservationStatus(reservation.id, 'no_show');
    if (success) {
      toast({ title: 'No show registrado', description: `${reservation.guest_name} marcado como no show.` });
    }
  };

  const handleSeatClick = (reservation: Reservation) => {
    // If pending_confirmation, show alert instead
    if (reservation.status === 'pending_confirmation') {
      setSelectedReservation(reservation);
      setShowPendingConfirmationAlert(true);
      return;
    }
    setSelectedReservation(reservation);
    setShowSeatDialog(true);
  };

  const handleEditClick = (reservation: Reservation) => {
    setSelectedReservation(reservation);
    setShowEditDialog(true);
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

  // Check if reservation can be seated
  const canSeatReservation = (reservation: Reservation) => {
    // Managers can seat pending or confirmed
    if (canManageReservations) {
      return reservation.status === 'pending' || reservation.status === 'pending_confirmation' || reservation.status === 'confirmed';
    }
    // Waiters can only seat confirmed reservations
    return reservation.status === 'confirmed';
  };

  // Check if reservation can be marked as no-show
  const canMarkNoShow = (reservation: Reservation) => {
    return reservation.status === 'pending' || reservation.status === 'pending_confirmation' || reservation.status === 'confirmed';
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
            <p className="text-muted-foreground mt-1 capitalize">
              {formatDateHeader(selectedDate)}, {format(selectedDate, "d 'de' MMMM", { locale: es })}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar nombre, teléfono, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
            
            {canManageReservations && (
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="w-4 h-4" />
                Nueva Reserva
              </Button>
            )}
          </div>
        </div>

        {/* Date Navigation */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={goToPreviousDay}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <Button
              variant={isToday(selectedDate) ? "default" : "ghost"}
              size="sm"
              onClick={goToToday}
            >
              Hoy
            </Button>
            
            <Button
              variant={isTomorrow(selectedDate) ? "default" : "ghost"}
              size="sm"
              onClick={() => setSelectedDate(addDays(new Date(), 1))}
            >
              Mañana
            </Button>
            
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Calendar className="h-4 w-4 mr-1" />
                  Calendario
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    if (date) {
                      setSelectedDate(date);
                      setCalendarOpen(false);
                    }
                  }}
                  locale={es}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={goToNextDay}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Filters */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              {statusFilterOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Origen" />
            </SelectTrigger>
            <SelectContent>
              {sourceFilterOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Summary */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>{filteredReservations.length} reserva{filteredReservations.length !== 1 ? 's' : ''}</span>
          <span>•</span>
          <span>{filteredReservations.reduce((sum, r) => sum + r.party_size, 0)} comensales</span>
        </div>

        {/* Reservations List */}
        {reservationsForDate.length === 0 ? (
          <div className="text-center py-16">
            <Calendar className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No hay reservas</h3>
            <p className="text-muted-foreground mb-6">
              No hay reservas para {formatDateHeader(selectedDate).toLowerCase()}
            </p>
            {canManageReservations && (
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Crear reserva
              </Button>
            )}
          </div>
        ) : filteredReservations.length === 0 ? (
          <div className="text-center py-16">
            <Search className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No se encontraron reservas</h3>
            <p className="text-muted-foreground">
              Prueba con otro término de búsqueda o filtro
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredReservations.map((reservation) => {
              const status = statusConfig[reservation.status] || statusConfig.pending;
              const source = sourceConfig[reservation.source as ReservationSource] || sourceConfig.manual;
              
              return (
                <div
                  key={reservation.id}
                  className="glass-card p-5 animate-fade-in hover:border-primary/30 transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      {/* Time */}
                      <div className="text-center min-w-[80px] flex-shrink-0">
                        <div className="text-2xl font-bold text-foreground">
                          {formatTime(reservation.scheduled_time)}
                        </div>
                      </div>

                      {/* Guest Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <h3 className="text-lg font-semibold text-foreground truncate">
                            {reservation.guest_name}
                          </h3>
                          <span className={cn('status-badge', status.className)}>
                            {status.label}
                          </span>
                          <span className={cn('text-xs px-2 py-0.5 rounded border', source.className)}>
                            {source.label}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <Users className="w-4 h-4" />
                            {reservation.party_size} comensal{reservation.party_size !== 1 ? 'es' : ''}
                          </span>
                          
                          {/* Contact indicators */}
                          {reservation.guest_phone && (
                            <span className="flex items-center gap-1.5" title={reservation.guest_phone}>
                              <Phone className="w-4 h-4 text-primary" />
                              <span className="hidden sm:inline">{reservation.guest_phone}</span>
                            </span>
                          )}
                          {reservation.guest_email && (
                            <span className="flex items-center gap-1.5" title={reservation.guest_email}>
                              <Mail className="w-4 h-4 text-primary" />
                              <span className="hidden sm:inline truncate max-w-[150px]">{reservation.guest_email}</span>
                            </span>
                          )}
                          
                          {/* Assigned table */}
                          {reservation.table && (
                            <span className="text-primary font-medium">
                              Mesa {reservation.table.number}
                            </span>
                          )}
                        </div>

                        {reservation.notes && (
                          <p className="mt-2 text-sm text-muted-foreground italic truncate">
                            "{reservation.notes}"
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                      {/* Ver / Editar */}
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => navigate(`/reservations/${reservation.id}`)}
                      >
                        <Eye className="w-4 h-4" />
                        <span className="hidden sm:inline ml-1">Ver / Editar</span>
                      </Button>

                      {/* Sentar */}
                      {canSeatReservation(reservation) && (
                        <Button 
                          size="sm" 
                          variant="success"
                          onClick={() => handleSeatClick(reservation)}
                        >
                          <UserCheck className="w-4 h-4" />
                          <span className="hidden sm:inline ml-1">Sentar</span>
                        </Button>
                      )}
                      
                      {/* Confirmar - only for managers and pending statuses */}
                      {canManageReservations && (reservation.status === 'pending' || reservation.status === 'pending_confirmation') && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleConfirmReservation(reservation)}
                        >
                          <CheckCircle className="w-4 h-4" />
                          <span className="hidden sm:inline ml-1">Confirmar</span>
                        </Button>
                      )}
                      
                      {/* No show */}
                      {canMarkNoShow(reservation) && (
                        <Button 
                          size="sm" 
                          variant="ghost"
                          className="text-amber-500 hover:text-amber-400"
                          onClick={() => handleNoShow(reservation)}
                        >
                          <UserX className="w-4 h-4" />
                          <span className="hidden sm:inline ml-1">No show</span>
                        </Button>
                      )}
                      
                      {/* Cancelar */}
                      {canManageReservations && (reservation.status === 'pending' || reservation.status === 'pending_confirmation' || reservation.status === 'confirmed') && (
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleCancelReservation(reservation)}
                        >
                          <XCircle className="w-4 h-4" />
                          <span className="hidden sm:inline ml-1">Cancelar</span>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Seat Reservation Floor Dialog */}
      <SeatReservationFloorDialog
        open={showSeatDialog}
        onOpenChange={setShowSeatDialog}
        reservation={selectedReservation}
        tables={tables}
        sessions={sessions.filter(s => s.status === 'active').map(s => ({
          table_id: s.table_id,
          id: s.id,
          guest_count: s.guest_count,
          started_at: s.started_at,
        }))}
        onConfirm={handleSeatReservation}
      />

      {/* Create Reservation Dialog */}
      <CreateReservationDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onConfirm={handleCreateReservation}
      />

      {/* Edit Reservation Dialog */}
      <EditReservationDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        reservation={selectedReservation}
        onConfirm={handleUpdateReservation}
        canEdit={canManageReservations}
      />

      {/* Pending Confirmation Alert */}
      <AlertDialog open={showPendingConfirmationAlert} onOpenChange={setShowPendingConfirmationAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Reserva pendiente de confirmación
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta reserva requiere confirmación del restaurante antes de poder sentar al cliente.
              {selectedReservation && selectedReservation.party_size > 8 && (
                <span className="block mt-2 font-medium">
                  Es una reserva de más de 8 personas ({selectedReservation.party_size} comensales).
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cerrar</AlertDialogCancel>
            {canManageReservations && (
              <AlertDialogAction
                onClick={() => {
                  if (selectedReservation) {
                    handleConfirmReservation(selectedReservation).then(() => {
                      setShowPendingConfirmationAlert(false);
                      setShowSeatDialog(true);
                    });
                  }
                }}
              >
                Confirmar y sentar
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
