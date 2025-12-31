import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { TableCard } from '@/components/tables/TableCard';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useTables, useTableSessions } from '@/hooks/useRestaurantData';
import { Table, TableStatus, STATUS_LABELS } from '@/types/database';
import { cn } from '@/lib/utils';
import {
  LayoutGrid,
  Map,
  Plus,
  Filter,
  Search,
  Loader2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import OpenTableDialog from '@/components/floor/OpenTableDialog';

const sections = ['Todas', 'Sala Principal', 'Barra', 'Terraza', 'Sala Privada', 'Principal'];
const statusFilters: { label: string; value: TableStatus | 'all' }[] = [
  { label: 'Todas', value: 'all' },
  { label: 'Disponibles', value: 'available' },
  { label: 'Ocupadas', value: 'occupied' },
  { label: 'Reservadas', value: 'reserved' },
  { label: 'Atención', value: 'needs_attention' },
];

export default function Floor() {
  const navigate = useNavigate();
  const { user, restaurantId } = useAuth();
  
  const { tables, isLoading: tablesLoading } = useTables(restaurantId);
  const { sessions, createSession } = useTableSessions(restaurantId);
  
  const [view, setView] = useState<'grid' | 'map'>('grid');
  const [activeSection, setActiveSection] = useState('Todas');
  const [activeStatus, setActiveStatus] = useState<TableStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [showOpenDialog, setShowOpenDialog] = useState(false);

  // Get unique sections from tables
  const availableSections = ['Todas', ...new Set(tables.map(t => t.section))];

  const filteredTables = tables.filter((table) => {
    const matchesSection = activeSection === 'Todas' || table.section === activeSection;
    const matchesStatus = activeStatus === 'all' || table.status === activeStatus;
    const matchesSearch = table.number.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSection && matchesStatus && matchesSearch;
  });

  const getStatusCounts = () => {
    return {
      available: tables.filter((t) => t.status === 'available').length,
      occupied: tables.filter((t) => t.status === 'occupied').length,
      reserved: tables.filter((t) => t.status === 'reserved').length,
      needs_attention: tables.filter((t) => t.status === 'needs_attention').length,
    };
  };

  const counts = getStatusCounts();

  // Get session info for a table
  const getSessionInfo = (tableId: string) => {
    const session = sessions.find(s => s.table_id === tableId && s.status === 'active');
    if (!session) return undefined;
    
    const start = new Date(session.started_at);
    const now = new Date();
    const diffMins = Math.floor((now.getTime() - start.getTime()) / 60000);
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    const duration = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    
    return {
      guestCount: session.guest_count,
      duration,
      waiter: 'Camarero',
      sessionId: session.id,
    };
  };

  const handleTableClick = (table: Table) => {
    const sessionInfo = getSessionInfo(table.id);
    
    if (sessionInfo?.sessionId) {
      // Table has active session - navigate to it
      navigate(`/session/${sessionInfo.sessionId}`);
    } else if (table.status === 'available') {
      // Available table - show open dialog
      setSelectedTable(table);
      setShowOpenDialog(true);
    }
  };

  const handleOpenTable = async (guestCount: number) => {
    if (!selectedTable) return;
    
    const session = await createSession(
      selectedTable.id,
      guestCount,
      user?.id || null
    );
    
    setShowOpenDialog(false);
    setSelectedTable(null);
    
    if (session) {
      navigate(`/session/${session.id}`);
    }
  };

  if (tablesLoading) {
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
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Plano de Sala</h1>
            <p className="text-muted-foreground mt-1">Gestiona mesas y asientos</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar mesas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-48"
              />
            </div>
            <div className="flex bg-secondary rounded-lg p-1">
              <Button
                variant={view === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setView('grid')}
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button
                variant={view === 'map' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setView('map')}
              >
                <Map className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Status Summary */}
        <div className="flex flex-wrap gap-3">
          {statusFilters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setActiveStatus(filter.value)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                activeStatus === filter.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              )}
            >
              {filter.label}
              {filter.value !== 'all' && (
                <span className="ml-2 text-xs opacity-75">
                  ({counts[filter.value as TableStatus]})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Section Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {availableSections.map((section) => (
            <button
              key={section}
              onClick={() => setActiveSection(section)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all',
                activeSection === section
                  ? 'bg-card text-foreground border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {section}
            </button>
          ))}
        </div>

        {/* Tables Grid */}
        {view === 'grid' ? (
          tables.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <LayoutGrid className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No hay mesas configuradas</h3>
              <p className="text-muted-foreground mb-6">
                Añade mesas para empezar a gestionar tu restaurante
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredTables.map((table) => (
                <TableCard
                  key={table.id}
                  table={table}
                  sessionInfo={getSessionInfo(table.id)}
                  onClick={() => handleTableClick(table)}
                />
              ))}
            </div>
          )
        ) : (
          <div className="glass-card p-8 min-h-[500px] flex items-center justify-center">
            <div className="text-center">
              <Map className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Vista de Mapa</h3>
              <p className="text-muted-foreground max-w-md">
                Arrastra y suelta las mesas para organizar tu plano de sala. Representación visual próximamente.
              </p>
            </div>
          </div>
        )}

        {filteredTables.length === 0 && tables.length > 0 && (
          <div className="text-center py-12">
            <Filter className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No se encontraron mesas</h3>
            <p className="text-muted-foreground">Prueba a ajustar los filtros</p>
          </div>
        )}
      </div>

      {/* Open Table Dialog */}
      <OpenTableDialog
        open={showOpenDialog}
        onOpenChange={setShowOpenDialog}
        table={selectedTable}
        onConfirm={handleOpenTable}
      />
    </MainLayout>
  );
}
