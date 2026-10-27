// Free, garment packs, Premium and Maker: what each one includes, and whether this account has it.
// Billing is switched off: until payments and sign-in exist, everyone has everything and none of the plan
// screens show. `?plans=preview` shows them without locking anything, for reviewing the screens.
// When billing arrives, `plan` and `packs` must come from the server, not from what's kept on the device.
import type { Account } from './account';
import type { Garment } from './measurements';
import { FREE_SAVED_LIMIT } from './account';

type Plan = 'free' | 'premium' | 'maker';

export const PRICES = {
  pack: '$6',
  premiumYear: '$49 a year',
  premiumMonth: '$5 a month',
  maker: '$25 a month',
} as const;

/** Garments every plan can print. The rest need Premium, Maker or a garment pack. */
const FREE_GARMENTS: readonly Garment[] = ['skirt', 'bodice'];
export const FREE_PHOTO_DRAFTS = 3;

/** Paid plans lock things only when this is on. Turned on with VITE_BILLING=on once payments work. */
export const BILLING_ON = import.meta.env.VITE_BILLING === 'on';

/**
 * Show the plan screens and prompts (with nothing locked) once the address has had ?plans=preview in this
 * tab; remembered for the tab, since the app tidies its address.
 */
export function plansPreview(search = typeof location === 'undefined' ? '' : location.search): boolean {
  const asked = new URLSearchParams(search).get('plans') === 'preview';
  try {
    if (asked) sessionStorage.setItem('pattern-maker:plans-preview', '1');
    return asked || sessionStorage.getItem('pattern-maker:plans-preview') === '1';
  } catch {
    return asked;
  }
}

// Read when the app loads, before it tidies the address.
plansPreview();

/** Whether the plan screens and prompts show at all. */
export const plansShown = (billing = BILLING_ON, preview = plansPreview()) => billing || preview;

export const planOf = (account: Account): Plan => account.plan ?? 'free';
const paid = (account: Account) => planOf(account) !== 'free';

/** Whether this garment can be printed: free garments, a paid plan, or a pack bought for it. */
export function hasGarment(account: Account, g: Garment, billing = BILLING_ON): boolean {
  if (!billing) return true;
  return FREE_GARMENTS.includes(g) || paid(account) || (account.packs ?? []).includes(g);
}

/** How many patterns can be saved: the free limit (kept today, before billing), or no limit on a paid plan. */
export const savedLimit = (account: Account): number => (paid(account) ? Infinity : FREE_SAVED_LIMIT);

/** The client book and size runs are Maker tools once billing is on. */
export const hasMakerTools = (account: Account, billing = BILLING_ON): boolean => !billing || planOf(account) === 'maker';

const monthKey = (d: Date) => d.toISOString().slice(0, 7);

/** Photo drafts used this calendar month (a count from an earlier month starts again at 0). */
export const photoDraftsUsed = (account: Account, now = new Date()): number =>
  account.photoDrafts?.month === monthKey(now) ? account.photoDrafts.used : 0;

/** The account with one more photo draft counted for this month. */
export const countPhotoDraft = (account: Account, now = new Date()): Account => ({
  ...account,
  photoDrafts: { month: monthKey(now), used: photoDraftsUsed(account, now) + 1 },
});

/** Whether another photo draft can be made: always on a paid plan or with billing off. */
export const canPhotoDraft = (account: Account, now = new Date(), billing = BILLING_ON): boolean =>
  !billing || paid(account) || photoDraftsUsed(account, now) < FREE_PHOTO_DRAFTS;

/** The first day of next month, when free photo drafts come back. */
export const photoDraftsReset = (now = new Date()): Date => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

export const GARMENT_NAMES: Record<Garment, string> = {
  skirt: 'skirt',
  bodice: 'bodice',
  dress: 'dress',
  trousers: 'trousers',
  tee: 'T-shirt',
  jacket: 'jacket',
  coat: 'coat',
  lingerie: 'lingerie',
};
