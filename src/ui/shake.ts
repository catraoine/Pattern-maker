// Shake the phone to undo. iPhones ask permission for motion first, and only from a tap, so the
// app offers a button there; Android and others just listen.
import { useEffect, useRef, useState } from 'react';

type MotionPermission = { requestPermission?: () => Promise<'granted' | 'denied'> };

const motion = () => (typeof window !== 'undefined' && 'DeviceMotionEvent' in window ? (window.DeviceMotionEvent as unknown as MotionPermission) : undefined);
const touch = () => typeof window !== 'undefined' && matchMedia('(pointer: coarse)').matches;

export type ShakeState = 'unavailable' | 'ask' | 'on' | 'denied';

/** Three hard jolts within 800 ms count as a shake; then it rests for a second. */
export function useShake(onShake: () => void): { state: ShakeState; enable: () => void } {
  const m = motion();
  const [state, setState] = useState<ShakeState>(() => (!m || !touch() ? 'unavailable' : m.requestPermission ? 'ask' : 'on'));
  const handler = useRef(onShake);
  handler.current = onShake;

  useEffect(() => {
    if (state !== 'on') return;
    let jolts: number[] = [];
    let restUntil = 0;
    let last: { x: number; y: number; z: number } | undefined;
    const listen = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity;
      if (!a || a.x === null || a.y === null || a.z === null) return;
      const now = performance.now();
      const cur = { x: a.x, y: a.y, z: a.z };
      if (last && now > restUntil) {
        const change = Math.hypot(cur.x - last.x, cur.y - last.y, cur.z - last.z);
        if (change > 18) {
          jolts = [...jolts.filter((t) => now - t < 800), now];
          if (jolts.length >= 3) {
            jolts = [];
            restUntil = now + 1000;
            handler.current();
          }
        }
      }
      last = cur;
    };
    window.addEventListener('devicemotion', listen);
    return () => window.removeEventListener('devicemotion', listen);
  }, [state]);

  const enable = () => {
    m?.requestPermission?.().then(
      (r) => setState(r === 'granted' ? 'on' : 'denied'),
      () => setState('denied'),
    );
  };
  return { state, enable };
}
