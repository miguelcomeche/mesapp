import { NavLink, Outlet } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { CashStatusBanner } from '@/components/cash/CashStatusBanner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

const tabs = [
  { to: '/caja', label: 'Resumen', end: true },
  { to: '/caja/apertura', label: 'Apertura', managerOnly: true },
  { to: '/caja/cierre', label: 'Cierre / Arqueo', managerOnly: true },
  { to: '/caja/movimientos', label: 'Movimientos', managerOnly: true },
  { to: '/caja/historial', label: 'Historial' },
  { to: '/caja/diario', label: 'Diario' },
];

export default function CashLayout() {
  const { hasRole } = useAuth();
  const isManager = hasRole('admin') || hasRole('manager') || hasRole('platform_admin');
  const visible = tabs.filter((t) => !t.managerOnly || isManager);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Caja</h1>
          <p className="text-muted-foreground mt-1">Apertura, cierre, arqueo y movimientos</p>
        </div>

        <CashStatusBanner />

        <div className="border-b border-border">
          <nav className="flex gap-1 overflow-x-auto">
            {visible.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  cn(
                    'px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                    isActive
                      ? 'border-primary text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  )
                }
              >
                {t.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <Outlet />
      </div>
    </MainLayout>
  );
}