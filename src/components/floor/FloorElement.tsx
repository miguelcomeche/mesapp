import { FloorPlanElement } from '@/types/database';
import { cn } from '@/lib/utils';

interface Props {
  element: FloorPlanElement;
  isEditing: boolean;
  isSelected: boolean;
  onSelect?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
}

export function FloorElement({ element, isEditing, isSelected, onSelect, onDragStart }: Props) {
  const baseStyle: React.CSSProperties = {
    left: `${element.x}px`,
    top: `${element.y}px`,
    width: `${element.width}px`,
    height: `${element.height}px`,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
  };

  const interactive = isEditing
    ? 'cursor-move pointer-events-auto'
    : 'pointer-events-none';

  const selectedRing = isSelected
    ? 'ring-2 ring-primary ring-offset-2 ring-offset-background'
    : '';

  const content = (() => {
    switch (element.type) {
      case 'bar':
        return (
          <div className={cn('w-full h-full rounded-lg bg-muted/60 border border-border flex items-center justify-center', selectedRing)}>
            <span className="text-xs text-muted-foreground font-medium">{element.label || 'BARRA'}</span>
          </div>
        );
      case 'wall':
        return <div className={cn('w-full h-full bg-foreground/70 rounded-sm', selectedRing)} />;
      case 'separator':
        return <div className={cn('w-full h-full bg-border rounded-full', selectedRing)} />;
      case 'text':
        return (
          <div className={cn('w-full h-full flex items-center justify-center text-xs text-foreground font-medium', selectedRing)}>
            {element.label}
          </div>
        );
      case 'zone_block':
        return (
          <div className={cn('w-full h-full rounded-lg bg-accent/10 border-2 border-dashed border-accent/40 flex items-start justify-start p-2', selectedRing)}>
            <span className="text-xs text-muted-foreground font-medium">{element.label}</span>
          </div>
        );
      case 'decoration':
        return <div className={cn('w-full h-full rounded-full bg-emerald-500/40 border border-emerald-500/60', selectedRing)} />;
    }
  })();

  return (
    <div
      className={cn('absolute', interactive)}
      style={baseStyle}
      draggable={isEditing}
      onDragStart={onDragStart}
      onClick={isEditing ? (e) => { e.stopPropagation(); onSelect?.(); } : undefined}
    >
      {content}
    </div>
  );
}