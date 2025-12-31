import { MainLayout } from '@/components/layout/MainLayout';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { TableCard } from '@/components/tables/TableCard';
import { useAuth } from '@/contexts/AuthContext';
import { useTables, useReservations, useTableSessions } from '@/hooks/useRestaurantData';
import {
  UtensilsCrossed,
  Users,
  CalendarClock,
  ClipboardList,
  DollarSign,
  Clock,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link, useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const { profile, restaurantId } = useAuth();
  const navigate = useNavigate();
  
  const { tables, isLoading: tablesLoading } = useTables(restaurantId);
  const { reservations, isLoading: reservationsLoading } = useReservations(restaurantId);
  const { sessions, isLoading: sessionsLoading } = useTableSessions(restaurantId);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  };

  const displayName = profile?.name?.split(' ')[0] || 'Usuario';

  // Calculate metrics
  const availableTables = tables.filter(t => t.status === 'available').length;
  const occupiedTables = tables.filter(t => t.status === 'occupied').length;
  const pendingReservations = reservations.filter(r => r.status === 'pending' || r.status === 'confirmed').length;
  const activeSessions = sessions.filter(s => s.status === 'active').length;
  const todayRevenue = sessions
    .filter(s => s.status === 'closed' && new Date(s.started_at).toDateString() === new Date().toDateString())
    .reduce((sum, s) => sum + Number(s.total_amount), 0);

  // Get session info for tables
  const getSessionInfo = (tableId: string) => {
    const session = sessions.find(s => s.table_id === tableId && s.status === 'active');
    if (!session) return undefined;
    
    const start = new Date(session.started_at);
    const now = new Date();
    const diffMins = Math.floor((now.getTime() - start.getTime()) / 60000);
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    const duration = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    
    return {
      guestCount: session.guest_count,
      duration,
      waiter: 'Camarero',
    };
  };

  const isLoading = tablesLoading || reservationsLoading || sessionsLoading;

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {getGreeting()}, {displayName}
            </h1>
            <p className="text-muted-foreground mt-1">
              Esto es lo que está pasando hoy en tu restaurante.
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" asChild>
              <Link to="/reservations">
                <CalendarClock className="w-4 h-4" />
                Ver Reservas
              </Link>
            </Button>
            <Button asChild>
              <Link to="/floor">
                <UtensilsCrossed className="w-4 h-4" />
                Plano de Sala
              </Link>
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              <MetricCard
                title="Mesas Disponibles"
                value={availableTables.toString()}
                icon={<UtensilsCrossed className="w-6 h-6" />}
                subtitle={`de ${tables.length} en total`}
              />
              <MetricCard
                title="Mesas Ocupadas"
                value={occupiedTables.toString()}
                icon={<Users className="w-6 h-6" />}
              />
              <MetricCard
                title="Reservas Pendientes"
                value={pendingReservations.toString()}
                icon={<CalendarClock className="w-6 h-6" />}
              />
              <MetricCard
                title="Servicios Activos"
                value={activeSessions.toString()}
                icon={<ClipboardList className="w-6 h-6" />}
              />
              <MetricCard
                title="Ingresos de Hoy"
                value={`${todayRevenue.toFixed(0)} €`}
                icon={<DollarSign className="w-6 h-6" />}
              />
              <MetricCard
                title="Total Mesas"
                value={tables.length.toString()}
                icon={<Clock className="w-6 h-6" />}
              />
            </div>

            {/* Quick Tables Overview */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Resumen de Mesas</h2>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/floor" className="gap-2">
                    Ver Todas <ArrowRight className="w-4 h-4" />
                  </Link>
                </Button>
              </div>
              
              {tables.length === 0 ? (
                <div className="glass-card p-8 text-center">
                  <UtensilsCrossed className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground mb-4">No hay mesas configuradas</p>
                  <p className="text-sm text-muted-foreground">
                    Configura tu restaurante añadiendo mesas desde el panel de administración.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {tables.slice(0, 8).map((table) => (
                    <TableCard
                      key={table.id}
                      table={table}
                      sessionInfo={getSessionInfo(table.id)}
                      onClick={() => {
                        const session = sessions.find(s => s.table_id === table.id && s.status === 'active');
                        if (session) {
                          navigate(`/session/${session.id}`);
                        } else {
                          navigate('/floor');
                        }
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}
