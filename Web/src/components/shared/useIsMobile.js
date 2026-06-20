'use client';
import { useState, useEffect } from 'react';

/**
 * Hook for viewport-based conditional rendering / styling.
 *
 * Because this project uses inline `style={{...}}` everywhere (no
 * Tailwind, no CSS modules), media queries can't live in a stylesheet
 * for the bits that actually need to change. This hook surfaces the
 * current breakpoint as a boolean so components can swap styles inline:
 *
 *   const isMobile = useIsMobile();
 *   <div style={{
 *     padding: isMobile ? 12 : 24,
 *     flexDirection: isMobile ? 'column' : 'row',
 *   }}>
 *
 * Server-side: returns `false` (desktop). Hydration mismatch is avoided
 * by initializing matchMedia only after mount.
 *
 * Breakpoints chosen to match common phone widths:
 *   - mobile:  < 768px (covers iPhone SE through Pro Max)
 *   - tablet:  768-1024px (iPad portrait)
 *   - desktop: > 1024px (laptop / desktop / iPad landscape)
 */
export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const update = () => setIsMobile(mq.matches);
    update();                             // initial value after mount
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [breakpoint]);

  return isMobile;
}

export function useIsTablet() {
  const [isTablet, setIsTablet] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 768px) and (max-width: 1023px)');
    const update = () => setIsTablet(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return isTablet;
}

/**
 * Returns the device class as one string: 'mobile' | 'tablet' | 'desktop'.
 * Useful for switch-style branching when more than two states matter.
 */
export function useDeviceClass() {
  const isMobile = useIsMobile(768);
  const isTablet = useIsTablet();
  if (isMobile) return 'mobile';
  if (isTablet) return 'tablet';
  return 'desktop';
}
