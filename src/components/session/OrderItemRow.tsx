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
import { Send, ChefHat, Wine, MoreVertical, Ban, Trash2, Gift } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface OrderItemRowProps {
  item: OrderItem;
  onMarchar: (item: OrderItem) => void;
  onCourseChange: (itemId: string, course: OrderCourse) => void;
  paidQuantity?: number;
  canDelete?: boolean;
  canCancel?: boolean;
  onCancelRequest?: (item: OrderItem) => void;
  onDeleteRequest?: (item: OrderItem) => void;
  canGift?: boolean;
  onGiftRequest?: (item: OrderItem) => void;
  onUngiftRequest?: (item: OrderItem) => void;
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

export function OrderItemRow({
  item,
  onMarchar,
  onCourseChange,
  paidQuantity = 0,
  canDelete = false,
  canCancel = false,
  onCancelRequest,
  onDeleteRequest,
  canGift = false,
  onGiftRequest,
  onUngiftRequest,
}: OrderItemRowProps) {
  const isPending = item.status === 'pending';
  const isKitchen = item.station === 'kitchen';
  const fullyPaid = paidQuantity >= item.quantity - 0.001;
  const partiallyPaid = paidQuantity > 0 && !fullyPaid;
  const isCancelled = item.status === 'cancelled';
  const isDeleted = !!item.deleted_at;
  const isComplimentary = !!(item as any).is_complimentary;
  const originalUnitPrice = Number((item as any).complimentary_original_unit_price ?? item.unit_price);
  const canShowActions = !isDeleted && !isCancelled;
  const canShowDelete = canDelete && isPending && !item.sent_at && !fullyPaid && !partiallyPaid;
  const canShowCancel = canCancel && !fullyPaid;
  const canShowGift = canGift && !fullyPaid && !partiallyPaid && !isComplimentary;
  const canShowUngift = canGift && isComplimentary && !fullyPaid && !partiallyPaid;

  const formatEuro = (value: number) =>
    Number(value).toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  // Get modifiers from join table
  const extras = item.order_item_modifiers?.filter(m => m.modifier_group === 'EXTRAS_CON') || [];
  const removals = item.order_item_modifiers?.filter(m => m.modifier_group === 'SIN') || [];
  const hasModifiers = extras.length > 0 || removals.length > 0;

  if (isDeleted) return null;

  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row sm:items-center gap-2 py-3 border-b border-border/30 last:border-0',
        isCancelled && 'opacity-60',
      )}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <span className="font-medium text-foreground w-8">{item.quantity}x</span>
        <div className="flex-1 min-w-0">
          <p className={cn('font-medium truncate', isCancelled && 'line-through')}>
            {item.menu_item?.name || 'Producto'}
            {partiallyPaid && (
              <span className="ml-2 text-xs text-muted-foreground">
                (Pagado {Math.round(paidQuantity)}/{item.quantity})
              </span>
            )}
          </p>
          {isComplimentary && (
            <p className="text-xs text-pink-500 mt-0.5 flex items-center gap-1">
              <Gift className="h-3 w-3" /> Invitación de la casa
            </p>
          )}
          {isCancelled && item.cancellation_reason && (
            <p className="text-xs text-destructive mt-0.5">
              Motivo: {item.cancellation_reason}
            </p>
          )}
          {hasModifiers && (
            <div className="text-xs mt-0.5 space-x-1">
              {extras.map((mod) => (
                <span key={mod.id} className="text-green-500">
                  + {mod.name} {Number(mod.price) > 0 && `(+${formatEuro(Number(mod.price))}€)`}
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
        {isKitchen && isPending && !isCancelled && (
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
        {isCancelled ? (
          <Badge className="text-xs bg-destructive/15 text-destructive border border-destructive/30">
            Anulado
          </Badge>
        ) : (
          <Badge className={cn('text-xs', statusColors[item.status])}>
            {STATUS_LABELS.orderItem[item.status]}
          </Badge>
        )}

        {/* Payment status */}
        {fullyPaid ? (
          <Badge className="text-xs bg-green-500/15 text-green-500 border border-green-500/30">
            Pagado
          </Badge>
        ) : partiallyPaid ? (
          <Badge variant="outline" className="text-xs">
            Parcial
          </Badge>
        ) : null}

        {isComplimentary && (
          <Badge className="text-xs bg-pink-500/15 text-pink-500 border border-pink-500/30 gap-1">
            <Gift className="h-3 w-3" /> Invitación
          </Badge>
        )}

        {/* Price */}
        {isComplimentary ? (
          <span className="font-semibold text-sm w-24 text-right">
            <span className="line-through text-muted-foreground mr-1">
              {formatEuro(originalUnitPrice * item.quantity)}€
            </span>
            <span className="text-pink-500">0,00€</span>
          </span>
        ) : (
          <span className="font-semibold text-sm w-16 text-right">
            {formatEuro(Number(item.unit_price) * item.quantity)}€
          </span>
        )}

        {/* Marchar button */}
        {isPending && !isCancelled && (
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

        {/* Actions menu */}
        {canShowActions && (canShowDelete || canShowCancel || canShowGift || canShowUngift || fullyPaid) && (
          <TooltipProvider>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {fullyPaid ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuItem disabled>
                        <Ban className="h-4 w-4 mr-2" /> No disponible
                      </DropdownMenuItem>
                    </TooltipTrigger>
                    <TooltipContent>Producto ya pagado. Debes hacer una devolución.</TooltipContent>
                  </Tooltip>
                ) : (
                  <>
                    {canShowGift && onGiftRequest && (
                      <DropdownMenuItem onClick={() => onGiftRequest(item)}>
                        <Gift className="h-4 w-4 mr-2" /> Invitación
                      </DropdownMenuItem>
                    )}
                    {canShowUngift && onUngiftRequest && (
                      <DropdownMenuItem onClick={() => onUngiftRequest(item)}>
                        <Gift className="h-4 w-4 mr-2" /> Quitar invitación
                      </DropdownMenuItem>
                    )}
                    {canShowDelete && onDeleteRequest && (
                      <DropdownMenuItem onClick={() => onDeleteRequest(item)}>
                        <Trash2 className="h-4 w-4 mr-2" /> Borrar
                      </DropdownMenuItem>
                    )}
                    {canShowCancel && onCancelRequest && (
                      <DropdownMenuItem
                        onClick={() => onCancelRequest(item)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Ban className="h-4 w-4 mr-2" /> Anular
                      </DropdownMenuItem>
                    )}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}
