import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Order, OrderStatus } from '@/types';
import { cn } from '@/lib/utils';
import {
  Plus,
  Clock,
  ChefHat,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

// Mock orders
const mockOrders: (Order & { tableNumber: string })[] = [
  {
    id: '1',
    sessionId: 'session-1',
    tableNumber: '3',
    items: [
      { id: '1', menuItemId: 'm1', menuItemName: 'Grilled Salmon', quantity: 2, unitPrice: 28 },
      { id: '2', menuItemId: 'm2', menuItemName: 'Caesar Salad', quantity: 1, unitPrice: 14 },
      { id: '3', menuItemId: 'm3', menuItemName: 'House Wine (Bottle)', quantity: 1, unitPrice: 45 },
    ],
    status: 'preparing',
    createdAt: new Date(Date.now() - 15 * 60000),
  },
  {
    id: '2',
    sessionId: 'session-2',
    tableNumber: '7',
    items: [
      { id: '4', menuItemId: 'm4', menuItemName: 'Ribeye Steak', quantity: 1, unitPrice: 42, notes: 'Medium rare' },
      { id: '5', menuItemId: 'm5', menuItemName: 'Truffle Fries', quantity: 1, unitPrice: 12 },
    ],
    status: 'ready',
    createdAt: new Date(Date.now() - 25 * 60000),
  },
  {
    id: '3',
    sessionId: 'session-3',
    tableNumber: '1',
    items: [
      { id: '6', menuItemId: 'm6', menuItemName: 'Lobster Bisque', quantity: 2, unitPrice: 18 },
      { id: '7', menuItemId: 'm7', menuItemName: 'Bread Basket', quantity: 1, unitPrice: 8 },
    ],
    status: 'pending',
    createdAt: new Date(Date.now() - 2 * 60000),
    notes: 'Allergy: shellfish for one guest',
  },
  {
    id: '4',
    sessionId: 'session-4',
    tableNumber: '12',
    items: [
      { id: '8', menuItemId: 'm8', menuItemName: 'Tiramisu', quantity: 3, unitPrice: 12 },
      { id: '9', menuItemId: 'm9', menuItemName: 'Espresso', quantity: 3, unitPrice: 4 },
    ],
    status: 'served',
    createdAt: new Date(Date.now() - 45 * 60000),
    servedAt: new Date(Date.now() - 5 * 60000),
  },
];

const statusConfig: Record<OrderStatus, { label: string; icon: React.ElementType; className: string }> = {
  pending: { label: 'Pending', icon: Clock, className: 'status-reserved' },
  preparing: { label: 'Preparing', icon: ChefHat, className: 'status-occupied' },
  ready: { label: 'Ready', icon: AlertCircle, className: 'status-attention animate-pulse-soft' },
  served: { label: 'Served', icon: CheckCircle, className: 'status-available' },
  cancelled: { label: 'Cancelled', icon: AlertCircle, className: 'text-muted-foreground bg-muted' },
};

export default function Orders() {
  const getTimeSince = (date: Date) => {
    const mins = Math.floor((Date.now() - date.getTime()) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
  };

  const activeOrders = mockOrders.filter((o) => o.status !== 'served' && o.status !== 'cancelled');
  const completedOrders = mockOrders.filter((o) => o.status === 'served');

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Orders</h1>
            <p className="text-muted-foreground mt-1">
              {activeOrders.length} active orders
            </p>
          </div>
          <Button>
            <Plus className="w-4 h-4" />
            New Order
          </Button>
        </div>

        {/* Active Orders */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {activeOrders.map((order) => {
            const status = statusConfig[order.status];
            const StatusIcon = status.icon;
            const total = order.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

            return (
              <div
                key={order.id}
                className={cn(
                  'glass-card p-5 animate-fade-in',
                  order.status === 'ready' && 'border-status-attention glow-effect'
                )}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-xl font-bold text-foreground">Table {order.tableNumber}</h3>
                      <span className={cn('status-badge', status.className)}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {status.label}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {getTimeSince(order.createdAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-foreground">${total}</p>
                    <p className="text-xs text-muted-foreground">{order.items.length} items</p>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex items-start justify-between text-sm">
                      <div className="flex-1">
                        <span className="text-foreground">
                          {item.quantity}x {item.menuItemName}
                        </span>
                        {item.notes && (
                          <p className="text-xs text-primary">{item.notes}</p>
                        )}
                      </div>
                      <span className="text-muted-foreground">
                        ${item.quantity * item.unitPrice}
                      </span>
                    </div>
                  ))}
                </div>

                {order.notes && (
                  <div className="mb-4 p-2 rounded-lg bg-destructive/10 text-destructive text-sm">
                    ⚠️ {order.notes}
                  </div>
                )}

                <div className="flex gap-2">
                  {order.status === 'pending' && (
                    <Button className="flex-1" size="sm">
                      Send to Kitchen
                    </Button>
                  )}
                  {order.status === 'ready' && (
                    <Button className="flex-1" size="sm" variant="success">
                      <CheckCircle className="w-4 h-4" />
                      Mark as Served
                    </Button>
                  )}
                  {order.status === 'preparing' && (
                    <Button className="flex-1" size="sm" variant="outline" disabled>
                      <ChefHat className="w-4 h-4 animate-pulse" />
                      In Kitchen
                    </Button>
                  )}
                  <Button size="sm" variant="outline">
                    <Plus className="w-4 h-4" />
                    Add Items
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Completed Orders */}
        {completedOrders.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Recently Completed</h2>
            <div className="space-y-2">
              {completedOrders.map((order) => {
                const total = order.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
                return (
                  <div
                    key={order.id}
                    className="glass-card p-4 flex items-center justify-between opacity-75"
                  >
                    <div className="flex items-center gap-4">
                      <span className="font-semibold text-foreground">Table {order.tableNumber}</span>
                      <span className="text-sm text-muted-foreground">
                        {order.items.length} items
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-medium text-foreground">${total}</span>
                      <span className="status-badge status-available">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Served
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
