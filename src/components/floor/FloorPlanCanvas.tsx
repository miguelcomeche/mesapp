import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Table, TableGroup } from '@/types/database';
import { FloorPlanTable } from './FloorPlanTable';
import { Button } from '@/components/ui/button';
import {
  Edit3, Save, X, Plus, Trash2, Copy, Minus, Type, Square, Sparkles, Wine,
  RotateCw, RotateCcw, Combine, Split, AlignStartVertical, AlignEndVertical,
  AlignCenterHorizontal, AlignStartHorizontal, AlignEndHorizontal, AlignCenterVertical,
  AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter, Grid3x3, Wand2,
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
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const SNAP_OPTIONS = [10, 20, 40] as const;
const MAGNET_THRESHOLD = 6;

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

  // Pro editor state
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [gridSize, setGridSize] = useState<number>(20);
  const [guides, setGuides] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] });
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    anchorId: string;
    offsets: Map<string, { dx: number; dy: number; w: number; h: number; x0: number; y0: number }>;
  } | null>(null);
  const marqueeRef = useRef<{ pointerId: number; startX: number; startY: number } | null>(null);

  const snap = useCallback((v: number) => (snapEnabled ? Math.round(v / gridSize) * gridSize : Math.round(v)), [snapEnabled, gridSize]);

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

    if (draggedElementId) {
      setLocalElementRects((prev) => ({
        ...prev,
        [draggedElementId]: { ...prev[draggedElementId], x: snap(x), y: snap(y) },
      }));
      setDraggedElementId(null);
    }
  }, [draggedElementId, snap]);

  // ===== Pointer-based table drag with snap + magnetic guides =====
  const beginTableDrag = (e: React.PointerEvent, table: Table) => {
    if (!isEditing) return;
    if ((e.target as HTMLElement).closest('[data-transform-handle]')) return;
    e.stopPropagation();
    e.preventDefault();
    // Ensure the dragged table is part of the selection
    let activeSelection = selection;
    if (!isSelected('table', table.id)) {
      const additive = e.shiftKey;
      activeSelection = additive
        ? [...selection, { kind: 'table' as const, id: table.id }]
        : [{ kind: 'table' as const, id: table.id }];
      setSelection(activeSelection);
    }
    const idsInDrag = activeSelection.filter(s => s.kind === 'table').map(s => s.id);
    const ids = idsInDrag.includes(table.id) ? idsInDrag : [table.id];
    const offsets = new Map<string, { dx: number; dy: number; w: number; h: number; x0: number; y0: number }>();
    const anchorIndex = zoneTables.findIndex(t => t.id === table.id);
    const anchorRect = getTableRect(table, anchorIndex);
    ids.forEach((id) => {
      const idx = zoneTables.findIndex(t => t.id === id);
      if (idx < 0) return;
      const r = getTableRect(zoneTables[idx], idx);
      offsets.set(id, { dx: r.x - anchorRect.x, dy: r.y - anchorRect.y, w: r.width, h: r.height, x0: r.x, y0: r.y });
    });
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      anchorId: table.id,
      offsets,
    };
    window.addEventListener('pointermove', onTableDragMove);
    window.addEventListener('pointerup', onTableDragEnd);
    window.addEventListener('pointercancel', onTableDragEnd);
  };

  const computeMagnetSnap = (anchorX: number, anchorY: number, anchorW: number, anchorH: number, draggingIds: Set<string>) => {
    const others: { x: number; y: number; w: number; h: number }[] = [];
    zoneTables.forEach((t, i) => {
      if (draggingIds.has(t.id)) return;
      const r = getTableRect(t, i);
      others.push({ x: r.x, y: r.y, w: r.width, h: r.height });
    });
    zoneElements.forEach((el) => {
      const patch = localElementRects[el.id] || {};
      others.push({
        x: (patch.x ?? el.x) as number,
        y: (patch.y ?? el.y) as number,
        w: (patch.width ?? el.width) as number,
        h: (patch.height ?? el.height) as number,
      });
    });
    const ax = [anchorX, anchorX + anchorW / 2, anchorX + anchorW];
    const ay = [anchorY, anchorY + anchorH / 2, anchorY + anchorH];
    let bestDX = 0, bestDY = 0;
    let bestAbsX = MAGNET_THRESHOLD + 1, bestAbsY = MAGNET_THRESHOLD + 1;
    const gv: number[] = [];
    const gh: number[] = [];
    others.forEach((o) => {
      const ox = [o.x, o.x + o.w / 2, o.x + o.w];
      const oy = [o.y, o.y + o.h / 2, o.y + o.h];
      ax.forEach((a, ai) => ox.forEach((b) => {
        const d = b - a;
        if (Math.abs(d) <= MAGNET_THRESHOLD && Math.abs(d) < bestAbsX) { bestAbsX = Math.abs(d); bestDX = d; }
      }));
      ay.forEach((a) => oy.forEach((b) => {
        const d = b - a;
        if (Math.abs(d) <= MAGNET_THRESHOLD && Math.abs(d) < bestAbsY) { bestAbsY = Math.abs(d); bestDY = d; }
      }));
    });
    const newX = anchorX + (bestAbsX <= MAGNET_THRESHOLD ? bestDX : 0);
    const newY = anchorY + (bestAbsY <= MAGNET_THRESHOLD ? bestDY : 0);
    // Collect guide lines that now match
    const nax = [newX, newX + anchorW / 2, newX + anchorW];
    const nay = [newY, newY + anchorH / 2, newY + anchorH];
    others.forEach((o) => {
      const ox = [o.x, o.x + o.w / 2, o.x + o.w];
      const oy = [o.y, o.y + o.h / 2, o.y + o.h];
      nax.forEach((a) => ox.forEach((b) => { if (Math.abs(a - b) < 0.5) gv.push(a); }));
      nay.forEach((a) => oy.forEach((b) => { if (Math.abs(a - b) < 0.5) gh.push(a); }));
    });
    return { x: newX, y: newY, gv, gh };
  };

  const onTableDragMove = (e: PointerEvent) => {
    const s = dragRef.current;
    if (!s || e.pointerId !== s.pointerId) return;
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    const anchor = s.offsets.get(s.anchorId);
    if (!anchor) return;
    let nx = anchor.x0 + dx;
    let ny = anchor.y0 + dy;
    nx = snap(nx);
    ny = snap(ny);
    nx = Math.max(0, nx);
    ny = Math.max(0, ny);
    const dragging = new Set(s.offsets.keys());
    const mag = computeMagnetSnap(nx, ny, anchor.w, anchor.h, dragging);
    nx = mag.x; ny = mag.y;
    setGuides({ v: mag.gv, h: mag.gh });
    setLocalTableRects((prev) => {
      const next = { ...prev };
      s.offsets.forEach((off, id) => {
        next[id] = { ...next[id], x: Math.round(nx + off.dx), y: Math.round(ny + off.dy) };
      });
      return next;
    });
  };

  const onTableDragEnd = (e: PointerEvent) => {
    if (!dragRef.current || e.pointerId !== dragRef.current.pointerId) return;
    window.removeEventListener('pointermove', onTableDragMove);
    window.removeEventListener('pointerup', onTableDragEnd);
    window.removeEventListener('pointercancel', onTableDragEnd);
    dragRef.current = null;
    setGuides({ v: [], h: [] });
  };

  useEffect(() => () => {
    window.removeEventListener('pointermove', onTableDragMove);
    window.removeEventListener('pointerup', onTableDragEnd);
    window.removeEventListener('pointercancel', onTableDragEnd);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== Marquee selection on canvas background =====
  const onCanvasPointerDown = (e: React.PointerEvent) => {
    if (!isEditing) return;
    if (e.target !== e.currentTarget) return;
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    marqueeRef.current = { pointerId: e.pointerId, startX: e.clientX - rect.left, startY: e.clientY - rect.top };
    setMarquee({ x: e.clientX - rect.left, y: e.clientY - rect.top, w: 0, h: 0 });
    window.addEventListener('pointermove', onMarqueeMove);
    window.addEventListener('pointerup', onMarqueeUp);
  };
  const onMarqueeMove = (e: PointerEvent) => {
    const s = marqueeRef.current;
    if (!s || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    setMarquee({ x: Math.min(s.startX, cx), y: Math.min(s.startY, cy), w: Math.abs(cx - s.startX), h: Math.abs(cy - s.startY) });
  };
  const onMarqueeUp = () => {
    window.removeEventListener('pointermove', onMarqueeMove);
    window.removeEventListener('pointerup', onMarqueeUp);
    const m = marquee;
    marqueeRef.current = null;
    setMarquee(null);
    if (!m || (m.w < 4 && m.h < 4)) { setSelection([]); return; }
    const sel: SelItem[] = [];
    zoneTables.forEach((t, i) => {
      const r = getTableRect(t, i);
      if (r.x < m.x + m.w && r.x + r.width > m.x && r.y < m.y + m.h && r.y + r.height > m.y) {
        sel.push({ kind: 'table', id: t.id });
      }
    });
    setSelection(sel);
  };

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

  // ===== Align / Distribute =====
  const getSelectedTableRects = () => {
    const items = selection.filter(s => s.kind === 'table').map(s => s.id);
    return items.map((id) => {
      const idx = zoneTables.findIndex(t => t.id === id);
      if (idx < 0) return null;
      const t = zoneTables[idx];
      const r = getTableRect(t, idx);
      return { id, x: r.x, y: r.y, width: r.width, height: r.height };
    }).filter(Boolean) as { id: string; x: number; y: number; width: number; height: number }[];
  };

  const updateLocalTable = (id: string, patch: Partial<TransformState>) => {
    setLocalTableRects((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const align = (mode: 'left' | 'right' | 'top' | 'bottom' | 'centerH' | 'centerV') => {
    const rects = getSelectedTableRects();
    if (rects.length < 2) return;
    if (mode === 'left') {
      const x = Math.min(...rects.map(r => r.x));
      rects.forEach(r => updateLocalTable(r.id, { x }));
    } else if (mode === 'right') {
      const right = Math.max(...rects.map(r => r.x + r.width));
      rects.forEach(r => updateLocalTable(r.id, { x: right - r.width }));
    } else if (mode === 'top') {
      const y = Math.min(...rects.map(r => r.y));
      rects.forEach(r => updateLocalTable(r.id, { y }));
    } else if (mode === 'bottom') {
      const bottom = Math.max(...rects.map(r => r.y + r.height));
      rects.forEach(r => updateLocalTable(r.id, { y: bottom - r.height }));
    } else if (mode === 'centerV') {
      // vertical axis -> align horizontal centers
      const cx = rects.reduce((a, r) => a + r.x + r.width / 2, 0) / rects.length;
      rects.forEach(r => updateLocalTable(r.id, { x: Math.round(cx - r.width / 2) }));
    } else if (mode === 'centerH') {
      const cy = rects.reduce((a, r) => a + r.y + r.height / 2, 0) / rects.length;
      rects.forEach(r => updateLocalTable(r.id, { y: Math.round(cy - r.height / 2) }));
    }
  };

  const distribute = (axis: 'horizontal' | 'vertical') => {
    const rects = getSelectedTableRects();
    if (rects.length < 3) return;
    if (axis === 'horizontal') {
      const sorted = [...rects].sort((a, b) => a.x - b.x);
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const totalWidth = sorted.reduce((a, r) => a + r.width, 0);
      const span = (last.x + last.width) - first.x;
      const gap = (span - totalWidth) / (sorted.length - 1);
      let cursor = first.x;
      sorted.forEach((r) => {
        updateLocalTable(r.id, { x: Math.round(cursor) });
        cursor += r.width + gap;
      });
    } else {
      const sorted = [...rects].sort((a, b) => a.y - b.y);
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const totalHeight = sorted.reduce((a, r) => a + r.height, 0);
      const span = (last.y + last.height) - first.y;
      const gap = (span - totalHeight) / (sorted.length - 1);
      let cursor = first.y;
      sorted.forEach((r) => {
        updateLocalTable(r.id, { y: Math.round(cursor) });
        cursor += r.height + gap;
      });
    }
  };

  // ===== Auto-organize =====
  const autoOrganize = () => {
    if (zoneTables.length === 0) return;
    const startX = 40;
    const startY = 40;
    const gap = 24;
    const maxW = Math.max(...zoneTables.map((t) => t.width ?? 80));
    const maxH = Math.max(...zoneTables.map((t) => t.height ?? 80));
    const stepX = maxW + gap;
    const stepY = maxH + gap;
    const canvasWidth = canvasRef.current?.clientWidth ?? 800;
    const cols = Math.max(1, Math.floor((canvasWidth - startX) / stepX));
    const sorted = [...zoneTables].sort((a, b) => {
      const na = parseInt(a.number.replace(/\D/g, ''), 10) || 0;
      const nb = parseInt(b.number.replace(/\D/g, ''), 10) || 0;
      return na - nb;
    });
    sorted.forEach((t, i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;
      updateLocalTable(t.id, { x: snap(startX + col * stepX), y: snap(startY + row * stepY) });
    });
    toast({ title: 'Plano reorganizado', description: 'Recuerda pulsar "Guardar plano".' });
  };

  // ===== Smart duplicate (tables) =====
  const handleDuplicateTables = async () => {
    if (!restaurantId) return;
    const tableSel = selection.filter(s => s.kind === 'table');
    if (tableSel.length === 0) return;
    const usedNums = new Set(zoneTables.map(t => parseInt(t.number.replace(/\D/g, ''), 10)).filter(n => !isNaN(n)));
    let next = (Math.max(0, ...Array.from(usedNums))) + 1;
    for (const item of tableSel) {
      const idx = zoneTables.findIndex(t => t.id === item.id);
      if (idx < 0) continue;
      const src = zoneTables[idx];
      const r = getTableRect(src, idx);
      while (usedNums.has(next)) next++;
      const prefix = src.number.replace(/\d+$/, '');
      const newNumber = `${prefix}${next}`;
      usedNums.add(next);
      // Find non-overlapping position to the right
      let nx = snap(r.x + r.width + 20);
      let ny = snap(r.y);
      const collides = (x: number, y: number) => zoneTables.some((t, i) => {
        const o = getTableRect(t, i);
        return x < o.x + o.width && x + r.width > o.x && y < o.y + o.height && y + r.height > o.y;
      });
      let safety = 0;
      while (collides(nx, ny) && safety < 50) {
        nx = snap(nx + r.width + 20);
        safety++;
      }
      const { error } = await supabase.from('tables').insert({
        restaurant_id: restaurantId,
        number: newNumber,
        capacity: src.capacity,
        min_capacity: src.min_capacity,
        max_capacity: src.max_capacity,
        section: src.section,
        status: 'available',
        position_x: nx,
        position_y: ny,
        width: r.width,
        height: r.height,
        rotation: src.rotation ?? 0,
      } as any);
      if (error) {
        toast({ title: 'Error al duplicar mesa', description: error.message, variant: 'destructive' });
      }
    }
    setSelection([]);
    onTablesUpdated();
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
        const { data, error } = await supabase.rpc('delete_table_safe', { _table: item.id });
        if (error) {
          toast({ title: 'Error al eliminar mesa', description: error.message, variant: 'destructive' });
        } else {
          const result = data as { action: string; session?: { id: string; status: string; opened_at: string } } | null;
          if (result?.action === 'blocked' && result.session) {
            toast({
              title: 'No se puede eliminar',
              description: `Sesión abierta: ${result.session.id} (${result.session.status})`,
              variant: 'destructive',
            });
          } else if (result?.action === 'deactivated') {
            toast({ title: 'Mesa desactivada', description: 'Tenía historial; se ocultó conservando el histórico.' });
          }
        }
      }
    }
    setSelection([]);
    onTablesUpdated();
  };

  const handleDuplicateSelection = async () => {
    const els = selection.filter(s => s.kind === 'element');
    for (const s of els) await duplicateElement(s.id);
    if (selection.some(s => s.kind === 'table')) await handleDuplicateTables();
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={selection.filter(s => s.kind === 'table').length < 2}>
                    <AlignCenterHorizontal className="w-4 h-4 mr-1" /> Alinear
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>Alinear selección</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => align('left')}><AlignStartVertical className="w-4 h-4 mr-2" />Izquierda</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => align('centerV')}><AlignCenterVertical className="w-4 h-4 mr-2" />Centrar horizontal</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => align('right')}><AlignEndVertical className="w-4 h-4 mr-2" />Derecha</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => align('top')}><AlignStartHorizontal className="w-4 h-4 mr-2" />Arriba</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => align('centerH')}><AlignCenterHorizontal className="w-4 h-4 mr-2" />Centrar vertical</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => align('bottom')}><AlignEndHorizontal className="w-4 h-4 mr-2" />Abajo</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={selection.filter(s => s.kind === 'table').length < 3}>
                    <AlignHorizontalDistributeCenter className="w-4 h-4 mr-1" /> Distribuir
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => distribute('horizontal')}>
                    <AlignHorizontalDistributeCenter className="w-4 h-4 mr-2" />Horizontalmente
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => distribute('vertical')}>
                    <AlignVerticalDistributeCenter className="w-4 h-4 mr-2" />Verticalmente
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" size="sm" onClick={autoOrganize} title="Auto-organizar todas las mesas de la zona">
                <Wand2 className="w-4 h-4 mr-1" /> Auto-organizar
              </Button>
              <Button variant="outline" size="sm" onClick={handleCombine} disabled={!canCombine}>
                <Combine className="w-4 h-4 mr-1" /> Combinar mesas
              </Button>
              <Button variant="outline" size="sm" onClick={handleSplit} disabled={!selectedExistingGroup}>
                <Split className="w-4 h-4 mr-1" /> Separar mesas
              </Button>
              <Button variant="outline" size="sm" onClick={handleDuplicateSelection} disabled={selection.length === 0}>
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

      {isEditing && (
        <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card/30 px-3 py-2 text-sm">
          <div className="flex items-center gap-2">
            <Grid3x3 className="w-4 h-4 text-muted-foreground" />
            <Switch id="snap-toggle" checked={snapEnabled} onCheckedChange={setSnapEnabled} />
            <Label htmlFor="snap-toggle" className="cursor-pointer">Ajustar a cuadrícula</Label>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">Tamaño:</span>
            {SNAP_OPTIONS.map((g) => (
              <Button
                key={g}
                size="sm"
                variant={gridSize === g ? 'default' : 'outline'}
                className="h-7 px-2 text-xs"
                onClick={() => setGridSize(g)}
              >
                {g}px
              </Button>
            ))}
          </div>
          <span className="text-muted-foreground text-xs">
            Shift+clic para seleccionar varias · arrastra en vacío para selección múltiple
          </span>
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
          onPointerDown={onCanvasPointerDown}
          className="relative"
          style={{ 
            width: `${computedWidth}px`, 
            height: `${computedHeight}px`,
            minWidth: '100%',
            backgroundImage: 'radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)',
            backgroundSize: `${gridSize}px ${gridSize}px`,
          }}
        >
          {/* Magnetic guides */}
          {isEditing && guides.v.map((x, i) => (
            <div key={`gv-${i}`} className="absolute top-0 bottom-0 w-px bg-primary/70 pointer-events-none" style={{ left: x }} />
          ))}
          {isEditing && guides.h.map((y, i) => (
            <div key={`gh-${i}`} className="absolute left-0 right-0 h-px bg-primary/70 pointer-events-none" style={{ top: y }} />
          ))}
          {/* Marquee */}
          {marquee && (
            <div
              className="absolute border border-primary bg-primary/10 pointer-events-none"
              style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }}
            />
          )}
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
                onPointerDown={(e) => beginTableDrag(e, table)}
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
