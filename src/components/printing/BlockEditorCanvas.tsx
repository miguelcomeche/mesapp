import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { BLOCK_LABELS, TicketBlock } from '@/types/tickets';
import { Button } from '@/components/ui/button';
import { GripVertical, Trash2, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

function Row({ block, selected, onSelect, onDelete, onDuplicate }: {
  block: TicketBlock;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };
  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={cn(
        'flex items-center gap-2 rounded-md border px-2 py-2 bg-card cursor-pointer',
        selected ? 'border-primary ring-1 ring-primary/40' : 'border-border hover:border-primary/40'
      )}
    >
      <button {...attributes} {...listeners} className="text-muted-foreground cursor-grab" onClick={(e) => e.stopPropagation()}>
        <GripVertical className="w-4 h-4" />
      </button>
      <span className="text-sm flex-1 truncate">{BLOCK_LABELS[block.type]}</span>
      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onDuplicate(); }} title="Duplicar">
        <Copy className="w-3.5 h-3.5" />
      </Button>
      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onDelete(); }} title="Eliminar">
        <Trash2 className="w-3.5 h-3.5 text-destructive" />
      </Button>
    </div>
  );
}

export function BlockEditorCanvas({
  blocks,
  selectedId,
  onSelect,
  onReorder,
  onDelete,
  onDuplicate,
}: {
  blocks: TicketBlock[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onReorder: (ids: string[]) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const handleDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const oldIdx = blocks.findIndex((b) => b.id === e.active.id);
    const newIdx = blocks.findIndex((b) => b.id === e.over!.id);
    if (oldIdx < 0 || newIdx < 0) return;
    onReorder(arrayMove(blocks, oldIdx, newIdx).map((b) => b.id));
  };

  if (blocks.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Añade bloques desde la paleta de la izquierda.
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-1.5">
          {blocks.map((b) => (
            <Row
              key={b.id}
              block={b}
              selected={selectedId === b.id}
              onSelect={() => onSelect(b.id)}
              onDelete={() => onDelete(b.id)}
              onDuplicate={() => onDuplicate(b.id)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}