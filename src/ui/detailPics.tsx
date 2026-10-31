// Little moving drawings for the Style sections that have no picture tiles (Cat's extra to E3, 2026-10-18):
// fit, darts, seams, collars, openings, pockets and the rest. Each sits beside the line that explains the
// picked choice. The garment is drawn faint and the detail the choice adds is drawn bright, so the pen that
// runs round the drawing traces what the choice changes. Same 40 x 48 box as the picture tiles.
import type { ReactNode } from 'react';
import type { ExplainSet } from '../explain';

const TOP = 'M8 12L15 8Q20 13 25 8L32 12L30 22L29 40H11L10 22z';
/** The top with long sleeves, turned out a little from the body. */
const SLEEVED = 'M15 8Q20 13 25 8L32 12L37 30H32L30 22L29 40H11L10 22L8 30H3L8 12z';
const SHORT_TOP = 'M8 12L15 8Q20 13 25 8L32 12L30 22L29 28H11L10 22z';
const SKIRT = 'M14 6h12l5 38H9z';
const TROUSERS = 'M11 4h18l1 42h-8l-2-28-2 28h-8z';
const JACKET = 'M9 11L15 6L20 14L25 6L31 11L30 22L31 38H9L10 22z';
const BODY = 'M14 8Q20 11 26 8L27 20L25.5 27L27 42H13L14.5 27L13 20z';

/** A dot, as a path so the pen can trace it. */
const dot = (x: number, y: number, r = 0.9) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;

/** The garment, faint, with what the choice adds drawn over it. */
const on = (base: string, detail?: string): ReactNode => (
  <>
    <path className="pic-faint-solid" d={base} />
    {detail && <path d={detail} />}
  </>
);

/** How much room over the body: the body faint, the garment drawn `d` out from it. */
const fit = (d: number): ReactNode => (
  <>
    <path className="pic-faint-solid" d={BODY} />
    <path d={`M${13 - d} 7Q20 ${10 - d / 2} ${27 + d} 7L${28 + d} 20L${27 + d} 27L${28 + d} 42H${12 - d}L${13 - d} 27L${12 - d} 20z`} />
  </>
);
const FIT = {
  fitted: fit(0.6),
  regular: fit(1.8),
  relaxed: fit(3.6),
};
/** The dress's fits, with its own Boxy: square at the shoulder and straight down the sides. */
const DRESS_FIT = {
  ...FIT,
  boxy: (
    <>
      <path className="pic-faint-solid" d={BODY} />
      <path d="M10 8.5L14 6.5Q20 9.5 26 6.5L30 8.5V42H10z" />
    </>
  ),
  /** The top's Oversized: far out from the body, the shoulder dropped past it. */
  oversized: (
    <>
      <path className="pic-faint-solid" d={BODY} />
      <path d="M6 12L14 6.5Q20 9.5 26 6.5L34 12V43H6z" />
    </>
  ),
};

/** Pockets hidden in the side seams: the bags drawn dashed behind the seam. */
const inseam = (base: string, y: number) => on(base, `M10.5 ${y}q-4 3 -1 7.5q2 1 3 -1M29.5 ${y}q4 3 1 7.5q-2 1 -3 -1`);

