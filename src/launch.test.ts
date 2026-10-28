import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { GARMENT_PROOF, LAUNCH_GARMENTS, TESTING_TOOLS, TestingTool, inTesting, stillInTesting } from './launch';
import { GARMENTS, GARMENT_NAME } from './measureFlow';

const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : join(dir, f).endsWith('.tsx') ? [join(dir, f)] : []));

describe('launch garments', () => {
  it('launches the dress, skirt and bodice and marks every other garment as in testing', () => {
    expect(LAUNCH_GARMENTS.sort()).toEqual(['bodice', 'dress', 'skirt']);
    for (const g of GARMENTS) expect(inTesting(g)).toBe(!LAUNCH_GARMENTS.includes(g));
    expect(inTesting(undefined)).toBe(false);
  });
});

// Nothing built stays "In testing" by accident (Cat, 2026-10-28): every tag on every screen is in the registry, every
// registry entry is on a screen, and the ship list names each of them, so the three can't drift apart.
describe('in-testing registry', () => {
  const screens = walk('src');
  const tagged = new Map<string, string[]>();
  for (const f of screens) for (const m of readFileSync(f, 'utf8').matchAll(/<TestingTag tool="(\w+)"/g)) tagged.set(m[1], [...(tagged.get(m[1]) ?? []), f]);
  const keys = Object.keys(TESTING_TOOLS) as TestingTool[];

  it('tags only tools in the registry', () => {
    for (const k of tagged.keys()) expect(keys, `${k} is tagged on ${tagged.get(k)?.join(', ')} but not in launch.ts`).toContain(k);
  });
  it('shows a tag on a screen for every registry entry', () => {
    for (const k of keys) expect([...tagged.keys()], `${k} is in launch.ts but tagged on no screen`).toContain(k);
  });
  it('lists everything still tagged, garments first, with what takes the tag off', () => {
    const left = stillInTesting((g) => GARMENT_NAME[g], GARMENTS);
    expect(left.map((t) => t.name)).toEqual([...GARMENTS.filter(inTesting).map((g) => `${GARMENT_NAME[g][0].toUpperCase()}${GARMENT_NAME[g].slice(1)}`), ...keys.map((k) => TESTING_TOOLS[k].name)]);
    for (const t of left) expect(t.proof.length).toBeGreaterThan(10);
    expect(left.filter((t) => t.proof === GARMENT_PROOF)).toHaveLength(GARMENTS.filter(inTesting).length);
  });
  it('names each of them in the ship list', () => {
    const doc = readFileSync('docs/SHIP-LIST.md', 'utf8');
    for (const k of keys) expect(doc, `${TESTING_TOOLS[k].name} is missing from docs/SHIP-LIST.md`).toContain(TESTING_TOOLS[k].name);
    for (const g of GARMENTS.filter(inTesting)) expect(doc.toLowerCase(), `${g} is missing from docs/SHIP-LIST.md`).toContain(GARMENT_NAME[g].toLowerCase());
  });
});
