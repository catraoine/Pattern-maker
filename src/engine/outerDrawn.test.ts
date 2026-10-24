import { describe, expect, it } from 'vitest';
import { checkPattern } from './qc';
import { randomArms, randomBody, rng } from './randomBodies';
import { taggedLength } from './geometry';
import { draftOuter } from './outerwear';
import { outerFlat } from './flat';
import { EXAMPLE_VALUES } from '../measurements';

const m = EXAMPLE_VALUES as Parameters<typeof draftOuter>[0];
const bad = (d: ReturnType<typeof draftOuter>) => checkPattern(d.pieces.filter((pc) => !pc.kind), {}).filter((c) => !c.ok).map((c) => `${c.label} ${c.detail}`);

describe('jackets and coats drawn on the form', () => {
  it('cuts the front away in a curve from the hem to the front edge, the facing and lining with it', () => {
    const plain = draftOuter(m, { kind: 'jacket' });
    const cut = draftOuter(m, { kind: 'jacket', cutawayCm: 10 });
    expect(cut.cutaway?.up).toBe(10);
    const front = (d: typeof plain) => d.pieces.find((pc) => pc.name === 'Jacket front')!;
    expect(taggedLength(front(cut).outline, 'opening')).toBeLessThan(taggedLength(front(plain).outline, 'opening') - 8);
    expect(taggedLength(front(cut).outline, 'opening-hem')).toBeGreaterThan(12);
    const facing = cut.pieces.find((pc) => pc.name === 'Front facing')!;
    const lining = cut.pieces.find((pc) => pc.name === 'Front lining')!;
    expect(taggedLength(facing.outline, 'lining')).toBeCloseTo(taggedLength(lining.outline, 'lining'), 0);
    expect(bad(cut)).toEqual(bad(plain));
    expect(outerFlat(cut).views[0].shapes.length).toBeGreaterThan(0);
  });

  it('keeps a cutaway clear of the last button', () => {
    const d = draftOuter(m, { kind: 'jacket', cutawayCm: 40 });
    const foot = Math.max(...d.block[0].outline.points(4).map((q) => q.y));
    expect(foot - d.cutaway!.up - Math.max(...d.buttons.at)).toBeGreaterThanOrEqual(3);
  });

  it('puts the pockets where they were drawn, and the vent as long as drawn', () => {
    const plain = draftOuter(m, { kind: 'coat' });
    const moved = draftOuter(m, { kind: 'coat', pocketAt: { x: plain.pocket!.x + plain.pocket!.w / 2, y: plain.pocket!.y + 6 }, ventCm: 30 });
    expect(moved.pocket!.y).toBeCloseTo(plain.pocket!.y + 6, 1);
    expect(moved.vent!.length).toBeCloseTo(30, 0);
    expect(bad(moved)).toEqual(bad(plain));
  });

  it('drafts cutaways, moved pockets and vents for random bodies', () => {
    const r = rng(77);
    for (let i = 0; i < 16; i++) {
      const body = randomBody(r);
      const b = { ...body, ...randomArms(body, r) } as Parameters<typeof draftOuter>[0];
      for (const kind of ['jacket', 'coat'] as const) {
        const plain = draftOuter(b, { kind });
        const d = draftOuter(b, { kind, cutawayCm: 4 + r() * 14, ventCm: 10 + r() * 40, pocketAt: { x: 6 + r() * 10, y: plain.pocket!.y - 4 + r() * 12 } });
        expect(bad(d), `${i} ${kind}`).toEqual(bad(plain));
      }
    }
  });
});
