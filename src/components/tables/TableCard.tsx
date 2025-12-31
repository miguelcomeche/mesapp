import { Table, TableStatus } from '@/types';
import { cn } from '@/lib/utils';
import { Users, Clock } from 'lucide-react';

interface TableCardProps {
  table: Table;
  sessionInfo?: {
    guestCount: number;
    duration: string;
    waiter: string;
  };
  onClick?: () => void;
}

const statusConfig: Record<TableStatus, { label: string; className: string }> = {
  available: { label: 'Disponible', className: 'status-available' },
  occupied: { label: 'Ocupada', className: 'status-occupied' },
  reserved: { label: 'Reservada', className: 'status-reserved' },
  needs_attention: { label: 'Requiere Atención', className: 'status-attention' },
};

export function TableCard({ table, sessionInfo, onClick }: TableCardProps) {
  const status = statusConfig[table.status];

  return (
    <div
      onClick={onClick}
      className={cn(
        'table-card animate-scale-in',
        table.status === 'needs_attention' && 'animate-pulse-soft border-status-attention/50'
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-xl font-bold text-foreground">Mesa {table.number}</h3>
          <p className="text-sm text-muted-foreground">{table.section}</p>
        </div>
        <span className={cn('status-badge', status.className)}>
          {status.label}
        </span>
      </div>

      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Users className="w-4 h-4" />
          <span>
            {sessionInfo ? `${sessionInfo.guestCount}/${table.capacity}` : `0/${table.capacity}`}
          </span>
        </div>
        {sessionInfo && (
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4" />
            <span>{sessionInfo.duration}</span>
          </div>
        )}
      </div>

      {sessionInfo && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Atendido por <span className="text-foreground">{sessionInfo.waiter}</span>
          </p>
        </div>
      )}
    </div>
  );
}
