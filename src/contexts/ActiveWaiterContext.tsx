import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  getActiveWaiterId,
  setActiveWaiterId,
  subscribeActiveWaiter,
  registerRequireWaiterImpl,
} from '@/lib/activeWaiter';
import WaiterSelectDialog from '@/components/waiter/WaiterSelectDialog';
import { useAuth } from '@/contexts/AuthContext';

interface WaiterInfo {
  id: string;
  name: string;
}

interface ActiveWaiterContextValue {
  activeWaiterId: string | null;
  activeWaiter: WaiterInfo | null;
  clear: () => void;
  changeWaiter: () => void;
  ensureWaiter: () => Promise<string | null>;
}

const ActiveWaiterContext = createContext<ActiveWaiterContextValue | undefined>(undefined);

export function ActiveWaiterProvider({ children }: { children: ReactNode }) {
  const { restaurantId } = useAuth();
  const [activeWaiterId, setActiveWaiterIdState] = useState<string | null>(() => getActiveWaiterId(restaurantId));
  const [activeWaiter, setActiveWaiter] = useState<WaiterInfo | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const pendingResolversRef = useRef<Array<(v: string | null) => void>>([]);

  // Refresh state when restaurant changes
  useEffect(() => {
    setActiveWaiterIdState(getActiveWaiterId(restaurantId));
  }, [restaurantId]);

  // Subscribe to module-level changes
  useEffect(() => {
    return subscribeActiveWaiter((id) => setActiveWaiterIdState(id));
  }, []);

  // Fetch active waiter name
  useEffect(() => {
    if (!activeWaiterId || !restaurantId) {
      setActiveWaiter(null);
      return;
    }
    supabase
      .from('waiters' as any)
      .select('id, name, active')
      .eq('id', activeWaiterId)
      .eq('restaurant_id', restaurantId)
      .maybeSingle()
      .then(({ data }) => {
        const w = data as any;
        if (!w || !w.active) {
          // Stale or deactivated
          setActiveWaiterId(restaurantId, null);
          setActiveWaiter(null);
        } else {
          setActiveWaiter({ id: w.id, name: w.name });
        }
      });
  }, [activeWaiterId, restaurantId]);

  const openDialog = useCallback(() => {
    setDialogOpen(true);
  }, []);

  const ensureWaiter = useCallback((): Promise<string | null> => {
    if (!restaurantId) return Promise.resolve(null);
    const current = getActiveWaiterId(restaurantId);
    if (current) return Promise.resolve(current);
    return new Promise((resolve) => {
      pendingResolversRef.current.push(resolve);
      setDialogOpen(true);
    });
  }, [restaurantId]);

  const handleSelected = (waiterId: string) => {
    if (restaurantId) setActiveWaiterId(restaurantId, waiterId);
    setDialogOpen(false);
    const resolvers = pendingResolversRef.current;
    pendingResolversRef.current = [];
    resolvers.forEach((r) => r(waiterId));
  };

  const handleCancel = () => {
    setDialogOpen(false);
    const resolvers = pendingResolversRef.current;
    pendingResolversRef.current = [];
    resolvers.forEach((r) => r(null));
  };

  const clear = useCallback(() => {
    if (restaurantId) setActiveWaiterId(restaurantId, null);
  }, [restaurantId]);

  const changeWaiter = useCallback(() => {
    if (restaurantId) setActiveWaiterId(restaurantId, null);
    setDialogOpen(true);
  }, [restaurantId]);

  // Register module-level resolver so non-React code (hooks/data layer) can request a waiter.
  useEffect(() => {
    registerRequireWaiterImpl(ensureWaiter);
    return () => registerRequireWaiterImpl(null);
  }, [ensureWaiter]);

  const value = useMemo<ActiveWaiterContextValue>(() => ({
    activeWaiterId,
    activeWaiter,
    clear,
    changeWaiter,
    ensureWaiter,
  }), [activeWaiterId, activeWaiter, clear, changeWaiter, ensureWaiter]);

  return (
    <ActiveWaiterContext.Provider value={value}>
      {children}
      <WaiterSelectDialog
        open={dialogOpen}
        restaurantId={restaurantId}
        onCancel={handleCancel}
        onSelected={handleSelected}
      />
    </ActiveWaiterContext.Provider>
  );
}

export function useActiveWaiter(): ActiveWaiterContextValue {
  const ctx = useContext(ActiveWaiterContext);
  if (!ctx) throw new Error('useActiveWaiter must be used within ActiveWaiterProvider');
  return ctx;
}