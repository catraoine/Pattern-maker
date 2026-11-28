import { describe, expect, it } from 'vitest';
import { COLLECTION, lookFabric, lookPatch } from './collection';
import { GARMENT_DRAFTING, DraftInputs, dressOf, skirtStyleOf, trousersChoicesOf } from './garmentDrafts';
import { DEFAULT_FINISH, INITIAL, Finish, Saved } from './savedWork';
import { SIMPLE_FINISH } from './mode';
import { clothFor } from './engine/fabrics';
import { printableFor } from './printable';
import { withEstimates } from './estimate';
import { taggedLength } from './engine/geometry';
import type { MeasurementValues } from './measurements';
import { MARK_TEXT, type Piece } from './engine/piece';
import { cutCollisions, diamondCollisions, footerCollisions, grainCollisions, labelCollisions, layout, textWidth } from './engine/export';
import { crossings } from './engine/easeMap';
import { edgeLabels } from './engine/marks';
import { checkPattern } from './engine/qc';
import { inInches } from './units';

// The five pieces the fit testers sew (Blush Shift, Ice Peplum Top, Black Pleated Skirt, Chocolate Barrel Trouser and the
// Black Vest), made the way the app makes a look, in its own cloth, on a small, a middle and a large body, and read as a
// pattern cutter reads a pattern before it is cut (tester pattern review, 2026-11-13): what the first page and the steps
// say has to be what the pieces are.
const BODIES: Record<string, MeasurementValues> = {
  small: { height: 162, waist: 66, full_bust: 84, high_bust: 81, underbust: 72, full_hip: 86, waist_to_hip: 19.5, waist_to_knee: 56, waist_to_floor: 100, nape_to_waist: 39.5, shoulder_width: 37, crotch_depth: 25.5, crotch_length: 62, arm_length: 57, upper_arm: 26, wrist: 15 },
  middle: { height: 166, waist: 83, full_bust: 100, high_bust: 93, underbust: 85, full_hip: 105, waist_to_hip: 21, waist_to_knee: 59, waist_to_floor: 103, nape_to_waist: 41, shoulder_width: 39.5, crotch_depth: 28, crotch_length: 73, arm_length: 59, upper_arm: 31.5, wrist: 16.5 },
  large: { height: 168, waist: 114, full_bust: 128, high_bust: 117, underbust: 111, full_hip: 136, waist_to_hip: 22.5, waist_to_knee: 60, waist_to_floor: 104, nape_to_waist: 42, shoulder_width: 42, crotch_depth: 31.5, crotch_length: 88, arm_length: 60, upper_arm: 41, wrist: 18.5 },
};

/** A look's printed pattern as the app makes it: its choices fitted to the body, in the cloth it is named for. */
function made(id: string, body: MeasurementValues) {
  const look = COLLECTION.find((l) => l.id === id)!;
  const values = withEstimates(body);
  const { garment, ...next } = lookPatch(look, values);
  const fabric = lookFabric(look.fabric);
  const finish = { ...DEFAULT_FINISH, ...SIMPLE_FINISH, ...look.finish, fabric, cloth: clothFor(fabric, DEFAULT_FINISH.cloth) } as Finish;
  const saved = { ...INITIAL, ...next, garment, finish } as Saved;
  const inputs: DraftInputs = { saved, form: 'womenswear', fabric };
  const result = GARMENT_DRAFTING[garment].draft(values, inputs, undefined);
  const print = printableFor({ result, values, finish, fabric, garment, ownFitting: undefined, carriedNotes: [], saved: { choices: saved.choices, bodice: saved.bodice }, dress: dressOf(saved), skirtStyle: skirtStyleOf(inputs, undefined), trousersChoices: trousersChoicesOf(saved) });
  if (!print) throw new Error(`${id} did not print`);
  return print;
}

const piece = (pieces: Piece[], name: string) => pieces.find((pc) => pc.name === name)!;
const step = (p: ReturnType<typeof made>, title: string) => p.guide.steps.find((s) => s.title === title)!.text;
/** The two ends of a piece's side seam, top first. */
function sideEnds(pc: Piece) {
  const { pts, tags } = pc.outline.taggedPoints(24);
  const on = pts.filter((_, i) => tags[i] === 'side' || tags[i - 1] === 'side');
  return on[0].y < on[on.length - 1].y ? [on[0], on[on.length - 1]] : [on[on.length - 1], on[0]];
}

