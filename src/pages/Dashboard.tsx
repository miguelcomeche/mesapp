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
  { id: '1', number: '1', capacity: 4, status: 'occupied', section: 'Main Floor', restaurantId: 'rest-1' },
  { id: '2', number: '2', capacity: 2, status: 'available', section: 'Main Floor', restaurantId: 'rest-1' },
  { id: '3', number: '3', capacity: 6, status: 'reserved', section: 'Main Floor', restaurantId: 'rest-1' },
  { id: '4', number: '4', capacity: 4, status: 'needs_attention', section: 'Terrace', restaurantId: 'rest-1' },
  { id: '5', number: '5', capacity: 8, status: 'occupied', section: 'Private Room', restaurantId: 'rest-1' },
  { id: '6', number: '6', capacity: 2, status: 'available', section: 'Bar Area', restaurantId: 'rest-1' },
];

const mockSessionInfo: Record<string, { guestCount: number; duration: string; waiter: string }> = {
  '1': { guestCount: 3, duration: '45m', waiter: 'John' },
  '4': { guestCount: 4, duration: '1h 12m', waiter: 'Maria' },
  '5': { guestCount: 6, duration: '28m', waiter: 'John' },
};

export default function Dashboard() {
  const { user } = useAuth();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
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
              Here's what's happening at your restaurant today.
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" asChild>
              <Link to="/reservations">
                <CalendarClock className="w-4 h-4" />
                View Reservations
              </Link>
            </Button>
            <Button asChild>
              <Link to="/floor">
                <UtensilsCrossed className="w-4 h-4" />
                Floor Plan
              </Link>
            </Button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <MetricCard
            title="Available Tables"
            value="8"
            icon={<UtensilsCrossed className="w-6 h-6" />}
            subtitle="of 24 total"
          />
          <MetricCard
            title="Occupied Tables"
            value="12"
            icon={<Users className="w-6 h-6" />}
            trend={{ value: 15, isPositive: true }}
          />
          <MetricCard
            title="Pending Reservations"
            value="6"
            icon={<CalendarClock className="w-6 h-6" />}
            subtitle="Next at 7:30 PM"
          />
          <MetricCard
            title="Active Orders"
            value="18"
            icon={<ClipboardList className="w-6 h-6" />}
            subtitle="3 ready to serve"
          />
          <MetricCard
            title="Today's Revenue"
            value="$2,847"
            icon={<DollarSign className="w-6 h-6" />}
            trend={{ value: 8, isPositive: true }}
          />
          <MetricCard
            title="Avg. Table Time"
            value="52m"
            icon={<Clock className="w-6 h-6" />}
            trend={{ value: 5, isPositive: false }}
          />
        </div>

        {/* Quick Tables Overview */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Tables Overview</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/floor" className="gap-2">
                View All <ArrowRight className="w-4 h-4" />
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
          <h2 className="text-lg font-semibold text-foreground mb-4">Recent Activity</h2>
          <div className="space-y-4">
            {[
              { time: '2 min ago', action: 'Table 3 seated', detail: 'Party of 4 • Reserved by CoverManager' },
              { time: '8 min ago', action: 'Order sent to kitchen', detail: 'Table 7 • 3 items' },
              { time: '15 min ago', action: 'Payment received', detail: 'Table 2 • $127.50' },
              { time: '22 min ago', action: 'Reservation confirmed', detail: 'Smith party • 8 PM • Table 5' },
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
