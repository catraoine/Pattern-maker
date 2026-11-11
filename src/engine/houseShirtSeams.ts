// The house shirt cut's seams (SS27 Look 08, the Leopard Shirt Dress, Nov 11: "to a 10"). A good shirt has no raw or
// overlocked edge inside: every seam is flat-felled, so it is as neat inside as out and lies flat through washing. That
// means the sleeves go in flat, before the side seams, and the side seam and the sleeve's underarm seam are then sewn
// in one run from the hem to the cuff (set in the round, a felled armhole cannot be turned under the arm).
import type { SewStep, SewingGuide } from './instructions';

/** How a flat-felled seam is sewn, as a sentence on its own: `toward` is the piece the folded edge lies on. */
const FELL = (seam: string, toward: string) =>
  `Sew it as a flat-felled seam: sew with wrong sides together ${seam} from the edge, trim the allowance on the ${toward} side to 0.6 cm, fold the wider one over it, turn it under and press it flat onto the ${toward}, then edgestitch the fold 0.2 cm from its edge, so both raw edges are enclosed`;

/** The sewing guide for the house shirt cut: flat-felled seams throughout, the sleeves set in flat. */
export function withHouseShirtSeams(g: SewingGuide, seam: string): SewingGuide {
  const sleeved = g.steps.some((s) => s.title === 'Set in the sleeves');
  const out: SewStep[] = [];
  for (const st of g.steps) {
    switch (st.title) {
      case 'Neaten the edges':
        // Nothing is overlocked: each seam is felled as it is sewn.
        break;
      case 'Sew the shoulders':
        out.push({ ...st, text: `Pin the front to the back at the shoulders. The back shoulder is 1 cm longer: ease it in so it fits without pleats. ${FELL(seam, 'back')}.` });
        break;
      case 'Sew the side seams':
        // A sleeved shirt sews these with the sleeve seams, once the sleeves are in.
        if (!sleeved) out.push({ ...st, text: `Pin the front to the back at the sides. Try it on now: this is the easiest moment to take it in or let it out at the sides. ${FELL(seam, 'back')}.` });
        break;
      case 'Sew the sleeve seams':
      case 'Ease the sleeve heads':
      case 'Finish the armhole seams':
        break;
      case 'Set in the sleeves':
        out.push(
          {
            title: 'Set the sleeves in flat',
            text: `With the body opened out flat and each sleeve still open, pin the sleeve crown to the armhole, matching the top notch to the shoulder seam, the single notch to the front and the double notches to the back, spreading the little ease evenly. ${FELL(seam, 'body')}, the fold lying on the body round the armhole.`,
          },
          {
            title: 'Sew the side and sleeve seams',
            text: `Fold the shirt so the front and back meet at the sides, matching the underarm seams exactly. In one run from the hem up the side, round the underarm and down the sleeve to its hem, ${FELL(seam, 'back').replace('Sew it as', 'sew it as')}. Try it on before you fell it: this is the easiest moment to take it in or let it out at the sides.`,
          },
        );
        break;
      default:
        out.push(st);
    }
  }
  // The sleeve hems (or cuffs) are finished once the sleeves are closed.
  const hs = out.findIndex((s) => s.title === 'Hem the sleeves' || /^Attach the .*cuffs$/.test(s.title));
  const sides = out.findIndex((s) => s.title === 'Sew the side and sleeve seams');
  if (hs >= 0 && sides > hs) {
    const [h] = out.splice(hs, 1);
    out.splice(sides, 0, { ...h, text: h.text.replace(' It is far easier now than once the sleeves are in.', '') });
  }
  return { ...g, steps: out };
}
