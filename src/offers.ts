// Paid extras that aren't built yet. Each one is shown as a sign-up so we can see who wants it before building
// the paid part. Prices are the business plan's planned prices; nothing is charged until paid plans open.

export const OFFER_IDS = ['founding', 'printed', 'tools', 'sewalong', 'designers', 'designer-partner', 'kit', 'gift', 'fitcheck', 'sizerun', 'classroom', 'sponsor', 'engine', 'nights'] as const;

/** Where Atelier Nights could run, first one first. Night sign-ups are counted per city. */
export const NIGHT_CITIES = ['vancouver', 'berlin', 'london', 'copenhagen'] as const;
export type NightCity = (typeof NIGHT_CITIES)[number];
export const CITY_NAMES: Record<NightCity, string> = { vancouver: 'Vancouver', berlin: 'Berlin', london: 'London', copenhagen: 'Copenhagen' };
export type OfferId = (typeof OFFER_IDS)[number];

export interface Offer {
  id: OfferId;
  eyebrow: string;
  title: string;
  text: string;
  /** Planned prices, label then price. */
  prices?: [string, string][];
  button: string;
  thanks: string;
}

export const FOUNDING_PLACES = 500;

export const OFFERS: Record<OfferId, Offer> = {
  founding: {
    id: 'founding',
    eyebrow: `Founding members · ${FOUNDING_PLACES} places`,
    title: `Be one of the first ${FOUNDING_PLACES}`,
    text: 'Premium for life, paid once, when paid plans open. Founding members also get every new garment the day it arrives and a say in what comes next.',
    prices: [['Founding membership', '$99 once']],
    button: 'Save my place',
    thanks: "Your place is saved. We'll email you when founding places open. Nothing is charged today.",
  },
  printed: {
    id: 'printed',
    eyebrow: 'No taping',
    title: 'Have it printed and posted',
    text: 'Your pattern printed full size on one roll of pattern paper and posted to you. No sheets to tape together.',
    prices: [['Full-size roll, posted', '$12']],
    button: 'Tell me when it opens',
    thanks: "Thank you. We'll email you when printing by post opens.",
  },
  tools: {
    id: 'tools',
    eyebrow: 'Shopping for these?',
    title: "Links to buy what you'll need",
    text: 'We are choosing shops for zips, interfacing, chalk and shears. Leave your email and we will send the list when it is ready.',
    button: 'Send me the list',
    thanks: "Thank you. We'll email you the shopping list.",
  },
  sewalong: {
    id: 'sewalong',
    eyebrow: 'Sew-alongs',
    title: 'Sew a garment with us',
    text: 'Live evenings with a guest sewist, one step at a time: cutting, darts and zip, waistband, hem. Ask questions as you go, and keep the recordings.',
    prices: [
      ['First class', 'Free'],
      ['Full sew-along', '$29'],
    ],
    button: 'Join the list',
    thanks: "You're on the list. We'll email you before the first sew-along.",
  },
  designers: {
    id: 'designers',
    eyebrow: 'From the designers',
    title: 'Their design, drafted to you',
    text: 'Patterns by independent designers, drafted to your own measurements instead of a size chart.',
    prices: [['Each pattern', 'from $16']],
    button: 'Tell me when they arrive',
    thanks: "Thank you. We'll email you when the first designer patterns arrive.",
  },
  'designer-partner': {
    id: 'designer-partner',
    eyebrow: 'Are you a pattern designer?',
    title: 'Sell made-to-measure versions of your patterns',
    text: 'We draft your design to each buyer and share every sale with you. Leave your email and we will get in touch.',
    button: 'Get in touch',
    thanks: "Thank you. We'll be in touch about your patterns.",
  },
  kit: {
    id: 'kit',
    eyebrow: 'Fabric and notions kit',
    title: 'Buy everything for this pattern',
    text: 'The fabric for your cutting layout, with the zip, interfacing and thread to match, from a partner fabric shop. You pay the shop at its own checkout.',
    button: 'Tell me when kits open',
    thanks: "Thank you. We'll email you when kits open.",
  },
  gift: {
    id: 'gift',
    eyebrow: 'Give it',
    title: 'Give a kit or a year of Premium',
    text: 'A gift card with a note. They add their own measurements, so it fits them.',
    button: 'Tell me when gifts open',
    thanks: "Thank you. We'll email you when gift cards open.",
  },
  fitcheck: {
    id: 'fitcheck',
    eyebrow: 'Still not right?',
    title: 'Ask a pattern cutter',
    text: 'Send three photos of the toile on you. A qualified pattern cutter looks at the fit and tells you exactly what to change, and the app redrafts it.',
    prices: [['One fit check', '$35']],
    button: "I'd like this",
    thanks: "Thank you. We'll email you when fit checks open.",
  },
  sizerun: {
    id: 'sizerun',
    eyebrow: 'For small brands',
    title: 'Size runs, ready for production',
    text: 'Grade a style across your size range, with a DXF and a tech pack for every size, ready for a sample room or factory.',
    prices: [['Per style', '$45']],
    button: 'Tell me when it opens',
    thanks: "Thank you. We'll email you when size runs open.",
  },
  classroom: {
    id: 'classroom',
    eyebrow: 'For teachers',
    title: 'Use it in your classroom',
    text: 'Student seats for fashion colleges, textiles classes and sewing schools.',
    button: 'Ask about class seats',
    thanks: "Thank you. We'll be in touch about class seats.",
  },
  sponsor: {
    id: 'sponsor',
    eyebrow: 'For fabric mills and brands',
    title: 'Feature your fabrics',
    text: 'A clearly labelled sponsored page in our seasonal edit, showing your fabrics with the patterns they suit.',
    button: 'Get in touch',
    thanks: "Thank you. We'll be in touch.",
  },
  engine: {
    id: 'engine',
    eyebrow: 'Early access',
    title: 'Try it in your shop first',
    text: 'Leave your work email and we will be in touch when the first brands can try it.',
    button: 'Send',
    thanks: "Thank you. We'll be in touch when the first brands can try it.",
  },
  nights: {
    id: 'nights',
    eyebrow: 'Atelier Nights',
    title: 'Tell me when tickets open',
    text: "We'll email you when tickets for a night in this city open.",
    prices: [['A ticket', '$90 to $140']],
    button: 'Send',
    thanks: "You're counted in. We'll email you when tickets open in this city.",
  },
};
