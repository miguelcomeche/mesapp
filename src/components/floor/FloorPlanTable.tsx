import { Table, TableStatus } from '@/types/database';
import { cn } from '@/lib/utils';
import { Users } from 'lucide-react';
import { TransformControls, TransformState } from './TransformControls';

interface FloorPlanTableProps {
  table: Table;
  sessionInfo?: {
    guestCount: number;
    duration: string;
    sessionId: string;
  };
  isEditing?: boolean;
  isAuxiliary?: boolean;
  isSelected?: boolean;
  displayName?: string;
  displayCapacity?: number;
  overrideRect?: { x: number; y: number; width: number; height: number };
  onClick?: (e: React.MouseEvent) => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onPointerDown?: (e: React.PointerEvent) => void;
  onTransform?: (next: TransformState) => void;
}

const statusColors: Record<TableStatus, string> = {
  available: 'bg-[hsl(var(--status-available))] border-[hsl(var(--status-available))]',
  occupied: 'bg-[hsl(var(--status-occupied))] border-[hsl(var(--status-occupied))]',
  reserved: 'bg-[hsl(var(--status-reserved))] border-[hsl(var(--status-reserved))]',
  needs_attention: 'bg-[hsl(var(--status-attention))] border-[hsl(var(--status-attention))]',
};

const statusBgColors: Record<TableStatus, string> = {
  available: 'bg-[hsl(var(--status-available)/.15)]',
  occupied: 'bg-[hsl(var(--status-occupied)/.15)]',
  reserved: 'bg-[hsl(var(--status-reserved)/.15)]',
  needs_attention: 'bg-[hsl(var(--status-attention)/.15)]',
};

export function FloorPlanTable({
  table,
  sessionInfo,
  isEditing = false,
  isAuxiliary = false,
  isSelected = false,
  displayName,
  displayCapacity,
  overrideRect,
  onClick,
  onDragStart,
  onDragEnd,
  onPointerDown,
  onTransform,
}: FloorPlanTableProps) {
  const rect = overrideRect ?? {
    x: table.position_x ?? 0,
    y: table.position_y ?? 0,
    width: table.width ?? (isAuxiliary ? 64 : 80),
    height: table.height ?? (isAuxiliary ? 64 : 80),
  };
  const capacity = displayCapacity ?? table.capacity;
  const label = displayName ?? table.number;
  const isCombined = !!displayName && displayName.includes('+');

  return (
    <div
      onClick={onClick}
      draggable={isEditing && !overrideRect && !onPointerDown}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onPointerDown={onPointerDown}
      className={cn(
        'absolute rounded-lg border-2 flex flex-col items-center justify-center cursor-pointer transition-all duration-200',
        'hover:shadow-lg',
        statusBgColors[table.status],
        statusColors[table.status],
        isEditing && 'cursor-move',
        isSelected && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
        table.status === 'needs_attention' && 'animate-pulse'
      )}
      style={{
        left: `${rect.x}px`,
        top: `${rect.y}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        transform: table.rotation ? `rotate(${table.rotation}deg)` : undefined,
        transformOrigin: 'center center',
      }}
    >
      <span className={cn('font-bold text-foreground', isAuxiliary ? 'text-xs' : 'text-sm')}>
        {label}
      </span>
      <div className="flex items-center gap-0.5 text-muted-foreground">
        <Users className={cn(isAuxiliary ? 'w-2.5 h-2.5' : 'w-3 h-3')} />
        <span className={cn(isAuxiliary ? 'text-[10px]' : 'text-xs')}>
          {sessionInfo ? sessionInfo.guestCount : 0}/{capacity}
        </span>
      </div>
      {sessionInfo && (
        <span className="text-[10px] text-muted-foreground mt-0.5">
          {sessionInfo.duration}
        </span>
      )}
      {isCombined && (
        <span className="absolute -top-2 -right-2 text-[10px] px-1.5 py-0.5 rounded bg-primary text-primary-foreground font-medium shadow">
          {capacity} pax
        </span>
      )}
      {isEditing && isSelected && onTransform && !overrideRect && (
        <TransformControls
          state={{ x: rect.x, y: rect.y, width: rect.width, height: rect.height, rotation: table.rotation ?? 0 }}
          minWidth={40}
          minHeight={40}
          onChange={onTransform}
        />
      )}
    </div>
  );
}
