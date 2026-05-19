import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { KitchenTicket, OrderItem, OrderCourse, OrderStation, OrderItemStatus } from '@/types/database';
import { useToast } from '@/hooks/use-toast';

export function useKitchenTickets(restaurantId: string | null, station?: OrderStation) {
  const [tickets, setTickets] = useState<KitchenTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchTickets = useCallback(async () => {
    if (!restaurantId) return;

    let query = supabase
      .from('kitchen_tickets')
      .select(`
        *,
        items:ticket_items(
          *,
          order_item:order_items(
            *,
            menu_item:menu_items(*)
          )
        ),
        session:table_sessions(
          *,
          table:tables(*)
        )
      `)
      .eq('restaurant_id', restaurantId)
      .in('status', ['sent', 'preparing', 'ready'])
      .order('created_at', { ascending: false });

    if (station) {
      query = query.eq('station', station);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching tickets:', error);
      return;
    }

    setTickets(data as unknown as KitchenTicket[]);
    setIsLoading(false);
  }, [restaurantId, station]);

  useEffect(() => {
    fetchTickets();

    const channel = supabase
      .channel('kitchen-tickets-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kitchen_tickets' }, () => {
        fetchTickets();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ticket_items' }, () => {
        fetchTickets();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => {
        fetchTickets();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTickets]);

  const updateTicketStatus = async (ticketId: string, status: OrderItemStatus) => {
    // Update ticket status
    const { error: ticketError } = await supabase
      .from('kitchen_tickets')
      .update({ status })
      .eq('id', ticketId);

    if (ticketError) {
      toast({ title: 'Error', description: 'No se pudo actualizar el ticket.', variant: 'destructive' });
      return false;
    }

    // Update all order items in this ticket
    const ticket = tickets.find(t => t.id === ticketId);
    if (ticket?.items) {
      const itemIds = ticket.items.map(ti => ti.order_item_id);
      await supabase
        .from('order_items')
        .update({ status })
        .in('id', itemIds);
    }

    toast({ title: 'Actualizado', description: `Estado cambiado a ${status}.` });
    return true;
  };

  return { tickets, isLoading, fetchTickets, updateTicketStatus };
}

export function useMarchar(sessionId: string | null, restaurantId: string | null, userId: string | null) {
  const { toast } = useToast();

  const createTicket = async (
    items: OrderItem[],
    station: OrderStation,
    course?: OrderCourse
  ): Promise<boolean> => {
    if (!sessionId || !restaurantId || items.length === 0) return false;

    const { requireActiveWaiter } = await import('@/lib/activeWaiter');
    const firedByWaiterId = await requireActiveWaiter(restaurantId);
    if (!firedByWaiterId) {
      toast({ title: 'Operación cancelada', description: 'Selecciona un camarero para continuar.', variant: 'destructive' });
      return false;
    }

    // Create ticket
    const { data: ticket, error: ticketError } = await supabase
      .from('kitchen_tickets')
      .insert({
        session_id: sessionId,
        station,
        course: course || null,
        created_by: userId,
        fired_by_waiter_id: firedByWaiterId,
        restaurant_id: restaurantId,
        status: 'sent',
      } as any)
      .select()
      .single();

    if (ticketError || !ticket) {
      toast({ title: 'Error', description: 'No se pudo crear el ticket.', variant: 'destructive' });
      return false;
    }

    // Create ticket items
    const ticketItems = items.map(item => ({
      ticket_id: ticket.id,
      order_item_id: item.id,
    }));

    const { error: itemsError } = await supabase
      .from('ticket_items')
      .insert(ticketItems);

    if (itemsError) {
      toast({ title: 'Error', description: 'No se pudieron añadir los items al ticket.', variant: 'destructive' });
      return false;
    }

    // Update order items status to 'sent' and set sent_at
    const itemIds = items.map(i => i.id);
    const { error: updateError } = await supabase
      .from('order_items')
      .update({ 
        status: 'sent',
        sent_at: new Date().toISOString()
      })
      .in('id', itemIds);

    if (updateError) {
      toast({ title: 'Error', description: 'No se pudo actualizar el estado de los items.', variant: 'destructive' });
      return false;
    }

    const stationLabel = station === 'kitchen' ? 'cocina' : 'barra';
    toast({ title: '¡Marchando!', description: `Enviado a ${stationLabel}.` });
    return true;
  };

  const marcharPrimeros = async (items: OrderItem[]) => {
    const pendingItems = items.filter(i => 
      i.status === 'pending' && 
      i.course === 'primeros' && 
      i.station === 'kitchen'
    );
    
    if (pendingItems.length === 0) {
      toast({ title: 'Sin productos', description: 'No hay productos pendientes en este pase.', variant: 'default' });
      return false;
    }
    
    return createTicket(pendingItems, 'kitchen', 'primeros');
  };

  const marcharSegundos = async (items: OrderItem[]) => {
    const pendingItems = items.filter(i => 
      i.status === 'pending' && 
      i.course === 'segundos' && 
      i.station === 'kitchen'
    );
    
    if (pendingItems.length === 0) {
      toast({ title: 'Sin productos', description: 'No hay productos pendientes en este pase.', variant: 'default' });
      return false;
    }
    
    return createTicket(pendingItems, 'kitchen', 'segundos');
  };

  const marcharPostres = async (items: OrderItem[]) => {
    const pendingItems = items.filter(i => 
      i.status === 'pending' && 
      i.course === 'postres' && 
      i.station === 'kitchen'
    );
    
    if (pendingItems.length === 0) {
      toast({ title: 'Sin productos', description: 'No hay productos pendientes en este pase.', variant: 'default' });
      return false;
    }
    
    return createTicket(pendingItems, 'kitchen', 'postres');
  };

  const marcharBarra = async (items: OrderItem[]) => {
    const pendingItems = items.filter(i => 
      i.status === 'pending' && 
      i.station === 'bar'
    );
    
    if (pendingItems.length === 0) {
      toast({ title: 'Sin productos', description: 'No hay productos pendientes en barra.', variant: 'default' });
      return false;
    }
    
    return createTicket(pendingItems, 'bar');
  };

  const marcharItem = async (item: OrderItem) => {
    if (item.status !== 'pending') {
      toast({ title: 'Item ya enviado', description: 'Este producto ya ha sido enviado.', variant: 'default' });
      return false;
    }
    
    return createTicket([item], item.station, item.station === 'kitchen' ? item.course : undefined);
  };

  const updateItemCourse = async (itemId: string, course: OrderCourse) => {
    const { error } = await supabase
      .from('order_items')
      .update({ course })
      .eq('id', itemId);

    if (error) {
      toast({ title: 'Error', description: 'No se pudo actualizar el pase.', variant: 'destructive' });
      return false;
    }
    return true;
  };

  return {
    marcharPrimeros,
    marcharSegundos,
    marcharPostres,
    marcharBarra,
    marcharItem,
    updateItemCourse,
  };
}
