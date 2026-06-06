import { ReactNode } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { ModuleKey } from '@/types/database';
import { Loader2 } from 'lucide-react';

interface ModuleGuardProps {
  module: ModuleKey;
  children: ReactNode;
}

export function ModuleGuard({ module, children }: ModuleGuardProps) {
  const { tenant, isLoading } = useTenant();
  const { hasRole } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // platform_admin is a global superuser and bypasses module-level gating
  // so every module is reachable regardless of restaurant configuration.
  if (hasRole('platform_admin')) {
    return <>{children}</>;
  }

  if (!tenant || !tenant.modules[module]) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-2xl font-bold text-foreground">Módulo no disponible</h1>
          <p className="text-muted-foreground">
            Este módulo no está activado para este restaurante.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default ModuleGuard;