describe.each(Object.entries(BODIES))('the Ice Peplum Top on a %s body', (_size, body) => {
  const p = made('ice-peplum', body);

  it('cuts the bodice edge and the sleeve edge with the seam allowance their steps sew, not the sheer hem', () => {
    for (const name of ['Bodice centre front', 'Bodice side front', 'Bodice centre back', 'Bodice side back', 'Sleeve']) expect(piece(p.pieces, name).allowances.hem, name).toBe(1.5);
    expect(step(p, 'Attach the peplum')).toContain('Sew 1.5 cm from the edge');
    expect(step(p, 'Attach the sleeve bands')).toContain('sew 1.5 cm from the edge');
    // The peplum's own hem is the sheer's narrow one, and the first page says so.
    expect(piece(p.pieces, 'Peplum front').allowances.hem).toBe(1);
    expect(p.notes.join(' ')).toContain('1 cm at the hem');
    expect(p.notes.join(' ')).not.toContain('2.5 cm at the hem');
  });

  it('asks for no more loops than fit down the back, and the same number everywhere', () => {
    const n = Number(/(\d+) small buttons and loops/.exec(p.notes.join(' '))![1]);
    const back = taggedLength(piece(p.pieces, 'Bodice centre back').outline, 'centre');
    // The first loop is 1 cm below the neck, the rest 2.5 cm apart, the last at least 1 cm above the peplum seam.
    expect(1 + (n - 1) * 2.5).toBeLessThanOrEqual(back - 1 + 1e-6);
    expect(step(p, 'Close the back with buttons and loops')).toContain(`mark ${n} points`);
    expect(step(p, 'Make the rouleau loops')).toContain(`into ${n} loops`);
    expect(p.guide.notions.join(' | ')).toContain(`${n} covered buttons`);
    expect(p.spec.find((r) => /centre back$/.test(r.label))).toEqual({ label: 'Buttons and loops, centre back', finished: `${n}` });
  });

  it("finishes the peplum's open edges on the centre back line, as the bodice's are", () => {
    // As halves of the allowance, not lengths: 0.75 cm read as 1/4 in each time in the inch booklet, 1/2 in of a 5/8 in
    // allowance, so the edges overlapped (pretend tester DX walk, Nov 22).
    expect(step(p, 'Close the back with buttons and loops')).toContain('Turn the 1.5 cm allowance on both backs under twice, half of it each time');
    expect(step(p, 'Make the peplum')).toContain('Turn the open edges in twice, half the 1.5 cm allowance each time');
    expect(inInches(step(p, 'Close the back with buttons and loops'))).toContain('Turn the ⅝ in allowance on both backs under twice, half of it each time');
  });

  it('labels the centre back an opening, as the booklet sews it, never a seam (DX walk, Nov 22)', () => {
    for (const name of ['Bodice centre back', 'Peplum back']) {
      const pc = p.pieces.find((x) => x.name.startsWith(name));
      expect(pc, name).toBeDefined();
      const words = edgeLabels(pc!).map((l) => l.text).join(' | ');
      expect(words, name).toContain('CENTRE BACK OPENING');
      expect(words, name).not.toContain('CENTRE BACK SEAM');
    }
  });

  it('says the whole sleeve hem drawn up to the band, and the crown ease front and back, with no total to disagree with them in inches', () => {
    const band = step(p, 'Attach the sleeve bands');
    const [hem, cuff] = /the ([\d.]+) cm sleeve hem is drawn up to the ([\d.]+) cm band/.exec(band)!.slice(1).map(Number);
    // A bishop sleeve: its hem much fuller than the band it is gathered into.
    expect(hem).toBeGreaterThan(cuff * 1.5);
    const crown = step(p, 'Ease the sleeve heads');
    expect(crown).toMatch(/longer than the armhole by its ease, [\d.]+ cm at the front and [\d.]+ cm at the back/);
    expect(crown).not.toMatch(/The crown is [\d.]+ cm longer/);
  });

  it('says the back shoulder ease is split between its two panels', () => {
    expect(step(p, 'Sew the shoulders')).toContain('1 cm longer, half of it on each of its two panels');
  });

  it('lists no interfacing, which no step uses, and says the sheer is cut single layer in place of folding', () => {
    expect(p.guide.notions.join(' | ')).not.toMatch(/interfacing/);
    expect(p.guide.steps.some((s) => /interfac/i.test(s.text))).toBe(false);
    expect(step(p, 'Cut the sheer')).toContain('Where the cutting step puts a piece on the fold, trace the piece out whole first');
  });

  it('runs the front and back side seams the same way below the waist', () => {
    const drop = (name: string) => {
      const pc = piece(p.pieces, name);
      const { pts, tags } = pc.outline.taggedPoints(24);
      const side = pts.filter((_, i) => tags[i] === 'side' || tags[i - 1] === 'side').sort((a, b) => a.y - b.y);
      const hem = side[side.length - 1];
      // Where the seam is 6 cm above its foot: the waist, the peplum seam being 6 cm below it.
      const waist = side.reduce((best, q) => (Math.abs(hem.y - q.y - 6) < Math.abs(hem.y - best.y - 6) ? q : best));
      return hem.x - waist.x;
    };
    const front = drop('Bodice side front');
    const back = drop('Bodice side back');
    expect(Math.abs(front - back)).toBeLessThan(0.5);
    expect(taggedLength(piece(p.pieces, 'Bodice side front').outline, 'side')).toBeCloseTo(taggedLength(piece(p.pieces, 'Bodice side back').outline, 'side'), 1);
  });
});

