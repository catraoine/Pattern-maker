import { describe, expect, it } from 'vitest';
import { seamSchedule } from './seamSchedule';
import { machineSetup } from './machineSetup';
import { withHouseShirtSeams } from './houseShirtSeams';
import { inInches } from '../units';

const step = (title: string, text: string) => ({ title, text });

describe('the tech pack seam list', () => {
  it('reads each seam from its own step', () => {
    const rows = seamSchedule({
      notions: [],
      steps: [
        step('Neaten the edges', 'Zigzag or overlock the shoulder and side edges.'),
        step('Sew the waist darts', 'Fold each dart and stitch.'),
        step('Sew the shoulders', 'Pin and sew 1.5 cm from the edge, and press the seams open.'),
        step('Sew the side seams', 'Sew them as French seams. With the pieces wrong sides together, sew 0.6 cm outside the stitching line.'),
        step('Set in the sleeves', 'Pin each sleeve into its armhole and sew 1 cm from the edge.'),
        step('Finish the armhole seams', 'Trim the armhole seam to 0.7 cm under the arm, and zigzag or overlock the two edges together.'),
      ],
    });
    expect(rows.map((r) => r.seam)).toEqual(['3. Sew the shoulders', '4. Sew the side seams', '5. Set in the sleeves']);
    expect(rows[0]).toMatchObject({ type: 'Plain', allowance: '1.5 cm', finish: 'Pressed open, each edge zigzagged or overlocked', topstitch: 'None' });
    expect(rows[1].type).toBe('French');
    expect(rows[2].finish).toMatch(/neatened together/);
  });

  it('lists only steps that sew a seam, and only calls a seam French when the step sews one', () => {
    const rows = seamSchedule({
      notions: [],
      steps: [
        step('Stay-tape the one-shoulder edge', 'Pin the tape to the wrong side.'),
        step('Press the seams', 'Press every seam open.'),
        step('Sew the left side seam', 'A French seam cannot go round a zip. Sew 1.5 cm from the edge and press the seam open.'),
        step('Sew the right side seam', 'Sew the right side seam (as you wear it) as a French seam.'),
        step('Join the bodice to the skirt', 'Sew the skirt centre back 1.5 cm from the edge and press it open. Sew the waist 1 cm from the edge and press the seams up toward the bodice.'),
      ],
    });
    expect(rows.map((r) => `${r.seam}: ${r.type}`)).toEqual(['3. Sew the left side seam: Plain', '4. Sew the right side seam: French', '5. Join the bodice to the skirt: Plain']);
    // A step with two seams: the titled seam's own allowance and pressing come last.
    expect(rows[2]).toMatchObject({ allowance: '1 cm', finish: 'Pressed to one side, as the step says' });
  });

  it('with 1 cm seams all round, the felled seam trims to what the allowance has', () => {
    const g = withHouseShirtSeams({ notions: [], steps: [step('Sew the shoulders', 'x')] }, '1 cm', '1 cm');
    expect(g.steps[0].text).toMatch(/to 0\.4 cm and leave the other as it is/);
    expect(g.steps[0].text).not.toMatch(/1\.2 cm/);
  });

  it('the house shirt is felled with the fold inside, yoke and armhole included', () => {
    const g = withHouseShirtSeams(
      {
        notions: [],
        steps: [
          step('Join the pleated back to its yoke', 'Pin the back yoke to the back. Sew 1.5 cm from the edge, and press the seam up toward the yoke. The pleat hangs free below the seam.'),
          step('Sew the shoulders', 'x'),
          step('Sew the side seams', 'x'),
          step('Set in the sleeves', 'x'),
        ],
      },
      '1.5 cm',
      '1 cm',
    );
    const felled = g.steps.filter((s) => /flat-felled/.test(s.text));
    expect(felled.map((s) => s.title)).toEqual(['Join the pleated back to its yoke', 'Sew the shoulders', 'Set the sleeves in flat', 'Sew the side and sleeve seams']);
    // Never wrong sides together: that puts the fold outside, where it rippled round the armhole.
    for (const s of felled) {
      // The armhole is sewn at its own 1 cm, not the straight seams' 1.5.
      expect(s.text).toMatch(s.title === 'Set the sleeves in flat' ? /right sides together 1 cm from the edge/ : /right sides together 1\.5 cm from the edge/);
      expect(s.text).not.toMatch(/wrong sides together/);
    }
    expect(seamSchedule(g).every((r) => r.type === 'Flat-felled, fold inside' && /2 rows/.test(r.topstitch))).toBe(true);
  });

  it('machine set-up reads the same in inches: no stitch length carries a unit', () => {
    for (const f of [undefined, { weight: 'light' }, { weight: 'heavy' }, { special: 'denim' }, { special: 'sheer' }, { knit: 'jersey' }] as const) {
      const lines = machineSetup(f as never);
      expect(lines.length).toBeGreaterThan(1);
      expect(lines.map(inInches)).toEqual(lines);
    }
  });
});
