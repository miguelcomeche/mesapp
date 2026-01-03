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

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 py-3 border-b border-border/30 last:border-0">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <span className="font-medium text-foreground w-8">{item.quantity}x</span>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{item.menu_item?.name || 'Producto'}</p>
          {item.notes && (
            <p className="text-sm text-muted-foreground truncate">{item.notes}</p>
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
