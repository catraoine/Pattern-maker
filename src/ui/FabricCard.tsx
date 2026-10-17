import { FabricAdvice, MyFabric, describeFabric, pickTag } from '../engine/fabrics';
import { FabricGuide } from './FabricGuide';

interface Props {
  metres: number;
  advice: FabricAdvice;
  /** The era look's own suggestion, while the style is still that look. */
  look?: { name: string; fabric: string };
  fabric?: MyFabric;
  /** Always lined (a jacket or coat), so the lining isn't optional. */
  lined?: boolean;
}

/** The style screen's fabric box: how much to buy, what suits this style, and what to avoid. */
export function FabricCard({ metres, advice, look, fabric, lined }: Props) {
  const mine = describeFabric(fabric);
  return (
    <div className="fabric">
      <p className="eyebrow">Fabric</p>
      <p className="big">{metres.toFixed(1)} m</p>
      <p className="muted small">of 140 cm wide woven fabric, rough estimate</p>
      {mine && <p className="small">Your fabric: {mine}. Check it on the print screen.</p>}
      <p className="eyebrow">Good fabrics for {advice.style}</p>
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
          <span className="muted small">{lined ? 'For the lining.' : 'If you line it.'} {advice.lining.why}</span>
        </li>
      </ul>
      {advice.note && <p className="small">{advice.note}</p>}
      <p className="avoid small">
        <b>Avoid</b> {advice.avoid}
      </p>
      <FabricGuide />
    </div>
  );
}
