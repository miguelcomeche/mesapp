import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useTableSessions, usePayments } from '@/hooks/useRestaurantData';
import { supabase } from '@/integrations/supabase/client';
import { STATUS_LABELS } from '@/types/database';
import { useToast } from '@/hooks/use-toast';
import {
  CreditCard,
  Banknote,
  SplitSquareVertical,
  Receipt,
  DollarSign,
  TrendingUp,
  Loader2,
} from 'lucide-react';
import { MetricCard } from '@/components/dashboard/MetricCard';

export default function Payments() {
  const navigate = useNavigate();
  const { restaurantId } = useAuth();
  const { toast } = useToast();
  
  const { sessions } = useTableSessions(restaurantId);
  const { payments, isLoading, createPayment, fetchPayments } = usePayments();

  // Get sessions that are ready for billing (active with orders)
  const sessionsReadyForPayment = sessions.filter(s => s.status === 'active' && Number(s.total_amount) > 0);
  
  // Calculate today's metrics
  const todayPayments = payments.filter(p => 
    new Date(p.processed_at).toDateString() === new Date().toDateString()
  );
  const todayRevenue = todayPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const todayTips = todayPayments.reduce((sum, p) => sum + Number(p.tip || 0), 0);
  const cardPayments = todayPayments.filter(p => p.method === 'card').length;
  const cashPayments = todayPayments.filter(p => p.method === 'cash').length;

  const handleQuickPayment = async (sessionId: string, amount: number, method: 'cash' | 'card') => {
    const payment = await createPayment(sessionId, amount, method);
    if (payment) {
      // Check if fully paid, then close session
      const session = sessions.find(s => s.id === sessionId);
      if (session) {
        // Get all payments for this session
        const { data: sessionPayments } = await supabase
          .from('payments')
          .select('amount')
          .eq('session_id', sessionId);
        
        const totalPaid = sessionPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
        
        if (totalPaid >= Number(session.total_amount)) {
          // Close the session
          await supabase
            .from('table_sessions')
            .update({ status: 'closed', closed_at: new Date().toISOString() })
            .eq('id', sessionId);
          
          // Mark table as available
          await supabase
            .from('tables')
            .update({ status: 'available' })
            .eq('id', session.table_id);
          
          // Complete reservation if exists
          if (session.reservation_id) {
            await supabase
              .from('reservations')
              .update({ status: 'completed' })
              .eq('id', session.reservation_id);
          }
          
          toast({ title: 'Mesa cerrada', description: 'El servicio ha sido cerrado correctamente.' });
        }
      }
    }
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
            value={`${todayRevenue.toFixed(0)} €`}
            icon={<DollarSign className="w-6 h-6" />}
          />
          <MetricCard
            title="Total Propinas"
            value={`${todayTips.toFixed(0)} €`}
            icon={<TrendingUp className="w-6 h-6" />}
          />
          <MetricCard
            title="Transacciones"
            value={todayPayments.length.toString()}
            icon={<Receipt className="w-6 h-6" />}
            subtitle={`${cardPayments} tarjeta, ${cashPayments} efectivo`}
          />
          <MetricCard
            title="Cuentas Pendientes"
            value={sessionsReadyForPayment.length.toString()}
            icon={<CreditCard className="w-6 h-6" />}
          />
        </div>

        {/* Tables Ready for Payment */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Listas para Cerrar</h2>
          
          {sessionsReadyForPayment.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <CreditCard className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No hay mesas pendientes de pago</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {sessionsReadyForPayment.map((session) => {
                const start = new Date(session.started_at);
                const now = new Date();
                const diffMins = Math.floor((now.getTime() - start.getTime()) / 60000);
                const hours = Math.floor(diffMins / 60);
                const mins = diffMins % 60;
                const duration = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
                
                return (
                  <div 
                    key={session.id} 
                    className="glass-card p-6 animate-fade-in cursor-pointer hover:border-primary/30 transition-all"
                    onClick={() => navigate(`/session/${session.id}`)}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-foreground">
                          Mesa {session.table?.number || '?'}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {session.guest_count} comensales • {duration}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-foreground">
                          {Number(session.total_amount).toFixed(2)} €
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button 
                        className="flex-1" 
                        variant="outline"
                        onClick={() => handleQuickPayment(session.id, Number(session.total_amount), 'cash')}
                      >
                        <Banknote className="w-4 h-4" />
                        Efectivo
                      </Button>
                      <Button 
                        className="flex-1"
                        onClick={() => handleQuickPayment(session.id, Number(session.total_amount), 'card')}
                      >
                        <CreditCard className="w-4 h-4" />
                        Tarjeta
                      </Button>
                      <Button 
                        className="flex-1" 
                        variant="secondary"
                        onClick={() => navigate(`/session/${session.id}`)}
                      >
                        <SplitSquareVertical className="w-4 h-4" />
                        Dividir
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Payments */}
        {todayPayments.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Transacciones Recientes</h2>
            <div className="glass-card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Importe</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Propina</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Método</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Hora</th>
                  </tr>
                </thead>
                <tbody>
                  {todayPayments.slice(0, 10).map((payment) => (
                    <tr key={payment.id} className="border-b border-border last:border-0 hover:bg-secondary/30">
                      <td className="p-4">
                        <span className="text-foreground font-medium">{Number(payment.amount).toFixed(2)} €</span>
                      </td>
                      <td className="p-4">
                        <span className="text-status-available">
                          {payment.tip ? `${Number(payment.tip).toFixed(2)} €` : '-'}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="status-badge bg-secondary text-foreground capitalize">
                          {payment.method === 'card' && <CreditCard className="w-3 h-3" />}
                          {payment.method === 'cash' && <Banknote className="w-3 h-3" />}
                          {payment.method === 'split' && <SplitSquareVertical className="w-3 h-3" />}
                          {STATUS_LABELS.payment[payment.method]}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-muted-foreground">
                          {new Date(payment.processed_at).toLocaleTimeString('es-ES', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
