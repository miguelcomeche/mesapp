import { ReactNode } from 'react';
import { Sidebar, MobileHeader, SidebarVariant } from './Sidebar';
import { SidebarProvider, useSidebarContext } from '@/contexts/SidebarContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { SupportBanner } from './SupportBanner';

interface MainLayoutProps {
  children: ReactNode;
  title?: string;
  variant?: SidebarVariant;
}

function MainLayoutContent({ children, title, variant = 'tenant' }: MainLayoutProps) {
  const { isCollapsed } = useSidebarContext();
  const isMobile = useIsMobile();

  return (
    <div className="min-h-screen bg-background">
      <SupportBanner />
      <MobileHeader />
      <Sidebar variant={variant} />
      <main
        className={cn(
          'transition-all duration-200 ease-in-out',
          isMobile ? 'pt-14' : isCollapsed ? 'pl-16' : 'pl-64'
        )}
      >
        <div className="p-6 lg:p-8">
          {title && <h1 className="text-2xl font-bold mb-6">{title}</h1>}
          {children}
        </div>
      </main>
    </div>
  );
}

export function MainLayout({ children, title, variant }: MainLayoutProps) {
  return (
    <SidebarProvider>
      <MainLayoutContent title={title} variant={variant}>
        {children}
      </MainLayoutContent>
    </SidebarProvider>
  );
}

export function PlatformLayout({ children, title }: Omit<MainLayoutProps, 'variant'>) {
  return <MainLayout variant="platform" title={title}>{children}</MainLayout>;
}

export default MainLayout;
