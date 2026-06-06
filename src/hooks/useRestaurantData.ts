import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Table, Reservation, TableSession, Order, OrderItem, MenuItem, Payment, Profile } from '@/types/database';
import { useToast } from '@/hooks/use-toast';

// Hook for managing tables
export function useTables(restaurantId: string | null) {
  const [tables, setTables] = useState<Table[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchTables = useCallback(async () => {
    if (!restaurantId) return;
    
    const { data, error } = await supabase
      .from('tables')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('number');
    
    if (error) {
      toast({ title: 'Error al cargar mesas', description: error.message, variant: 'destructive' });
      return;
    }
    
    setTables(data as Table[]);
    setIsLoading(false);
  }, [restaurantId, toast]);

  useEffect(() => {
    fetchTables();
    
    // Subscribe to realtime updates
    const channel = supabase
      .channel('tables-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, () => {
        fetchTables();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTables]);

  const updateTableStatus = async (tableId: string, status: Table['status']) => {
    const { error } = await supabase
      .from('tables')
      .update({ status })
      .eq('id', tableId);
    
    if (error) {
      toast({ title: 'Error al actualizar mesa', description: error.message, variant: 'destructive' });
      return false;
    }
    
    return true;
  };

  return { tables, isLoading, fetchTables, updateTableStatus };
}

// Hook for managing reservations
export function useReservations(restaurantId: string | null) {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchReservations = useCallback(async () => {
    if (!restaurantId) return;
    
    const { data, error } = await supabase
      .from('reservations')
      .select('*, table:tables(*)')
      .eq('restaurant_id', restaurantId)
      .order('scheduled_time', { ascending: true });
    
    if (error) {
      toast({ title: 'Error al cargar reservas', description: error.message, variant: 'destructive' });
      return;
    }
    
    setReservations(data as Reservation[]);
    setIsLoading(false);
  }, [restaurantId, toast]);

  useEffect(() => {
    fetchReservations();
    
    const channel = supabase
      .channel('reservations-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => {
        fetchReservations();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchReservations]);

  const updateReservationStatus = async (reservationId: string, status: Reservation['status']) => {
    const { error } = await supabase
      .from('reservations')
      .update({ status })
      .eq('id', reservationId);
    
    if (error) {
      toast({ title: 'Error al actualizar reserva', description: error.message, variant: 'destructive' });
      return false;
    }
    
    return true;
  };

  const assignTableToReservation = async (reservationId: string, tableId: string) => {
    const { error } = await supabase
      .from('reservations')
      .update({ table_id: tableId })
      .eq('id', reservationId);
    
    if (error) {
      toast({ title: 'Error al asignar mesa', description: error.message, variant: 'destructive' });
      return false;
    }
    
    return true;
  };

  const createReservation = async (data: {
    guest_name: string;
    guest_phone?: string;
    guest_email?: string;
    party_size: number;
    scheduled_time: string;
    source: 'manual' | 'phone' | 'walkin' | 'covermanager' | 'restoo';
    notes?: string;
  }): Promise<Reservation | null> => {
    if (!restaurantId) return null;

    // Determine status based on party size
    const status = data.party_size > 8 ? 'pending_confirmation' : 'pending';

    const { data: reservation, error } = await supabase
      .from('reservations')
      .insert({
        restaurant_id: restaurantId,
        guest_name: data.guest_name,
        guest_phone: data.guest_phone || null,
        guest_email: data.guest_email || null,
        party_size: data.party_size,
        scheduled_time: data.scheduled_time,
        source: data.source,
        status,
        notes: data.notes || null,
      })
      .select('*, table:tables(*)')
      .single();

    if (error) {
      toast({ title: 'Error al crear reserva', description: error.message, variant: 'destructive' });
      return null;
    }

    const statusMsg = status === 'pending_confirmation' 
      ? 'Reserva >8: pendiente de confirmación por el restaurante.'
      : 'Reserva creada correctamente.';
    toast({ title: 'Reserva creada', description: statusMsg });
    return reservation as Reservation;
  };

  const updateReservation = async (reservationId: string, data: {
    guest_name: string;
    guest_phone?: string;
    guest_email?: string;
    party_size: number;
    scheduled_time: string;
    source: 'manual' | 'phone' | 'walkin' | 'covermanager' | 'restoo';
    notes?: string;
  }): Promise<boolean> => {
    const { error } = await supabase
      .from('reservations')
      .update({
        guest_name: data.guest_name,
        guest_phone: data.guest_phone || null,
        guest_email: data.guest_email || null,
        party_size: data.party_size,
        scheduled_time: data.scheduled_time,
        source: data.source,
        notes: data.notes || null,
      })
      .eq('id', reservationId);

    if (error) {
      toast({ title: 'Error al actualizar reserva', description: error.message, variant: 'destructive' });
      return false;
    }

    toast({ title: 'Reserva actualizada', description: 'Los cambios se han guardado correctamente.' });
    return true;
  };

  return { reservations, isLoading, fetchReservations, updateReservationStatus, assignTableToReservation, createReservation, updateReservation };
}

// Hook for managing table sessions
export function useTableSessions(restaurantId: string | null) {
  const [sessions, setSessions] = useState<TableSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchSessions = useCallback(async () => {
    if (!restaurantId) return;
    
    const { data, error } = await supabase
      .from('table_sessions')
      .select('*, table:tables(*), reservation:reservations(*)')
      .eq('restaurant_id', restaurantId)
      .order('started_at', { ascending: false });
    
    if (error) {
      toast({ title: 'Error al cargar servicios', description: error.message, variant: 'destructive' });
      return;
    }
    
    setSessions(data as TableSession[]);
    setIsLoading(false);
  }, [restaurantId, toast]);

  useEffect(() => {
    fetchSessions();
    
    const channel = supabase
      .channel('sessions-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'table_sessions' }, () => {
        fetchSessions();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchSessions]);

  const createSession = async (
    tableId: string, 
    guestCount: number, 
    waiterId: string | null,
    reservationId?: string,
    groupId?: string | null
  ): Promise<TableSession | null> => {
    if (!restaurantId) return null;

    // Camarero activo (operativo) — independiente del usuario autenticado
    const { requireActiveWaiter } = await import('@/lib/activeWaiter');
    const operativeWaiterId = await requireActiveWaiter(restaurantId);
    if (!operativeWaiterId) {
      toast({ title: 'Operación cancelada', description: 'Selecciona un camarero para continuar.', variant: 'destructive' });
      return null;
    }

    const { data, error } = await supabase
      .from('table_sessions')
      .insert({
        table_id: tableId,
        guest_count: guestCount,
        waiter_id: waiterId,
        opened_by_waiter_id: operativeWaiterId,
        reservation_id: reservationId || null,
        restaurant_id: restaurantId,
        status: 'active',
        group_id: groupId ?? null,
      } as any)
      .select()
      .single();
    
    if (error) {
      toast({ title: 'Error al crear servicio', description: error.message, variant: 'destructive' });
      return null;
    }
    
    // Update table status to occupied (all members of the group, if any)
    if (groupId) {
      await supabase.from('tables').update({ status: 'occupied' }).eq('group_id', groupId);
      await (supabase as any).from('table_groups').update({ active_session_id: (data as any).id }).eq('id', groupId);
    } else {
      await supabase.from('tables').update({ status: 'occupied' }).eq('id', tableId);
    }
    
    toast({ title: 'Servicio creado', description: 'La mesa ha sido abierta correctamente.' });
    return data as TableSession;
  };

  const closeSession = async (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return false;

    const { requireActiveWaiter } = await import('@/lib/activeWaiter');
    const operativeWaiterId = await requireActiveWaiter(session.restaurant_id);

    const { error } = await supabase
      .from('table_sessions')
      .update({ 
        status: 'closed',
        closed_at: new Date().toISOString(),
        closed_by_waiter_id: operativeWaiterId,
      } as any)
      .eq('id', sessionId);
    
    if (error) {
      toast({ title: 'Error al cerrar servicio', description: error.message, variant: 'destructive' });
      return false;
    }

    // Update table status to available (all members of the group, if any)
    if ((session as any).group_id) {
      await supabase.from('tables').update({ status: 'available' }).eq('group_id', (session as any).group_id);
      await (supabase as any).from('table_groups').update({ active_session_id: null }).eq('id', (session as any).group_id);
    } else {
      await supabase.from('tables').update({ status: 'available' }).eq('id', session.table_id);
    }

    // If there's a reservation, mark it as completed
    if (session.reservation_id) {
      await supabase
        .from('reservations')
        .update({ status: 'completed' })
        .eq('id', session.reservation_id);
    }
    
    toast({ title: 'Servicio cerrado', description: 'La mesa ha sido cerrada correctamente.' });
    return true;
  };

  const updateSessionStatus = async (sessionId: string, status: TableSession['status']) => {
    const { error } = await supabase
      .from('table_sessions')
      .update({ status })
      .eq('id', sessionId);
    
    if (error) {
      toast({ title: 'Error al actualizar servicio', description: error.message, variant: 'destructive' });
      return false;
    }
    
    return true;
  };

  return { 
    sessions, 
    isLoading, 
    fetchSessions, 
    createSession, 
    closeSession, 
    updateSessionStatus 
  };
}

// Hook for managing orders
export function useOrders(sessionId?: string) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchOrders = useCallback(async () => {
    let query = supabase
      .from('orders')
      .select('*, items:order_items(*, menu_item:menu_items(*), order_item_modifiers(*))');
    
    if (sessionId) {
      query = query.eq('session_id', sessionId);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    
    if (error) {
      toast({ title: 'Error al cargar pedidos', description: error.message, variant: 'destructive' });
      return;
    }
    
    setOrders(data as Order[]);
    setIsLoading(false);
  }, [sessionId, toast]);

  useEffect(() => {
    fetchOrders();
    
    const channel = supabase
      .channel('orders-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchOrders();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => {
        fetchOrders();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchOrders]);

  const createOrder = async (sessionId: string): Promise<Order | null> => {
    const { data, error } = await supabase
      .from('orders')
      .insert({ session_id: sessionId, status: 'pending' })
      .select()
      .single();
    
    if (error) {
      toast({ title: 'Error al crear pedido', description: error.message, variant: 'destructive' });
      return null;
    }
    
    return data as Order;
  };

  const addOrderItem = async (
    orderId: string, 
    menuItem: MenuItem, 
    quantity: number = 1,
    notes?: string
  ) => {
    const { getActiveWaiterId, requireActiveWaiter } = await import('@/lib/activeWaiter');
    let waiterId = getActiveWaiterId(menuItem.restaurant_id);
    if (!waiterId) waiterId = await requireActiveWaiter(menuItem.restaurant_id);
    if (!waiterId) {
      toast({ title: 'Operación cancelada', description: 'Selecciona un camarero para continuar.', variant: 'destructive' });
      return false;
    }

    const { error } = await supabase
      .from('order_items')
      .insert({
        order_id: orderId,
        menu_item_id: menuItem.id,
        quantity,
        unit_price: menuItem.price,
        notes: notes || null,
        status: 'pending',
        added_by_waiter_id: waiterId,
      } as any);
    
    if (error) {
      toast({ title: 'Error al añadir producto', description: error.message, variant: 'destructive' });
      return false;
    }
    
    toast({ title: 'Producto añadido', description: `${menuItem.name} añadido al pedido.` });
    return true;
  };

  const updateOrderItemStatus = async (itemId: string, status: OrderItem['status']) => {
    const { error } = await supabase
      .from('order_items')
      .update({ status })
      .eq('id', itemId);
    
    if (error) {
      toast({ title: 'Error al actualizar producto', description: error.message, variant: 'destructive' });
      return false;
    }
    
    return true;
  };

  const sendOrderToKitchen = async (orderId: string) => {
    // Update all pending items to 'sent'
    const { error: itemsError } = await supabase
      .from('order_items')
      .update({ status: 'sent' })
      .eq('order_id', orderId)
      .eq('status', 'pending');
    
    if (itemsError) {
      toast({ title: 'Error al enviar pedido', description: itemsError.message, variant: 'destructive' });
      return false;
    }

    // Update order status to 'preparing'
    const { error: orderError } = await supabase
      .from('orders')
      .update({ status: 'preparing' })
      .eq('id', orderId);
    
    if (orderError) {
      toast({ title: 'Error al actualizar pedido', description: orderError.message, variant: 'destructive' });
      return false;
    }
    
    toast({ title: 'Pedido enviado', description: 'El pedido ha sido enviado a cocina.' });
    return true;
  };

  const updateOrderStatus = async (orderId: string, status: Order['status']) => {
    const { error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', orderId);
    
    if (error) {
      toast({ title: 'Error al actualizar pedido', description: error.message, variant: 'destructive' });
      return false;
    }
    
    return true;
  };

  return { 
    orders, 
    isLoading, 
    fetchOrders, 
    createOrder, 
    addOrderItem, 
    updateOrderItemStatus,
    sendOrderToKitchen,
    updateOrderStatus
  };
}

// Hook for managing menu items
export function useMenuItems(restaurantId: string | null) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchMenuItems = useCallback(async () => {
    if (!restaurantId) return;
    
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('available', true)
      .order('category', { ascending: true });
    
    if (error) {
      toast({ title: 'Error al cargar menú', description: error.message, variant: 'destructive' });
      return;
    }
    
    setMenuItems(data as MenuItem[]);
    setIsLoading(false);
  }, [restaurantId, toast]);

  useEffect(() => {
    fetchMenuItems();
  }, [fetchMenuItems]);

  return { menuItems, isLoading, fetchMenuItems };
}

// Hook for managing payments
export function usePayments(sessionId?: string) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchPayments = useCallback(async () => {
    let query = supabase
      .from('payments')
      .select('*');
    
    if (sessionId) {
      query = query.eq('session_id', sessionId);
    }
    
    const { data, error } = await query.order('processed_at', { ascending: false });
    
    if (error) {
      toast({ title: 'Error al cargar pagos', description: error.message, variant: 'destructive' });
      return;
    }
    
    setPayments(data as Payment[]);
    setIsLoading(false);
  }, [sessionId, toast]);

  useEffect(() => {
    fetchPayments();
    
    // Subscribe to realtime updates for payments
    const channel = supabase
      .channel('payments-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => {
        fetchPayments();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPayments]);

  const createPayment = async (
    sessionId: string, 
    amount: number, 
    method: Payment['method'],
    tip?: number
  ): Promise<Payment | null> => {
    // Fetch session restaurant to scope active waiter
    const { data: sess } = await supabase
      .from('table_sessions')
      .select('restaurant_id')
      .eq('id', sessionId)
      .maybeSingle();
    const rid = (sess as any)?.restaurant_id ?? null;

    const { requireActiveWaiter } = await import('@/lib/activeWaiter');
    const waiterId = await requireActiveWaiter(rid);
    if (!waiterId) {
      toast({ title: 'Operación cancelada', description: 'Selecciona un camarero para continuar.', variant: 'destructive' });
      return null;
    }

    const { data, error } = await supabase
      .from('payments')
      .insert({
        session_id: sessionId,
        amount,
        method,
        tip: tip || null,
        paid_by_waiter_id: waiterId,
      } as any)
      .select()
      .single();
    
    if (error) {
      toast({ title: 'Error al registrar pago', description: error.message, variant: 'destructive' });
      return null;
    }
    
    toast({ title: 'Pago registrado', description: `Pago de ${amount.toFixed(2)}€ registrado.` });
    return data as Payment;
  };

  return { payments, isLoading, fetchPayments, createPayment };
}
