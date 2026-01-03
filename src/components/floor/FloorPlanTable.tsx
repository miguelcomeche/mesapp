import { Table, TableStatus } from '@/types/database';
import { cn } from '@/lib/utils';
import { Users } from 'lucide-react';

interface FloorPlanTableProps {
  table: Table;
  sessionInfo?: {
    guestCount: number;
    duration: string;
    sessionId: string;
  };
  isEditing?: boolean;
  isAuxiliary?: boolean;
  onClick?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
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
  onClick,
  onDragStart,
  onDragEnd,
}: FloorPlanTableProps) {
  const size = isAuxiliary ? 'w-16 h-16' : 'w-20 h-20';
  
  return (
    <div
      onClick={onClick}
      draggable={isEditing}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        size,
        'absolute rounded-lg border-2 flex flex-col items-center justify-center cursor-pointer transition-all duration-200',
        'hover:scale-105 hover:shadow-lg',
        statusBgColors[table.status],
        statusColors[table.status],
        isEditing && 'cursor-move ring-2 ring-primary ring-offset-2 ring-offset-background',
        table.status === 'needs_attention' && 'animate-pulse'
      )}
      style={{
        left: `${table.position_x ?? 0}px`,
        top: `${table.position_y ?? 0}px`,
      }}
    >
      <span className={cn(
        'font-bold text-foreground',
        isAuxiliary ? 'text-xs' : 'text-sm'
      )}>
        {table.number}
      </span>
      <div className="flex items-center gap-0.5 text-muted-foreground">
        <Users className={cn(isAuxiliary ? 'w-2.5 h-2.5' : 'w-3 h-3')} />
        <span className={cn(isAuxiliary ? 'text-[10px]' : 'text-xs')}>
          {sessionInfo ? sessionInfo.guestCount : 0}/{table.capacity}
        </span>
      </div>
      {sessionInfo && (
        <span className="text-[10px] text-muted-foreground mt-0.5">
          {sessionInfo.duration}
        </span>
      )}
    </div>
  );
}
