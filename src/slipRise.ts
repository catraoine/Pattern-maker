import type { DressChoices } from './garments';
import { EXAMPLE_BODY, MeasurementValues } from './measurements';

/** How much a slip's scoop and armhole rise on a fuller bust: 1 cm for every 10 cm of bust over the example body,
 *  at most 4 cm. On a 130 cm bust the Ivory Slip's scoop and side showed the bust while its armhole stayed 26 cm deep
 *  against the example's 22 (CLO at hip 138, Nov 15 2026); raised 4 cm the front covered (Cat chose it, Nov 16). */
const SLIP_RISE = { per10: 1, most: 4 };

/** The rise for this bust, in half centimetres; none at or under the example body's bust. */
export function slipRise(m: MeasurementValues): number {
  const over = (m.full_bust ?? 0) - (EXAMPLE_BODY.full_bust ?? 0);
  if (!m.full_bust || over <= 0) return 0;
  return Math.min(SLIP_RISE.most, Math.round(((over / 10) * SLIP_RISE.per10) * 2) / 2);
}

/** A slip dress (a drawn neck with a strap, sleeveless) with its scoop and armhole raised for the bust. Other dresses
 *  come back as they are. */
export function withSlipRise(c: DressChoices, m: MeasurementValues): DressChoices {
  const b = c.bodice;
  if (b.neck?.strap === undefined || (b.sleeve && b.sleeve !== 'none')) return c;
  const rise = slipRise(m);
  if (!rise) return c;
  return { ...c, bodice: { ...b, armholeLower: (b.armholeLower ?? 0) - rise, neck: { ...b.neck, rise } } };
}
