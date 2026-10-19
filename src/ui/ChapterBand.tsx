// The top edge of the Style and Print chapters, the way the tape runs along the top of every measuring page
// (Cat's picks S2c Raw Fringe and P4e Ivory Mat, 2026-10-18). Style gets the selvedge of a length of cloth,
// frayed along its raw edge, with only the house name printed on it. Print gets the edge of a cutting mat in
// the tape's ivory, its centimetres carrying on from where the tape's stop. Each unrolls when its chapter opens.

const MAT_MARKS = Array.from({ length: 34 }, (_, i) => i + 57);

export function ChapterBand({ kind }: { kind: 'selvedge' | 'mat' }) {
  if (kind === 'selvedge')
    return (
      <div className="chapter-band selvedge-band" aria-hidden="true">
        <div className="selvedge-cloth">
          <span>Maison Tracé</span>
        </div>
        <div className="selvedge-fringe" />
      </div>
    );
  return (
    <div className="chapter-band mat-band" aria-hidden="true">
      <div className="mat-marks">
        {MAT_MARKS.map((n) => (
          <span key={n}>{n}</span>
        ))}
      </div>
    </div>
  );
}