describe.each(Object.entries(BODIES))('the other tester pieces on a %s body', (_size, body) => {
  it("gives the Blush Shift's table the hip its pieces and first page have", () => {
    const p = made('blush-shift', body);
    const hip = p.spec.find((r) => r.label === 'Hip')!;
    expect(p.notes[0]).toContain(`hip ${hip.finished} cm`);
    expect(hip.ease).toBe(5);
    expect(step(p, 'Line the neck and armholes')).toContain('stop every line of stitching 3 cm short of the shoulder edges');
  });

  it("sets the Blush Shift's back dart about halfway across the body's back waist, not out past the shoulder blade", () => {
    // Placed from the roomy back piece, the dart sat 13 cm from the centre back at a 109 hip (Cat, CLO, Nov 14).
    const xs = piece(made('blush-shift', body).pieces, 'Dress back').lines.flatMap((l) => l.taggedPoints(8).pts.map((q) => q.x));
    const middle = (Math.min(...xs) + Math.max(...xs)) / 2;
    const half = body.waist! / 8;
    expect(middle).toBeGreaterThan(half);
    expect(middle).toBeLessThan(half + 2);
  });

  it("writes the Black Pleated Skirt's waist to the millimetre, no finer", () => {
    expect(made('black-pleated-skirt', body).notes[0]).toMatch(/^Finished waist \d+(\.\d)? cm,/);
  });

  it('puts the Barrel Trouser buttonhole in the end that laps over and the button on the underlap', () => {
    const p = made('chocolate-barrel', body);
    expect(step(p, 'Finish')).toContain('buttonhole in the end of the waistband on the left front');
    expect(step(p, 'Finish')).toContain('button to the extension marked UNDERLAP on the right front');
    expect(piece(p.pieces, 'Waistband').labels.map((l) => l.text)).toContain('UNDERLAP');
    expect(step(p, 'Put in the fly zip')).toContain("stitch the zip's free tape to the fly facing only");
  });

  it('describes no sleeve on the sleeveless Black Vest, and finishes the foot of its facings', () => {
    const p = made('black-vest', body);
    expect(p.pieces.some((pc) => /sleeve/i.test(pc.name))).toBe(false);
    expect(p.notes.join(' ')).not.toMatch(/Sleeve: bicep/);
    expect(step(p, 'Hem the vest')).toContain('Leave the front facings unfolded at the hem for now');
    expect(step(p, 'Bag the lining')).toContain('finish the foot of each front facing');
    // The front and back side seams are still one length.
    const [ft, fb] = sideEnds(piece(p.pieces, 'Vest front'));
    const [bt, bb] = sideEnds(piece(p.pieces, 'Vest back'));
    expect(Math.hypot(fb.x - ft.x, fb.y - ft.y)).toBeCloseTo(Math.hypot(bb.x - bt.x, bb.y - bt.y), 1);
  });

  // Fit-test walk, Nov 15: the vest was called a jacket on its pieces, and asked for arm measurements it doesn't use.
  it('calls the Black Vest a vest, and prints the same with or without arm measurements', () => {
    const { arm_length: _a, upper_arm: _u, ...noArms } = body;
    const print = (v: MeasurementValues) => made('black-vest', v);
    const all = (p: ReturnType<typeof made>) => JSON.stringify([p.pieces.map((pc) => [pc.name, pc.labels.map((l) => l.text), pc.outline.taggedPoints(24).pts.map((q) => [q.x.toFixed(3), q.y.toFixed(3)])]), p.notes, p.guide.steps]);
    const without = all(print(noArms));
    expect(without).not.toMatch(/jacket/i);
    expect(print(noArms).pieces.map((pc) => pc.name)).toContain('Vest front');
    expect(all(print({ ...noArms, arm_length: 50, upper_arm: 36 }))).toBe(without);
    expect(all(print({ ...noArms, arm_length: 64, upper_arm: 26 }))).toBe(without);
  });
});

// A joining diamond printed over "WAIST · 5/8 IN ALLOWANCE" on the skirt's first Letter page (pretend tester DJ walk,
// Nov 19): on every tester piece, on every body, the labels keep off the diamonds of both home papers. A waistband is
// the one exception: a long, narrow band laid along a page join has a diamond every few cm, with no gap for its name.
// DR walk, Nov 20: the band cleared under each page's footer cut the labels in that row short ("SIDE SEA", "PANE").
describe('the page footers', () => {
  for (const id of ['blush-shift', 'ice-peplum', 'black-pleated-skirt', 'chocolate-barrel', 'black-vest'])
    it(`have no piece words in their row on ${id}`, () => {
      for (const values of Object.values(BODIES)) {
        const print = made(id, values);
        const hit = footerCollisions(layout(print.pieces, `Maison Tracé: ${id}`, print.notes, { pattern: id }));
        // The labels that move out of the way: the seam names and the finished measurement words.
        expect(hit.filter((h) => /ALLOWANCE|^FINISHED |^YOU /.test(h.text)).map((h) => `${print.pieces[h.piece].name}: ${h.text}`)).toEqual([]);
      }
    });
});

