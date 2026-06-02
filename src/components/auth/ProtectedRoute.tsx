import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types/database';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, hasRole, user, roles, restaurantId } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If allowedRoles is specified, check if user has any of them
  if (allowedRoles && allowedRoles.length > 0) {
    // platform_admin is a superuser and bypasses every role guard.
    const isPlatformAdmin = hasRole('platform_admin');
    const hasAccess = isPlatformAdmin || hasRole(allowedRoles);

    if (!hasAccess) {
      // eslint-disable-next-line no-console
      console.warn('[ProtectedRoute] Acceso denegado', {
        user: user?.email,
        roles,
        restaurantId,
        requiredRoles: allowedRoles,
      });
      toast({
        title: "Acceso denegado",
        description: "No tienes permisos para acceder a esta sección",
        variant: "destructive",
      });
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
}

export default ProtectedRoute;
