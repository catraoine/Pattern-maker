/** Whether the form under a garment is drawn out to the wearer's shoulder width (see makeSpace): only when nothing
 *  covers the shoulders. Not under sleeves (a jacket or coat always has them), nor under a sleeveless top cut with full
 *  shoulders (a shell): its armhole sits inside the shoulder, on the body, and widened it would stand out square.
 *  (Kept free of the engine, so the view can ask it too.) */
export function widensForm(job: { kind: string; sleeve?: unknown; draft?: unknown }): boolean {
  if (job.kind === 'outer' || job.sleeve) return false;
  // (A T-shirt has sleeves; a tank keeps the T-shirt's own shoulder, sitting on the body like a shell's, and on a widened
  // form the form's shoulder showed past its armhole.)
  if (job.kind === 'tee') return false;
  // (A dress's bodice is the same: its shoulder is on the bodice it is drafted from.)
  type Shoulder = { shoulder?: { front?: number } };
  const draft = job.draft as (Shoulder & { bodice?: Shoulder }) | undefined;
  const sh = (job.kind === 'dress' ? draft?.bodice : draft)?.shoulder?.front;
  return !((job.kind === 'bodice' || job.kind === 'dress') && typeof sh === 'number' && sh >= 9);
}
