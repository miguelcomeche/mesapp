import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useTableSessions, useOrders } from '@/hooks/useRestaurantData';
import { STATUS_LABELS } from '@/types/database';
import { cn } from '@/lib/utils';
import {
  Clock,
  ChefHat,
  CheckCircle,
  AlertCircle,
  Send,
  Loader2,
  ClipboardList,
} from 'lucide-react';

export default function Orders() {
  const navigate = useNavigate();
  const { restaurantId } = useAuth();
  
  const { sessions } = useTableSessions(restaurantId);
  const { orders, isLoading, sendOrderToKitchen, updateOrderStatus } = useOrders();

  const getTimeSince = (dateString: string) => {
    const date = new Date(dateString);
    const mins = Math.floor((Date.now() - date.getTime()) / 60000);
    if (mins < 1) return 'Ahora mismo';
    if (mins < 60) return `Hace ${mins}m`;
    return `Hace ${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  // Get table number for a session
  const getTableNumber = (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    return session?.table?.number || '?';
  };

  const activeOrders = orders.filter((o) => o.status !== 'served' && o.status !== 'cancelled');
  const completedOrders = orders.filter((o) => o.status === 'served');

  const handleSendToKitchen = async (orderId: string) => {
    await sendOrderToKitchen(orderId);
  };

  const handleMarkServed = async (orderId: string) => {
    await updateOrderStatus(orderId, 'served');
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  const statusConfig = {
    pending: { label: STATUS_LABELS.order.pending, icon: Clock, className: 'status-reserved' },
    preparing: { label: STATUS_LABELS.order.preparing, icon: ChefHat, className: 'status-occupied' },
    ready: { label: STATUS_LABELS.order.ready, icon: AlertCircle, className: 'status-attention animate-pulse-soft' },
    served: { label: STATUS_LABELS.order.served, icon: CheckCircle, className: 'status-available' },
    cancelled: { label: STATUS_LABELS.order.cancelled, icon: AlertCircle, className: 'text-muted-foreground bg-muted' },
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Pedidos</h1>
            <p className="text-muted-foreground mt-1">
              {activeOrders.length} pedidos activos
            </p>
          </div>
        </div>

        {/* Active Orders */}
        {orders.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <ClipboardList className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No hay pedidos</h3>
            <p className="text-muted-foreground">
              Los pedidos aparecerán aquí cuando se creen desde los servicios de mesa
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {activeOrders.map((order) => {
              const status = statusConfig[order.status];
              const StatusIcon = status.icon;
              const total = order.items?.reduce((sum, item) => sum + item.quantity * Number(item.unit_price), 0) || 0;

              return (
                <div
                  key={order.id}
                  className={cn(
                    'glass-card p-5 animate-fade-in cursor-pointer',
                    order.status === 'ready' && 'border-status-attention glow-effect'
                  )}
                  onClick={() => {
                    const session = sessions.find(s => s.id === order.session_id);
                    if (session) navigate(`/session/${session.id}`);
                  }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-xl font-bold text-foreground">
                          Mesa {getTableNumber(order.session_id)}
                        </h3>
                        <span className={cn('status-badge', status.className)}>
                          <StatusIcon className="w-3.5 h-3.5" />
                          {status.label}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {getTimeSince(order.created_at)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-foreground">{total.toFixed(2)} €</p>
                      <p className="text-xs text-muted-foreground">{order.items?.length || 0} productos</p>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    {order.items?.slice(0, 5).map((item) => (
                      <div key={item.id} className="flex items-start justify-between text-sm">
                        <div className="flex-1">
                          <span className="text-foreground">
                            {item.quantity}x {item.menu_item?.name || 'Producto'}
                          </span>
                          {item.notes && (
                            <p className="text-xs text-primary">{item.notes}</p>
                          )}
                        </div>
                        <span className="text-muted-foreground">
                          {(item.quantity * Number(item.unit_price)).toFixed(2)} €
                        </span>
                      </div>
                    ))}
                    {(order.items?.length || 0) > 5 && (
                      <p className="text-sm text-muted-foreground">
                        +{(order.items?.length || 0) - 5} más...
                      </p>
                    )}
                  </div>

                  {order.notes && (
                    <div className="mb-4 p-2 rounded-lg bg-destructive/10 text-destructive text-sm">
                      ⚠️ {order.notes}
                    </div>
                  )}

                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    {order.status === 'pending' && order.items && order.items.length > 0 && (
                      <Button 
                        className="flex-1" 
                        size="sm"
                        onClick={() => handleSendToKitchen(order.id)}
                      >
                        <Send className="w-4 h-4" />
                        Enviar a Cocina
                      </Button>
                    )}
                    {order.status === 'ready' && (
                      <Button 
                        className="flex-1" 
                        size="sm" 
                        variant="success"
                        onClick={() => handleMarkServed(order.id)}
                      >
                        <CheckCircle className="w-4 h-4" />
                        Marcar como Servido
                      </Button>
                    )}
                    {order.status === 'preparing' && (
                      <Button className="flex-1" size="sm" variant="outline" disabled>
                        <ChefHat className="w-4 h-4 animate-pulse" />
                        En Cocina
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Completed Orders */}
        {completedOrders.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Completados Recientemente</h2>
            <div className="space-y-2">
              {completedOrders.slice(0, 5).map((order) => {
                const total = order.items?.reduce((sum, item) => sum + item.quantity * Number(item.unit_price), 0) || 0;
                return (
                  <div
                    key={order.id}
                    className="glass-card p-4 flex items-center justify-between opacity-75"
                  >
                    <div className="flex items-center gap-4">
                      <span className="font-semibold text-foreground">
                        Mesa {getTableNumber(order.session_id)}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {order.items?.length || 0} productos
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-medium text-foreground">{total.toFixed(2)} €</span>
                      <span className="status-badge status-available">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Servido
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