describe('the grain and fold words', () => {
  // DS walk, Nov 21: "FOLD" sat on "PAGE D9". They keep out of the footer row where they can: 35 sat in it across these
  // pieces and bodies, and the 8 left would land on a diamond if pushed out.
  it('are seldom in the footer row', () => {
    const hit = ['blush-shift', 'ice-peplum', 'black-pleated-skirt', 'chocolate-barrel', 'black-vest'].flatMap((id) =>
      Object.values(BODIES).flatMap((values) => {
        const print = made(id, values);
        return footerCollisions(layout(print.pieces, `Maison Tracé: ${id}`, print.notes, { pattern: id })).filter((h) => /^(GRAIN|FOLD|PLACE ON FOLD|CREASE LINE ON GRAIN)$/.test(h.text));
      }),
    );
    expect(hit.length).toBeLessThanOrEqual(8);
  });
});

describe('the page cut lines', () => {
  // DR walk, Nov 20: "ALLOWANCE" ran across skirt page A2's cut line, so half of it was cut away with the strip. The
  // seam names and the finished measurement words keep off the cut lines where they have room: 74 of them crossed one
  // across these pieces and bodies, and the 37 left have nowhere else to go on their seam, or would land on a diamond
  // (taped, they read whole). 40 since the Ice Peplum's darts were left open at its peplum seam: its pieces moved a few mm
  // and 4 more words landed on a page join on the small body (Cat chose "Allow 40", Nov 24).
  it('have few piece words across them', () => {
    const hit = ['blush-shift', 'ice-peplum', 'black-pleated-skirt', 'chocolate-barrel', 'black-vest'].flatMap((id) =>
      Object.values(BODIES).flatMap((values) => {
        const print = made(id, values);
        return cutCollisions(layout(print.pieces, `Maison Tracé: ${id}`, print.notes, { pattern: id })).filter((h) => /ALLOWANCE|^FINISHED |^YOU /.test(h.text));
      }),
    );
    expect(hit.length).toBeLessThanOrEqual(40);
  });
});

describe('the grain arrows', () => {
  // DR walk, Nov 20: the Ice Peplum neck ruffle's "NECKLINE · 1 CM ALLOWANCE" ran through its grain arrow's head.
  for (const id of ['blush-shift', 'ice-peplum', 'black-pleated-skirt', 'chocolate-barrel', 'black-vest'])
    it(`have no seam name on them on ${id}`, () => {
      for (const values of Object.values(BODIES)) {
        const print = made(id, values);
        const hit = grainCollisions(layout(print.pieces, `Maison Tracé: ${id}`, print.notes, { pattern: id }));
        expect(hit.filter((h) => /ALLOWANCE/.test(h.text)).map((h) => `${print.pieces[h.piece].name}: ${h.text}`)).toEqual([]);
      }
    });
});

// DU walk, Nov 21: the skirt's curved waistband printed its name and cutting over the grain arrow, and the vest collar's
// GRAIN sat on its FOLD. Only the words that belong on or beside the arrow touch it: the crease line, the pleat
// instructions that run across it, and its own word.
describe('the grain arrows, with the name block', () => {
  for (const id of ['blush-shift', 'ice-peplum', 'black-pleated-skirt', 'chocolate-barrel', 'black-vest'])
    it(`have no name, cutting or fold word on them on ${id}`, () => {
      for (const values of Object.values(BODIES)) {
        const print = made(id, values);
        const sheet = layout(print.pieces, `Maison Tracé: ${id}`, print.notes, { pattern: id, name: id, madeFor: 'Tester', date: '21 Nov 2026', code: 'MT-EXAMPLE' });
        const hit = grainCollisions(sheet).filter((h) => !/^GRAIN$|CREASE LINE|^BRING EACH PAIR/.test(h.text));
        expect(hit.map((h) => `${print.pieces[h.piece].name}: ${h.text}`)).toEqual([]);
      }
    });
});

// DV walk, Nov 21: back and front length typed as 12 in each, the Ice Peplum can't be drafted, and its message quoted the
// front length as 12⅜ in, the length it was drafted with, so the tester couldn't tell which number it meant.
it('quotes the front length as typed when the top cannot be drafted', () => {
  expect(() => made('ice-peplum', { ...BODIES.middle, nape_to_waist: 30.48, front_hps_to_waist: 30.48, bust_depth: 30 })).toThrow(/front length \(neck to waist, 30\.5 cm, which should be longer than your back length, 30\.5 cm\)/);
});

