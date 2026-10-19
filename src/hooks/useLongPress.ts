import { useCallback, useEffect, useRef } from "react";

/**
 * Press-and-hold detection that plays nicely with scrolling and native media
 * controls. Returns pointer handlers to spread on the target element; movement
 * of more than 10px cancels, as does lifting the finger or leaving the element.
 */
export function useLongPress(onLongPress: () => void, delay = 500) {
  const timer = useRef<number | undefined>(undefined);
  const origin = useRef<{ x: number; y: number } | null>(null);

  const cancel = useCallback(() => {
    if (timer.current !== undefined) window.clearTimeout(timer.current);
    timer.current = undefined;
    origin.current = null;
  }, []);

  useEffect(() => cancel, [cancel]);

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("video, audio, a, button, input, textarea")) return;
    cancel();
    origin.current = { x: e.clientX, y: e.clientY };
    timer.current = window.setTimeout(() => {
      timer.current = undefined;
      origin.current = null;
      onLongPress();
    }, delay);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!origin.current) return;
    const dx = e.clientX - origin.current.x;
    const dy = e.clientY - origin.current.y;
    if (Math.hypot(dx, dy) > 10) cancel();
  }

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
  };
}
