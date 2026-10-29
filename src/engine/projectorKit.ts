// What you need for projector mode (Cat picked K1 Fold-out, 2026-10-29), each with an Amazon search link.
// Cat's Amazon.ca Associates tag (joined 2026-10-29) goes on amazon.ca links only: a tag earns on its own store.
// Add a store's tag here when she joins it; Amazon's required line shows once any tag is set.
import type { Unit } from '../measurements';

type Store = 'www.amazon.ca' | 'www.amazon.com' | 'www.amazon.co.uk';

const AMAZON_TAGS: Partial<Record<Store, string>> = { 'www.amazon.ca': 'maisontrace-20' };

interface KitItem {
  name: string;
  why: string;
  optional?: boolean;
  search: string;
}

export const kit = (unit: Unit): KitItem[] => [
  { name: 'Projector', why: 'Any small 1080p projector. Brighter is easier in daylight.', search: '1080p mini projector' },
  { name: 'Mount or tall stand', why: 'So it points straight down at the table.', search: 'projector ceiling mount overhead stand' },
  { name: 'Cable', why: 'HDMI, plus a USB-C adapter if your laptop or tablet needs one.', search: 'HDMI cable USB-C to HDMI adapter' },
  {
    name: 'Cutting mat with a grid',
    why: `${unit === 'in' ? '24 × 18 in' : '60 × 45 cm'}. It's what you line up against.`,
    search: unit === 'in' ? 'self healing cutting mat 24 x 18 inch grid' : 'self healing cutting mat 60 x 45 cm grid',
  },
  { name: 'Pattern weights', why: 'Keep the cloth still while you cut.', optional: true, search: 'sewing pattern weights' },
];

// Many Canadians browse in en-US, so a Canadian time zone also counts as Canada.
const CANADA_ZONES = /^America\/(Vancouver|Edmonton|Winnipeg|Regina|Toronto|Montreal|Halifax|St_Johns|Moncton|Glace_Bay|Goose_Bay|Whitehorse|Dawson|Dawson_Creek|Fort_Nelson|Creston|Yellowknife|Inuvik|Cambridge_Bay|Iqaluit|Rankin_Inlet|Resolute|Atikokan|Blanc-Sablon|Swift_Current|Thunder_Bay|Nipigon|Rainy_River|Pangnirtung)$/;

const browserZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
  } catch {
    return '';
  }
};

/** The sewist's own Amazon: Canada, the UK or the US, read from the browser's language and time zone. */
export function amazonHost(language = typeof navigator === 'undefined' ? '' : navigator.language, zone = browserZone()): Store {
  if (/^[a-z]{2}-CA\b/i.test(language) || CANADA_ZONES.test(zone)) return 'www.amazon.ca';
  if (/^en-(GB|IE)\b/i.test(language)) return 'www.amazon.co.uk';
  return 'www.amazon.com';
}

export function amazonLink(item: KitItem, language?: string, tags = AMAZON_TAGS, zone?: string): string {
  const host = amazonHost(language, zone);
  const q = new URLSearchParams({ k: item.search });
  const tag = tags[host];
  if (tag) q.set('tag', tag);
  return `https://${host}/s?${q}`;
}

/** Amazon's line goes under the list whenever this sewist's links carry a tag. */
export const amazonTagged = (language?: string, tags = AMAZON_TAGS, zone?: string) => Boolean(tags[amazonHost(language, zone)]);
