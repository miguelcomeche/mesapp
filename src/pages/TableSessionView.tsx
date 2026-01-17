import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  Plus, 
  Receipt, 
  CreditCard,
  Users,
  Clock,
  ChefHat,
  Wine,
  Send
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useOrders, usePayments, useMenuItems } from '@/hooks/useRestaurantData';
import { useModifiers } from '@/hooks/useModifiers';
import { useMarchar } from '@/hooks/useKitchenTickets';
import { supabase } from '@/integrations/supabase/client';
import { TableSession, OrderItem, OrderCourse, STATUS_LABELS } from '@/types/database';
import { useToast } from '@/hooks/use-toast';
import AddProductsDialog, { CartItem, SelectedModifier } from '@/components/session/AddProductsDialog';
import PaymentDialog from '@/components/session/PaymentDialog';
import { OrderItemRow } from '@/components/session/OrderItemRow';

export default function TableSessionView() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user, restaurantId } = useAuth();
  const { toast } = useToast();
  
  const [session, setSession] = useState<TableSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddProducts, setShowAddProducts] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  
  const { orders, createOrder, addOrderItem, fetchOrders } = useOrders(sessionId);
  const { payments, createPayment } = usePayments(sessionId);
  const { menuItems } = useMenuItems(restaurantId);
  const { modifierGroups } = useModifiers(restaurantId);
  const { 
    marcharPrimeros, 
    marcharSegundos, 
    marcharPostres, 
    marcharBarra, 
    marcharItem,
    updateItemCourse 
  } = useMarchar(sessionId || null, restaurantId, user?.id || null);

  // Get all order items flattened
  const allOrderItems: OrderItem[] = orders.flatMap(o => (o.items || []) as OrderItem[]);

  // Count pending items by course/station
  const pendingCounts = {
    primeros: allOrderItems.filter(i => i.status === 'pending' && i.course === 'primeros' && i.station === 'kitchen').length,
    segundos: allOrderItems.filter(i => i.status === 'pending' && i.course === 'segundos' && i.station === 'kitchen').length,
    postres: allOrderItems.filter(i => i.status === 'pending' && i.course === 'postres' && i.station === 'kitchen').length,
    bar: allOrderItems.filter(i => i.status === 'pending' && i.station === 'bar').length,
  };

  useEffect(() => {
    const fetchSession = async () => {
      if (!sessionId) return;
      
      const { data, error } = await supabase
        .from('table_sessions')
        .select('*, table:tables(*), reservation:reservations(*)')
        .eq('id', sessionId)
        .maybeSingle();
      
      if (error || !data) {
        toast({ title: 'Error', description: 'No se pudo cargar el servicio.', variant: 'destructive' });
        navigate('/floor');
        return;
      }
      
      setSession(data as TableSession);
      setIsLoading(false);
    };
    
    fetchSession();
    
    const channel = supabase
      .channel(`session-${sessionId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'table_sessions',
        filter: `id=eq.${sessionId}`
      }, () => {
        fetchSession();
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, navigate, toast]);

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDuration = (startTime: string) => {
    const start = new Date(startTime);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return hours > 0 ? `${hours}h ${mins}min` : `${mins}min`;
  };

  // Determine station based on category
  const getStation = (menuItem: { category: string }): 'kitchen' | 'bar' => {
    const bebidasCategories = ['Bebidas', 'Aguas y refrescos', 'Cerveza', 'Vino', 'Café', 'Licores'];
    return bebidasCategories.some(c => menuItem.category.toLowerCase().includes(c.toLowerCase())) 
      ? 'bar' 
      : 'kitchen';
  };

  const recalculateAndPersistSessionTotal = async () => {
    if (!sessionId) return;

    const { data, error } = await supabase
      .from('order_items')
      .select('unit_price, quantity, status, orders!inner(session_id)')
      .eq('orders.session_id', sessionId);

    if (error) {
      console.error('Error recalculating session total:', error);
      return;
    }

    const total = (data as any[])
      .filter((row) => row.status !== 'cancelled')
      .reduce((sum, row) => sum + Number(row.unit_price) * Number(row.quantity), 0);

    await supabase
      .from('table_sessions')
      .update({ total_amount: total })
      .eq('id', sessionId);
  };

  const handleAddProducts = async (items: CartItem[]) => {
    if (!sessionId) return;

    let activeOrder = orders.find(o => o.status === 'pending');

    if (!activeOrder) {
      const newOrder = await createOrder(sessionId);
      if (!newOrder) return;
      activeOrder = newOrder;
    }

    for (const item of items) {
      // Separate extras and sin modifiers
      const extrasMods = item.modifiers?.filter(m => {
        const groupLower = m.groupName.toLowerCase();
        return groupLower.includes('extras') || groupLower.includes('con');
      }) || [];

      const sinMods = item.modifiers?.filter(m => {
        const groupLower = m.groupName.toLowerCase();
        return groupLower.includes('sin') || groupLower.includes('quitar');
      }) || [];

      // Calculate modifier price adjustment (only extras add price)
      const modifierPriceAdjustment = extrasMods.reduce(
        (sum, m) => sum + Number(m.modifier.price_adjustment),
        0
      );

      const basePrice = Number(item.menuItem.price);
      const adjustedPrice = basePrice + modifierPriceAdjustment;
      const station = getStation(item.menuItem);

      // Build notes for display
      let notes = item.notes || '';
      if (item.modifiers && item.modifiers.length > 0) {
        const modifierLabels = item.modifiers.map(m => {
          const price = Number(m.modifier.price_adjustment);
          const groupLower = m.groupName.toLowerCase();
          const isSin = groupLower.includes('sin') || groupLower.includes('quitar');
          if (isSin) {
            return `Sin ${m.modifier.name}`;
          }
          if (price > 0) {
            return `+ ${m.modifier.name} (+${price.toFixed(2)}€)`;
          }
          return `+ ${m.modifier.name}`;
        }).join(', ');
        notes = notes ? `${modifierLabels}. ${notes}` : modifierLabels;
      }

      // Insert order item
      const { data: orderItemData, error } = await supabase
        .from('order_items')
        .insert({
          order_id: activeOrder.id,
          menu_item_id: item.menuItem.id,
          quantity: item.quantity,
          unit_price: adjustedPrice,
          base_unit_price: basePrice,
          notes: notes || null,
          modifiers: item.modifiers?.map(m => m.modifier.id) || null,
          status: 'pending',
          station,
          course: 'unassigned',
        })
        .select('id')
        .single();

      if (error || !orderItemData) {
        toast({ title: 'Error', description: 'No se pudo añadir el producto.', variant: 'destructive' });
        continue;
      }

      // Insert modifiers into join table
      const orderItemId = orderItemData.id;

      const modifierInserts = [
        ...extrasMods.map(m => ({
          order_item_id: orderItemId,
          modifier_id: m.modifier.id,
          modifier_group: 'EXTRAS_CON' as const,
          name: m.modifier.name,
          price: Number(m.modifier.price_adjustment),
        })),
        ...sinMods.map(m => ({
          order_item_id: orderItemId,
          modifier_id: m.modifier.id,
          modifier_group: 'SIN' as const,
          name: m.modifier.name,
          price: 0,
        })),
      ];

      if (modifierInserts.length > 0) {
        const { error: modError } = await supabase
          .from('order_item_modifiers')
          .insert(modifierInserts);

        if (modError) {
          console.error('Error inserting modifiers:', modError);
        }
      }
    }

    await recalculateAndPersistSessionTotal();
    await fetchOrders();
    setShowAddProducts(false);
  };

  const handleApplyOrderItemModifiers = async (params: {
    orderItemId: string;
    mode: 'extras' | 'sin' | 'all';
    selectedModifiers: SelectedModifier[];
  }) => {
    const { orderItemId, mode, selectedModifiers } = params;

    if (!sessionId) return;

    const getIsSin = (groupName: string) => {
      const lower = groupName.toLowerCase();
      return lower.includes('sin') || lower.includes('quitar');
    };

    const extrasSelected =
      mode === 'sin'
        ? []
        : selectedModifiers.filter((m) => !getIsSin(m.groupName));

    const sinSelected =
      mode === 'extras'
        ? []
        : selectedModifiers.filter((m) => getIsSin(m.groupName));

    const persistGroup = async (group: 'EXTRAS_CON' | 'SIN', mods: SelectedModifier[]) => {
      const { error: delError } = await supabase
        .from('order_item_modifiers')
        .delete()
        .eq('order_item_id', orderItemId)
        .eq('modifier_group', group);

      if (delError) throw delError;

      if (mods.length === 0) return;

      const inserts = mods.map((m) => ({
        order_item_id: orderItemId,
        modifier_id: m.modifier.id,
        modifier_group: group,
        name: m.modifier.name,
        price: group === 'SIN' ? 0 : Number(m.modifier.price_adjustment),
      }));

      const { error: insError } = await supabase
        .from('order_item_modifiers')
        .insert(inserts);

      if (insError) throw insError;
    };

    try {
      if (mode === 'extras') {
        await persistGroup('EXTRAS_CON', extrasSelected);
      } else if (mode === 'sin') {
        await persistGroup('SIN', sinSelected);
      } else {
        await persistGroup('EXTRAS_CON', extrasSelected);
        await persistGroup('SIN', sinSelected);
      }

      // Recalculate unit_price = base_unit_price + SUM(extras)
      const { data: oi, error: oiError } = await supabase
        .from('order_items')
        .select('base_unit_price')
        .eq('id', orderItemId)
        .single();

      if (oiError) throw oiError;

      const { data: extrasRows, error: extrasError } = await supabase
        .from('order_item_modifiers')
        .select('price')
        .eq('order_item_id', orderItemId)
        .eq('modifier_group', 'EXTRAS_CON');

      if (extrasError) throw extrasError;

      const extrasSum = (extrasRows || []).reduce((sum, row) => sum + Number((row as any).price), 0);
      const base = Number((oi as any).base_unit_price || 0);

      const { error: upError } = await supabase
        .from('order_items')
        .update({ unit_price: base + extrasSum })
        .eq('id', orderItemId);

      if (upError) throw upError;

      await recalculateAndPersistSessionTotal();
      await fetchOrders();

      toast({ title: 'Modificadores guardados', description: 'Los cambios se han aplicado al pedido.' });
    } catch (e: any) {
      console.error('Error applying modifiers:', e);
      toast({
        title: 'Error',
        description: 'No se pudieron guardar los modificadores.',
        variant: 'destructive',
      });
      throw e;
    }
  };

  const handleAddWithModifiers = async (params: {
    menuItem: { id: string; name: string; price: number; category: string };
    selectedModifiers: SelectedModifier[];
  }) => {
    if (!sessionId) return;

    const { menuItem, selectedModifiers } = params;

    let activeOrder = orders.find(o => o.status === 'pending');

    if (!activeOrder) {
      const newOrder = await createOrder(sessionId);
      if (!newOrder) return;
      activeOrder = newOrder;
    }

    // Separate extras and sin modifiers
    const getIsSin = (groupName: string) => {
      const lower = groupName.toLowerCase();
      return lower.includes('sin') || lower.includes('quitar');
    };

    const extrasMods = selectedModifiers.filter(m => !getIsSin(m.groupName));
    const sinMods = selectedModifiers.filter(m => getIsSin(m.groupName));

    // Calculate modifier price adjustment (only extras add price)
    const modifierPriceAdjustment = extrasMods.reduce(
      (sum, m) => sum + Number(m.modifier.price_adjustment),
      0
    );

    const basePrice = Number(menuItem.price);
    const adjustedPrice = basePrice + modifierPriceAdjustment;
    const station = getStation(menuItem);

    // Insert order item
    const { data: orderItemData, error } = await supabase
      .from('order_items')
      .insert({
        order_id: activeOrder.id,
        menu_item_id: menuItem.id,
        quantity: 1,
        unit_price: adjustedPrice,
        base_unit_price: basePrice,
        notes: null,
        modifiers: selectedModifiers.map(m => m.modifier.id) || null,
        status: 'pending',
        station,
        course: 'unassigned',
      })
      .select('id')
      .single();

    if (error || !orderItemData) {
      toast({ title: 'Error', description: 'No se pudo añadir el producto.', variant: 'destructive' });
      return;
    }

    // Insert modifiers into join table
    const orderItemId = orderItemData.id;

    const modifierInserts = [
      ...extrasMods.map(m => ({
        order_item_id: orderItemId,
        modifier_id: m.modifier.id,
        modifier_group: 'EXTRAS_CON' as const,
        name: m.modifier.name,
        price: Number(m.modifier.price_adjustment),
      })),
      ...sinMods.map(m => ({
        order_item_id: orderItemId,
        modifier_id: m.modifier.id,
        modifier_group: 'SIN' as const,
        name: m.modifier.name,
        price: 0,
      })),
    ];

    if (modifierInserts.length > 0) {
      const { error: modError } = await supabase
        .from('order_item_modifiers')
        .insert(modifierInserts);

      if (modError) {
        console.error('Error inserting modifiers:', modError);
      }
    }

    await recalculateAndPersistSessionTotal();
    await fetchOrders();
    
    toast({ title: 'Producto añadido', description: `${menuItem.name} añadido al pedido.` });
  };

  const handleMarcharItem = async (item: OrderItem) => {
    await marcharItem(item);
    fetchOrders();
  };

  const handleCourseChange = async (itemId: string, course: OrderCourse) => {
    await updateItemCourse(itemId, course);
    fetchOrders();
  };

  const handleMarcharPrimeros = async () => {
    await marcharPrimeros(allOrderItems);
    fetchOrders();
  };

  const handleMarcharSegundos = async () => {
    await marcharSegundos(allOrderItems);
    fetchOrders();
  };

  const handleMarcharPostres = async () => {
    await marcharPostres(allOrderItems);
    fetchOrders();
  };

  const handleMarcharBarra = async () => {
    await marcharBarra(allOrderItems);
    fetchOrders();
  };

  const handleCloseSession = async () => {
    if (!session) return;
    
    const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const remaining = Number(session.total_amount) - totalPaid;
    
    if (remaining > 0) {
      toast({ 
        title: 'Pago pendiente', 
        description: `Aún quedan ${remaining.toFixed(2)}€ por pagar.`,
        variant: 'destructive'
      });
      return;
    }
    
    const { error } = await supabase
      .from('table_sessions')
      .update({ 
        status: 'closed',
        closed_at: new Date().toISOString()
      })
      .eq('id', session.id);
    
    if (error) {
      toast({ title: 'Error', description: 'No se pudo cerrar el servicio.', variant: 'destructive' });
      return;
    }
    
    await supabase
      .from('tables')
      .update({ status: 'available' })
      .eq('id', session.table_id);
    
    if (session.reservation_id) {
      await supabase
        .from('reservations')
        .update({ status: 'completed' })
        .eq('id', session.reservation_id);
    }
    
    toast({ title: 'Servicio cerrado', description: 'La mesa ha sido cerrada correctamente.' });
    navigate('/floor');
  };

  if (isLoading || !session) {
    return (
      <MainLayout title="Cargando...">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </MainLayout>
    );
  }

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const remaining = Number(session.total_amount) - totalPaid;

  return (
    <MainLayout title={`Mesa ${session.table?.number || ''}`}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/floor')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
          
          <Badge variant={session.status === 'active' ? 'default' : 'secondary'}>
            {STATUS_LABELS.session[session.status]}
          </Badge>
        </div>

        {/* Session Info */}
        <Card className="glass-card p-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Comensales</p>
                <p className="font-semibold">{session.guest_count}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Inicio</p>
                <p className="font-semibold">{formatTime(session.started_at)}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Receipt className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="font-semibold text-lg">{Number(session.total_amount).toFixed(2)}€</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CreditCard className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ya pagado</p>
                <p className="font-semibold text-lg text-green-500">{totalPaid.toFixed(2)}€</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${remaining > 0.01 ? 'bg-destructive/10' : 'bg-green-500/10'}`}>
                <Receipt className={`h-5 w-5 ${remaining > 0.01 ? 'text-destructive' : 'text-green-500'}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pendiente</p>
                <p className={`font-semibold text-lg ${remaining > 0.01 ? 'text-destructive' : 'text-green-500'}`}>
                  {remaining.toFixed(2)}€
                </p>
              </div>
            </div>
          </div>
          
          {session.reservation && (
            <div className="mt-4 pt-4 border-t border-border/50">
              <p className="text-sm text-muted-foreground">
                Reserva: <span className="text-foreground font-medium">{session.reservation.guest_name}</span>
                {session.reservation.guest_phone && ` • ${session.reservation.guest_phone}`}
              </p>
            </div>
          )}
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setShowAddProducts(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Añadir productos
          </Button>
          
          <Button 
            variant="outline" 
            onClick={() => setShowPayment(true)}
            className="gap-2"
          >
            <CreditCard className="h-4 w-4" />
            Registrar pago
          </Button>
          
          <Button 
            variant="destructive" 
            onClick={handleCloseSession}
            disabled={remaining > 0}
            className="gap-2"
          >
            <Receipt className="h-4 w-4" />
            Cerrar mesa
          </Button>
        </div>

        {/* Marchar Buttons */}
        {allOrderItems.some(i => i.status === 'pending') && (
          <Card className="glass-card p-4">
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">Marchar pedidos</h3>
            <div className="flex flex-wrap gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleMarcharPrimeros}
                className="gap-2"
                disabled={pendingCounts.primeros === 0}
              >
                <ChefHat className="h-4 w-4" />
                Marchar primeros
                {pendingCounts.primeros > 0 && (
                  <Badge variant="secondary" className="ml-1">{pendingCounts.primeros}</Badge>
                )}
              </Button>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleMarcharSegundos}
                className="gap-2"
                disabled={pendingCounts.segundos === 0}
              >
                <ChefHat className="h-4 w-4" />
                Marchar segundos
                {pendingCounts.segundos > 0 && (
                  <Badge variant="secondary" className="ml-1">{pendingCounts.segundos}</Badge>
                )}
              </Button>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleMarcharPostres}
                className="gap-2"
                disabled={pendingCounts.postres === 0}
              >
                <ChefHat className="h-4 w-4" />
                Marchar postres
                {pendingCounts.postres > 0 && (
                  <Badge variant="secondary" className="ml-1">{pendingCounts.postres}</Badge>
                )}
              </Button>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleMarcharBarra}
                className="gap-2 border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                disabled={pendingCounts.bar === 0}
              >
                <Wine className="h-4 w-4" />
                Marchar barra
                {pendingCounts.bar > 0 && (
                  <Badge variant="secondary" className="ml-1">{pendingCounts.bar}</Badge>
                )}
              </Button>
            </div>
          </Card>
        )}

        {/* Orders */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Pedidos</h2>
          
          {orders.length === 0 ? (
            <Card className="glass-card p-8 text-center">
              <ChefHat className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No hay pedidos aún</p>
              <Button onClick={() => setShowAddProducts(true)} className="mt-4">
                Añadir primer pedido
              </Button>
            </Card>
          ) : (
            orders.map((order) => (
              <Card key={order.id} className="glass-card p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Badge variant={order.status === 'pending' ? 'outline' : 'default'}>
                      {STATUS_LABELS.order[order.status]}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {formatTime(order.created_at)}
                    </span>
                  </div>
                </div>
                
                {order.items && order.items.length > 0 ? (
                  <div className="space-y-1">
                    {(order.items as OrderItem[]).map((item) => (
                      <OrderItemRow
                        key={item.id}
                        item={item}
                        onMarchar={handleMarcharItem}
                        onCourseChange={handleCourseChange}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">Sin productos</p>
                )}
              </Card>
            ))
          )}
        </div>

        {/* Payment History */}
        {payments.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Historial de pagos</h2>
            <Card className="glass-card p-4">
              <div className="space-y-2">
                {payments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">
                        {STATUS_LABELS.payment[payment.method]}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {new Date(payment.processed_at).toLocaleDateString('es-ES', { 
                          day: '2-digit', 
                          month: '2-digit'
                        })} {new Date(payment.processed_at).toLocaleTimeString('es-ES', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </span>
                    </div>
                    <span className="font-semibold text-green-500">
                      +{Number(payment.amount).toFixed(2)}€
                      {payment.tip && ` (+${Number(payment.tip).toFixed(2)}€ propina)`}
                    </span>
                  </div>
                ))}
              </div>
              
              <div className="mt-4 pt-4 border-t border-border/50 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total cuenta</span>
                  <span className="font-medium">{Number(session.total_amount).toFixed(2)}€</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total pagado</span>
                  <span className="font-medium text-green-500">{totalPaid.toFixed(2)}€</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-border/30">
                  <span className="font-medium">Pendiente</span>
                  <span className={`font-bold text-lg ${remaining > 0.01 ? 'text-destructive' : 'text-green-500'}`}>
                    {remaining.toFixed(2)}€
                  </span>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <AddProductsDialog
        open={showAddProducts}
        onOpenChange={setShowAddProducts}
        menuItems={menuItems}
        modifierGroups={modifierGroups}
        orderItems={allOrderItems}
        onApplyOrderItemModifiers={handleApplyOrderItemModifiers}
        onAddWithModifiers={handleAddWithModifiers}
        onConfirm={handleAddProducts}
      />
      
      <PaymentDialog
        open={showPayment}
        onOpenChange={setShowPayment}
        totalAmount={Number(session.total_amount)}
        paidAmount={totalPaid}
        guestCount={session.guest_count}
        orderItems={orders.flatMap(o => o.items || [])}
        onConfirm={async (paymentsData) => {
          // STEP 1: Create all payments
          console.log('[Payment] Creating payments:', paymentsData);
          
          for (const paymentData of paymentsData) {
            await createPayment(session.id, paymentData.amount, paymentData.method, paymentData.tip);
          }
          
          // STEP 2: Query the database for the TRUE total of all payments for this session
          // This is the single source of truth - NOT local state
          const { data: allPayments, error: paymentsError } = await supabase
            .from('payments')
            .select('amount')
            .eq('session_id', session.id);
          
          if (paymentsError) {
            console.error('[Payment] Error fetching payments after creation:', paymentsError);
            setShowPayment(false);
            return;
          }
          
          // STEP 3: Calculate actual pending from database totals
          const dbPaidTotal = (allPayments || []).reduce((sum, p) => sum + Number(p.amount), 0);
          const sessionTotal = Number(session.total_amount);
          const actualPending = sessionTotal - dbPaidTotal;
          
          // Currency-safe rounding (2 decimal places)
          const pendingRounded = Math.round(actualPending * 100) / 100;
          
          console.log('[Payment] Session total:', sessionTotal);
          console.log('[Payment] DB paid total:', dbPaidTotal);
          console.log('[Payment] Actual pending (rounded):', pendingRounded);
          
          // STEP 4: Auto-close ONLY if pending is essentially zero (within 0.01€ tolerance for rounding)
          if (pendingRounded <= 0.01) {
            console.log('[Payment] Pending <= 0.01, closing table...');
            
            await supabase
              .from('table_sessions')
              .update({ 
                status: 'closed',
                closed_at: new Date().toISOString()
              })
              .eq('id', session.id);
            
            await supabase
              .from('tables')
              .update({ status: 'available' })
              .eq('id', session.table_id);
            
            if (session.reservation_id) {
              await supabase
                .from('reservations')
                .update({ status: 'completed' })
                .eq('id', session.reservation_id);
            }
            
            toast({ title: 'Mesa cerrada', description: 'Pago completado y mesa cerrada automáticamente.' });
            navigate('/floor');
          } else {
            console.log('[Payment] Pending > 0.01 (', pendingRounded, '€), keeping table OPEN');
            toast({ 
              title: 'Pago registrado', 
              description: `Pendiente: ${pendingRounded.toFixed(2)}€` 
            });
            setShowPayment(false);
          }
        }}
      />
    </MainLayout>
  );
}
