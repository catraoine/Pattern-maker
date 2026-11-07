import type { Flat } from '../engine/flat';
import { TechFlatView } from './TechFlatView';

// The front of a pattern envelope (Cat's pick with D1, 2026-10-18): the house name, the garment's technical
// flat drawn to the sewist, and its name set large. It covers each saved pattern, each Archive cut, the print
// screen on a computer and the first page of the PDF, so a pattern looks like a designer piece wherever it's kept.

interface Props {
  /** The garment as named: "Knee A-line skirt". */
  name: string;
  flat?: Flat;
  /** Top right: an Archive number, a drop copy, or the date it was saved. */
  mark?: string;
  /** Under the name: who it's drafted to. */
  foot?: string;
  size?: 'small' | 'large';
  /** The house name at the top. Print's summary card goes without it (Cat, Nov 7). */
  house?: boolean;
}

export function Envelope({ name, flat, mark, foot, size = 'large', house = true }: Props) {
  return (
    <figure className={`envelope ${size}`} aria-label={`Pattern envelope: ${name}`}>
      {(house || mark) && (
        <div className="env-top">
          {house && <span>Maison Tracé</span>}
          {mark && <span>{mark}</span>}
        </div>
      )}
      <div className="env-art">{flat ? <TechFlatView flat={flat} title={name.toLowerCase()} /> : null}</div>
      <figcaption>
        <span className="env-name">{name}</span>
        {foot && <span className="env-foot">{foot}</span>}
      </figcaption>
    </figure>
  );
}
