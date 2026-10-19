import { describe, expect, it } from 'vitest';
import { NEW_ACCOUNT, makeBackup } from './account';
import { isMoveLink, moveLink, readMoveLink } from './moveLink';

const hash = (url: string) => url.slice(url.indexOf('#'));
const account = { ...NEW_ACCOUNT, onboarded: true, name: 'Zoë', patterns: [{ id: 'p1', name: 'Midi', savedAt: '2026-10-19' } as never] };

describe('send to another device', () => {
  it('carries everything after the #, packed, and reads it back', async () => {
    const backup = makeBackup({ unit: 'cm', values: { waist: 74 } }, account, { skirt: [{ id: 1 }] });
    const url = await moveLink('https://maisontrace.app', backup);
    expect(url.startsWith('https://maisontrace.app/#move=z.')).toBe(true);
    expect(isMoveLink(hash(url))).toBe(true);
    expect(await readMoveLink(hash(url))).toEqual(backup);
  });

  it('packs a full account small enough for a link', async () => {
    const patterns = Array.from({ length: 20 }, (_, i) => ({ id: `p${i}`, name: `Pattern ${i}`, garment: 'dress', choices: { fit: 'fitted', silhouette: 'a-line', length: 'midi' } }));
    const url = await moveLink('https://x.app', makeBackup({ unit: 'cm' }, { ...account, patterns: patterns as never }));
    expect(url.length).toBeLessThan(8000);
  });

  it('calls a cut-off link broken, and ignores other hashes', async () => {
    const url = await moveLink('https://x.app', makeBackup({ unit: 'cm' }, account));
    expect(await readMoveLink(hash(url).slice(0, 40))).toBe('broken');
    expect(await readMoveLink('#move=q.abc')).toBe('broken');
    expect(await readMoveLink('#measure=abc')).toBeNull();
    expect(isMoveLink('#measured=abc')).toBe(false);
  });
});
