import { useMemo, useState } from 'react';
import { HouseLook, lookFabric, lookFlat, lookValues } from '../collection';
import { ERAS } from '../engine/eras';
import { eraLine } from '../eraLines';
import type { MeasurementValues } from '../measurements';
import { describePattern } from './describe';
import { GarmentFabric } from '../ui/FabricFill';
import { TechFlatView } from '../ui/TechFlatView';

interface Props {
  values: MeasurementValues;
  onMake: (look: HouseLook) => void;
}

/** The Eras shelf: pick an era and see its whole line (skirts, top, dress and a trouser, jacket or coat), each drawn
 *  flat to the sewist's measurements and made like any house look. */
export function EraShelf({ values, onMake }: Props) {
  const [eraId, setEraId] = useState(ERAS[0].id);
  const era = ERAS.find((e) => e.id === eraId) ?? ERAS[0];
  const pieces = useMemo(
    () =>
      eraLine(era.id).map((look) => {
        const at = lookValues(look, values);
        return { look, flat: lookFlat(look, at.values) };
      }),
    [era.id, values],
  );
  return (
    <>
      <div className="chips era-chips" role="group" aria-label="Era">
        {ERAS.map((e) => (
          <button key={e.id} type="button" className={e.id === era.id ? 'chip on' : 'chip'} aria-pressed={e.id === era.id} onClick={() => setEraId(e.id)}>
            {e.name}
          </button>
        ))}
      </div>
      <p className="muted small">
        {era.years}. {era.about}
      </p>
      <ol className="lookbook" aria-label={`The ${era.name} line`}>
        {pieces.map(({ look, flat }) => (
          <li key={look.id} className="house-look">
            <p className="eyebrow">{era.name}</p>
            <div className="house-flat">{flat ? <GarmentFabric fabric={lookFabric(look.fabric)}><TechFlatView flat={flat} title={describePattern(look.choices).toLowerCase()} /></GarmentFabric> : <p className="muted small">This look can&rsquo;t be drafted to these measurements.</p>}</div>
            <h2>{look.name}</h2>
            <p className="muted">{look.line}</p>
            <p className="muted small">Try: {look.fabric[0].toLowerCase() + look.fabric.slice(1)}.</p>
            <button type="button" className="secondary" onClick={() => onMake(look)}>
              Make this look
            </button>
          </li>
        ))}
      </ol>
    </>
  );
}