describe('the joining diamonds', () => {
  // DQ walk, Nov 20: "OVER D4" printed on the Ice Peplum's "ARMHOLE · 1 CM ALLOWANCE".
  for (const id of ['blush-shift', 'ice-peplum', 'black-pleated-skirt', 'chocolate-barrel', 'black-vest'])
    it(`keep the seam names off their OVER and UNDER words on ${id}`, () => {
      for (const values of Object.values(BODIES)) {
        const print = made(id, values);
        const hit = diamondCollisions(layout(print.pieces, `Maison Tracé: ${id}`, print.notes, { pattern: id }), true);
        expect(hit.filter((h) => /ALLOWANCE/.test(h.text)).map((h) => `${print.pieces[h.piece].name}: ${h.text}`)).toEqual([]);
      }
    });

  for (const id of ['blush-shift', 'ice-peplum', 'black-pleated-skirt', 'chocolate-barrel', 'black-vest'])
    for (const [body, values] of Object.entries(BODIES))
      it(`print over no label on ${id}, ${body} body`, () => {
        const print = made(id, values);
        const hit = diamondCollisions(layout(print.pieces, `Maison Tracé: ${id}`, print.notes, { pattern: id }));
        expect(hit.filter((h) => print.pieces[h.piece].kind !== 'waistband' || /ALLOWANCE/.test(h.text)).map((h) => `${print.pieces[h.piece].name}: ${h.text}`)).toEqual([]);
      });
});

// The Ice Peplum's bodice pieces and both waistbands printed their big name with no piece number or cutting under it,
// since their name label is shorter than the piece's name (pretend tester DM walk, Nov 19). Every tester piece says
// which piece it is and how many to cut.
describe('every piece', () => {
  for (const id of ['blush-shift', 'ice-peplum', 'black-pleated-skirt', 'chocolate-barrel', 'black-vest'])
    it(`says its number and how many to cut on ${id}`, () => {
      const print = made(id, BODIES.middle);
      const sheet = layout(print.pieces, `Maison Tracé: ${id}`, print.notes, { pattern: id });
      print.pieces.forEach((pc, i) => {
        const words = sheet.prims.filter((pr) => pr.kind === 'text' && pr.piece === i).map((pr) => (pr.kind === 'text' ? pr.text : '')).join(' ');
        expect(words, pc.name).toMatch(new RegExp(`PIECE ${i + 1}( OF |/)${print.pieces.length}`));
        expect(words, pc.name).toContain(pc.cut.toUpperCase().split(' (')[0]);
      });
    });
});

