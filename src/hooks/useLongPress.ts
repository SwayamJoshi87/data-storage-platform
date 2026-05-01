import { useRef } from 'react';

export function useLongPress(callback: () => void, ms = 550) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const originRef = useRef<{ x: number; y: number } | null>(null);

  const cancel = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    originRef.current = null;
  };

  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse') return;
      originRef.current = { x: e.clientX, y: e.clientY };
      timerRef.current = setTimeout(() => {
        navigator.vibrate?.(30);
        callback();
      }, ms);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!originRef.current) return;
      const dx = Math.abs(e.clientX - originRef.current.x);
      const dy = Math.abs(e.clientY - originRef.current.y);
      if (dx > 8 || dy > 8) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
  };
}
