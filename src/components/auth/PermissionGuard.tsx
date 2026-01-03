import { ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

interface PermissionGuardProps {
  allowed: boolean;
  children: ReactNode;
  redirectTo?: string;
}

export default function PermissionGuard({ 
  allowed, 
  children, 
  redirectTo = '/dashboard' 
}: PermissionGuardProps) {
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!allowed) {
      toast({
        title: 'Acceso restringido',
        description: 'No tienes permisos para realizar esta acción',
        variant: 'destructive',
      });
      navigate(redirectTo);
    }
  }, [allowed, navigate, redirectTo, toast]);

  if (!allowed) {
    return null;
  }

  return <>{children}</>;
}
