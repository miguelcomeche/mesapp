import { Button } from '@/components/ui/button';
import { BLOCK_LABELS, BlockType } from '@/types/tickets';
import { Plus } from 'lucide-react';

const ALL: BlockType[] = [
  'logo', 'text', 'separator', 'restaurant_info', 'table_info', 'waiter_info',
  'datetime', 'ticket_number', 'order_items', 'totals', 'payment_method',
  'qr', 'barcode', 'footer',
];

export function BlockPalette({ onAdd }: { onAdd: (type: BlockType) => void }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">Bloques</h3>
      <p className="text-xs text-muted-foreground">Pulsa para añadir al diseño.</p>
      <div className="space-y-1">
        {ALL.map((t) => (
          <Button
            key={t}
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={() => onAdd(t)}
          >
            <Plus className="w-3.5 h-3.5 mr-2" />
            {BLOCK_LABELS[t]}
          </Button>
        ))}
      </div>
    </div>
  );
}