import { useState } from 'react';
import type { Account } from '../account';
import type { Garment } from '../measurements';
import { FREE_PHOTO_DRAFTS, GARMENT_NAMES, PRICES, photoDraftsReset, photoDraftsUsed, planOf, savedLimit } from '../plans';
import { InterestCard } from './InterestCard';

const PLAN_NAMES = { free: 'Free', premium: 'Premium', maker: 'Maker' } as const;
const dayMonth = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'long', timeZone: 'UTC' });

/** Paid plans aren't open: a buy button says so and offers a founding place instead. */
export function BuyButton({ label, primary }: { label: string; primary?: boolean }) {
  const [asked, setAsked] = useState(false);
  return (
    <>
      <button type="button" className={primary ? 'primary' : 'secondary'} onClick={() => setAsked(true)} aria-expanded={asked}>
        {label}
      </button>
      {asked && (
        <>
          <p className="msg small">Paid plans aren't open yet. Save a founding place and you'll hear first.</p>
          <InterestCard offer="founding" inset />
        </>
      )}
    </>
  );
}

/** On the Print screen, in place of the downloads, when a free account picks a garment it hasn't unlocked. */
export function UnlockGarment({ garment, onPlans, onBack }: { garment: Garment; onPlans: () => void; onBack: () => void }) {
  const name = GARMENT_NAMES[garment];
  return (
    <section className="card plan" aria-labelledby="unlocktitle">
      <p className="eyebrow">{name}</p>
      <h1 id="unlocktitle">Unlock the {name}</h1>
      <p className="muted">You've seen it styled and drawn to your measurements. Unlock it to print the pattern, the sewing steps and the files for a dressmaker.</p>
      <dl className="offerprices">
        <div>
          <dt>Just the {name}, yours to keep</dt>
          <dd>{PRICES.pack}</dd>
        </div>
        <div>
          <dt>Every garment with Premium</dt>
          <dd>{PRICES.premiumYear}</dd>
        </div>
      </dl>
      <div className="stack">
        <BuyButton label={`Unlock the ${name} · ${PRICES.pack}`} primary />
        <button type="button" className="secondary" onClick={onPlans}>
          See Premium
        </button>
        <button type="button" className="link" onClick={onBack}>
          Back to style
        </button>
      </div>
    </section>
  );
}

/** The month's free photo drafts: a quiet count, or the limit with a way to Premium. */
export function PhotoAllowance({ account, onPlans }: { account: Account; onPlans: () => void }) {
  if (planOf(account) !== 'free') return null;
  const used = photoDraftsUsed(account);
  const back = dayMonth.format(photoDraftsReset());
  if (used < FREE_PHOTO_DRAFTS)
    return (
      <p className="muted small photoallowance">
        {used} of {FREE_PHOTO_DRAFTS} free photo drafts used this month. They start again on {back}.
      </p>
    );
  return (
    <section className="card plan" aria-labelledby="phototitle">
      <p className="eyebrow">This month</p>
      <h2 id="phototitle">That's this month's {FREE_PHOTO_DRAFTS} free drafts</h2>
      <p className="muted">Premium has unlimited photo drafts. Your free ones come back on {back}.</p>
      <button type="button" className="primary" onClick={onPlans}>
        See Premium
      </button>
    </section>
  );
}

/** At the top of Your account: the plan, what's unlocked and how full the saved patterns are. */
export function YourPlan({ account, onPlans }: { account: Account; onPlans: () => void }) {
  const plan = planOf(account);
  const limit = savedLimit(account);
  const packs = account.packs ?? [];
  return (
    <section className="card plan" aria-labelledby="plantitle">
      <p className="eyebrow">Your plan</p>
      <h2 id="plantitle">{PLAN_NAMES[plan]}</h2>
      <dl className="offerprices">
        {plan === 'free' && (
          <div>
            <dt>Garments unlocked</dt>
            <dd>{packs.length ? packs.map((g) => GARMENT_NAMES[g]).join(', ') : 'Skirt and bodice'}</dd>
          </div>
        )}
        <div>
          <dt>Saved patterns</dt>
          <dd>{limit === Infinity ? `${account.patterns.length}, no limit` : `${account.patterns.length} of ${limit}`}</dd>
        </div>
      </dl>
      <button type="button" className="secondary" onClick={onPlans}>
        See plans
      </button>
    </section>
  );
}
