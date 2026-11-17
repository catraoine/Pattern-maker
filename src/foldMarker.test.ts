import { describe, expect, it } from 'vitest';
import { COLLECTION, lookPatch } from './collection';
import { ARCHIVE } from './archive';
import { printedPattern, patternDesigns } from './patternSweep';
import { EXAMPLE_BODY } from './measurements';
import { edgeLabels } from './engine/marks';

// A piece cut on the fold has to show which edge goes on it. The Ice Peplum's neck ruffle said "Cut 1 on fold" with
// no PLACE ON FOLD bracket, and the only FOLD on it was the lengthwise fold line, so its end could be cut off the fold
// and the strip come out half as long (tester sweep, Nov 17). Every printed piece's cut line and its fold now agree.
describe('pieces cut on the fold', () => {
  const designs: [string, Parameters<typeof printedPattern>[0]][] = [];
  for (const l of [...COLLECTION, ...ARCHIVE]) {
    const { garment, ...saved } = lookPatch(l, EXAMPLE_BODY);
    designs.push([`look ${l.name}`, { garment, saved: saved as never, finish: l.finish }]);
  }
  for (const d of patternDesigns()) designs.push([`option ${d.key}`, d]);
  it('say so on the cut line exactly when the piece marks the edge that goes on the fold', () => {
    const wrong: string[] = [];
    for (const [name, d] of designs) {
      let made;
      try {
        made = printedPattern(d, EXAMPLE_BODY).made;
      } catch {
        continue; // A design that doesn't draft is the pattern sweep's to report.
      }
      for (const pc of made.pieces) if (/fold/i.test(pc.cut) !== !!pc.fold) wrong.push(`${name}: ${pc.name} (${pc.cut})`);
    }
    expect(wrong).toEqual([]);
  }, 600000);

  // Its fold end is the ruffle's middle, which the booklet pins to the centre front; it read CENTRE BACK.
  it('name the Ice Peplum ruffle fold end for the centre front it goes to', () => {
    const look = COLLECTION.find((l) => l.name === 'Ice Peplum Top')!;
    const { garment, ...saved } = lookPatch(look, EXAMPLE_BODY);
    const ruffle = printedPattern({ garment, saved: saved as never, finish: look.finish }, EXAMPLE_BODY).made.pieces.find((pc) => pc.name === 'Neck ruffle')!;
    const words = edgeLabels(ruffle).map((l) => l.text);
    expect(words).toContain('CENTRE FRONT');
    expect(words).not.toContain('CENTRE BACK');
  });
});
