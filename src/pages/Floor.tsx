import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { TableCard } from '@/components/tables/TableCard';
import { Button } from '@/components/ui/button';
import { Table, TableStatus } from '@/types';
import { cn } from '@/lib/utils';
import {
  LayoutGrid,
  Map,
  Plus,
  Filter,
  Search,
} from 'lucide-react';
import { Input } from '@/components/ui/input';

// Mock data
const mockTables: Table[] = [
  { id: '1', number: '1', capacity: 4, status: 'occupied', section: 'Sala Principal', restaurantId: 'rest-1' },
  { id: '2', number: '2', capacity: 2, status: 'available', section: 'Sala Principal', restaurantId: 'rest-1' },
  { id: '3', number: '3', capacity: 6, status: 'reserved', section: 'Sala Principal', restaurantId: 'rest-1' },
  { id: '4', number: '4', capacity: 4, status: 'needs_attention', section: 'Sala Principal', restaurantId: 'rest-1' },
  { id: '5', number: '5', capacity: 8, status: 'occupied', section: 'Sala Principal', restaurantId: 'rest-1' },
  { id: '6', number: '6', capacity: 2, status: 'available', section: 'Barra', restaurantId: 'rest-1' },
  { id: '7', number: '7', capacity: 4, status: 'available', section: 'Barra', restaurantId: 'rest-1' },
  { id: '8', number: '8', capacity: 2, status: 'occupied', section: 'Barra', restaurantId: 'rest-1' },
  { id: '9', number: 'T1', capacity: 6, status: 'available', section: 'Terraza', restaurantId: 'rest-1' },
  { id: '10', number: 'T2', capacity: 4, status: 'reserved', section: 'Terraza', restaurantId: 'rest-1' },
  { id: '11', number: 'T3', capacity: 8, status: 'available', section: 'Terraza', restaurantId: 'rest-1' },
  { id: '12', number: 'P1', capacity: 12, status: 'occupied', section: 'Sala Privada', restaurantId: 'rest-1' },
];

const mockSessionInfo: Record<string, { guestCount: number; duration: string; waiter: string }> = {
  '1': { guestCount: 3, duration: '45m', waiter: 'Juan' },
  '4': { guestCount: 4, duration: '1h 12m', waiter: 'María' },
  '5': { guestCount: 6, duration: '28m', waiter: 'Juan' },
  '8': { guestCount: 2, duration: '15m', waiter: 'Sara' },
  '12': { guestCount: 10, duration: '1h 45m', waiter: 'María' },
};

const sections = ['Todas', 'Sala Principal', 'Barra', 'Terraza', 'Sala Privada'];
const statusFilters: { label: string; value: TableStatus | 'all' }[] = [
  { label: 'Todas', value: 'all' },
  { label: 'Disponibles', value: 'available' },
  { label: 'Ocupadas', value: 'occupied' },
  { label: 'Reservadas', value: 'reserved' },
  { label: 'Requieren Atención', value: 'needs_attention' },
];

export default function Floor() {
  const [view, setView] = useState<'grid' | 'map'>('grid');
  const [activeSection, setActiveSection] = useState('Todas');
  const [activeStatus, setActiveStatus] = useState<TableStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTables = mockTables.filter((table) => {
    const matchesSection = activeSection === 'Todas' || table.section === activeSection;
    const matchesStatus = activeStatus === 'all' || table.status === activeStatus;
    const matchesSearch = table.number.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSection && matchesStatus && matchesSearch;
  });

  const getStatusCounts = () => {
    return {
      available: mockTables.filter((t) => t.status === 'available').length,
      occupied: mockTables.filter((t) => t.status === 'occupied').length,
      reserved: mockTables.filter((t) => t.status === 'reserved').length,
      needs_attention: mockTables.filter((t) => t.status === 'needs_attention').length,
    };
  };

  const counts = getStatusCounts();

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
            <Button>
              <Plus className="w-4 h-4" />
              Añadir Mesa
            </Button>
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
          {sections.map((section) => (
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredTables.map((table) => (
              <TableCard
                key={table.id}
                table={table}
                sessionInfo={mockSessionInfo[table.id]}
                onClick={() => console.log('Open table', table.id)}
              />
            ))}
          </div>
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

        {filteredTables.length === 0 && (
          <div className="text-center py-12">
            <Filter className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No se encontraron mesas</h3>
            <p className="text-muted-foreground">Prueba a ajustar los filtros</p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
