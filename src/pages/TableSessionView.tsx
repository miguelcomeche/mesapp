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
import AddProductsDialog, { CartItem } from '@/components/session/AddProductsDialog';
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

  const handleAddProducts = async (items: CartItem[]) => {
    if (!sessionId) return;
    
    let activeOrder = orders.find(o => o.status === 'pending');
    
    if (!activeOrder) {
      const newOrder = await createOrder(sessionId);
      if (!newOrder) return;
      activeOrder = newOrder;
    }
    
    for (const item of items) {
      // Build modifier IDs array for DB storage
      const modifierIds = item.modifiers?.map(m => m.modifier.id) || null;
      
      // Build notes with modifier names for display
      let notes = item.notes || '';
      if (item.modifiers && item.modifiers.length > 0) {
        const modifierLabels = item.modifiers.map(m => {
          const price = Number(m.modifier.price_adjustment);
          if (price > 0) {
            return `+ ${m.modifier.name} (+${price.toFixed(2)}€)`;
          }
          return `Sin ${m.modifier.name}`;
        }).join(', ');
        notes = notes ? `${modifierLabels}. ${notes}` : modifierLabels;
      }
      
      const adjustedPrice = Number(item.menuItem.price) + (item.modifierPriceAdjustment || 0);
      const station = getStation(item.menuItem);
      
      // Add item with station and modifiers
      const { error } = await supabase
        .from('order_items')
        .insert({
          order_id: activeOrder.id,
          menu_item_id: item.menuItem.id,
          quantity: item.quantity,
          unit_price: adjustedPrice,
          notes: notes || null,
          modifiers: modifierIds,
          status: 'pending',
          station,
          course: 'unassigned',
        });
      
      if (error) {
        toast({ title: 'Error', description: 'No se pudo añadir el producto.', variant: 'destructive' });
      }
    }
    
    fetchOrders();
    setShowAddProducts(false);
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Duración</p>
                <p className="font-semibold">{formatDuration(session.started_at)}</p>
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

        {/* Payment Summary */}
        {payments.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Pagos</h2>
            <Card className="glass-card p-4">
              <div className="space-y-2">
                {payments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">
                        {STATUS_LABELS.payment[payment.method]}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {new Date(payment.processed_at).toLocaleTimeString('es-ES', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </span>
                    </div>
                    <span className="font-semibold">
                      {Number(payment.amount).toFixed(2)}€
                      {payment.tip && ` (+${Number(payment.tip).toFixed(2)}€ propina)`}
                    </span>
                  </div>
                ))}
              </div>
              
              <div className="mt-4 pt-4 border-t border-border/50 flex justify-between">
                <span className="font-medium">Pendiente</span>
                <span className={`font-bold text-lg ${remaining > 0 ? 'text-destructive' : 'text-green-500'}`}>
                  {remaining.toFixed(2)}€
                </span>
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
        onConfirm={handleAddProducts}
      />
      
      <PaymentDialog
        open={showPayment}
        onOpenChange={setShowPayment}
        totalAmount={Number(session.total_amount)}
        paidAmount={totalPaid}
        guestCount={session.guest_count}
        orderItems={orders.flatMap(o => o.items || [])}
        onConfirm={(amount, method, tip, discount) => {
          createPayment(session.id, amount, method, tip);
          setShowPayment(false);
        }}
      />
    </MainLayout>
  );
}
