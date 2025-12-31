import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import {
  CreditCard,
  Banknote,
  SplitSquareVertical,
  Receipt,
  DollarSign,
  TrendingUp,
} from 'lucide-react';
import { MetricCard } from '@/components/dashboard/MetricCard';

// Mock data for tables ready for payment
const tablesReadyForPayment = [
  {
    id: '1',
    tableNumber: '5',
    guestCount: 4,
    items: [
      { name: 'Salmón a la Plancha x2', price: 56 },
      { name: 'Ensalada César', price: 14 },
      { name: 'Vino de la Casa (Botella)', price: 45 },
      { name: 'Surtido de Postres', price: 24 },
    ],
    subtotal: 139,
    tax: 13.9,
    total: 152.9,
    duration: '1h 23m',
    waiter: 'Juan',
  },
  {
    id: '2',
    tableNumber: '8',
    guestCount: 2,
    items: [
      { name: 'Chuletón', price: 42 },
      { name: 'Sopa de Marisco', price: 18 },
      { name: 'Café Solo x2', price: 8 },
    ],
    subtotal: 68,
    tax: 6.8,
    total: 74.8,
    duration: '52m',
    waiter: 'María',
  },
];

const recentPayments = [
  { id: '1', table: '3', amount: 127.5, method: 'tarjeta', tip: 25, time: 'Hace 10 min' },
  { id: '2', table: '7', amount: 89.0, method: 'efectivo', tip: 15, time: 'Hace 25 min' },
  { id: '3', table: '2', amount: 234.0, method: 'dividido', tip: 40, time: 'Hace 45 min' },
  { id: '4', table: '11', amount: 156.0, method: 'tarjeta', tip: 30, time: 'Hace 1h' },
];

const methodLabels: Record<string, string> = {
  tarjeta: 'Tarjeta',
  efectivo: 'Efectivo',
  dividido: 'Dividido',
};

export default function Payments() {
  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pagos</h1>
          <p className="text-muted-foreground mt-1">Procesa cuentas y controla ingresos</p>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Ingresos de Hoy"
            value="3.247 €"
            icon={<DollarSign className="w-6 h-6" />}
            trend={{ value: 12, isPositive: true }}
          />
          <MetricCard
            title="Total Propinas"
            value="487 €"
            icon={<TrendingUp className="w-6 h-6" />}
            subtitle="Media del 18%"
          />
          <MetricCard
            title="Transacciones"
            value="42"
            icon={<Receipt className="w-6 h-6" />}
            subtitle="32 tarjeta, 10 efectivo"
          />
          <MetricCard
            title="Cuentas Pendientes"
            value="2"
            icon={<CreditCard className="w-6 h-6" />}
            subtitle="Mesas 5 y 8"
          />
        </div>

        {/* Tables Ready for Payment */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Listas para Cerrar</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {tablesReadyForPayment.map((table) => (
              <div key={table.id} className="glass-card p-6 animate-fade-in">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-foreground">Mesa {table.tableNumber}</h3>
                    <p className="text-sm text-muted-foreground">
                      {table.guestCount} comensales • {table.duration} • {table.waiter}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-foreground">{table.total.toFixed(2)} €</p>
                    <p className="text-xs text-muted-foreground">incl. {table.tax.toFixed(2)} € IVA</p>
                  </div>
                </div>

                <div className="space-y-2 mb-4 p-3 rounded-lg bg-secondary/50">
                  {table.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{item.name}</span>
                      <span className="text-foreground">{item.price} €</span>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Button className="flex-1" variant="outline">
                    <Banknote className="w-4 h-4" />
                    Efectivo
                  </Button>
                  <Button className="flex-1">
                    <CreditCard className="w-4 h-4" />
                    Tarjeta
                  </Button>
                  <Button className="flex-1" variant="secondary">
                    <SplitSquareVertical className="w-4 h-4" />
                    Dividir
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Payments */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Transacciones Recientes</h2>
          <div className="glass-card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Mesa</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Importe</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Propina</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Método</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Hora</th>
                  <th className="text-right p-4 text-sm font-medium text-muted-foreground">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {recentPayments.map((payment) => (
                  <tr key={payment.id} className="border-b border-border last:border-0 hover:bg-secondary/30">
                    <td className="p-4">
                      <span className="font-medium text-foreground">Mesa {payment.table}</span>
                    </td>
                    <td className="p-4">
                      <span className="text-foreground">{payment.amount.toFixed(2)} €</span>
                    </td>
                    <td className="p-4">
                      <span className="text-status-available">{payment.tip} €</span>
                    </td>
                    <td className="p-4">
                      <span className="status-badge bg-secondary text-foreground capitalize">
                        {payment.method === 'tarjeta' && <CreditCard className="w-3 h-3" />}
                        {payment.method === 'efectivo' && <Banknote className="w-3 h-3" />}
                        {payment.method === 'dividido' && <SplitSquareVertical className="w-3 h-3" />}
                        {methodLabels[payment.method]}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="text-muted-foreground">{payment.time}</span>
                    </td>
                    <td className="p-4 text-right">
                      <Button size="sm" variant="ghost">
                        <Receipt className="w-4 h-4" />
                        Recibo
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
