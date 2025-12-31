import { MainLayout } from '@/components/layout/MainLayout';
import { useLocation } from 'react-router-dom';
import { 
  ChefHat, 
  BarChart3, 
  Users, 
  Settings,
  Rocket 
} from 'lucide-react';

const pageConfig: Record<string, { title: string; description: string; icon: React.ElementType }> = {
  '/kitchen': {
    title: 'Pantalla de Cocina',
    description: 'Cola de pedidos en tiempo real para el equipo de cocina con seguimiento de preparación.',
    icon: ChefHat,
  },
  '/analytics': {
    title: 'Analíticas',
    description: 'Informes de ingresos, rotación de mesas y métricas de rendimiento.',
    icon: BarChart3,
  },
  '/staff': {
    title: 'Gestión de Personal',
    description: 'Administra miembros del equipo, turnos y permisos de rol.',
    icon: Users,
  },
  '/settings': {
    title: 'Ajustes',
    description: 'Configura tu restaurante, menú, integraciones y preferencias.',
    icon: Settings,
  },
};

export default function ComingSoon() {
  const location = useLocation();
  const config = pageConfig[location.pathname] || {
    title: 'Próximamente',
    description: 'Esta funcionalidad está en desarrollo.',
    icon: Rocket,
  };
  const Icon = config.icon;

  return (
    <MainLayout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
          <Icon className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-3">{config.title}</h1>
        <p className="text-lg text-muted-foreground max-w-md mb-8">
          {config.description}
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary text-muted-foreground text-sm">
          <Rocket className="w-4 h-4" />
          <span>Disponible próximamente</span>
        </div>
      </div>
    </MainLayout>
  );
}
