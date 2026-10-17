import { useMemo } from 'react';
import { COLLECTION, HouseLook, lookFlat, lookValues } from '../collection';
import type { MeasurementValues } from '../measurements';
import { describePattern } from './describe';
import { TechFlatView } from '../ui/TechFlatView';

interface Props {
  values: MeasurementValues;
  onMake: (look: HouseLook) => void;
  onBack: () => void;
}

const lookNo = (n: number) => `Look ${String(n).padStart(2, '0')}`;

/** The Maison collection, laid out like a lookbook: each house look drawn flat to the sewist's measurements. */
export function CollectionScreen({ values, onMake, onBack }: Props) {
  const looks = useMemo(
    () =>
      COLLECTION.map((look) => {
        const at = lookValues(look, values);
        return { look, own: at.own, flat: lookFlat(look, at.values) };
      }),
    [values],
  );
  const sample = looks.some((l) => !l.own);

  return (
    <div className="collection">
      <header className="collection-head">
        <p className="eyebrow">Maison Tracé</p>
        <h1 id="ctitle">The collection</h1>
        <p className="muted">Signature designs from the house, each drafted to your measurements. Make one, then change any detail you like.</p>
        {sample && <p className="muted small">Looks you haven&rsquo;t measured for yet are drawn to sample measurements.</p>}
        <button type="button" className="link" onClick={onBack}>
          Back to styling
        </button>
      </header>
      <ol className="lookbook" aria-labelledby="ctitle">
        {looks.map(({ look, flat }) => (
          <li key={look.id} className="house-look">
            <p className="eyebrow">{lookNo(look.number)}</p>
            <div className="house-flat">{flat ? <TechFlatView flat={flat} title={describePattern(look.choices).toLowerCase()} /> : <p className="muted small">This look can&rsquo;t be drafted to these measurements.</p>}</div>
            <h2>{look.name}</h2>
            <p className="muted">{look.line}</p>
            <p className="muted small">Cut in {look.fabric[0].toLowerCase() + look.fabric.slice(1)}.</p>
            <button type="button" className="secondary" onClick={() => onMake(look)}>
              Make this look
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
