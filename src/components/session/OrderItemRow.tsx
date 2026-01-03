import { OrderItem, OrderCourse, STATUS_LABELS } from '@/types/database';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Send, ChefHat, Wine } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrderItemRowProps {
  item: OrderItem;
  onMarchar: (item: OrderItem) => void;
  onCourseChange: (itemId: string, course: OrderCourse) => void;
}

const courseOptions: { value: OrderCourse; label: string }[] = [
  { value: 'unassigned', label: 'Sin asignar' },
  { value: 'primeros', label: 'Primeros' },
  { value: 'segundos', label: 'Segundos' },
  { value: 'postres', label: 'Postres' },
];

const statusColors: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  sent: 'bg-[hsl(var(--status-occupied)/.15)] text-[hsl(var(--status-occupied))]',
  preparing: 'bg-[hsl(var(--status-attention)/.15)] text-[hsl(var(--status-attention))]',
  ready: 'bg-[hsl(var(--status-available)/.15)] text-[hsl(var(--status-available))]',
  served: 'bg-primary/15 text-primary',
  cancelled: 'bg-destructive/15 text-destructive',
};

export function OrderItemRow({ item, onMarchar, onCourseChange }: OrderItemRowProps) {
  const isPending = item.status === 'pending';
  const isKitchen = item.station === 'kitchen';

  // Get modifiers from join table
  const extras = item.order_item_modifiers?.filter(m => m.modifier_group === 'EXTRAS_CON') || [];
  const removals = item.order_item_modifiers?.filter(m => m.modifier_group === 'SIN') || [];
  const hasModifiers = extras.length > 0 || removals.length > 0;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 py-3 border-b border-border/30 last:border-0">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <span className="font-medium text-foreground w-8">{item.quantity}x</span>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{item.menu_item?.name || 'Producto'}</p>
          {hasModifiers && (
            <div className="text-xs mt-0.5 space-x-1">
              {extras.map((mod) => (
                <span key={mod.id} className="text-green-500">
                  + {mod.name} {mod.price > 0 && `(+${Number(mod.price).toFixed(2)}€)`}
                </span>
              ))}
              {removals.map((mod) => (
                <span key={mod.id} className="text-orange-400">
                  Sin {mod.name}
                </span>
              ))}
            </div>
          )}
          {!hasModifiers && item.notes && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {item.notes.split(', ').map((mod, idx) => (
                <span 
                  key={idx} 
                  className={cn(
                    "inline-block mr-1",
                    mod.startsWith('+') ? 'text-green-500' : mod.startsWith('Sin') ? 'text-orange-400' : ''
                  )}
                >
                  {mod}{idx < item.notes!.split(', ').length - 1 ? ' · ' : ''}
                </span>
              ))}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
        {/* Station indicator */}
        <Badge 
          variant="outline" 
          className={cn(
            'text-xs gap-1',
            isKitchen ? 'border-orange-500/50 text-orange-400' : 'border-blue-500/50 text-blue-400'
          )}
        >
          {isKitchen ? <ChefHat className="h-3 w-3" /> : <Wine className="h-3 w-3" />}
          {STATUS_LABELS.station[item.station]}
        </Badge>

        {/* Course selector (only for kitchen items) */}
        {isKitchen && isPending && (
          <Select
            value={item.course}
            onValueChange={(value) => onCourseChange(item.id, value as OrderCourse)}
          >
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {courseOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Course badge (for non-pending kitchen items) */}
        {isKitchen && !isPending && item.course !== 'unassigned' && (
          <Badge variant="outline" className="text-xs">
            {STATUS_LABELS.course[item.course]}
          </Badge>
        )}

        {/* Status */}
        <Badge className={cn('text-xs', statusColors[item.status])}>
          {STATUS_LABELS.orderItem[item.status]}
        </Badge>

        {/* Price */}
        <span className="font-semibold text-sm w-16 text-right">
          {(Number(item.unit_price) * item.quantity).toFixed(2)}€
        </span>

        {/* Marchar button */}
        {isPending && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onMarchar(item)}
            className="gap-1 h-8 text-xs"
          >
            <Send className="h-3 w-3" />
            Marchar
          </Button>
        )}
      </div>
    </div>
  );
}