// The booklets are written for each look's own cloth, and the testers sew in muslin (calico): every tester booklet
// says what changes in muslin (DM walk, Nov 19; Cat, Nov 20).
describe('sewing in muslin', () => {
  for (const id of ['blush-shift', 'ice-peplum', 'black-pleated-skirt', 'chocolate-barrel', 'black-vest'])
    it(`is in the ${id} booklet`, () => {
      expect(made(id, BODIES.middle).guide.fabric?.some((l) => l.startsWith('Sewing in muslin (calico): '))).toBe(true);
    });
  it("leaves out the Ice Peplum's tissue paper, French seams and horsehair braid", () => {
    const line = made('ice-peplum', BODIES.middle).guide.fabric!.find((l) => l.startsWith('Sewing in muslin'))!;
    for (const w of ['tissue paper', 'French seams', 'horsehair braid', 'universal 80/12']) expect(line).toContain(w);
  });
  // Cat, Nov 20: the lining, welt pockets and loops may be left out of a muslin or sewn, either way.
  it('says the lining, welt pockets and loops may be left out, where the booklet has them', () => {
    const line = (id: string) => made(id, BODIES.middle).guide.fabric!.find((l) => l.startsWith('Sewing in muslin'))!;
    const may = (id: string) => /If you like, you can also leave out (.*): either way is fine for the fit test\.$/.exec(line(id))?.[1] ?? '';
    expect(may('blush-shift')).toMatch(/^the lining /);
    expect(may('ice-peplum')).toMatch(/^the rouleau loops and buttons /);
    expect(may('chocolate-barrel')).toMatch(/^the welt pockets .*, the belt loops, /);
    expect(may('black-vest')).toMatch(/^the lining .*, the welt pockets /);
    // And the interfacing, the zip and the buttons, where the steps use them, with what to do instead (DO walk, Nov 20).
    expect(may('black-pleated-skirt')).toMatch(/the interfacing and the zip \(pin or baste the opening closed/);
    expect(may('black-vest')).toContain('the buttonholes and buttons (pin the fronts closed');
  });
  // DQ walk, Nov 20: stay tape named on a skirt and trouser that have none, "pin the fronts closed" for the trouser's
  // one button, and the press cloth left out where the skirt's pleats are pressed through a damp one.
  it('names only what each booklet uses, and says how to press without the cloth', () => {
    const line = (id: string) => made(id, BODIES.middle).guide.fabric!.find((l) => l.startsWith('Sewing in muslin'))!;
    const steps = (id: string) => made(id, BODIES.middle).guide.steps.map((st) => st.text).join(' ');
    for (const id of ['blush-shift', 'ice-peplum', 'black-pleated-skirt', 'chocolate-barrel', 'black-vest']) if (!/stay tape/i.test(steps(id))) expect(line(id), id).not.toContain('stay tape');
    expect(line('chocolate-barrel')).not.toContain('pin the fronts closed');
    expect(line('chocolate-barrel')).toContain('the buttonhole and button (pin the opening closed where it buttons)');
    expect(line('black-vest')).not.toContain('the buttonhole and button (');
    if (/press cloth/i.test(steps('black-pleated-skirt'))) expect(line('black-pleated-skirt')).toContain('the press cloth (press the muslin directly, with steam)');
  });
  // Two lengths that add up in cm needn't in inches (1 cm then 3 cm read 3/8 + 1-1/8 on a 1-5/8 in allowance): the hems
  // turn up the rest of the allowance, or halves of it (DO walk, Nov 20).
  it('turns hems up by the allowance, not by lengths that must add up', () => {
    const hem = step(made('chocolate-barrel', BODIES.middle), 'Hem');
    expect(hem).toMatch(/Press up 1 cm, then turn up the rest of the [\d.]+ cm hem allowance/);
    expect(made('ice-peplum', BODIES.middle).guide.fabric!.join(' ')).toContain('turn the hem allowance up by half, then again');
  });
  // The cutting layout lays an unlined trouser's back pocket bags in the fabric, and the step says so (DO walk, Nov 20).
  it("says the trouser's back pocket bags may come from the fabric, as the layout lays them", () => {
    const p = made('chocolate-barrel', BODIES.middle);
    expect(step(p, 'Cut out')).toContain('the four back pocket bags from lining or pocketing, or from the fabric itself: the cutting layout leaves room for them.');
    expect(p.lays?.find((l) => l.fabric === 'self')?.placements.some((pl) => pl.name === 'Back pocket bag')).toBe(true);
  });
  // The trouser's first step says wash the cloth: the line doesn't say it says not to (DO walk, Nov 20).
  it('says the first step says not to wash only where it does', () => {
    const line = (id: string) => made(id, BODIES.middle).guide.fabric!.find((l) => l.startsWith('Sewing in muslin'))!;
    expect(line('chocolate-barrel')).not.toContain('says not to wash');
    expect(line('black-vest')).toContain('says not to wash');
    for (const id of ['blush-shift', 'ice-peplum', 'black-pleated-skirt', 'chocolate-barrel', 'black-vest']) expect(line(id)).toContain('long machine stitch');
  });
  // The steps say take it in or let it out, and testers are asked not to alter: the line says so wherever a step does
  // (DU walk, Nov 21).
  it('tells testers to leave the seams as drafted wherever a step says take in or let out', () => {
    for (const id of ['blush-shift', 'ice-peplum', 'black-pleated-skirt', 'chocolate-barrel', 'black-vest']) {
      const p = made(id, BODIES.middle);
      const line = p.guide.fabric!.find((l) => l.startsWith('Sewing in muslin'))!;
      expect(line.includes('leave the seams as they are'), id).toBe(p.guide.steps.some((st) => /take (it )?in or let (it )?out/i.test(st.text)));
    }
    expect(made('black-pleated-skirt', BODIES.middle).guide.fabric!.find((l) => l.startsWith('Sewing in muslin'))).toContain('leave the seams as they are');
  });
});

// The Ice Peplum's bodice is sewn to its peplum at its lower edge, and its sleeve to its band, and both were labelled
// "HEM · 1.5 CM ALLOWANCE": a tester might turn them up (pretend tester DL walk, Nov 19). No tester piece names an edge
// that is sewn to another piece a hem.
describe('a sewn-on edge', () => {
  for (const id of ['blush-shift', 'ice-peplum', 'black-pleated-skirt', 'chocolate-barrel', 'black-vest'])
    for (const [body, values] of Object.entries(BODIES))
      it(`is not labelled a hem on ${id}, ${body} body`, () => {
        for (const pc of made(id, values).pieces.filter((q) => q.meta.joinedHem)) expect(edgeLabels(pc).map((l) => l.text).filter((t) => t.startsWith('HEM')), pc.name).toEqual([]);
      });
  // The Black Vest's lining was labelled "HEM · 1.5 CM ALLOWANCE", but it is bagged to the vest's hem allowance 1 cm
  // from its edge (pretend tester DM walk, Nov 19): no lining on a tester piece is labelled a hem, and each says where
  // its step sews it.
  it('names the Black Vest lining edges for the step that bags them', () => {
    for (const [body, values] of Object.entries(BODIES)) {
      const p = made('black-vest', values);
      const sews = /sew the lining to the hem allowance of the vest all round, (\d+(?:\.\d+)?) cm from the lining's edge/.exec(step(p, 'Bag the lining'))![1];
      for (const pc of p.pieces.filter((q) => q.kind === 'lining' && q.allowances.hem !== undefined)) {
        const words = edgeLabels(pc).map((l) => l.text);
        expect(words.filter((t) => t.startsWith('HEM')), `${pc.name}, ${body}`).toEqual([]);
        expect(words, `${pc.name}, ${body}`).toContain(`JOINS THE HEM ALLOWANCE · SEW ${sews} CM FROM THE EDGE`);
      }
    }
  });
  it('labels the seams the steps sew, with the allowance the steps use', () => {
    const words = (id: string) => made(id, BODIES.middle).pieces.flatMap((pc) => edgeLabels(pc).map((l) => `${pc.name}: ${l.text}`));
    const vest = words('black-vest');
    expect(vest).toContain('Vest front: CHEST SEAM · 1 CM ALLOWANCE');
    expect(vest).toContain('Vest front yoke: CHEST SEAM · 1 CM ALLOWANCE');
    const trousers = words('chocolate-barrel');
    for (const side of ['front', 'back']) {
      expect(trousers).toContain(`Trousers ${side}: CROTCH SEAM · 1 CM ALLOWANCE`);
      expect(trousers).toContain(`Trousers ${side}: INSIDE LEG SEAM · 1.5 CM ALLOWANCE`);
    }
    expect(trousers.filter((w) => w.startsWith('Pocket facing: SIDE SEAM'))).toHaveLength(1);
  });
  it('names the Ice Peplum bodice and sleeve edges as their seams', () => {
    const words = made('ice-peplum', BODIES.middle).pieces.flatMap((pc) => edgeLabels(pc).map((l) => `${pc.name}: ${l.text}`));
    expect(words.filter((w) => /^Bodice .*: PEPLUM SEAM/.test(w)).length).toBeGreaterThan(0);
    expect(words.some((w) => /^Sleeve: BAND SEAM/.test(w))).toBe(true);
  });
});

// The Ice Peplum's centre front is too narrow at the bust for the finished-bust words, which were printed over PLACE ON
// FOLD and its princess seam label (pretend tester DO walk, Nov 20). On every tester piece, the finished measurement
// words keep clear of the other words.
describe('the finished measurement words on each tester piece', () => {
  for (const id of ['blush-shift', 'ice-peplum', 'black-pleated-skirt', 'chocolate-barrel', 'black-vest'])
    for (const [body, values] of Object.entries(BODIES))
      it(`keep clear on ${id}, ${body} body`, () => {
        const sheet = layout(made(id, values).pieces, id, [], { pattern: id, madeFor: 'Me', date: '20 Nov 2026' });
        expect(labelCollisions(sheet).filter((pair) => pair.some((t) => /^(FINISHED |YOU )/.test(t)))).toEqual([]);
      });
  // And each sits where its words fit across the piece, clear of the seam names along the edges and the fold bracket.
  for (const [body, values] of Object.entries(BODIES))
    it(`has room for the words on the Ice Peplum, ${body} body`, () => {
      for (const pc of made('ice-peplum', values).pieces)
        for (const f of pc.finished ?? []) {
          const edge = crossings(pc.outline.points(), f.at.y);
          const half = textWidth(f.title, MARK_TEXT, 0.12) / 2;
          expect(f.at.x - half, `${pc.name}: ${f.title}`).toBeGreaterThanOrEqual(edge[0] + (pc.fold ? 3.4 : 1));
          expect(f.at.x + half, `${pc.name}: ${f.title}`).toBeLessThanOrEqual(edge[edge.length - 1] - 1);
        }
    });
});

// DP walk, Nov 20: the Black Vest's seam check listed "Yoke seam square at centre back" and "Neckline square at centre
// back" twice, and its first page left the 1 cm chest seam off the allowances it named.
describe('the Black Vest first page and seam check', () => {
  it('names each check once, and the chest seam among the 1 cm allowances', () => {
    const vest = made('black-vest', BODIES.middle);
    const pieces = vest.pieces.filter((pc) => !pc.kind || pc.kind === 'collar' || pc.kind === 'pocket');
    const labels = checkPattern(pieces).map((c) => c.label);
    expect(labels.filter((l, i) => labels.indexOf(l) !== i)).toEqual([]);
    expect(vest.notes.join(' ')).toMatch(/1 cm at [^.]*chest seam/);
  });
});

// DQ walk, Nov 20: the pleated skirt's seam check said "with darts closed", and it has no darts.
describe('the seam check words', () => {
  it('says darts closed only where there are darts', () => {
    const skirt = made('black-pleated-skirt', BODIES.middle);
    const checks = checkPattern(skirt.pieces.filter((pc) => !pc.kind || pc.kind === 'collar' || pc.kind === 'pocket'), { finishedWaist: 80 });
    expect(checks.some((c) => /waist seam to finished waist/i.test(c.label))).toBe(true);
    expect(checks.map((c) => c.detail).join(' ')).not.toContain('darts closed');
  });
});

// DR walk, Nov 20: the Ice Peplum's description broke as "PEPLUM, 7.6" / "CM BELOW THE WAIST", and each printed line is
// turned into inches on its own, so an inch file kept the cm.
describe('a wrapped length', () => {
  for (const id of ['blush-shift', 'ice-peplum', 'black-pleated-skirt', 'chocolate-barrel', 'black-vest'])
    it(`keeps its number and unit on one line on ${id}`, () => {
      const print = made(id, BODIES.middle);
      // The look's description as the app titles it, with its length in it.
      const info = { pattern: 'Ruffled crew neck princess top with long bishop sleeves and a big flared peplum, 7.6 cm below the waist', madeFor: 'Me', date: '21 Nov 2026' };
      const sheet = layout(print.pieces, `Maison Tracé: ${id}`, print.notes, info);
      const texts = sheet.prims.flatMap((pr) => (pr.kind === 'text' ? [pr.text] : []));
      expect(texts.filter((t) => /^(cm|mm|in|yd)\b/i.test(t))).toEqual([]);
    });
});

// The pleated skirt's panel seams join the front and back to the side panels: the neaten step named only the side and
// centre back edges, so the front panel's were left raw (DZ pretend-tester walk, Nov 21; Cat: "Fix it now").
describe('the Black Pleated Skirt neatens every seam it joins', () => {
  it('names the panel seam edges in Neaten the edges', () => {
    const p = made('black-pleated-skirt', BODIES.middle);
    expect(p.guide.steps.some((s) => s.title === 'Join the side panels')).toBe(true);
    expect(step(p, 'Neaten the edges')).toContain('Neaten the panel seam edges as well, on the front, the back and each side panel.');
  });
});

describe('tester pieces: the maker pack table', () => {
  it("a curved waistband's row gives the band as it is cut: twice, 6 cm wide, not the folded straight band's 9", () => {
    for (const id of ['black-pleated-skirt', 'chocolate-barrel'])
      for (const body of Object.values(BODIES)) {
        const p = made(id, body);
        const band = piece(p.pieces, 'Waistband');
        const rows = p.spec.filter((r) => /^Waistband/.test(r.label));
        expect(rows).toHaveLength(1);
        if (band.meta.curved) {
          // The piece is the finished width plus a seam allowance on each long edge.
          const wide = (band.meta.finishedWidth as number) + 2 * band.seamAllowance;
          expect(band.cut).toMatch(/^Cut 2/);
          expect(rows[0].label).toBe('Waistband, curved (finished width 3)');
          expect(rows[0].finished).toMatch(/^cut 2, band and facing, each [\d.]+ at the waist seam x [\d.]+$/);
          expect(Number(String(rows[0].finished).split(' x ')[1])).toBe(wide);
        } else {
          // Folded: twice the finished width, plus a seam allowance on each long edge.
          expect(rows[0].finished).toMatch(/^cut [\d.]+ x [\d.]+$/);
          expect(Number(String(rows[0].finished).split(' x ')[1])).toBe(2 * 3 + 2 * band.seamAllowance);
        }
      }
    // The test would prove nothing if no tester piece had a curved band.
    expect(piece(made('chocolate-barrel', BODIES.middle).pieces, 'Waistband').meta.curved).toBe(true);
  });

  it('the slant pocket row says centimetres, so "4 in" is not read as inches', () => {
    for (const body of Object.values(BODIES)) expect(made('chocolate-barrel', body).spec.find((r) => r.label === 'Slant pockets')!.finished).toBe('opening 4 cm in from the side seam, 17 cm down');
  });
});

// The steps read for clarity, sewing terms and ease of use (sewing instructions review, 2026-11-28).
describe('tester pieces: how the steps read', () => {
  const body = BODIES.middle;

  it('says how a dart ends before the darts are sewn, and how an invisible zip goes in', () => {
    const p = made('blush-shift', body);
    expect(step(p, 'Sew the bust and waist darts')).toMatch(/^At the point of every dart, run the stitching off the fold/);
    const zip = step(p, 'Put in the zip');
    expect(zip).toContain('press its coils flat');
    expect(zip).toContain('invisible zip foot');
    expect(zip).not.toMatch(/\bSew a \d/);
  });

  it("leaves the pleated skirt's panel seams as sewn, where they are the inside fold of a pleat, and opens them only in the hem", () => {
    const p = made('black-pleated-skirt', body);
    expect(step(p, 'Join the side panels')).toContain('press each seam flat as it was sewn');
    expect(step(p, 'Join the side panels')).not.toContain('press the seams open');
    expect(step(p, 'Hem the skirt')).toContain('press the seam open below the clip only');
  });

  it('binds the slip neckline all the way round, there being no opening, and lays the satin one way up in both cutting steps', () => {
    const p = made('ivory-slip', body);
    expect(step(p, 'Bind the neckline')).toContain('starting at a shoulder seam, all the way round');
    expect(step(p, 'Bind the neckline')).not.toContain('extra at each end');
    expect(step(p, 'Cut the satin')).toContain('right side up');
    expect(step(p, 'Cut out')).toContain('right side up');
    expect(step(p, 'Cut the satin')).not.toContain('side down');
  });

  it("says left and right on the trousers are as worn, and stitches the front pleat for its first centimetres, not at a distance", () => {
    const p = made('chocolate-barrel', body);
    expect(step(p, 'Put in the fly zip')).toMatch(/^The left and the right here are as you wear the trousers\./);
    expect(step(p, 'Fold the front pleat')).toContain('for the first 4 cm below the waist edge');
  });
});
