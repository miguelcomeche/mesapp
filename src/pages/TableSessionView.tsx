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
  Wine
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useOrders, usePayments } from '@/hooks/useRestaurantData';
import { useMarchar } from '@/hooks/useKitchenTickets';
import { supabase } from '@/integrations/supabase/client';
import { TableSession, OrderItem, OrderCourse, STATUS_LABELS } from '@/types/database';
import { useToast } from '@/hooks/use-toast';
import PaymentDialog from '@/components/session/PaymentDialog';
import { OrderItemRow } from '@/components/session/OrderItemRow';
import { CancelOrderItemDialog, CancelMode } from '@/components/session/CancelOrderItemDialog';
import { useOrderItemActions } from '@/hooks/useOrderItemActions';
import { usePermissions } from '@/hooks/usePermissions';
import { requireActiveWaiter } from '@/lib/activeWaiter';

export default function TableSessionView() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user, restaurantId } = useAuth();
  const { toast } = useToast();
  
  const [session, setSession] = useState<TableSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPayment, setShowPayment] = useState(false);
  
  const { orders, fetchOrders } = useOrders(sessionId);
  const { payments, createPayment } = usePayments(sessionId);
  const { cancelItem, deleteItem } = useOrderItemActions();
  const { isOwner, isManager, isWaiter } = usePermissions();
  const [restaurantPolicy, setRestaurantPolicy] = useState<{ waiters_can_cancel_items: boolean; require_cancellation_reason: boolean } | null>(null);
  const [actionDialog, setActionDialog] = useState<{ item: OrderItem; mode: CancelMode } | null>(null);
  const { 
    marcharPrimeros, 
    marcharSegundos, 
    marcharPostres, 
    marcharBarra, 
    marcharItem,
    updateItemCourse 
  } = useMarchar(sessionId || null, restaurantId, user?.id || null);

  // Get all order items flattened (soft-deleted excluded)
  const allOrderItems: OrderItem[] = orders
    .flatMap(o => (o.items || []) as OrderItem[])
    .filter(i => !i.deleted_at);

  useEffect(() => {
    if (!session?.restaurant_id) return;
    (supabase as any)
      .from('restaurants')
      .select('waiters_can_cancel_items, require_cancellation_reason')
      .eq('id', session.restaurant_id)
      .maybeSingle()
      .then(({ data }: any) => setRestaurantPolicy((data as any) ?? { waiters_can_cancel_items: true, require_cancellation_reason: true }));
  }, [session?.restaurant_id]);

  const waitersCanCancel = restaurantPolicy?.waiters_can_cancel_items ?? true;
  const requireReason = restaurantPolicy?.require_cancellation_reason ?? true;
  const canDelete = isOwner || isManager; // never for waiter-only
  const canCancel = isOwner || isManager || (isWaiter && waitersCanCancel);

  // Compute paid quantity per order_item from payment_items
  const paidQuantityByItem: Record<string, number> = {};
  for (const p of payments as any[]) {
    const items = (p as any).payment_items || [];
    for (const pi of items) {
      paidQuantityByItem[pi.order_item_id] =
        (paidQuantityByItem[pi.order_item_id] || 0) + Number(pi.quantity_paid);
    }
  }

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

    const waiterId = await requireActiveWaiter(session.restaurant_id);
    if (!waiterId) {
      toast({ title: 'Operación cancelada', description: 'Selecciona un camarero para continuar.', variant: 'destructive' });
      return;
    }
    
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
        closed_at: new Date().toISOString(),
        closed_by_waiter_id: waiterId,
      } as any)
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
          <Button onClick={() => navigate(`/session/${sessionId}/add-products`)} className="gap-2">
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
              <Button onClick={() => navigate(`/session/${sessionId}/add-products`)} className="mt-4">
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
                        paidQuantity={paidQuantityByItem[item.id] || 0}
                        canDelete={canDelete}
                        canCancel={canCancel}
                        onCancelRequest={(i) => setActionDialog({ item: i, mode: 'cancel' })}
                        onDeleteRequest={(i) => setActionDialog({ item: i, mode: 'delete' })}
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
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
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
                      {(payment as any).payment_items && (payment as any).payment_items.length > 0 && (
                        <div className="mt-1.5 text-xs text-muted-foreground pl-1">
                          <span className="font-medium">Productos:</span>
                          <ul className="mt-0.5 space-y-0.5">
                            {(payment as any).payment_items.map((pi: any) => (
                              <li key={pi.id}>
                                · {Number(pi.quantity_paid)}x {pi.order_item?.menu_item?.name || 'Producto'}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    <span className="font-semibold text-green-500 ml-3 whitespace-nowrap">
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

      {/* Payment Dialog */}
      
      <PaymentDialog
        open={showPayment}
        onOpenChange={setShowPayment}
        totalAmount={Number(session.total_amount)}
        paidAmount={totalPaid}
        guestCount={session.guest_count}
        tableLabel={session.table?.number ? String(session.table.number) : undefined}
        orderItems={orders.flatMap(o => o.items || [])}
        paidQuantityByItem={paidQuantityByItem}
        onConfirm={async (paymentsData) => {
          // STEP 1: Create all payments
          console.log('[Payment] Creating payments:', paymentsData);
          
          for (const paymentData of paymentsData) {
            await createPayment(
              session.id,
              paymentData.amount,
              paymentData.method,
              paymentData.tip,
              paymentData.items
            );
          }

          // Insertar trabajo de impresión para el ticket del cliente
          try {
            const orderItems = orders.flatMap(o => o.items || []);
            const ticketItems = orderItems
              .filter((item: any) => item.status !== 'cancelled' && !item.deleted_at)
              .map((item: any) => ({
                name: item.menu_item?.name || 'Producto',
                quantity: item.quantity,
                price: Number(item.unit_price),
                modifiers: item.modifiers || [],
              }));

            await supabase.from('print_jobs' as any).insert({
              restaurant_id: session.restaurant_id,
              type: 'customer_ticket',
              status: 'pending',
              data: {
                table_number: session.table?.number || '?',
                date: new Date().toISOString(),
                items: ticketItems,
                subtotal: Number(session.total_amount),
                total: Number(session.total_amount),
                payments: paymentsData.map((p: any) => ({
                  method: p.method,
                  amount: p.amount,
                })),
              },
            });
          } catch (printErr) {
            console.error('[Print] Error insertando print job:', printErr);
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
                closed_at: new Date().toISOString(),
                closed_by_waiter_id: await requireActiveWaiter(session.restaurant_id),
              } as any)
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

      <CancelOrderItemDialog
        open={!!actionDialog}
        onOpenChange={(o) => !o && setActionDialog(null)}
        mode={actionDialog?.mode ?? 'cancel'}
        productName={actionDialog?.item.menu_item?.name}
        requireReason={requireReason}
        onConfirm={async (reason) => {
          if (!actionDialog) return;
          const ok =
            actionDialog.mode === 'cancel'
              ? await cancelItem(actionDialog.item.id, reason)
              : await deleteItem(actionDialog.item.id, reason);
          if (ok) {
            setActionDialog(null);
            fetchOrders();
          }
        }}
      />
    </MainLayout>
  );
}
