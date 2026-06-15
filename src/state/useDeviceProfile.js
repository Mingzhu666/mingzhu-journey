import { useEffect, useState } from 'react';

// Device profiling for mobile support.
//
// The diorama renders the SAME full 3D scene everywhere (we want to "preserve
// as much as possible" on phones), but a phone GPU can't afford the desktop's
// shadow map, post-processing, and pixel density. So instead of stripping the
// scene down, we scale its GPU cost by a coarse performance *tier*:
//
//   'high' — desktop / large pointer devices. Everything on, full quality.
//   'mid'  — tablets and capable phones. Lighter shadows + bloom, lower dpr.
//   'low'  — small / memory-constrained phones. Shadows off, minimal bloom,
//            dpr pinned to 1. The scene still shows every building, the car,
//            the track and the neon — just cheaply.
//
// `isTouch` drives interaction affordances (swipe hints, "Tap" vs key labels).

export function detectDeviceProfile() {
  if (typeof window === 'undefined') {
    return { isTouch: false, isMobile: false, tier: 'high' };
  }

  const coarse =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches;

  const w = window.innerWidth || 0;
  const h = window.innerHeight || 0;
  const minSide = Math.min(w, h);

  // A phone is a coarse pointer with a small short edge. A large coarse-pointer
  // device (tablet, touch laptop) is treated as touch-capable but not "mobile".
  const isMobile = coarse && minSide <= 900;

  const mem = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;

  let tier = 'high';
  if (isMobile) {
    const weak = mem <= 4 || cores <= 4 || minSide <= 480;
    tier = weak ? 'low' : 'mid';
  } else if (coarse) {
    tier = 'mid';
  }

  return { isTouch: coarse, isMobile, tier };
}

export function useDeviceProfile() {
  const [profile, setProfile] = useState(detectDeviceProfile);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const next = detectDeviceProfile();
        setProfile((prev) =>
          prev.isMobile === next.isMobile &&
          prev.tier === next.tier &&
          prev.isTouch === next.isTouch
            ? prev
            : next,
        );
      });
    };
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return profile;
}
