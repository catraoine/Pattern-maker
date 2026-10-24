// Little line drawings for the Style choices that are about shape (Cat's S1 Picture Choices): a skirt's
// silhouette, length and hem, a trouser leg, a neckline, a sleeve, how long a top or coat is. The chip
// keeps its words under the drawing, so its name (and every test that finds it) stays the same.
import { useState, type ReactNode } from 'react';
import { explainLine } from '../explain';
import { BigDrawing, Drawing } from './Drawing';

export type PicSet = 'skirt' | 'bodice' | 'tee' | 'trousers' | 'jacket' | 'coat';

const f = (n: number) => n.toFixed(1);

/** An A-line skirt from a waist at y = 5 down to a hem at y, with the legs below it. */
function skirtTo(y: number) {
  const s = (y - 5) * 0.2;
  return (
    <>
      <path d={`M15 5h10l${f(s)} ${y - 5}H${f(15 - s)}z`} />
      <path className="pic-faint" d={`M17.5 ${y}V47M22.5 ${y}V47`} />
    </>
  );
}

/** A top from the shoulders to a hem at y. */
function topTo(y: number) {
  return <path d={`M8 12L15 8Q20 13 25 8L32 12L30 22L29 ${y}H11L10 22z`} />;
}

/** A top with both sleeves, each `len` long down the arm (0 for none). */
function sleeves(len: number) {
  const dx = -0.42 * len;
  const dy = 0.9 * len;
  const sl = (side: 1 | -1) => {
    const x0 = side === 1 ? 10 : 30;
    const x = (v: number) => f(20 + side * (v - 20));
    return len ? <path d={`M${x(x0)} 10L${x(x0 + dx)} ${f(10 + dy)}L${x(x0 + dx + 5)} ${f(12 + dy)}L${x(x0 + 1.5)} 22`} /> : null;
  };
  return (
    <>
      <path d="M10 10L15 7Q20 12 25 7L30 10L30 22L29 44H11L10 22z" />
      {sl(1)}
      {sl(-1)}
    </>
  );
}

/** A coat or jacket from the shoulders to a hem at y, with its front edge and lapels. */
function coatTo(y: number) {
  return (
    <>
      <path d={`M9 11L15 6L20 14L25 6L31 11L30 22L${f(31 + (y - 22) * 0.08)} ${y}H${f(9 - (y - 22) * 0.08)}L10 22z`} />
      <path className="pic-faint" d={`M20 14V${y}`} />
    </>
  );
}

const SKIRT: Record<string, Record<string, ReactNode>> = {
  silhouette: {
    pencil: <path d="M14 5h12q3 8 1.5 15L26 43H14l-1.5-23Q11 13 14 5z" />,
    straight: <path d="M14 5h12q3 7 3 13V43H11V18q0-6 3-13z" />,
    a_line: <path d="M15 5h10l8 38H7z" />,
    gathered: (
      <>
        <path d="M15 5h10q1 3 3 6q5 15 6 32H6q1-17 6-32q2-3 3-6z" />
        <path className="pic-faint" d="M16 6l-1 6M18 6v7M20 6v7M22 6v7M24 6l1 6" />
      </>
    ),
    trumpet: <path d="M15 5h10q2 15 .5 22q2 9 9 16h-29q7-7 9-16Q13 20 15 5z" />,
    half_circle: <path d="M16 5h8L37 40Q20 46 3 40z" />,
    circle: <path d="M17 5h6L40 37Q20 48 0 37z" />,
    slip: (
      <>
        <path d="M15 5h10q2 10 1 18q1 10 4 20H10q3-10 4-20q-1-8 1-18z" />
        <path className="pic-faint" d="M14 17l11 11M13 26l14 14M16 6l9 9" />
      </>
    ),
  },
  length: {
    mini: skirtTo(17),
    above_knee: skirtTo(23),
    knee: skirtTo(30),
    midi: skirtTo(38),
    maxi: skirtTo(46),
  },
  asymHem: {
    none: <path d="M15 5h10l8 36H7z" />,
    high_low: (
      <>
        <path d="M15 5h10l8 36Q20 24 7 41z" />
        <path className="pic-faint" d="M7 41Q20 46 33 41" />
      </>
    ),
    diagonal: <path d="M15 5h10l8 24L7 43z" />,
  },
  // A straight skirt with its slit: none, up the centre back (drawn dashed, round the back), up the side, or up the front.
  slit: {
    none: <path d="M14 5h12l2 38H12z" />,
    back: (
      <>
        <path d="M14 5h12l2 38H12z" />
        <path className="pic-faint" d="M20 30V43" />
      </>
    ),
    side: <path d="M14 5h12l1.2 24L27 43H24.5L26 29L26.2 43" />,
    front: <path d="M14 5h12l2 38H20.6L20 32L19.4 43H12z" />,
  },
  // A dress with a waist seam, or cut in one: a sheath shaped in at the waist, a shift hanging straight.
  noSeam: {
    seam: (
      <>
        <path d="M15 5L20 8L25 5L27 13L25 21L32 43H8L15 21L13 13z" />
        <path className="pic-faint" d="M15 21H25" />
      </>
    ),
    sheath: (
      <>
        <path d="M15 5L20 8L25 5L27 13L25 21L27 29L25.5 43H14.5L13 29L15 21L13 13z" />
        <path className="pic-faint" d="M17 15L16.5 21L17 27M23 15L23.5 21L23 27" />
      </>
    ),
    shift: <path d="M15 5L20 8L25 5L27 13L28.5 43H11.5L13 13z" />,
  },
};

