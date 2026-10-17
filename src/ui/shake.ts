// Shake the phone to undo. iPhones ask permission for motion first, and only from a tap, so the
// app offers a button there; Android and others just listen.
import { useEffect, useRef, useState } from 'react';

type MotionPermission = { requestPermission?: () => Promise<'granted' | 'denied'> };

const motion = () => (typeof window !== 'undefined' && 'DeviceMotionEvent' in window ? (window.DeviceMotionEvent as unknown as MotionPermission) : undefined);
const touch = () => typeof window !== 'undefined' && matchMedia('(pointer: coarse)').matches;

export type ShakeState = 'unavailable' | 'ask' | 'on' | 'denied';

/**
 * Three hard jolts within a second count as a shake; then it rests for a second. A jolt is the phone
 * moving hard (gravity taken out) at least 100 ms after the last one, so a single knock, like putting
 * the phone down, counts once however many readings it rattles through.
 */
export function useShake(onShake: () => void): { state: ShakeState; enable: () => void } {
  const m = motion();
  const [state, setState] = useState<ShakeState>(() => (!m || !touch() ? 'unavailable' : m.requestPermission ? 'ask' : 'on'));
  const handler = useRef(onShake);
  handler.current = onShake;

  useEffect(() => {
    if (state !== 'on') return;
    let jolts: number[] = [];
    let restUntil = 0;
    let gravity: { x: number; y: number; z: number } | undefined;
    const listen = (e: DeviceMotionEvent) => {
      const now = performance.now();
      // Most phones give the movement with gravity already taken out; otherwise follow gravity slowly and take it out here.
      let move = e.acceleration;
      if (move?.x == null || move.y == null || move.z == null) {
        const a = e.accelerationIncludingGravity;
        if (a?.x == null || a.y == null || a.z == null) return;
        gravity = gravity ? { x: 0.9 * gravity.x + 0.1 * a.x, y: 0.9 * gravity.y + 0.1 * a.y, z: 0.9 * gravity.z + 0.1 * a.z } : { x: a.x, y: a.y, z: a.z };
        move = { x: a.x - gravity.x, y: a.y - gravity.y, z: a.z - gravity.z };
      }
      if (now < restUntil || Math.hypot(move.x!, move.y!, move.z!) < 12) return;
      if (jolts.length && now - jolts[jolts.length - 1] < 100) return;
      jolts = [...jolts.filter((t) => now - t < 1000), now];
      if (jolts.length >= 3) {
        jolts = [];
        restUntil = now + 1000;
        handler.current();
      }
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
