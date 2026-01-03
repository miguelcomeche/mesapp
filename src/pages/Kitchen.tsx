import { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useKitchenTickets } from '@/hooks/useKitchenTickets';
import { KitchenTicket, STATUS_LABELS, OrderItemStatus } from '@/types/database';
import { ChefHat, Clock, Play, CheckCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

const courseOrder = ['primeros', 'segundos', 'postres', 'unassigned'] as const;

const statusColors: Record<string, string> = {
  sent: 'border-[hsl(var(--status-occupied))] bg-[hsl(var(--status-occupied)/.1)]',
  preparing: 'border-[hsl(var(--status-attention))] bg-[hsl(var(--status-attention)/.1)]',
  ready: 'border-[hsl(var(--status-available))] bg-[hsl(var(--status-available)/.1)]',
};

const courseColors: Record<string, string> = {
  primeros: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
  segundos: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
  postres: 'bg-purple-500/20 text-purple-400 border-purple-500/50',
  unassigned: 'bg-muted text-muted-foreground',
};

function TicketCard({ 
  ticket, 
  onStatusChange 
}: { 
  ticket: KitchenTicket; 
  onStatusChange: (ticketId: string, status: OrderItemStatus) => void;
}) {
  const tableName = ticket.session?.table?.number || 'Mesa';
  const timeAgo = formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true, locale: es });

  const getNextStatus = (current: OrderItemStatus): OrderItemStatus | null => {
    const progression: Record<string, OrderItemStatus | null> = {
      sent: 'preparing',
      preparing: 'ready',
      ready: 'served',
      served: null,
    };
    return progression[current] || null;
  };

  const nextStatus = getNextStatus(ticket.status);
  const nextStatusLabel = nextStatus ? STATUS_LABELS.orderItem[nextStatus] : null;

  return (
    <Card className={cn(
      'p-4 border-2 transition-all',
      statusColors[ticket.status]
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold">Mesa {tableName}</span>
          {ticket.course && ticket.course !== 'unassigned' && (
            <Badge className={cn('text-xs', courseColors[ticket.course])}>
              {STATUS_LABELS.course[ticket.course]}
            </Badge>
          )}
        </div>
        <Badge variant="outline" className="gap-1">
          <Clock className="h-3 w-3" />
          {timeAgo}
        </Badge>
      </div>

      {/* Items */}
      <div className="space-y-2 mb-4">
        {ticket.items?.map((ticketItem) => {
          const item = ticketItem.order_item;
          if (!item) return null;
          
          return (
            <div key={ticketItem.id} className="flex items-center gap-2 text-sm">
              <span className="font-medium">{item.quantity}x</span>
              <span className="flex-1">{item.menu_item?.name}</span>
              {item.notes && (
                <span className="text-muted-foreground text-xs italic truncate max-w-[150px]">
                  {item.notes}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Status & Action */}
      <div className="flex items-center justify-between">
        <Badge className={cn('text-xs', statusColors[ticket.status])}>
          {STATUS_LABELS.orderItem[ticket.status]}
        </Badge>
        
        {nextStatus && (
          <Button 
            size="sm" 
            onClick={() => onStatusChange(ticket.id, nextStatus)}
            className="gap-2"
          >
            {nextStatus === 'preparing' && <Play className="h-4 w-4" />}
            {nextStatus === 'ready' && <CheckCircle className="h-4 w-4" />}
            {nextStatus === 'served' && <CheckCircle className="h-4 w-4" />}
            {nextStatusLabel}
          </Button>
        )}
      </div>
    </Card>
  );
}

export default function Kitchen() {
  const { restaurantId } = useAuth();
  const { tickets, isLoading, updateTicketStatus } = useKitchenTickets(restaurantId, 'kitchen');
  const [activeTab, setActiveTab] = useState<'all' | 'primeros' | 'segundos' | 'postres'>('all');

  // Group tickets by course
  const groupedTickets = tickets.reduce((acc, ticket) => {
    const course = ticket.course || 'unassigned';
    if (!acc[course]) acc[course] = [];
    acc[course].push(ticket);
    return acc;
  }, {} as Record<string, KitchenTicket[]>);

  const filteredTickets = activeTab === 'all' 
    ? tickets 
    : tickets.filter(t => t.course === activeTab);

  const handleStatusChange = async (ticketId: string, status: OrderItemStatus) => {
    await updateTicketStatus(ticketId, status);
  };

  if (isLoading) {
    return (
      <MainLayout title="Cocina">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Cocina">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <ChefHat className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Cocina</h1>
            <p className="text-muted-foreground">KDS - Kitchen Display System</p>
          </div>
        </div>

        {/* Course Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList>
            <TabsTrigger value="all">
              Todos
              <Badge variant="secondary" className="ml-2">{tickets.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="primeros">
              Primeros
              <Badge variant="secondary" className="ml-2">{groupedTickets.primeros?.length || 0}</Badge>
            </TabsTrigger>
            <TabsTrigger value="segundos">
              Segundos
              <Badge variant="secondary" className="ml-2">{groupedTickets.segundos?.length || 0}</Badge>
            </TabsTrigger>
            <TabsTrigger value="postres">
              Postres
              <Badge variant="secondary" className="ml-2">{groupedTickets.postres?.length || 0}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {filteredTickets.length === 0 ? (
              <Card className="glass-card p-12 text-center">
                <ChefHat className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Sin tickets pendientes</h3>
                <p className="text-muted-foreground">
                  Los nuevos pedidos aparecerán aquí
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredTickets.map((ticket) => (
                  <TicketCard 
                    key={ticket.id} 
                    ticket={ticket} 
                    onStatusChange={handleStatusChange}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