const DETAILS: Record<ExplainSet, Record<string, Record<string, ReactNode>>> = {
  skirt: {
    fit: FIT,
    gathers: {
      soft: on('M15 6h10l3 38H12z', 'M17 7L16 43M20 7V43M23 7L24 43'),
      full: on('M15 6h10l6 38H9z', 'M16 7L13 43M18 7L17 43M20 7V43M22 7L23 43M24 7L27 43'),
      dramatic: on('M15 6h10l10 38H5z', 'M15.5 7L9 43M17 7L13 43M18.5 7L17 43M20 7V43M21.5 7L23 43M23 7L27 43M24.5 7L31 43'),
    },
    volume: {
      none: on(SKIRT),
      knife: on(SKIRT, 'M15.5 6L13 44M18.5 6L17.5 44M21.5 6L22.5 44M24.5 6L27 44M15.5 6l1.5 3M18.5 6l1.5 3M21.5 6l1.5 3M24.5 6l1.5 3'),
      box: on(SKIRT, 'M16 6L14 44M19 6L18.5 44M21 6L21.5 44M24 6L26 44M16 9h3M21 9h3'),
      inverted: on(SKIRT, 'M20 6V44M18 6L20 12L22 6'),
      godets: on(SKIRT, 'M13 30L10 44H16zM20 30L17.5 44H22.5zM27 30L24 44H30z'),
      hem_flounce: on('M14 6h12l3.5 28H10.5z', 'M10.5 34Q9 44 14 42Q17 46 20 42Q23 46 26 42Q31 44 29.5 34'),
      tiers: on('M14 6h12l1 10H13z', 'M13 16H27L29 28H11zM11 28H29L32 42H8z'),
      ruffle: on('M14 6h12l2.5 26H11.5z', 'M11.5 32H28.5L33 41Q30 44 27 42Q24 45 20 42Q16 45 13 42Q10 44 7 41zM14 33l-.5 4M18 33v4M22 33v4M26 33l.5 4'),
      ruched: on(SKIRT, 'M10.5 18q3 1.5 5 .5M10.8 23q3 1.5 5 .5M11.1 28q3 1.5 5 .5M11.4 33q3 1.5 5 .5M11.7 38q3 1.5 5 .5M29.5 18q-3 1.5 -5 .5M29.2 23q-3 1.5 -5 .5M28.9 28q-3 1.5 -5 .5M28.6 33q-3 1.5 -5 .5M28.3 38q-3 1.5 -5 .5'),
      balloon: on('M14 6h12Q34 30 28 40Q25 43 20 43Q15 43 12 40Q6 30 14 6z', 'M15 40.5l.5 2M18 41v2M22 41v2M25 40.5l-.5 2'),
    },
    waist: {
      band: on(SKIRT, 'M13.5 6h13v4h-13zM24 10V22M23 22h2'),
      faced: on(SKIRT, 'M14.4 12Q20 13.5 25.6 12M24 6V20M23 20h2'),
      high: on('M14 12h12l5 32H9z', 'M14.5 2h11L26 12H14zM17 2L17.5 8L18 2M22 2L22.5 8L23 2M24 2V20M23 20h2'),
      elastic: on(SKIRT, 'M13.5 6h13v4h-13zM15 7v2M17 7v2M19 7v2M21 7v2M23 7v2M25 7v2'),
      wrap: on(SKIRT, 'M13.5 6h13v4h-13zM24 6L26.5 44M13.5 8L8 14M13.5 8L9.5 16'),
    },
    pockets: { none: on(SKIRT), inseam: inseam(SKIRT, 13) },
    front: {
      plain: on(SKIRT, 'M16 6L16.5 13M24 6L23.5 13'),
      yoke: on(SKIRT, 'M13.2 13Q16 15.5 20 15Q24 15.5 26.8 13'),
      buttons: on(SKIRT, `M20 6V44${[11, 18, 25, 32].map((y) => dot(21.5, y)).join('')}`),
    },
    belt: {
      none: on(SKIRT),
      sash: on(SKIRT, 'M13.6 8h12.8v4H13.6zM20 12L17.5 24M20.5 12L23 22'),
      sash_loops: on(SKIRT, 'M13.6 8h12.8v4H13.6zM20 12L17.5 24M20.5 12L23 22M14.5 7v6M25.5 7v6'),
      loops: on(SKIRT, 'M16 5.5v3.5M24 5.5v3.5M16.8 5.5v3.5M24.8 5.5v3.5'),
      band: on(SKIRT, 'M13.6 8h12.8v4H13.6zM16.5 7h2.4v6h-2.4zM18.9 8.6h3.5l0.8 1.4l-0.8 1.4h-3.5'),
    },
  },
  bodice: {
    fit: DRESS_FIT,
    darts: {
      bust_waist: on(TOP, 'M14 40L15.5 26L17 40M23 40L24.5 26L26 40M10 21L15 24L10 25.5M30 21L25 24L30 25.5'),
      bust: on(TOP, 'M10 21L15 24L10 25.5M30 21L25 24L30 25.5'),
      none: on(TOP),
    },
    sleeveShape: {
      fitted: on('M13 8Q20 2 27 8L24.5 44H16z', 'M13 8Q20 2 27 8M16 44h8.5'),
      straight: on('M13 8Q20 2 27 8L27 44H13z', 'M13 8Q20 2 27 8M13 44h14'),
      puff: on('M12 10Q20 -2 28 10Q31 16 27 20H13Q9 16 12 10z', 'M15 6v2M18 4.5v2M22 4.5v2M25 6v2M13 20h14'),
      bishop: on('M14 8Q20 2 26 8L31 38Q20 42 9 38z', 'M10 38Q20 42 30 38M14 40h12v4H14zM16 38v2M20 39v1.5M24 38v2'),
      cap: on('M13 8Q20 2 27 8L28 14Q20 17 12 14z', 'M13 8Q20 2 27 8M12 14Q20 17 28 14'),
      flutter: on('M13 8Q20 2 27 8L33 22Q30 25 27 22Q24 26 20 23Q16 26 13 22Q10 25 7 22z', 'M13 8Q20 2 27 8M7 22Q10 25 13 22Q16 26 20 23Q24 26 27 22Q30 25 33 22'),
    },
    sleeveCut: {
      set_in: on(SLEEVED, 'M8 12Q11 17 10 22M32 12Q29 17 30 22'),
      drop: on('M15 8Q20 13 25 8L34 11L38 30H33L31 24L29 40H11L9 24L7 30H2L6 11z', 'M6 11L15 8M34 11L25 8M6.5 13Q9.5 19 9 24M33.5 13Q30.5 19 31 24'),
      raglan: on(SLEEVED, 'M16.5 9.5Q14 17 10 22M23.5 9.5Q26 17 30 22'),
      kimono: on('M15 8Q20 13 25 8L36 15L33 22L29 19L29 40H11L11 19L7 22L4 15z', 'M15 8L4 15M25 8L36 15M11 19Q9 20 7 22M29 19Q31 20 33 22'),
    },
    sleeveCuff: {
      none: on('M13 8Q20 2 27 8L28 44H12z', 'M12 42h16'),
      shirt: on('M13 8Q20 2 27 8L29 36Q20 39 11 36z', 'M13 36h14v7H13zM24.5 39.5h.1M15 32v4M18 33v3M22 33v3M25 32v4'),
      elastic: on('M13 8Q20 2 27 8L29 38Q20 41 11 38z', 'M14 38h12v3H14zM15.5 38.5v2M18 38.5v2M20.5 38.5v2M23 38.5v2'),
      tie: on('M13 8Q20 2 27 8L29 38Q20 41 11 38z', 'M14 38h12v2.5H14zM26 39L31 46M26 39L33 43'),
      ruffle: on('M13 8Q20 2 27 8L28 36H12z', 'M12 36H28L32 43Q29 46 26 44Q23 47 20 44Q17 47 14 44Q11 46 8 43zM14 37l-.5 4M18 37v4M22 37v4M26 37l.5 4'),
    },
    princess: {
      none: on(TOP),
      shoulder: on(TOP, 'M16 10Q14 24 15.5 40M24 10Q26 24 24.5 40'),
      armhole: on(TOP, 'M10 19Q16 21 15.5 40M30 19Q24 21 24.5 40'),
    },
    bustDart: {
      side: on(TOP, `M10 21L16 24L10 25.5${dot(16, 24, 0.6)}`),
      french: on(TOP, `M10.5 30L16 24L10.5 33${dot(16, 24, 0.6)}`),
      shoulder: on(TOP, `M11 10.5L16 24L13 9.3${dot(16, 24, 0.6)}`),
      neck: on(TOP, `M16.5 10.8L16 24L18 11.8${dot(16, 24, 0.6)}`),
      armhole: on(TOP, `M10 16.5L16 24L10 19${dot(16, 24, 0.6)}`),
      waist: on(TOP, `M13.5 40L16 24L18.5 40${dot(16, 24, 0.6)}`),
    },
    closure: {
      back_zip: on('M8 12L15 8Q20 10 25 8L32 12L30 22L29 40H11L10 22z', 'M20 9.5V32M19 32h2v2.5h-2z'),
      front_buttons: on(TOP, `M20 12.5V40${dot(21.5, 16)}${dot(21.5, 22)}${dot(21.5, 28)}${dot(21.5, 34)}`),
      wrap: on('M8 12L15 8L25 8L32 12L30 22L29 40H11L10 22z', 'M15 8L24 26Q27 34 29 38M25 8L20 24M29 38l3 7M29 38l-1 7'),
    },
    collar: {
      none: on(TOP),
      peter_pan: on(TOP, 'M15 8Q12 15 19.5 13.5M25 8Q28 15 20.5 13.5'),
      mandarin: on(TOP, 'M15 8V4.5Q20 7 25 4.5V8'),
      mock: on(TOP, 'M15 8L15.5 2.5Q20 4.5 24.5 2.5L25 8'),
      funnel: on(TOP, 'M15 8L13.5 2Q20 4 26.5 2L25 8'),
      shirt: on(TOP, 'M15 8V5Q20 7 25 5V8M15 8L17.5 15L20 12.5L22.5 15L25 8'),
      bow: on(TOP, 'M15 8Q20 13 25 8M20 12.5Q14 9 13.5 13Q14 16 20 12.5Q26 16 26.5 13Q26 9 20 12.5M20 12.5L17 24M20 12.5L23.5 23'),
      ruffle: on(TOP, 'M15 8Q20 13 25 8M15 8Q13 10 14 12Q15 13 15.5 15Q17.5 15 18 16.5Q20 15.5 22 16.5Q22.5 15 24.5 15Q25 13 26 12Q27 10 25 8'),
      cape: on(TOP, 'M15 8Q20 13 25 8L32 12Q35 18 36 25Q20 30 4 25Q5 18 8 12zM12 15L9 24M28 15L31 24'),
    },
    back: {
      plain: on('M8 12L15 8Q20 10 25 8L32 12L30 22L29 40H11L10 22z', 'M20 9.5V40'),
      scoop: on('M8 12L15 8L25 8L32 12L30 22L29 40H11L10 22z', 'M15 8Q15.5 22 20 22Q24.5 22 25 8M20 22V40'),
      v: on('M8 12L15 8L25 8L32 12L30 22L29 40H11L10 22z', 'M15 8L20 26L25 8M20 26V40'),
      keyhole: on('M8 12L15 8Q20 10 25 8L32 12L30 22L29 40H11L10 22z', 'M20 9.5Q17 13 20 17Q23 13 20 9.5M20 17V40' + dot(21.6, 10.2, 0.6)),
    },
    structure: {
      none: on(TOP),
      boned: on('M10 18Q20 15 30 18L29 40H11z', 'M14.5 17.5V40M20 16.5V40M25.5 17.5V40M10.5 26.5V40M29.5 26.5V40'),
      shirred: on('M10 18Q20 15 30 18L29 40H11z', 'M10.3 21H29.7M10.4 24.5H29.6M10.6 28H29.4M10.7 31.5H29.3M10.8 35H29.2M10.9 38.5H29.1'),
    },
    peplum: {
      none: on(SHORT_TOP),
      flared: on(SHORT_TOP, 'M11 28L5 39Q20 43 35 39L29 28'),
      gathered: on(SHORT_TOP, 'M11 28L8 38Q11 40 14 38Q17 40 20 38Q23 40 26 38Q29 40 32 38L29 28M13 29v2M17 29v2M21 29v2M25 29v2'),
    },
    peplumHem: {
      level: on(SHORT_TOP, 'M11 28L5 39Q20 43 35 39L29 28'),
      high_low: on(SHORT_TOP, 'M11 28L5 35Q12 37 15 40Q20 46 25 40Q28 37 35 35L29 28'),
    },
  },
  tee: {
    fit: FIT,
    stretch: {
      low: on('M14 18h12v12H14z', 'M13 18h14v12H13zM10 24H6M7.5 22.5L6 24L7.5 25.5M30 24h4M32.5 22.5L34 24L32.5 25.5'),
      medium: on('M14 18h12v12H14z', 'M11 18h18v12H11zM9 24H4M5.5 22.5L4 24L5.5 25.5M31 24h5M34.5 22.5L36 24L34.5 25.5'),
      high: on('M14 18h12v12H14z', 'M8 18h24v12H8zM7 24H2M3.5 22.5L2 24L3.5 25.5M33 24h5M36.5 22.5L38 24L36.5 25.5'),
    },
  },
  trousers: {
    fit: FIT,
    waist: {
      band: on(TROUSERS, 'M11 4h18v3.5H11zM20 7.5V16M19 16h2'),
      elastic: on(TROUSERS, 'M11 4h18v3.5H11zM13 5v1.5M15.5 5v1.5M18 5v1.5M20.5 5v1.5M23 5v1.5M25.5 5v1.5M28 5v1.5'),
    },
    closure: {
      fly: on(TROUSERS, 'M20 4V17Q23 17 23 13.5V4'),
      side_zip: on(TROUSERS, 'M29.2 5V17M28.2 17h2v2.5h-2z'),
    },
    pockets: { none: on(TROUSERS), inseam: inseam(TROUSERS, 8), slant: on(TROUSERS, 'M14 4L11.2 12M26 4L28.8 12') },
  },
  outer: {
    fit: { ...FIT, oversized: DRESS_FIT.oversized },
    shaping: {
      darts: on(JACKET, 'M14.5 36L15.5 22L16.5 36M23.5 36L24.5 22L25.5 36'),
      princess: on(JACKET, 'M13 9Q15 24 14 38M27 9Q25 24 26 38'),
      boxy: on('M9 11L15 6L20 14L25 6L31 11V38H9z', 'M9 11V38M31 11V38'),
    },
    front: {
      single: on(JACKET, `M20 14V38${dot(20, 22)}${dot(20, 28)}${dot(20, 34)}`),
      double: on(JACKET, `M23 14V38${dot(17, 22)}${dot(23, 22)}${dot(17, 28)}${dot(23, 28)}${dot(17, 34)}${dot(23, 34)}`),
      zip: on('M9 11L15 7Q20 10 25 7L31 11L30 22L31 38H9L10 22z', 'M20 9V38M19 11h2M19 14h2M19 17h2M19 20h2M19 23h2M19 26h2M19 29h2M19 32h2M19 35h2'),
    },
    collar: {
      notched: on(JACKET, 'M15 6L12.5 14L15.5 13.5L20 24M25 6L27.5 14L24.5 13.5L20 24'),
      stand: on('M9 11L15 7Q20 10 25 7L31 11L30 22L31 38H9L10 22z', 'M15 7V3.5Q20 6 25 3.5V7'),
      collarless: on('M9 11L15 7Q20 13 25 7L31 11L30 22L31 38H9L10 22z', 'M15 7Q20 13 25 7'),
      hood: on('M9 11L15 7Q20 10 25 7L31 11L30 22L31 38H9L10 22z', 'M15 7Q13 -1 20 -1.5Q27 -1 25 7M17.5 5.5Q17 1.5 20 1Q23 1.5 22.5 5.5'),
    },
    sleeve: {
      tailored: on('M13 7Q20 2 27 7Q26 20 28 26L25 44H16L14 26Q12 18 13 7z', 'M18 5.5Q16 24 18.5 44'),
      fitted: on('M13 7Q20 2 27 7L25 44H16L13 7z', 'M14.5 24L18 25.5L14.8 27'),
      straight: on('M13 7Q20 2 27 7L27 44H13z', 'M13 44h14'),
      raglan: on(JACKET, 'M17 10L9.5 22M23 10L30.5 22'),
    },
    pads: {
      soft: on(JACKET, 'M9.5 10.5Q12 7.5 15 6.5'),
      structured: on('M8 10L15 6L20 14L25 6L32 10L30.5 22L31 38H9L9.5 22z', 'M8 10L15 6M32 10L25 6M9.5 10.5h4.5v1.5h-4.5zM26 10.5h4.5v1.5H26z'),
      none: on('M10 12L15 6L20 14L25 6L30 12L30 22L31 38H9L10 22z'),
    },
    pockets: { patch: on(JACKET, 'M11 27h6.5v6.5H11zM22.5 27H29v6.5h-6.5z'), welt: on(JACKET, 'M11 28h6.5v1.3H11zM22.5 28H29v1.3h-6.5z'), none: on(JACKET) },
    vent: {
      centre: on('M9 11L15 7Q20 9 25 7L31 11L30 22L31 38H9L10 22z', 'M20 9V38M20 29L21.5 31V38'),
      none: on('M9 11L15 7Q20 9 25 7L31 11L30 22L31 38H9L10 22z', 'M20 9V38'),
    },
    trim: {
      none: on(JACKET, 'M9 38h22'),
      rib: on('M9 11L15 6L20 14L25 6L31 11L30 22L31 34H9L10 22z', 'M10 34h20v4H10zM12 34v4M14 34v4M16 34v4M18 34v4M20 34v4M22 34v4M24 34v4M26 34v4M28 34v4'),
    },
    flare: {
      straight: on('M9 11L15 6L20 14L25 6L31 11L30 22L30.5 44H9.5L10 22z'),
      a_line: on('M9 11L15 6L20 14L25 6L31 11L30 22L34 44H6L10 22z', 'M30 22L34 44M10 22L6 44'),
    },
  },
};

/** The drawing beside a section's line for its picked choice, where the section has no picture tiles. */
export const detailPic = (set: ExplainSet, group: string, id: string): ReactNode | undefined => DETAILS[set][group]?.[id];

/** Every drawn section, for the test that checks each choice has one. */
export const detailGroups = (set: ExplainSet) => DETAILS[set];
