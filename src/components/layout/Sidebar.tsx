import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useSidebarContext } from '@/contexts/SidebarContext';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  LayoutDashboard,
  UtensilsCrossed,
  CalendarClock,
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
  ChevronLeft,
  BookOpen,
  Wine,
  Menu,
  X,
  Building2,
  Printer as PrinterIcon,
  Clock,
  Store,
  UserCheck,
  UserCog,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useActiveWaiter } from '@/contexts/ActiveWaiterContext';
import { PlatformRestaurantSwitcher } from './PlatformRestaurantSwitcher';

import { ModuleKey } from '@/types/database';

export type SidebarVariant = 'tenant' | 'platform';

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
  roles?: ('admin' | 'manager' | 'waiter')[];
  module?: ModuleKey;
  children?: NavItem[];
}

const navItems: NavItem[] = [
  { label: 'Panel', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Carta', path: '/menu', icon: BookOpen, roles: ['admin', 'manager'], module: 'menu_enabled' },
  { label: 'Plano de Sala', path: '/floor', icon: UtensilsCrossed },
  { label: 'Reservas', path: '/reservations', icon: CalendarClock, module: 'reservations_enabled' },
  { label: 'Cocina', path: '/kitchen', icon: ChefHat, module: 'kitchen_bar_enabled' },
  { label: 'Barra', path: '/bar', icon: Wine, module: 'kitchen_bar_enabled' },
  { label: 'Pagos', path: '/payments', icon: CreditCard, module: 'payments_enabled' },
  { label: 'Analíticas', path: '/analytics', icon: BarChart3, roles: ['admin', 'manager'], module: 'analytics_enabled' },
];

const settingsItems: NavItem[] = [
  { label: 'Restaurante', path: '/settings/restaurant', icon: Store, roles: ['admin'] },
  { label: 'Horarios', path: '/settings/hours', icon: Clock, roles: ['admin', 'manager'] },
  { label: 'Impresoras', path: '/settings/printers', icon: PrinterIcon, roles: ['admin'], module: 'printing_enabled' },
  { label: 'Usuarios', path: '/settings/users', icon: Users, roles: ['admin'] },
  { label: 'Mesas', path: '/settings/tables', icon: LayoutGrid, roles: ['admin', 'manager'] },
];

const platformItems: NavItem[] = [
  { label: 'Restaurantes', path: '/admin/restaurants', icon: Building2 },
  { label: 'Usuarios globales', path: '/admin/users', icon: Users },
  { label: 'Configuración plataforma', path: '/admin/platform-settings', icon: Settings },
];

function SidebarContent({ onNavigate, variant = 'tenant' }: { onNavigate?: () => void; variant?: SidebarVariant }) {
  const location = useLocation();
  const { user, profile, roles, logout, hasRole } = useAuth();
  const { tenant } = useTenant();
  const { canAccessSettings } = usePermissions();
  const { isCollapsed } = useSidebarContext();
  const isMobile = useIsMobile();
  const { activeWaiter, changeWaiter } = useActiveWaiter();
  const [settingsOpen, setSettingsOpen] = useState(
    location.pathname.startsWith('/settings')
  );

  const filteredNavItems = navItems.filter(item => {
    if (item.roles && !item.roles.some(role => hasRole(role))) return false;
    if (item.module && tenant && !tenant.modules[item.module]) return false;
    return true;
  });

  const isPlatformAdmin = hasRole('platform_admin');
  const isAdmin = hasRole('admin');
  const isManager = hasRole('manager');
  const isWaiterOnly = hasRole('waiter') && !isPlatformAdmin && !isAdmin && !isManager;

  // platform_admin bypasses role + module checks for settings entries.
  const filteredSettingsItems = settingsItems.filter(item => {
    if (isPlatformAdmin) return true;
    if (item.roles && !item.roles.some(role => hasRole(role))) return false;
    if (item.module && tenant && !tenant.modules[item.module]) return false;
    return true;
  });

  const canSeeSettings = isPlatformAdmin || canAccessSettings;

  if (typeof window !== 'undefined') {
    // Debug aid for navigation visibility issues.
    // eslint-disable-next-line no-console
    console.debug('[Sidebar]', {
      roles,
      tenant: tenant?.slug,
      modules: tenant?.modules,
      visibleNav: filteredNavItems.map(i => i.path),
      visibleSettings: filteredSettingsItems.map(i => i.path),
    });
  }

  const displayName = profile?.name || user?.email || 'Usuario';
  const displayRole = isPlatformAdmin
    ? 'Platform admin'
    : isAdmin
      ? 'Admin'
      : isManager
        ? 'Gerente'
        : isWaiterOnly
          ? 'Camarero'
          : 'Usuario';

  // Operational waiter selector is only meaningful inside a tenant context for non-platform-admin operators.
  // Platform admins should never be labelled as "Camarero"; they may still open the selector if they
  // act on behalf of a waiter, but it is hidden by default to avoid confusion.
  const showWaiterSelector = variant === 'tenant' && !isPlatformAdmin;

  const showCollapsed = isCollapsed && !isMobile;

  const handleNavClick = () => {
    onNavigate?.();
  };

  const NavLink = ({ item, isChild = false }: { item: NavItem; isChild?: boolean }) => {
    const isActive = location.pathname === item.path;
    const iconSize = isChild ? 'w-4 h-4' : 'w-5 h-5';
    
    const linkContent = (
      <Link
        to={item.path}
        onClick={handleNavClick}
        className={cn(
          'nav-link',
          isActive && 'nav-link-active',
          showCollapsed && 'justify-center px-2'
        )}
        aria-label={item.label}
      >
        <item.icon className={iconSize} />
        {!showCollapsed && <span className={isChild ? 'text-sm' : ''}>{item.label}</span>}
      </Link>
    );

    if (showCollapsed) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            {linkContent}
          </TooltipTrigger>
          <TooltipContent side="right" className="bg-popover text-popover-foreground">
            {item.label}
          </TooltipContent>
        </Tooltip>
      );
    }

    return linkContent;
  };

  const SettingsSection = () => {
    if (!canSeeSettings) return null;

    if (showCollapsed) {
      return (
        <Popover>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    'nav-link w-full justify-center px-2',
                    location.pathname.startsWith('/settings') && 'nav-link-active'
                  )}
                  aria-label="Ajustes"
                >
                  <Settings className="w-5 h-5" />
                </button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-popover text-popover-foreground">
              Ajustes
            </TooltipContent>
          </Tooltip>
          <PopoverContent side="right" align="start" className="w-48 p-2 bg-popover">
            <div className="space-y-1">
              {filteredSettingsItems.map(item => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={handleNavClick}
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
            </div>
          </PopoverContent>
        </Popover>
      );
    }

    return (
      <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
        <CollapsibleTrigger asChild>
          <button
            className={cn(
              'nav-link w-full justify-between',
              location.pathname.startsWith('/settings') && 'nav-link-active'
            )}
            aria-label="Ajustes"
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
          {filteredSettingsItems.map(item => (
            <NavLink key={item.path} item={item} isChild />
          ))}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full">
        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <ul className="space-y-1">
            {variant === 'platform' ? (
              platformItems.map(item => (
                <li key={item.path}><NavLink item={item} /></li>
              ))
            ) : (
              <>
                {filteredNavItems.map(item => (
                  <li key={item.path}>
                    <NavLink item={item} />
                  </li>
                ))}
                <li>
                  <SettingsSection />
                </li>
              </>
            )}
          </ul>
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-sidebar-border">
          <PlatformRestaurantSwitcher collapsed={showCollapsed} />
          {showWaiterSelector && (
            showCollapsed ? (
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <button
                    onClick={changeWaiter}
                    className="nav-link w-full justify-center px-2 mb-3"
                    aria-label="Cambiar camarero"
                  >
                    {activeWaiter ? <UserCheck className="w-5 h-5 text-primary" /> : <UserCog className="w-5 h-5" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-popover text-popover-foreground">
                  {activeWaiter ? `Camarero activo: ${activeWaiter.name}` : 'Seleccionar camarero'}
                </TooltipContent>
              </Tooltip>
            ) : (
              <button
                onClick={changeWaiter}
                className="nav-link w-full mb-3"
                aria-label="Cambiar camarero"
              >
                {activeWaiter ? <UserCheck className="w-5 h-5 text-primary" /> : <UserCog className="w-5 h-5" />}
                <span className="flex-1 text-left">
                  {activeWaiter ? (
                    <>
                      <span className="block text-xs text-muted-foreground leading-none">Camarero activo</span>
                      <span className="block text-sm font-medium truncate">{activeWaiter.name}</span>
                    </>
                  ) : (
                    <span className="text-sm">Seleccionar camarero</span>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">Cambiar</span>
              </button>
            )
          )}
          {showCollapsed ? (
            <div className="flex flex-col items-center gap-3">
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center cursor-default">
                    <span className="text-sm font-medium text-foreground">
                      {displayName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-popover text-popover-foreground">
                  <p>{displayName}</p>
                  <p className="text-xs text-muted-foreground">{displayRole}</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <button
                    onClick={logout}
                    className="nav-link w-full justify-center px-2 text-destructive hover:bg-destructive/10"
                    aria-label="Cerrar Sesión"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-popover text-popover-foreground">
                  Cerrar Sesión
                </TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

export function Sidebar({ variant = 'tenant' }: { variant?: SidebarVariant } = {}) {
  const { isCollapsed, isOpen, toggleCollapsed, closeMobileDrawer } = useSidebarContext();
  const isMobile = useIsMobile();

  // Mobile: Drawer
  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={closeMobileDrawer}>
        <SheetContent side="left" className="w-64 p-0 bg-sidebar border-sidebar-border">
          {/* Logo Header */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
            <Link to="/dashboard" className="flex items-center gap-3" onClick={closeMobileDrawer}>
              <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
                <UtensilsCrossed className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold text-foreground">Mesapp</span>
            </Link>
          </div>
          <SidebarContent onNavigate={closeMobileDrawer} variant={variant} />
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop/Tablet: Fixed sidebar
  return (
    <aside 
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-200 ease-in-out",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-3 border-b border-sidebar-border">
        <button
          onClick={toggleCollapsed}
          className={cn(
            "flex items-center gap-3 hover:opacity-80 transition-opacity",
            isCollapsed && "justify-center w-full"
          )}
          aria-label={isCollapsed ? "Expandir menú" : "Colapsar menú"}
        >
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <UtensilsCrossed className="w-5 h-5 text-primary-foreground" />
          </div>
          {!isCollapsed && <span className="text-xl font-bold text-foreground">Mesapp</span>}
        </button>
        {!isCollapsed && (
          <button
            onClick={toggleCollapsed}
            className="p-1.5 rounded-md hover:bg-secondary transition-colors"
            aria-label="Colapsar menú"
          >
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      <SidebarContent variant={variant} />
    </aside>
  );
}

// Mobile header with hamburger menu
export function MobileHeader() {
  const { toggleCollapsed } = useSidebarContext();
  const isMobile = useIsMobile();

  if (!isMobile) return null;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-sidebar border-b border-sidebar-border flex items-center px-4">
      <button
        onClick={toggleCollapsed}
        className="p-2 rounded-md hover:bg-secondary transition-colors"
        aria-label="Abrir menú"
      >
        <Menu className="w-6 h-6 text-foreground" />
      </button>
      <div className="flex items-center gap-2 ml-3">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <UtensilsCrossed className="w-4 h-4 text-primary-foreground" />
        </div>
        <span className="text-lg font-bold text-foreground">Mesapp</span>
      </div>
    </header>
  );
}
