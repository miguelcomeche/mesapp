import { useMemo, useState, useRef, useCallback } from 'react';
import { Table, TableGroup } from '@/types/database';
import { FloorPlanTable } from './FloorPlanTable';
import { Button } from '@/components/ui/button';
import {
  Edit3, Save, X, Plus, Trash2, Copy, Minus, Type, Square, Sparkles, Wine,
  RotateCw, RotateCcw, Combine, Split,
} from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useFloorPlanElements } from '@/hooks/useFloorPlanElements';
import { useTableGroups } from '@/hooks/useTableGroups';
import { FloorElement } from './FloorElement';
import { AddTableDialog } from './AddTableDialog';
import { FloorElementType } from '@/types/database';
import { TransformState } from './TransformControls';

interface FloorPlanCanvasProps {
  tables: Table[];
  zone: string;
  sessions: { table_id: string; id: string; guest_count: number; started_at: string; group_id?: string | null }[];
  onTableClick: (table: Table, group?: TableGroup | null) => void;
  onTablesUpdated: () => void;
}

type SelKind = 'element' | 'table';
interface SelItem { kind: SelKind; id: string; }

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
  const { groups, combine, split } = useTableGroups(restaurantId);
  const [isEditing, setIsEditing] = useState(false);
  const [draggedTable, setDraggedTable] = useState<Table | null>(null);
  const [draggedElementId, setDraggedElementId] = useState<string | null>(null);
  const [localTableRects, setLocalTableRects] = useState<Record<string, Partial<TransformState>>>({});
  const [localElementRects, setLocalElementRects] = useState<Record<string, Partial<TransformState>>>({});
  const [selection, setSelection] = useState<SelItem[]>([]);
  const [showAddTable, setShowAddTable] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Filter tables for this zone
  const zoneTables = tables.filter(t => t.section === zone);
  const zoneElements = elements.filter((e) => e.zone === zone);
  const zoneGroups = groups.filter((g) => (g.zone ?? zone) === zone || zoneTables.some(t => t.group_id === g.id));

  const groupById = useMemo(() => new Map(zoneGroups.map(g => [g.id, g] as const)), [zoneGroups]);
  const isMultiSelect = selection.length > 1;
  const selectedIds = useMemo(() => new Set(selection.map(s => `${s.kind}:${s.id}`)), [selection]);
  const isSelected = (kind: SelKind, id: string) => selectedIds.has(`${kind}:${id}`);

  const toggleSelection = (item: SelItem, additive: boolean) => {
    setSelection((prev) => {
      const key = `${item.kind}:${item.id}`;
      const exists = prev.some(s => `${s.kind}:${s.id}` === key);
      if (additive) {
        return exists ? prev.filter(s => `${s.kind}:${s.id}` !== key) : [...prev, item];
      }
      return [item];
    });
  };

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

  const getTableRect = (table: Table, index: number) => {
    const base = {
      x: table.position_x ?? getDefaultPosition(table, index).x,
      y: table.position_y ?? getDefaultPosition(table, index).y,
      width: table.width ?? 80,
      height: table.height ?? 80,
      rotation: table.rotation ?? 0,
    };
    return { ...base, ...(localTableRects[table.id] || {}) };
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

  const getGroupSessionInfo = (groupId: string) => {
    const session = sessions.find(s => s.group_id === groupId);
    if (!session) return undefined;
    const start = new Date(session.started_at);
    const now = new Date();
    const diffMins = Math.floor((now.getTime() - start.getTime()) / 60000);
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    const duration = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    return { guestCount: session.guest_count, duration, sessionId: session.id };
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
      setLocalTableRects((prev) => ({
        ...prev,
        [draggedTable.id]: { ...prev[draggedTable.id], x: Math.round(x), y: Math.round(y) },
      }));
      setDraggedTable(null);
    } else if (draggedElementId) {
      setLocalElementRects((prev) => ({
        ...prev,
        [draggedElementId]: { ...prev[draggedElementId], x: Math.round(x), y: Math.round(y) },
      }));
      setDraggedElementId(null);
    }
  }, [draggedTable, draggedElementId]);

  const handleSave = async () => {
    const updates = Object.entries(localTableRects).map(([id, patch]) =>
      supabase
        .from('tables')
        .update({
          ...(patch.x != null ? { position_x: patch.x } : {}),
          ...(patch.y != null ? { position_y: patch.y } : {}),
          ...(patch.width != null ? { width: patch.width } : {}),
          ...(patch.height != null ? { height: patch.height } : {}),
          ...(patch.rotation != null ? { rotation: patch.rotation } : {}),
        } as any)
        .eq('id', id)
    );
    const elementUpdates = Object.entries(localElementRects).map(([id, patch]) =>
      updateElement(id, patch as any)
    );

    try {
      await Promise.all([...updates, ...elementUpdates]);
      toast({ title: 'Plano guardado', description: 'Las posiciones se han guardado correctamente.' });
      setIsEditing(false);
      setLocalTableRects({});
      setLocalElementRects({});
      setSelection([]);
      onTablesUpdated();
    } catch (error) {
      toast({ title: 'Error al guardar', description: 'No se pudieron guardar las posiciones.', variant: 'destructive' });
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setLocalTableRects({});
    setLocalElementRects({});
    setDraggedTable(null);
    setDraggedElementId(null);
    setSelection([]);
  };

  const handleAddElement = async (type: FloorElementType) => {
    await createElement({ type, zone });
  };

  const handleAddTable = async ({ number, capacity, min_capacity, max_capacity }:
    { number: string; capacity: number; min_capacity: number; max_capacity: number }) => {
    if (!restaurantId) return;
    const { error } = await supabase.from('tables').insert({
      restaurant_id: restaurantId,
      number,
      capacity,
      min_capacity,
      max_capacity,
      section: zone,
      status: 'available',
      position_x: 100,
      position_y: 100,
    } as any);
    if (error) {
      toast({ title: 'Error al crear mesa', description: error.message, variant: 'destructive' });
      return;
    }
    onTablesUpdated();
  };

  const handleDeleteSelection = async () => {
    if (selection.length === 0) return;
    for (const item of selection) {
      if (item.kind === 'element') {
        await removeElement(item.id);
      } else {
        const { error } = await supabase.from('tables').delete().eq('id', item.id);
        if (error) toast({ title: 'Error al eliminar mesa', description: error.message, variant: 'destructive' });
      }
    }
    setSelection([]);
    onTablesUpdated();
  };

  const handleDuplicateSelection = async () => {
    const els = selection.filter(s => s.kind === 'element');
    for (const s of els) await duplicateElement(s.id);
  };

  const applyRotationDelta = (delta: number) => {
    selection.forEach((item) => {
      if (item.kind === 'table') {
        const t = zoneTables.find(x => x.id === item.id);
        if (!t) return;
        const current = (localTableRects[t.id]?.rotation ?? t.rotation ?? 0);
        const next = ((current + delta) % 360 + 360) % 360;
        setLocalTableRects((prev) => ({ ...prev, [t.id]: { ...prev[t.id], rotation: next } }));
      } else {
        const el = zoneElements.find(x => x.id === item.id);
        if (!el) return;
        const current = (localElementRects[el.id]?.rotation ?? el.rotation ?? 0);
        const next = ((current + delta) % 360 + 360) % 360;
        setLocalElementRects((prev) => ({ ...prev, [el.id]: { ...prev[el.id], rotation: next } }));
      }
    });
  };

  // Combine / split helpers
  const selectedTableIds = selection.filter(s => s.kind === 'table').map(s => s.id);
  const selectedTables = zoneTables.filter(t => selectedTableIds.includes(t.id));
  const canCombine = selectedTables.length >= 2
    && selectedTables.every(t => t.group_id == null)
    && new Set(selectedTables.map(t => t.section)).size === 1;
  const selectedExistingGroup = (() => {
    const ids = new Set(selectedTables.map(t => t.group_id).filter(Boolean) as string[]);
    if (ids.size === 1) return [...ids][0];
    return null;
  })();

  const handleCombine = async () => {
    if (!canCombine) return;
    const groupId = await combine(selectedTableIds);
    if (groupId) {
      setSelection([]);
      onTablesUpdated();
    }
  };

  const handleSplit = async () => {
    if (!selectedExistingGroup) return;
    const ok = await split(selectedExistingGroup);
    if (ok) {
      setSelection([]);
      onTablesUpdated();
    }
  };

  const computedWidth = Math.max(
    600,
    ...zoneTables.map((t, i) => {
      const r = getTableRect(t, i);
      return r.x + r.width + 40;
    }),
    ...zoneElements.map((el) => (localElementRects[el.id]?.x ?? el.x) + (localElementRects[el.id]?.width ?? el.width) + 40)
  );
  const computedHeight = Math.max(
    400,
    ...zoneTables.map((t, i) => {
      const r = getTableRect(t, i);
      return r.y + r.height + 40;
    }),
    ...zoneElements.map((el) => (localElementRects[el.id]?.y ?? el.y) + (localElementRects[el.id]?.height ?? el.height) + 40)
  );

  const isEmpty = zoneTables.length === 0 && zoneElements.length === 0;

  // Group rendering in non-editing mode: collapse member tables to one tile sized to bounding box.
  const renderedTableSet = new Set<string>(); // tables already drawn as part of a group

  // Compute bounding rects per group
  const groupRects = new Map<string, { x: number; y: number; width: number; height: number; firstIndex: number }>();
  if (!isEditing) {
    zoneGroups.forEach((g) => {
      const members = zoneTables
        .map((t, idx) => ({ t, idx, rect: getTableRect(t, idx) }))
        .filter(({ t }) => t.group_id === g.id);
      if (members.length === 0) return;
      const minX = Math.min(...members.map(m => m.rect.x));
      const minY = Math.min(...members.map(m => m.rect.y));
      const maxX = Math.max(...members.map(m => m.rect.x + m.rect.width));
      const maxY = Math.max(...members.map(m => m.rect.y + m.rect.height));
      groupRects.set(g.id, {
        x: minX, y: minY,
        width: Math.max(80, maxX - minX),
        height: Math.max(80, maxY - minY),
        firstIndex: members[0].idx,
      });
    });
  }

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
              <Button variant="outline" size="sm" onClick={() => applyRotationDelta(-90)} disabled={selection.length === 0}>
                <RotateCcw className="w-4 h-4 mr-1" /> -90°
              </Button>
              <Button variant="outline" size="sm" onClick={() => applyRotationDelta(90)} disabled={selection.length === 0}>
                <RotateCw className="w-4 h-4 mr-1" /> +90°
              </Button>
              <Button variant="outline" size="sm" onClick={handleCombine} disabled={!canCombine}>
                <Combine className="w-4 h-4 mr-1" /> Combinar mesas
              </Button>
              <Button variant="outline" size="sm" onClick={handleSplit} disabled={!selectedExistingGroup}>
                <Split className="w-4 h-4 mr-1" /> Separar mesas
              </Button>
              <Button variant="outline" size="sm" onClick={handleDuplicateSelection} disabled={selection.every(s => s.kind !== 'element')}>
                <Copy className="w-4 h-4 mr-1" /> Duplicar
              </Button>
              <Button variant="destructive" size="sm" onClick={handleDeleteSelection} disabled={selection.length === 0}>
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
          onClick={() => isEditing && setSelection([])}
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
            const patch = localElementRects[el.id] || {};
            const rendered = { ...el, ...patch } as typeof el;
            return (
              <FloorElement
                key={el.id}
                element={rendered}
                isEditing={isEditing}
                isSelected={isSelected('element', el.id)}
                onSelect={(e) => toggleSelection({ kind: 'element', id: el.id }, e.shiftKey)}
                onDragStart={(e) => handleElementDragStart(e, el.id)}
                onTransform={(next) => setLocalElementRects((prev) => ({ ...prev, [el.id]: { ...prev[el.id], ...next } }))}
              />
            );
          })}

          {/* Tables */}
          {zoneTables.map((table, index) => {
            const rect = getTableRect(table, index);
            const isAuxiliary = table.number.startsWith('VD');

            // Non-editing: collapse grouped tables into a single rendered tile placed on the first member.
            if (!isEditing && table.group_id) {
              const g = groupById.get(table.group_id);
              const gr = groupRects.get(table.group_id);
              if (!g || !gr) return null;
              if (renderedTableSet.has(table.group_id)) return null;
              renderedTableSet.add(table.group_id);
              return (
                <FloorPlanTable
                  key={`group:${table.group_id}`}
                  table={{ ...table, position_x: gr.x, position_y: gr.y, width: gr.width, height: gr.height, rotation: 0 }}
                  displayName={g.name}
                  displayCapacity={g.default_capacity}
                  overrideRect={gr}
                  sessionInfo={getSessionInfo(table.id) ?? getGroupSessionInfo(g.id)}
                  isEditing={false}
                  isAuxiliary={false}
                  onClick={() => onTableClick(table, g)}
                />
              );
            }

            const tableWithRect = {
              ...table,
              position_x: rect.x,
              position_y: rect.y,
              width: rect.width,
              height: rect.height,
              rotation: rect.rotation,
            };

            return (
              <FloorPlanTable
                key={table.id}
                table={tableWithRect}
                sessionInfo={getSessionInfo(table.id)}
                isEditing={isEditing}
                isAuxiliary={isAuxiliary}
                isSelected={isSelected('table', table.id)}
                onClick={(e) => {
                  if (isEditing) {
                    e.stopPropagation();
                    toggleSelection({ kind: 'table', id: table.id }, e.shiftKey);
                  } else {
                    onTableClick(table, table.group_id ? groupById.get(table.group_id) ?? null : null);
                  }
                }}
                onDragStart={(e) => handleDragStart(e, table)}
                onTransform={(next) => setLocalTableRects((prev) => ({ ...prev, [table.id]: { ...prev[table.id], ...next } }))}
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
          Arrastra para mover, usa los manejadores para redimensionar o rotar. Mantén Shift+clic para seleccionar varias mesas y combinarlas. Pulsa "Guardar plano" cuando termines.
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
