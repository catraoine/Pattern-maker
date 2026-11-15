import type { FormKind } from '../measurements';
import { ContourForm } from './ContourForm';

/** The first measuring page's picture (Cat's W1, Nov 14: "keep the style of the form at the welcome screen"): the
 *  welcome's own contour form, champagne on black, so the body is the same from the welcome into the measuring pages.
 *  It replaces the 3D form on a chalk panel (F1), so this page is no longer the first chalk of a visit and Style's
 *  window lights up from black again. The form is already drawn: the welcome played its light pass a moment before. */
export function FirstForm({ kind }: { kind: FormKind }) {
  return (
    <div className={`first-form ${kind}`} aria-hidden="true">
      <ContourForm start="drawn" kind={kind} />
    </div>
  );
}
