import { useState, useMemo } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useKitchenTickets } from '@/hooks/useKitchenTickets';
import { useCategorySettings } from '@/hooks/useCategorySettings';
import { useProductionStations } from '@/hooks/useProductionStations';
import { KitchenTicket, STATUS_LABELS, OrderItemStatus } from '@/types/database';
import { ChefHat, Clock, Play, CheckCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

const statusColors: Record<string, string> = {
  sent: 'border-[hsl(var(--status-occupied))] bg-[hsl(var(--status-occupied)/.1)]',
  preparing: 'border-[hsl(var(--status-attention))] bg-[hsl(var(--status-attention)/.1)]',
  ready: 'border-[hsl(var(--status-available))] bg-[hsl(var(--status-available)/.1)]',
};

function TicketCard({ 
  ticket, 
  onStatusChange,
  categoryToStationName,
}: { 
  ticket: KitchenTicket; 
  onStatusChange: (ticketId: string, status: OrderItemStatus) => void;
  categoryToStationName: (category: string | null | undefined) => string | null;
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

  // Group items by their real category
  const itemsByCategory = (ticket.items || []).reduce((acc, ti) => {
    const cat = ti.order_item?.menu_item?.category || 'Sin categoría';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(ti);
    return acc;
  }, {} as Record<string, NonNullable<KitchenTicket['items']>>);

  return (
    <Card className={cn(
      'p-4 border-2 transition-all',
      statusColors[ticket.status]
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-lg font-bold">Mesa {tableName}</span>
        <Badge variant="outline" className="gap-1">
          <Clock className="h-3 w-3" />
          {timeAgo}
        </Badge>
      </div>

      {/* Items grouped by real category */}
      <div className="space-y-3 mb-4">
        {Object.entries(itemsByCategory).map(([category, items]) => {
          const stationName = categoryToStationName(category);
          return (
            <div key={category} className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="text-xs">{category}</Badge>
                {stationName && (
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Partida: {stationName}
                  </span>
                )}
              </div>
              {items.map((ticketItem) => {
                const item = ticketItem.order_item;
                if (!item) return null;
                return (
                  <div key={ticketItem.id} className="flex items-center gap-2 text-sm pl-1">
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
  const { settings: categorySettings } = useCategorySettings(restaurantId);
  const { stations } = useProductionStations(restaurantId);
  const [activeTab, setActiveTab] = useState<string>('all');

  // Map category name -> station name (from active restaurant config)
  const categoryToStationName = useMemo(() => {
    const stationById = new Map(stations.map(s => [s.id, s.name]));
    const byCategory = new Map<string, string>();
    for (const cs of categorySettings) {
      if (cs.production_station_id) {
        const name = stationById.get(cs.production_station_id);
        if (name) byCategory.set(cs.category_name, name);
      }
    }
    return (category: string | null | undefined) =>
      category ? byCategory.get(category) ?? null : null;
  }, [categorySettings, stations]);

  // Dynamic categories present in current tickets
  const categoriesInTickets = useMemo(() => {
    const set = new Set<string>();
    for (const t of tickets) {
      for (const ti of t.items || []) {
        const cat = ti.order_item?.menu_item?.category;
        if (cat) set.add(cat);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [tickets]);

  const countByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of tickets) {
      const cats = new Set<string>();
      for (const ti of t.items || []) {
        const cat = ti.order_item?.menu_item?.category;
        if (cat) cats.add(cat);
      }
      for (const c of cats) counts[c] = (counts[c] || 0) + 1;
    }
    return counts;
  }, [tickets]);

  const filteredTickets = activeTab === 'all'
    ? tickets
    : tickets.filter(t => (t.items || []).some(ti => ti.order_item?.menu_item?.category === activeTab));

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

        {/* Dynamic Category Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="all">
              Todos
              <Badge variant="secondary" className="ml-2">{tickets.length}</Badge>
            </TabsTrigger>
            {categoriesInTickets.map((cat) => (
              <TabsTrigger key={cat} value={cat}>
                {cat}
                <Badge variant="secondary" className="ml-2">{countByCategory[cat] || 0}</Badge>
              </TabsTrigger>
            ))}
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
                    categoryToStationName={categoryToStationName}
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
