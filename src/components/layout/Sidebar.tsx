import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
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
  Pizza,
  LayoutGrid,
  ChevronDown,
  ChevronRight,
  BookOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
  roles?: ('admin' | 'manager' | 'waiter')[];
  children?: NavItem[];
}

const navItems: NavItem[] = [
  { label: 'Panel', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Carta', path: '/menu', icon: BookOpen, roles: ['admin', 'manager'] },
  { label: 'Plano de Sala', path: '/floor', icon: UtensilsCrossed },
  { label: 'Reservas', path: '/reservations', icon: CalendarClock },
  { label: 'Pedidos', path: '/orders', icon: ClipboardList },
  { label: 'Cocina', path: '/kitchen', icon: ChefHat, roles: ['admin', 'manager'] },
  { label: 'Pagos', path: '/payments', icon: CreditCard },
  { label: 'Analíticas', path: '/analytics', icon: BarChart3, roles: ['admin', 'manager'] },
];

const settingsItems: NavItem[] = [
  { label: 'Menú', path: '/settings/menu', icon: Pizza, roles: ['admin', 'manager'] },
  { label: 'Mesas', path: '/settings/tables', icon: LayoutGrid, roles: ['admin', 'manager'] },
  { label: 'Usuarios', path: '/settings/users', icon: Users, roles: ['admin'] },
];

export function Sidebar() {
  const location = useLocation();
  const { user, profile, roles, logout, hasRole } = useAuth();
  const { canAccessSettings, canAccessFullSettings } = usePermissions();
  const [settingsOpen, setSettingsOpen] = useState(
    location.pathname.startsWith('/settings')
  );

  const filteredNavItems = navItems.filter(
    item => !item.roles || item.roles.some(role => hasRole(role))
  );

  const filteredSettingsItems = settingsItems.filter(
    item => !item.roles || item.roles.some(role => hasRole(role))
  );

  const displayName = profile?.name || user?.email || 'Usuario';
  const displayRole = roles[0] === 'admin' ? 'Gerente' : roles[0] === 'manager' ? 'Encargado' : 'Camarero';

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

          {/* Settings Section - Only for admin and manager */}
          {canAccessSettings && (
            <li>
              <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
                <CollapsibleTrigger asChild>
                  <button
                    className={cn(
                      'nav-link w-full justify-between',
                      location.pathname.startsWith('/settings') && 'nav-link-active'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Settings className="w-5 h-5" />
                      <span>Ajustes</span>
                    </div>
                    {settingsOpen ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-1 ml-4 space-y-1">
                  {filteredSettingsItems.map(item => {
                    const isActive = location.pathname === item.path;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={cn(
                          'nav-link',
                          isActive && 'nav-link-active'
                        )}
                      >
                        <item.icon className="w-4 h-4" />
                        <span className="text-sm">{item.label}</span>
                      </Link>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            </li>
          )}
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
            <p className="text-xs text-muted-foreground">{displayRole}</p>
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
