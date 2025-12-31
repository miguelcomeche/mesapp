import { MainLayout } from '@/components/layout/MainLayout';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { TableCard } from '@/components/tables/TableCard';
import { useAuth } from '@/contexts/AuthContext';
import { Table } from '@/types';
import {
  UtensilsCrossed,
  Users,
  CalendarClock,
  ClipboardList,
  DollarSign,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

// Mock data for demonstration
const mockTables: Table[] = [
  { id: '1', number: '1', capacity: 4, status: 'occupied', section: 'Sala Principal', restaurantId: 'rest-1' },
  { id: '2', number: '2', capacity: 2, status: 'available', section: 'Sala Principal', restaurantId: 'rest-1' },
  { id: '3', number: '3', capacity: 6, status: 'reserved', section: 'Sala Principal', restaurantId: 'rest-1' },
  { id: '4', number: '4', capacity: 4, status: 'needs_attention', section: 'Terraza', restaurantId: 'rest-1' },
  { id: '5', number: '5', capacity: 8, status: 'occupied', section: 'Sala Privada', restaurantId: 'rest-1' },
  { id: '6', number: '6', capacity: 2, status: 'available', section: 'Barra', restaurantId: 'rest-1' },
];

const mockSessionInfo: Record<string, { guestCount: number; duration: string; waiter: string }> = {
  '1': { guestCount: 3, duration: '45m', waiter: 'Juan' },
  '4': { guestCount: 4, duration: '1h 12m', waiter: 'María' },
  '5': { guestCount: 6, duration: '28m', waiter: 'Juan' },
};

export default function Dashboard() {
  const { user } = useAuth();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  };

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {getGreeting()}, {user?.name?.split(' ')[0]}
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

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <MetricCard
            title="Mesas Disponibles"
            value="8"
            icon={<UtensilsCrossed className="w-6 h-6" />}
            subtitle="de 24 en total"
          />
          <MetricCard
            title="Mesas Ocupadas"
            value="12"
            icon={<Users className="w-6 h-6" />}
            trend={{ value: 15, isPositive: true }}
          />
          <MetricCard
            title="Reservas Pendientes"
            value="6"
            icon={<CalendarClock className="w-6 h-6" />}
            subtitle="Próxima a las 19:30"
          />
          <MetricCard
            title="Pedidos Activos"
            value="18"
            icon={<ClipboardList className="w-6 h-6" />}
            subtitle="3 listos para servir"
          />
          <MetricCard
            title="Ingresos de Hoy"
            value="2.847 €"
            icon={<DollarSign className="w-6 h-6" />}
            trend={{ value: 8, isPositive: true }}
          />
          <MetricCard
            title="Tiempo Medio Mesa"
            value="52m"
            icon={<Clock className="w-6 h-6" />}
            trend={{ value: 5, isPositive: false }}
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
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {mockTables.map((table) => (
              <TableCard
                key={table.id}
                table={table}
                sessionInfo={mockSessionInfo[table.id]}
                onClick={() => console.log('Open table', table.id)}
              />
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Actividad Reciente</h2>
          <div className="space-y-4">
            {[
              { time: 'Hace 2 min', action: 'Mesa 3 sentada', detail: 'Grupo de 4 • Reserva de CoverManager' },
              { time: 'Hace 8 min', action: 'Pedido enviado a cocina', detail: 'Mesa 7 • 3 productos' },
              { time: 'Hace 15 min', action: 'Pago recibido', detail: 'Mesa 2 • 127,50 €' },
              { time: 'Hace 22 min', action: 'Reserva confirmada', detail: 'Grupo Smith • 20:00 • Mesa 5' },
            ].map((activity, i) => (
              <div key={i} className="flex items-start gap-4 pb-4 border-b border-border last:border-0 last:pb-0">
                <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{activity.action}</p>
                  <p className="text-sm text-muted-foreground">{activity.detail}</p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{activity.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
