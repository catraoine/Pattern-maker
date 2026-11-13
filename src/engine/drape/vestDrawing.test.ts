import { afterEach, describe, expect, it } from 'vitest';
import { COLLECTION } from '../../collection';
import { drapeDesign } from '../../drapeSweep';
import { draftOuter } from '../outerwear';
import { EXAMPLE_BODY } from '../../measurements';
import { setKnob } from './knob';

// The Black Vest in All round (Cat Nov 12, "Fix"): its collar point lies where the flat puts it, not out past the
// shoulder, and its lapel runs on into the front edge at the break with no step beside the top button.
const look = COLLECTION.find((l) => l.id === 'black-vest')!;
const sew = () => drapeDesign({ garment: 'jacket', saved: { garment: 'jacket', jacket: look.choices as never }, fibre: 'wool', crisp: true });
const lapel = draftOuter(EXAMPLE_BODY as never, { ...(look.choices as object), kind: 'jacket' } as never).lapel!;
type Lite = ReturnType<typeof sew>;
const panel = (d: Lite, role: string) => d.panels.find((p) => !p.hidden && p.role === role)!;
const cut = (p: Lite['panels'][number], i: number) => ({ x: p.uv[i * 2], y: -p.uv[i * 2 + 1] });

/** How far the collar's point lies from the place on the front the flat puts it, round the body, in cm. */
function pointOff(d: Lite): number {
  const front = panel(d, 'front');
  const collar = panel(d, 'collar');
  let c = 0;
  for (let i = 0; i < collar.uv.length / 2; i++) if (collar.uv[i * 2] > collar.uv[c * 2]) c = i;
  let f = -1;
  let best = Infinity;
  for (let i = 0; i < front.uv.length / 2; i++) {
    if (front.turned?.[i]) continue;
    const q = cut(front, i);
    const dd = Math.hypot(q.x - lapel.collarPoint.x, q.y - lapel.collarPoint.y);
    if (dd < best) [best, f] = [dd, i];
  }
  const [C, F] = [(collar.base + c) * 3, (front.base + f) * 3];
  return Math.hypot(d.pos[C] - d.pos[F], d.pos[C + 1] - d.pos[F + 1]);
}

/** How far past the centre line the lapel lies within 1.5 cm of the break, cm. */
function pastCentre(d: Lite): number {
  let most = 0;
  for (const p of d.panels) {
    if (p.hidden || p.role !== 'front') continue;
    for (let i = 0; i < p.uv.length / 2; i++) {
      const q = cut(p, i);
      if (!p.turned?.[i] || Math.hypot(q.x - lapel.breakPt.x, q.y - lapel.breakPt.y) > 1.5) continue;
      most = Math.max(most, -d.pos[(p.base + i) * 3]);
    }
  }
  return most;
}

describe('the Black Vest drawn in All round', () => {
  afterEach(() => {
    setKnob('__noCollarPoint', undefined);
    setKnob('__noLapelBreak', undefined);
  });
  it('lays its collar point nearer where the flat puts it, and runs its lapel into the front edge at the break', () => {
    setKnob('__noCollarPoint', 1);
    setKnob('__noLapelBreak', 1);
    const was = sew();
    setKnob('__noCollarPoint', undefined);
    setKnob('__noLapelBreak', undefined);
    const now = sew();
    expect(pastCentre(was)).toBeGreaterThan(1);
    expect(pastCentre(now)).toBeLessThan(0.5);
    expect(pointOff(now)).toBeLessThan(pointOff(was) - 0.5);
    expect(now.quality.ok).toBe(true);
  });
}, 300000);
