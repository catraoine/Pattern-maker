import { describe, expect, it } from 'vitest';
import { NEW_ACCOUNT } from './account';
import { DEFAULT_FINISH, Finish } from './savedWork';
import { PRO_TOOLS, SIMPLE_FINISH, finishFor, keepFinish, modeOf, shows } from './mode';

const pro: Finish = { ...DEFAULT_FINISH, allowances: 'couture', route: 'couture', skirtLined: true, bodiceEdges: 'lined', atelier: true, byHand: true };

describe('modeOf', () => {
  it('starts new people in the simple view', () => {
    expect(modeOf(NEW_ACCOUNT)).toBe('simple');
  });

  it('opens accounts from before the choice with all the tools', () => {
    expect(modeOf({ ...NEW_ACCOUNT, onboarded: true })).toBe('all');
  });

  it('keeps the chosen view', () => {
    expect(modeOf({ ...NEW_ACCOUNT, onboarded: true, mode: 'simple' })).toBe('simple');
    expect(modeOf({ ...NEW_ACCOUNT, mode: 'all' })).toBe('all');
  });
});

describe('shows', () => {
  it('shows every tool with all tools on', () => {
    for (const t of PRO_TOOLS) expect(shows('all', t)).toBe(true);
  });

  it('tucks the professional tools away in the simple view', () => {
    for (const t of PRO_TOOLS) expect(shows('simple', t)).toBe(false);
  });

  it('keeps starting from a photo in the simple view', () => {
    expect((PRO_TOOLS as readonly string[]).includes('photo')).toBe(false);
  });

  it('counts these as professional tools', () => {
    expect([...PRO_TOOLS].sort()).toEqual(
      ['byHand', 'checkFile', 'clientBook', 'couture', 'dartMoves', 'easeMap', 'insideFinish', 'makerPack', 'posture', 'sizeRun', 'techFlat', 'toile'].sort(),
    );
  });
});

describe('finishFor', () => {
  it('prints the simple view with home allowances, the quick route and no extra pages', () => {
    const f = finishFor({ ...pro, fabricWidth: 115, nap: true }, 'simple');
    expect(f).toMatchObject({ allowances: 'home', route: 'quick', skirtLined: false, bodiceEdges: 'binding', atelier: false, byHand: false });
    // What the simple view still shows is left as chosen.
    expect(f.fabricWidth).toBe(115);
    expect(f.nap).toBe(true);
  });

  it('leaves the finish alone with all tools', () => {
    expect(finishFor(pro, 'all')).toEqual(pro);
  });

  it('matches the app defaults for a new sewist', () => {
    expect(finishFor(DEFAULT_FINISH, 'simple')).toEqual({ ...DEFAULT_FINISH, ...SIMPLE_FINISH });
    expect(DEFAULT_FINISH.allowances).toBe('home');
    expect(DEFAULT_FINISH.route).toBe('quick');
  });
});

describe('keepFinish', () => {
  it('keeps choices made with all the tools when the simple view changes something else', () => {
    const shown = finishFor(pro, 'simple');
    const kept = keepFinish(pro, { ...shown, fabricWidth: 150, fabric: { fibre: 'linen' } }, 'simple');
    expect(kept).toEqual({ ...pro, fabricWidth: 150, fabric: { fibre: 'linen' } });
  });

  it('stores every change with all tools', () => {
    const next = { ...pro, allowances: 'industry' as const };
    expect(keepFinish(pro, next, 'all')).toEqual(next);
  });
});
