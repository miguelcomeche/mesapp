import { useState, useRef, useCallback } from 'react';
import { Table, TableStatus } from '@/types/database';
import { FloorPlanTable } from './FloorPlanTable';
import { Button } from '@/components/ui/button';
import { Edit3, Save, X } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface FloorPlanCanvasProps {
  tables: Table[];
  zone: 'Interior' | 'Terraza';
  sessions: { table_id: string; id: string; guest_count: number; started_at: string }[];
  onTableClick: (table: Table) => void;
  onTablesUpdated: () => void;
}

export function FloorPlanCanvas({
  tables,
  zone,
  sessions,
  onTableClick,
  onTablesUpdated,
}: FloorPlanCanvasProps) {
  const { canEditTables } = usePermissions();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [draggedTable, setDraggedTable] = useState<Table | null>(null);
  const [localPositions, setLocalPositions] = useState<Record<string, { x: number; y: number }>>({});
  const canvasRef = useRef<HTMLDivElement>(null);

  // Filter tables for this zone
  const zoneTables = tables.filter(t => t.section === zone);

  // Define default positions for tables without positions
  const getDefaultPosition = (table: Table, index: number) => {
    const cols = zone === 'Interior' ? 5 : 5;
    const spacing = zone === 'Interior' ? 100 : 110;
    const startX = 50;
    const startY = 50;
    
    const row = Math.floor(index / cols);
    const col = index % cols;
    
    return {
      x: startX + col * spacing,
      y: startY + row * spacing,
    };
  };

  const getTablePosition = (table: Table, index: number) => {
    // Check local positions first (during editing)
    if (localPositions[table.id]) {
      return localPositions[table.id];
    }
    // Use saved positions or calculate default
    if (table.position_x != null && table.position_y != null) {
      return { x: table.position_x, y: table.position_y };
    }
    return getDefaultPosition(table, index);
  };

  const getSessionInfo = (tableId: string) => {
    const session = sessions.find(s => s.table_id === tableId);
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
      sessionId: session.id,
    };
  };

  const handleDragStart = (e: React.DragEvent, table: Table) => {
    setDraggedTable(table);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedTable || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left - 40, rect.width - 80));
    const y = Math.max(0, Math.min(e.clientY - rect.top - 40, rect.height - 80));

    setLocalPositions(prev => ({
      ...prev,
      [draggedTable.id]: { x: Math.round(x), y: Math.round(y) },
    }));
    setDraggedTable(null);
  }, [draggedTable]);

  const handleSave = async () => {
    const updates = Object.entries(localPositions).map(([id, pos]) => 
      supabase
        .from('tables')
        .update({ position_x: pos.x, position_y: pos.y })
        .eq('id', id)
    );

    try {
      await Promise.all(updates);
      toast({ title: 'Plano guardado', description: 'Las posiciones se han guardado correctamente.' });
      setIsEditing(false);
      setLocalPositions({});
      onTablesUpdated();
    } catch (error) {
      toast({ title: 'Error al guardar', description: 'No se pudieron guardar las posiciones.', variant: 'destructive' });
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setLocalPositions({});
    setDraggedTable(null);
  };

  // Compute canvas dimensions based on table positions
  const computedWidth = Math.max(
    600,
    ...zoneTables.map((t, i) => {
      const pos = getTablePosition(t, i);
      return pos.x + 100;
    })
  );
  const computedHeight = Math.max(
    400,
    ...zoneTables.map((t, i) => {
      const pos = getTablePosition(t, i);
      return pos.y + 100;
    })
  );

  return (
    <div className="space-y-4">
      {/* Edit Controls */}
      {canEditTables && (
        <div className="flex items-center justify-end gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" size="sm" onClick={handleCancel}>
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSave}>
                <Save className="w-4 h-4 mr-2" />
                Guardar plano
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Edit3 className="w-4 h-4 mr-2" />
              Editar plano
            </Button>
          )}
        </div>
      )}

      {/* Canvas */}
      <div 
        className="relative overflow-auto rounded-xl border border-border bg-card/50"
        style={{ maxHeight: '70vh' }}
      >
        <div
          ref={canvasRef}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className="relative"
          style={{ 
            width: `${computedWidth}px`, 
            height: `${computedHeight}px`,
            minWidth: '100%',
            backgroundImage: 'radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        >
          {/* Bar/Separation Block for Interior */}
          {zone === 'Interior' && (
            <div 
              className="absolute rounded-lg bg-muted/50 border border-border flex items-center justify-center"
              style={{
                left: '200px',
                top: '100px',
                width: '150px',
                height: '40px',
              }}
            >
              <span className="text-xs text-muted-foreground font-medium">BARRA</span>
            </div>
          )}

          {/* Tables */}
          {zoneTables.map((table, index) => {
            const position = getTablePosition(table, index);
            const isAuxiliary = table.number.startsWith('VD');
            const tableWithPosition = {
              ...table,
              position_x: position.x,
              position_y: position.y,
            };

            return (
              <FloorPlanTable
                key={table.id}
                table={tableWithPosition}
                sessionInfo={getSessionInfo(table.id)}
                isEditing={isEditing}
                isAuxiliary={isAuxiliary}
                onClick={() => !isEditing && onTableClick(table)}
                onDragStart={(e) => handleDragStart(e, table)}
              />
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-[hsl(var(--status-available)/.5)] border border-[hsl(var(--status-available))]" />
          <span className="text-muted-foreground">Disponible</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-[hsl(var(--status-occupied)/.5)] border border-[hsl(var(--status-occupied))]" />
          <span className="text-muted-foreground">Ocupada</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-[hsl(var(--status-reserved)/.5)] border border-[hsl(var(--status-reserved))]" />
          <span className="text-muted-foreground">Reservada</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-[hsl(var(--status-attention)/.5)] border border-[hsl(var(--status-attention))]" />
          <span className="text-muted-foreground">Atención</span>
        </div>
      </div>

      {isEditing && (
        <p className="text-sm text-muted-foreground">
          Arrastra las mesas para reorganizar el plano. Haz clic en "Guardar plano" cuando termines.
        </p>
      )}
    </div>
  );
}
