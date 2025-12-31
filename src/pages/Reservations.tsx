import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Reservation } from '@/types';
import { cn } from '@/lib/utils';
import {
  Search,
  Plus,
  Calendar,
  Clock,
  Users,
  Phone,
  MoreVertical,
  CheckCircle,
  XCircle,
  UserCheck,
  ExternalLink,
} from 'lucide-react';

// Mock reservations
const mockReservations: Reservation[] = [
  {
    id: '1',
    guestName: 'Juan García',
    guestPhone: '+34 612 345 678',
    partySize: 4,
    scheduledTime: new Date(new Date().setHours(18, 30)),
    status: 'confirmed',
    notes: 'Cena de aniversario',
    externalSource: 'CoverManager',
    restaurantId: 'rest-1',
    createdAt: new Date(),
  },
  {
    id: '2',
    guestName: 'Sara López',
    guestPhone: '+34 623 456 789',
    partySize: 2,
    scheduledTime: new Date(new Date().setHours(19, 0)),
    tableId: '3',
    status: 'confirmed',
    externalSource: 'Restoo',
    restaurantId: 'rest-1',
    createdAt: new Date(),
  },
  {
    id: '3',
    guestName: 'Miguel Fernández',
    guestPhone: '+34 634 567 890',
    partySize: 6,
    scheduledTime: new Date(new Date().setHours(19, 30)),
    status: 'pending',
    notes: 'Celebración de cumpleaños',
    restaurantId: 'rest-1',
    createdAt: new Date(),
  },
  {
    id: '4',
    guestName: 'Elena Martínez',
    guestPhone: '+34 645 678 901',
    partySize: 8,
    scheduledTime: new Date(new Date().setHours(20, 0)),
    tableId: '12',
    status: 'confirmed',
    notes: 'Cena de negocios - VIP',
    externalSource: 'CoverManager',
    restaurantId: 'rest-1',
    createdAt: new Date(),
  },
  {
    id: '5',
    guestName: 'Roberto Sánchez',
    partySize: 3,
    scheduledTime: new Date(new Date().setHours(20, 30)),
    status: 'confirmed',
    restaurantId: 'rest-1',
    createdAt: new Date(),
  },
];

const statusConfig = {
  pending: { label: 'Pendiente', className: 'status-reserved' },
  confirmed: { label: 'Confirmada', className: 'status-available' },
  seated: { label: 'Sentado', className: 'status-occupied' },
  completed: { label: 'Completada', className: 'text-muted-foreground bg-muted' },
  cancelled: { label: 'Cancelada', className: 'status-attention' },
  no_show: { label: 'No show', className: 'status-attention' },
};

const statusFilterLabels: Record<string, string> = {
  all: 'Todas las Reservas',
  pending: 'Pendientes',
  confirmed: 'Confirmadas',
  seated: 'Sentados',
};

export default function Reservations() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredReservations = mockReservations.filter((res) => {
    const matchesSearch = res.guestName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || res.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  };

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
            <Button>
              <Plus className="w-4 h-4" />
              Nueva Reserva
            </Button>
          </div>
        </div>

        {/* Status Filters */}
        <div className="flex flex-wrap gap-2">
          {['all', 'pending', 'confirmed', 'seated'].map((status) => (
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
        <div className="space-y-3">
          {filteredReservations.map((reservation) => {
            const status = statusConfig[reservation.status];
            return (
              <div
                key={reservation.id}
                className="glass-card p-5 animate-fade-in hover:border-primary/30 transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    {/* Time */}
                    <div className="text-center min-w-[80px]">
                      <div className="text-2xl font-bold text-foreground">
                        {formatTime(reservation.scheduledTime)}
                      </div>
                    </div>

                    {/* Guest Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-foreground">
                          {reservation.guestName}
                        </h3>
                        <span className={cn('status-badge', status.className)}>
                          {status.label}
                        </span>
                        {reservation.externalSource && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground bg-secondary px-2 py-1 rounded">
                            <ExternalLink className="w-3 h-3" />
                            {reservation.externalSource}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Users className="w-4 h-4" />
                          {reservation.partySize} comensales
                        </span>
                        {reservation.guestPhone && (
                          <span className="flex items-center gap-1.5">
                            <Phone className="w-4 h-4" />
                            {reservation.guestPhone}
                          </span>
                        )}
                        {reservation.tableId && (
                          <span className="text-primary font-medium">
                            Mesa {reservation.tableId}
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
                    {reservation.status === 'confirmed' && (
                      <Button size="sm" variant="success">
                        <UserCheck className="w-4 h-4" />
                        Sentar
                      </Button>
                    )}
                    {reservation.status === 'pending' && (
                      <>
                        <Button size="sm" variant="outline">
                          <CheckCircle className="w-4 h-4" />
                          Confirmar
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive">
                          <XCircle className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                    <Button size="icon" variant="ghost">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredReservations.length === 0 && (
          <div className="text-center py-16">
            <Calendar className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No se encontraron reservas</h3>
            <p className="text-muted-foreground mb-6">
              {searchQuery ? 'Prueba con otro término de búsqueda' : 'Aún no hay reservas para hoy'}
            </p>
            <Button>
              <Plus className="w-4 h-4" />
              Añadir Reserva
            </Button>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
