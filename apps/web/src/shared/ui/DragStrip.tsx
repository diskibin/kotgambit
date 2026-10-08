import { useEffect, useImperativeHandle, useRef, type ReactNode, type Ref } from 'react';

// Less than this is a click with a shaky hand, not a drag
const DRAG_THRESHOLD = 5;

interface DragStripProps {
  className?: string;
  children: ReactNode;
  ref?: Ref<HTMLDivElement> | undefined;
}

/**
 * A row that scrolls sideways and that a mouse can also drag. Touch and the wheel scroll it on their own,
 * only the mouse has nothing to grab without this.
 */
export function DragStrip({ className = '', children, ref }: DragStripProps) {
  const strip = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => strip.current as HTMLDivElement);

  useEffect(() => {
    const node = strip.current;
    if (!node) return;
    let origin: { x: number; left: number } | null = null;
    let dragged = false;

    const move = (event: MouseEvent) => {
      if (!origin) return;
      const shift = event.clientX - origin.x;
      if (!dragged && Math.abs(shift) < DRAG_THRESHOLD) return;
      dragged = true;
      node.style.cursor = 'grabbing';
      node.scrollLeft = origin.left - shift;
    };
    const stop = () => {
      origin = null;
      node.style.cursor = '';
      node.style.userSelect = '';
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', stop);
    };
    const start = (event: MouseEvent) => {
      if (event.button !== 0) return;
      origin = { x: event.clientX, left: node.scrollLeft };
      dragged = false;
      // Dragging over the cards must not select their text
      node.style.userSelect = 'none';
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', stop);
    };
    // The click that ends a drag must not open the card under the pointer
    const swallowClick = (event: MouseEvent) => {
      if (!dragged) return;
      dragged = false;
      event.preventDefault();
      event.stopPropagation();
    };
    // A picture inside would otherwise be dragged away as a file
    const keepPictures = (event: Event) => event.preventDefault();

    node.addEventListener('mousedown', start);
    node.addEventListener('click', swallowClick, true);
    node.addEventListener('dragstart', keepPictures);
    return () => {
      stop();
      node.removeEventListener('mousedown', start);
      node.removeEventListener('click', swallowClick, true);
      node.removeEventListener('dragstart', keepPictures);
    };
  }, []);

  return (
    <div ref={strip} className={`cursor-grab ${className}`}>
      {children}
    </div>
  );
}
