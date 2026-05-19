// Module-level "camarero activo" state with localStorage persistence (per restaurant).
// A provider registers a `requireWaiter` implementation that opens the selection modal;
// hooks/components can then call `requireActiveWaiter(restaurantId)` from anywhere.

const storageKey = (restaurantId: string) => `mesapp:active_waiter:${restaurantId}`;

type Listener = (waiterId: string | null) => void;
const listeners = new Set<Listener>();

export function getActiveWaiterId(restaurantId: string | null | undefined): string | null {
  if (!restaurantId) return null;
  try {
    return localStorage.getItem(storageKey(restaurantId));
  } catch {
    return null;
  }
}

export function setActiveWaiterId(restaurantId: string, waiterId: string | null) {
  try {
    if (waiterId) localStorage.setItem(storageKey(restaurantId), waiterId);
    else localStorage.removeItem(storageKey(restaurantId));
  } catch {
    /* noop */
  }
  listeners.forEach((l) => l(waiterId));
}

export function subscribeActiveWaiter(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

type RequireImpl = (restaurantId: string) => Promise<string | null>;
let requireImpl: RequireImpl | null = null;

export function registerRequireWaiterImpl(impl: RequireImpl | null) {
  requireImpl = impl;
}

/**
 * Resolves with an active waiter id. If one is already stored, returns it.
 * Otherwise opens the "Selecciona camarero" modal. Returns null if cancelled.
 */
export async function requireActiveWaiter(restaurantId: string | null | undefined): Promise<string | null> {
  if (!restaurantId) return null;
  const current = getActiveWaiterId(restaurantId);
  if (current) return current;
  if (!requireImpl) return null;
  return await requireImpl(restaurantId);
}