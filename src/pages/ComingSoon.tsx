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
    title: 'Kitchen Display',
    description: 'Real-time order queue for kitchen staff with preparation tracking.',
    icon: ChefHat,
  },
  '/analytics': {
    title: 'Analytics',
    description: 'Revenue reports, table turnover rates, and performance insights.',
    icon: BarChart3,
  },
  '/staff': {
    title: 'Staff Management',
    description: 'Manage team members, shifts, and role permissions.',
    icon: Users,
  },
  '/settings': {
    title: 'Settings',
    description: 'Configure your restaurant, menu, integrations, and preferences.',
    icon: Settings,
  },
};

export default function ComingSoon() {
  const location = useLocation();
  const config = pageConfig[location.pathname] || {
    title: 'Coming Soon',
    description: 'This feature is under development.',
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
          <span>Coming soon in the next update</span>
        </div>
      </div>
    </MainLayout>
  );
}
