import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

interface SidebarContextType {
  isCollapsed: boolean;
  isOpen: boolean; // For mobile drawer
  toggleCollapsed: () => void;
  setOpen: (open: boolean) => void;
  closeMobileDrawer: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

const SIDEBAR_COLLAPSED_KEY = 'mesapp-sidebar-collapsed';

export function SidebarProvider({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  
  // Desktop: collapsed state (icons only)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    return stored === 'true';
  });
  
  // Mobile: drawer open state
  const [isOpen, setIsOpen] = useState(false);

  // Persist collapsed state
  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isCollapsed));
  }, [isCollapsed]);

  // Close drawer on resize to desktop
  useEffect(() => {
    if (!isMobile) {
      setIsOpen(false);
    }
  }, [isMobile]);

  const toggleCollapsed = () => {
    if (isMobile) {
      setIsOpen(prev => !prev);
    } else {
      setIsCollapsed(prev => !prev);
    }
  };

  const closeMobileDrawer = () => {
    setIsOpen(false);
  };

  return (
    <SidebarContext.Provider 
      value={{ 
        isCollapsed, 
        isOpen, 
        toggleCollapsed, 
        setOpen: setIsOpen,
        closeMobileDrawer 
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebarContext() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebarContext must be used within SidebarProvider');
  }
  return context;
}
