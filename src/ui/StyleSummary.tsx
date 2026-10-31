// The parts every Style screen's summary and preview share: the list of pattern pieces, the print, save and
// edit-measurements buttons, and the Form / Drawing / All round views.
import type { ReactNode } from 'react';
import type { Piece } from '../engine/piece';
import { SaveControl } from './SaveControl';

/** The pattern pieces and how many to cut; a garment's extra lines (tiers, a waistband) come in as children. */
export function PiecesList({ pieces, lining, children }: { pieces: Piece[]; lining?: boolean; children?: ReactNode }) {
  return (
    <div>
      <p className="eyebrow">Pattern pieces</p>
      <ul className="pieces">
        {pieces.map((pc) => (
          <li key={pc.name}>
            {pc.name}: {pc.cut.replace(' (1 pair)', '').toLowerCase()}
            {lining && pc.kind === 'lining' ? ' in lining' : ''}
          </li>
        ))}
        {children}
      </ul>
    </div>
  );
}

interface ActionsProps {
  ready: boolean;
  onNext: () => void;
  saveState: 'can' | 'saved' | 'full';
  onSave: () => void;
  onAccount: () => void;
  onEditMeasurements: () => void;
}

/** Print, save, and back to the measurements, at the foot of the summary. */
export function SummaryActions({ ready, onNext, saveState, onSave, onAccount, onEditMeasurements }: ActionsProps) {
  return (
    <>
      <button type="button" className="primary" disabled={!ready} onClick={onNext}>
        Print my pattern
      </button>
      <SaveControl state={saveState} disabled={!ready} onSave={onSave} onAccount={onAccount} />
      <button type="button" className="later edit-measure" onClick={onEditMeasurements}>
        Edit measurements
      </button>
    </>
  );
}

/** The garment views on a form-drawn garment: on the form, as a flat (the fashion word, so it doesn't read like the
 *  Draw tool beside it; Cat, 2026-10-29), and turning all round once it can. */
export const formViews = (round: unknown): ['sketch' | 'flat' | 'round', string][] => [['sketch', 'Front'], ['flat', 'Flat'], ...(round ? ([['round', 'All round']] as ['round', string][]) : [])];
