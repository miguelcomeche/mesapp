import { ReactNode } from 'react';
import { Sidebar, MobileHeader } from './Sidebar';
import { SidebarProvider, useSidebarContext } from '@/contexts/SidebarContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface MainLayoutProps {
  children: ReactNode;
  title?: string;
}

function MainLayoutContent({ children, title }: MainLayoutProps) {
  const { isCollapsed } = useSidebarContext();
  const isMobile = useIsMobile();

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader />
      <Sidebar />
      <main 
        className={cn(
          "transition-all duration-200 ease-in-out",
          isMobile ? "pt-14" : isCollapsed ? "pl-16" : "pl-64"
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

export function MainLayout({ children, title }: MainLayoutProps) {
  return (
    <SidebarProvider>
      <MainLayoutContent title={title}>
        {children}
      </MainLayoutContent>
    </SidebarProvider>
  );
}

export default MainLayout;