const NECK: Record<string, ReactNode> = {
  crew: topTo(44),
  scoop: <path d="M8 12L15 8C16 20 24 20 25 8L32 12L30 22L29 44H11L10 22z" />,
  v: <path d="M8 12L15 8L20 22L25 8L32 12L30 22L29 44H11L10 22z" />,
  mock: (
    <>
      {topTo(44)}
      <path d="M15.5 8.5L16 3Q20 4.5 24 3L24.5 8.5" />
    </>
  ),
  square: <path d="M8 12L15 8V18H25V8L32 12L30 22L29 44H11L10 22z" />,
  boat: <path d="M8 13L12 10Q20 14 28 10L32 13L30 22L29 44H11L10 22z" />,
  one_shoulder: <path d="M10 13L16 9L30 22L29 44H11L10 22z" />,
  cowl: (
    <>
      {topTo(44)}
      <path className="pic-faint" d="M16 12Q20 20 24 12M17.5 15.5Q20 22 22.5 15.5" />
    </>
  ),
  strapless: <path d="M10 20Q20 17 30 20L29 44H11z" />,
  sweetheart: <path d="M10 19Q15 14 20 20Q25 14 30 19L29 44H11z" />,
  cami: (
    <>
      <path d="M10 20H30L29 44H11z" />
      <path d="M13 20L14 7M27 20L26 7" />
    </>
  ),
  halter: (
    <>
      <path d="M17 6L23 6L30 20L29 44H11L10 20z" />
      <path className="pic-faint" d="M17 6Q20 3 23 6M17 6Q20 9 23 6" />
    </>
  ),
};

/** A sleeveless dress with its waist seam at y and the skirt flaring below. */
function dressSeam(y: number) {
  return (
    <>
      <path d={`M13 7Q20 11 27 7L29 13L28 ${y}L34 46H6L12 ${y}L11 13z`} />
      <path className="pic-faint" d={`M12 ${y}H28`} />
    </>
  );
}

const SLEEVE: Record<string, ReactNode> = { none: sleeves(0), short: sleeves(8), elbow: sleeves(16), three_quarter: sleeves(22), long: sleeves(30) };

const PICS: Record<PicSet, Record<string, Record<string, ReactNode>>> = {
  skirt: SKIRT,
  bodice: { neckline: NECK, sleeve: SLEEVE, length: { waist: topTo(28), high_hip: topTo(34), hip: topTo(40) }, waistSeam: { empire: dressSeam(16), raised: dressSeam(19), natural: dressSeam(22), dropped: dressSeam(29), low: dressSeam(33) } },
  tee: { neckline: NECK, sleeve: { short: sleeves(8), elbow: sleeves(16), long: sleeves(30) }, length: { cropped: topTo(26), hip: topTo(36), tunic: topTo(45) } },
  trousers: {
    leg: {
      straight: <path d="M11 4h18l1 42h-8l-2-28-2 28h-8z" />,
      wide: <path d="M11 4h18l5 42H23l-3-28-3 28H6z" />,
      tapered: <path d="M10 4h20l-3 42h-6l-1-28-1 28h-6z" />,
      culotte: <path d="M11 4h18l6 30H22l-2-16-2 16H5z" />,
      flare: <path d="M11 4h18l-1 24 4 18h-9l-3-28-3 28H8l4-18z" />,
      bootcut: <path d="M11 4h18l-1 24 2 18h-8l-2-28-2 28h-8l2-18z" />,
    },
    length: {
      shorts: <path d="M11 4h18l2 16h-9l-2-6-2 6h-9z" />,
      knee: <path d="M11 4h18l1 26h-8l-2-12-2 12h-8z" />,
      capri: <path d="M11 4h18l1 33h-8l-2-19-2 19h-8z" />,
      cropped: <path d="M11 4h18l1 36h-8l-2-22-2 22h-8z" />,
      full: <path d="M11 4h18l1 42h-8l-2-28-2 28h-8z" />,
      ankle: (
        <>
          <path d="M11 4h18l1 37h-8l-2-23-2 23h-8z" />
          <path className="pic-faint" d="M4 46H36" />
        </>
      ),
    },
  },
  jacket: { length: { cropped: coatTo(24), hip: coatTo(31), long: coatTo(38) } },
  coat: { length: { thigh: coatTo(33), knee: coatTo(40), midi: coatTo(46) } },
};

/** Whether a group's chips are drawn as pictures. */
export const hasPics = (set: PicSet, group: string) => !!PICS[set][group];

/** The chips' class: picture tiles where the group has drawings. */
export const chipsClass = (set: PicSet, group: string) => (hasPics(set, group) ? 'chips pics' : 'chips');

/** The drawing for one choice, or nothing where the choice has none. Tapping the picked tile's drawing opens
 * it full size (Cat's extra to E3); tapping any other tile picks it as before. */
export function ChoicePic({ set, group, id }: { set: PicSet; group: string; id: string }) {
  const pic = PICS[set][group]?.[id];
  const [big, setBig] = useState<string>();
  if (!pic) return null;
  const cls = `pic-${set}-${group}-${id}`;
  return (
    <>
      <Drawing
        pic={pic}
        className={cls}
        onClick={(e) => {
          const chip = e.currentTarget.closest('.chip');
          if (!chip?.classList.contains('on')) return;
          e.stopPropagation();
          setBig(chip.textContent?.trim() ?? '');
        }}
      />
      {big !== undefined && (
        <BigDrawing pic={pic} className={cls} name={big} line={explainLine(set === 'jacket' || set === 'coat' ? 'outer' : set, group, id)} onClose={() => setBig(undefined)} />
      )}
    </>
  );
}
