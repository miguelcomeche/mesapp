import { useEffect, useRef } from 'react';
import { RotateCw } from 'lucide-react';

export interface TransformState {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

interface Props {
  state: TransformState;
  minWidth?: number;
  minHeight?: number;
  onChange: (next: TransformState) => void;
}

/**
 * Renders 4 corner resize handles + a rotation handle above the wrapped element.
 * Mounted as an absolutely positioned overlay; the parent element must be
 * positioned at the same x/y/width/height/rotation. The handles dispatch pointer
 * events that update the transform state.
 */
export function TransformControls({ state, minWidth = 20, minHeight = 20, onChange }: Props) {
  const startRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    initial: TransformState;
    mode: 'tl' | 'tr' | 'bl' | 'br' | 'rotate';
  } | null>(null);

  const handlePointerMove = (e: PointerEvent) => {
    const s = startRef.current;
    if (!s || e.pointerId !== s.pointerId) return;
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    if (s.mode === 'rotate') {
      // Compute angle from element center to pointer
      const cx = s.initial.x + s.initial.width / 2;
      const cy = s.initial.y + s.initial.height / 2;
      // dx/dy are screen-space; convert by adding initial pointer offset
      const px = s.startX + dx;
      const py = s.startY + dy;
      // We don't know canvas offset, but rotation only needs relative angle.
      const ang = Math.atan2(py - cy, px - cx) * (180 / Math.PI) + 90;
      const snapped = e.shiftKey ? Math.round(ang / 15) * 15 : Math.round(ang);
      onChange({ ...s.initial, rotation: ((snapped % 360) + 360) % 360 });
      return;
    }
    let { x, y, width, height } = s.initial;
    if (s.mode === 'br') {
      width = Math.max(minWidth, s.initial.width + dx);
      height = Math.max(minHeight, s.initial.height + dy);
    } else if (s.mode === 'tr') {
      width = Math.max(minWidth, s.initial.width + dx);
      const newH = Math.max(minHeight, s.initial.height - dy);
      y = s.initial.y + (s.initial.height - newH);
      height = newH;
    } else if (s.mode === 'bl') {
      const newW = Math.max(minWidth, s.initial.width - dx);
      x = s.initial.x + (s.initial.width - newW);
      width = newW;
      height = Math.max(minHeight, s.initial.height + dy);
    } else if (s.mode === 'tl') {
      const newW = Math.max(minWidth, s.initial.width - dx);
      const newH = Math.max(minHeight, s.initial.height - dy);
      x = s.initial.x + (s.initial.width - newW);
      y = s.initial.y + (s.initial.height - newH);
      width = newW;
      height = newH;
    }
    onChange({ ...s.initial, x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) });
  };

  const stop = (e: PointerEvent) => {
    if (startRef.current && e.pointerId === startRef.current.pointerId) {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      startRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const begin = (mode: 'tl' | 'tr' | 'bl' | 'br' | 'rotate') => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    startRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      initial: { ...state },
      mode,
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
  };

  const handle =
    'absolute w-3 h-3 rounded-sm bg-primary border border-background shadow-sm pointer-events-auto';

  return (
    <>
      <span className={`${handle} -top-1.5 -left-1.5 cursor-nwse-resize`} onPointerDown={begin('tl')} />
      <span className={`${handle} -top-1.5 -right-1.5 cursor-nesw-resize`} onPointerDown={begin('tr')} />
      <span className={`${handle} -bottom-1.5 -left-1.5 cursor-nesw-resize`} onPointerDown={begin('bl')} />
      <span className={`${handle} -bottom-1.5 -right-1.5 cursor-nwse-resize`} onPointerDown={begin('br')} />
      <span
        className="absolute left-1/2 -translate-x-1/2 -top-7 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center cursor-grab pointer-events-auto shadow"
        title="Rotar (Shift = 15°)"
        onPointerDown={begin('rotate')}
      >
        <RotateCw className="w-3 h-3" />
      </span>
    </>
  );
}