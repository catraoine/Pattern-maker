import { useEffect } from 'react';
import type { Account } from '../account';
import { FREE_PHOTO_DRAFTS, PRICES, planOf } from '../plans';
import { FREE_SAVED_LIMIT } from '../account';
import { BuyButton } from '../ui/PlanPrompts';

/** Free, Premium and Maker side by side. Opened from Your account and from every unlock prompt. */
export function PlansScreen({ account, onBack }: { account: Account; onBack: () => void }) {
  const plan = planOf(account);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  const yours = (p: typeof plan) => (plan === p ? ' · yours now' : '');

  return (
    <div className="plans">
      <section className="card plan" aria-labelledby="freetitle">
        <p className="eyebrow">Free{yours('free')}</p>
        <h1 id="freetitle">Skirt and bodice</h1>
        <p className="muted">
          Every style option, a pattern you print at home, {FREE_SAVED_LIMIT} saved patterns, {FREE_PHOTO_DRAFTS} photo drafts a month and how much
          fabric to buy.
        </p>
        {/* Projector and copy-shop files are free for everyone (Cat, 2026-10-28): highlighted, not a Premium extra. */}
        <p className="plan-perk">Project it straight onto fabric, or print one big copy-shop sheet. No taping pages, free.</p>
        <p className="muted small">Any other garment can be unlocked on its own for {PRICES.pack}, and it's yours to keep.</p>
      </section>

      <section className="card plan" aria-labelledby="premiumtitle">
        <p className="eyebrow">Premium{yours('premium') || ' · best value yearly'}</p>
        <h2 id="premiumtitle">Every garment</h2>
        <p className="muted">
          Dress, trousers, T-shirt, jacket and coat as well, as many people and saved patterns as you like, and unlimited photo drafts.
        </p>
        <dl className="offerprices">
          <div>
            <dt>Yearly</dt>
            <dd>{PRICES.premiumYear}</dd>
          </div>
          <div>
            <dt>Monthly</dt>
            <dd>{PRICES.premiumMonth}</dd>
          </div>
        </dl>
        {plan === 'free' && <BuyButton label="Go Premium" primary />}
      </section>

      <section className="card plan" aria-labelledby="makertitle2">
        <p className="eyebrow">Maker{yours('maker') || ' · for dressmakers'}</p>
        <h2 id="makertitle2">Premium plus your clients</h2>
        <p className="muted">Everything in Premium, with a client book for each person you sew for, the maker pack and graded size runs.</p>
        <dl className="offerprices">
          <div>
            <dt>Monthly</dt>
            <dd>{PRICES.maker}</dd>
          </div>
        </dl>
        {plan !== 'maker' && <BuyButton label="Go Maker" />}
      </section>

      <button type="button" className="link" onClick={onBack}>
        Back
      </button>
    </div>
  );
}
