import { type ReactNode, type RefObject, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/shared/ui/cn';

export interface AnchoredPopoverProps {
  open: boolean;
  triggerRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  children: ReactNode;
  minSpaceBelow?: number;
  matchTriggerWidth?: boolean;
  className?: string;
}

/**
 * Capa flotante portalizada a `document.body` para escapar contenedores con `overflow-y-auto`
 * sin recorte y escalar desde el borde del disparador (`150 ms --ease-out`).
 */
export function AnchoredPopover({
  open,
  triggerRef,
  onClose,
  children,
  minSpaceBelow = 260,
  matchTriggerWidth = true,
  className,
}: AnchoredPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const trigger = triggerRef.current;
      const popover = popoverRef.current;
      if (!trigger || !popover) return;

      const rect = trigger.getBoundingClientRect();
      const viewportWidth = window.innerWidth || 1024;
      const viewportHeight = window.innerHeight || 768;
      const spaceBelow = viewportHeight - rect.bottom;
      const openAbove = spaceBelow < minSpaceBelow && rect.top > spaceBelow;

      const measuredWidth = popover.offsetWidth || rect.width;
      const targetWidth = matchTriggerWidth ? Math.max(rect.width, 260) : measuredWidth;
      const maxWidth = Math.max(240, viewportWidth - 24);
      const clampedWidth = Math.min(targetWidth, maxWidth);
      const clampedLeft = Math.max(12, Math.min(rect.left, viewportWidth - clampedWidth - 12));

      if (matchTriggerWidth) {
        popover.style.width = `${clampedWidth}px`;
      } else {
        popover.style.minWidth = `${Math.min(rect.width, maxWidth)}px`;
        popover.style.maxWidth = `${maxWidth}px`;
      }

      popover.style.left = `${clampedLeft}px`;

      if (openAbove) {
        popover.style.top = 'auto';
        popover.style.bottom = `${Math.max(12, viewportHeight - rect.top + 6)}px`;
        popover.style.transformOrigin = 'bottom left';
      } else {
        popover.style.bottom = 'auto';
        popover.style.top = `${Math.min(viewportHeight - 40, rect.bottom + 6)}px`;
        popover.style.transformOrigin = 'top left';
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, triggerRef, minSpaceBelow, matchTriggerWidth]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      onClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, triggerRef, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      ref={popoverRef}
      className={cn(
        'fixed z-20 overscroll-contain rounded-xl border border-line bg-surface shadow-lg',
        'scale-100 opacity-100 transition-[opacity,transform] duration-150 ease-(--ease-out) motion-reduce:transition-opacity',
        'starting:scale-[0.97] starting:opacity-0 motion-reduce:starting:scale-100',
        className,
      )}
    >
      {children}
    </div>,
    document.body,
  );
}
