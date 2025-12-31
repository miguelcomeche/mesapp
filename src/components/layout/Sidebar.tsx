import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  UtensilsCrossed,
  CalendarClock,
  ClipboardList,
  CreditCard,
  BarChart3,
  Settings,
  LogOut,
  ChefHat,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
  roles?: ('admin' | 'manager' | 'waiter')[];
}

const navItems: NavItem[] = [
  { label: 'Panel', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Plano de Sala', path: '/floor', icon: UtensilsCrossed },
  { label: 'Reservas', path: '/reservations', icon: CalendarClock },
  { label: 'Pedidos', path: '/orders', icon: ClipboardList },
  { label: 'Cocina', path: '/kitchen', icon: ChefHat, roles: ['admin', 'manager'] },
  { label: 'Pagos', path: '/payments', icon: CreditCard },
  { label: 'Analíticas', path: '/analytics', icon: BarChart3, roles: ['admin', 'manager'] },
  { label: 'Personal', path: '/staff', icon: Users, roles: ['admin'] },
  { label: 'Ajustes', path: '/settings', icon: Settings, roles: ['admin', 'manager'] },
];

export function Sidebar() {
  const location = useLocation();
  const { user, profile, roles, logout, hasRole } = useAuth();

  const filteredNavItems = navItems.filter(
    item => !item.roles || item.roles.some(role => hasRole(role))
  );

  const displayName = profile?.name || user?.email || 'Usuario';
  const displayRole = roles[0] || 'waiter';

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
        <Link to="/dashboard" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
            <UtensilsCrossed className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold text-foreground">Mesapp</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <ul className="space-y-1">
          {filteredNavItems.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={cn(
                    'nav-link',
                    isActive && 'nav-link-active'
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User Section */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
            <span className="text-sm font-medium text-foreground">
              {displayName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
            <p className="text-xs text-muted-foreground capitalize">{displayRole}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="nav-link w-full text-destructive hover:bg-destructive/10"
        >
          <LogOut className="w-5 h-5" />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  );
}
