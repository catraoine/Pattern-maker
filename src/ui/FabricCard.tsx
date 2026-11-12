import { FabricAdvice, MyFabric, describeFabric, pickTag } from '../engine/fabrics';
import { ReactNode, createContext } from 'react';
import { FabricGuide } from './FabricGuide';

interface Props {
  metres: number;
  advice: FabricAdvice;
  /** The era look's own suggestion, while the style is still that look. */
  look?: { name: string; fabric: string };
  fabric?: MyFabric;
  /** A knit garment: knit fabric to buy, and the neckband's fabric in place of a lining. */
  knit?: boolean;
  /** Always lined (a jacket or coat), so the lining isn't optional. */
  lined?: boolean;
  /** The fabric to see the sketch in, first, so it sits right under the tabs on a phone. */
  children?: ReactNode;
}

/** The fabric this garment needs, in metres, for the shop fabric's buy strip inside the Fabric tab. */
export const FabricMetres = createContext<number | undefined>(undefined);

/** The style screen's Fabric tab (Cat's S3 Style Tab, 2026-10-18): the fabric to see the sketch in, how much to
 * buy, what suits this style, and what to avoid, all in one place. */
export function FabricCard({ metres, advice, look, fabric, knit, lined, children }: Props) {
  const mine = describeFabric(fabric);
  return (
    <div className="fabric">
      <FabricMetres.Provider value={metres}>{children}</FabricMetres.Provider>
      <p className="fabric-amount">
        <span className="big">{metres.toFixed(1)} m</span>{' '}
        <span className="muted small">{knit ? 'of 150 cm wide knit fabric, rough estimate' : 'of 140 cm wide woven fabric, rough estimate'}</span>
      </p>
      {mine && <p className="small">Your fabric: {mine}.</p>}
      {/* Folded, so the tab stays short on a phone, under the pinned sketch. */}
      <details className="small fold-link">
        {/* A hyphenated word kept whole: "T-shirt" split as "T-" and "SHIRT" across two lines (Cat, Nov 11 sweep). */}
        <summary>
          Good fabrics for{' '}
          {advice.style.split(' ').map((w, i) => (
            <span key={i}>
              {i ? ' ' : ''}
              {w.includes('-') ? <span className="nowrap">{w}</span> : w}
            </span>
          ))}
        </summary>
        <ul className="picks">
          {look && (
            <li>
              <strong>{look.fabric}</strong>
              <span className="muted small">The {look.name} look</span>
            </li>
          )}
          {advice.picks.map((p) => (
            <li key={p.name}>
              <strong>{p.name}</strong>
              <span className="tag">{pickTag(p)}</span>
              <span className="muted small">{p.why}</span>
            </li>
          ))}
          <li>
            <strong>{advice.lining.name}</strong>
            <span className="tag">{pickTag(advice.lining)}</span>
            <span className="muted small">{knit ? advice.lining.why : `${lined ? 'For the lining.' : 'If you line it.'} ${advice.lining.why}`}</span>
          </li>
        </ul>
        {advice.note && <p className="small">{advice.note}</p>}
        <p className="avoid small">
          <b>Avoid</b> {advice.avoid}
        </p>
        <FabricGuide />
      </details>
    </div>
  );
}

/** The Review page's one line on fabric, now that choosing it happens on the Fabric tab. */
export function FabricSummary({ metres, fabric }: { metres: number; fabric?: MyFabric }) {
  const mine = describeFabric(fabric);
  return (
    <p className="small fabric-summary">
      <b>Fabric</b> {metres.toFixed(1)} m{mine ? ` of ${mine}` : ''}. Change it on the Fabric tab.
    </p>
  );
}
