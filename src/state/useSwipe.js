import { useRef } from 'react';

// Tiny touch-swipe helper. Returns onTouchStart/onTouchEnd handlers you spread
// onto any element. It picks the dominant axis and fires the matching callback
// once the gesture clears `threshold` px — short taps (e.g. tapping a nav
// button or a 3D chip) never trigger a swipe.
//
// Used by the full-screen station overlays (horizontal swipe = next/prev item)
// so touch visitors get the same flow the arrow keys give on desktop.

export function useSwipe({ onLeft, onRight, onUp, onDown, threshold = 45 } = {}) {
  const start = useRef(null);

  const onTouchStart = (e) => {
    const t = e.touches && e.touches[0];
    start.current = t
      ? { x: t.clientX, y: t.clientY, multi: e.touches.length > 1 }
      : null;
  };

  const onTouchEnd = (e) => {
    const s = start.current;
    start.current = null;
    if (!s || s.multi) return;
    const t = e.changedTouches && e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return;
    if (Math.abs(dx) >= Math.abs(dy)) {
      if (dx < 0) onLeft && onLeft();
      else onRight && onRight();
    } else {
      if (dy < 0) onUp && onUp();
      else onDown && onDown();
    }
  };

  return { onTouchStart, onTouchEnd };
}
