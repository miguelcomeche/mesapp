import { useState, useRef, useCallback } from 'react';
import { Table, TableStatus } from '@/types/database';
import { FloorPlanTable } from './FloorPlanTable';
import { Button } from '@/components/ui/button';
import { Edit3, Save, X, Plus, Trash2, Copy, Minus, Type, Square, Sparkles, Wine } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useFloorPlanElements } from '@/hooks/useFloorPlanElements';
import { FloorElement } from './FloorElement';
import { AddTableDialog } from './AddTableDialog';
import { FloorElementType } from '@/types/database';

interface FloorPlanCanvasProps {
  tables: Table[];
  zone: string;
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
  const { restaurantId } = useAuth();
  const { elements, createElement, updateElement, removeElement, duplicateElement } = useFloorPlanElements(restaurantId);
  const [isEditing, setIsEditing] = useState(false);
  const [draggedTable, setDraggedTable] = useState<Table | null>(null);
  const [draggedElementId, setDraggedElementId] = useState<string | null>(null);
  const [localPositions, setLocalPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [localElementPositions, setLocalElementPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [selection, setSelection] = useState<{ kind: 'element' | 'table'; id: string } | null>(null);
  const [showAddTable, setShowAddTable] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Filter tables for this zone
  const zoneTables = tables.filter(t => t.section === zone);
  const zoneElements = elements.filter((e) => e.zone === zone);

  // Define default positions for tables without positions
  const getDefaultPosition = (table: Table, index: number) => {
    const cols = 5;
    const spacing = 100;
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
    setDraggedElementId(null);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleElementDragStart = (e: React.DragEvent, id: string) => {
    setDraggedElementId(id);
    setDraggedTable(null);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(0, e.clientX - rect.left - 40);
    const y = Math.max(0, e.clientY - rect.top - 40);

    if (draggedTable) {
      setLocalPositions((prev) => ({ ...prev, [draggedTable.id]: { x: Math.round(x), y: Math.round(y) } }));
      setDraggedTable(null);
    } else if (draggedElementId) {
      setLocalElementPositions((prev) => ({ ...prev, [draggedElementId]: { x: Math.round(x), y: Math.round(y) } }));
      setDraggedElementId(null);
    }
  }, [draggedTable, draggedElementId]);

  const handleSave = async () => {
    const updates = Object.entries(localPositions).map(([id, pos]) => 
      supabase
        .from('tables')
        .update({ position_x: pos.x, position_y: pos.y })
        .eq('id', id)
    );
    const elementUpdates = Object.entries(localElementPositions).map(([id, pos]) =>
      updateElement(id, { x: pos.x, y: pos.y })
    );

    try {
      await Promise.all([...updates, ...elementUpdates]);
      toast({ title: 'Plano guardado', description: 'Las posiciones se han guardado correctamente.' });
      setIsEditing(false);
      setLocalPositions({});
      setLocalElementPositions({});
      setSelection(null);
      onTablesUpdated();
    } catch (error) {
      toast({ title: 'Error al guardar', description: 'No se pudieron guardar las posiciones.', variant: 'destructive' });
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setLocalPositions({});
    setLocalElementPositions({});
    setDraggedTable(null);
    setDraggedElementId(null);
    setSelection(null);
  };

  const handleAddElement = async (type: FloorElementType) => {
    await createElement({ type, zone });
  };

  const handleAddTable = async ({ number, capacity }: { number: string; capacity: number }) => {
    if (!restaurantId) return;
    const { error } = await supabase.from('tables').insert({
      restaurant_id: restaurantId,
      number,
      capacity,
      section: zone,
      status: 'available',
      position_x: 100,
      position_y: 100,
    });
    if (error) {
      toast({ title: 'Error al crear mesa', description: error.message, variant: 'destructive' });
      return;
    }
    onTablesUpdated();
  };

  const handleDeleteSelection = async () => {
    if (!selection) return;
    if (selection.kind === 'element') {
      await removeElement(selection.id);
    } else {
      const { error } = await supabase.from('tables').delete().eq('id', selection.id);
      if (error) {
        toast({ title: 'Error al eliminar mesa', description: error.message, variant: 'destructive' });
        return;
      }
      onTablesUpdated();
    }
    setSelection(null);
  };

  const handleDuplicateSelection = async () => {
    if (!selection || selection.kind !== 'element') return;
    await duplicateElement(selection.id);
  };

  // Compute canvas dimensions based on table positions
  const computedWidth = Math.max(
    600,
    ...zoneTables.map((t, i) => {
      const pos = getTablePosition(t, i);
      return pos.x + 100;
    }),
    ...zoneElements.map((el) => (localElementPositions[el.id]?.x ?? el.x) + el.width + 40)
  );
  const computedHeight = Math.max(
    400,
    ...zoneTables.map((t, i) => {
      const pos = getTablePosition(t, i);
      return pos.y + 100;
    }),
    ...zoneElements.map((el) => (localElementPositions[el.id]?.y ?? el.y) + el.height + 40)
  );

  const isEmpty = zoneTables.length === 0 && zoneElements.length === 0;

  return (
    <div className="space-y-4">
      {/* Edit Controls */}
      {canEditTables && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setShowAddTable(true)}>
                <Plus className="w-4 h-4 mr-1" /> Añadir mesa
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleAddElement('bar')}>
                <Wine className="w-4 h-4 mr-1" /> Añadir barra
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleAddElement('wall')}>
                <Minus className="w-4 h-4 mr-1" /> Añadir pared
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleAddElement('separator')}>
                <Minus className="w-4 h-4 mr-1" /> Añadir separador
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleAddElement('text')}>
                <Type className="w-4 h-4 mr-1" /> Añadir texto
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleAddElement('zone_block')}>
                <Square className="w-4 h-4 mr-1" /> Añadir zona
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleAddElement('decoration')}>
                <Sparkles className="w-4 h-4 mr-1" /> Decoración
              </Button>
              <Button variant="outline" size="sm" onClick={handleDuplicateSelection} disabled={!selection || selection.kind !== 'element'}>
                <Copy className="w-4 h-4 mr-1" /> Duplicar
              </Button>
              <Button variant="destructive" size="sm" onClick={handleDeleteSelection} disabled={!selection}>
                <Trash2 className="w-4 h-4 mr-1" /> Eliminar
              </Button>
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

      {isEmpty && (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
          El plano está vacío. Pulsa "Editar plano" para añadir mesas y elementos.
        </div>
      )}

      {/* Canvas */}
      {!isEmpty && (
      <div 
        className="relative overflow-auto rounded-xl border border-border bg-card/50"
        style={{ maxHeight: '70vh' }}
      >
        <div
          ref={canvasRef}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => isEditing && setSelection(null)}
          className="relative"
          style={{ 
            width: `${computedWidth}px`, 
            height: `${computedHeight}px`,
            minWidth: '100%',
            backgroundImage: 'radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        >
          {/* Visual elements */}
          {zoneElements.map((el) => {
            const pos = localElementPositions[el.id];
            const rendered = pos ? { ...el, x: pos.x, y: pos.y } : el;
            return (
              <FloorElement
                key={el.id}
                element={rendered}
                isEditing={isEditing}
                isSelected={selection?.kind === 'element' && selection.id === el.id}
                onSelect={() => setSelection({ kind: 'element', id: el.id })}
                onDragStart={(e) => handleElementDragStart(e, el.id)}
              />
            );
          })}

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
                onClick={() => {
                  if (isEditing) {
                    setSelection({ kind: 'table', id: table.id });
                  } else {
                    onTableClick(table);
                  }
                }}
                onDragStart={(e) => handleDragStart(e, table)}
              />
            );
          })}
        </div>
      </div>
      )}

      {/* Legend */}
      {!isEmpty && (
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
      )}

      {isEditing && (
        <p className="text-sm text-muted-foreground">
          Arrastra mesas y elementos para reorganizar el plano. Haz clic en un elemento para seleccionarlo y luego duplica o elimina. Pulsa "Guardar plano" cuando termines.
        </p>
      )}

      <AddTableDialog
        open={showAddTable}
        onOpenChange={setShowAddTable}
        zone={zone}
        onConfirm={handleAddTable}
      />
    </div>
  );
}
