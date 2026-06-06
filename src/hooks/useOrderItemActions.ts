import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { getActiveWaiterId } from '@/lib/activeWaiter';

function friendlyError(message: string | undefined): string {
  if (!message) return 'Ocurrió un error.';
  if (message.includes('ALREADY_PAID')) {
    return 'Producto ya pagado. Debes hacer una devolución.';
  }
  if (message.includes('ALREADY_SENT')) {
    return 'El producto ya fue enviado. Debes anularlo en lugar de borrarlo.';
  }
  if (message.includes('Motivo requerido')) return 'Debes indicar un motivo.';
  if (message.includes('forbidden') || message.includes('42501')) {
    return 'No tienes permisos para esta acción.';
  }
  return message;
}

export function useOrderItemActions() {
  const { toast } = useToast();
  const { restaurantId } = useAuth();

  const cancelItem = useCallback(
    async (itemId: string, reason: string) => {
      const waiter = getActiveWaiterId(restaurantId);
      const { error } = await supabase.rpc('cancel_order_item' as any, {
        _item: itemId,
        _reason: reason,
        _waiter: waiter ?? null,
      } as any);
      if (error) {
        toast({ title: 'No se pudo anular', description: friendlyError(error.message), variant: 'destructive' });
        return false;
      }
      toast({ title: 'Producto anulado' });
      return true;
    },
    [restaurantId, toast],
  );

  const deleteItem = useCallback(
    async (itemId: string, reason: string) => {
      const waiter = getActiveWaiterId(restaurantId);
      const { error } = await supabase.rpc('delete_order_item' as any, {
        _item: itemId,
        _reason: reason,
        _waiter: waiter ?? null,
      } as any);
      if (error) {
        toast({ title: 'No se pudo borrar', description: friendlyError(error.message), variant: 'destructive' });
        return false;
      }
      toast({ title: 'Producto borrado' });
      return true;
    },
    [restaurantId, toast],
  );

  return { cancelItem, deleteItem };
}