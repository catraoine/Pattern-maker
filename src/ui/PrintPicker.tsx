// The print picker (Cat's P1): a row of pictures in place of the checks switch. The print sets how the
// pieces are laid, how much more fabric to buy and the cutting steps, and its swatch goes under the
// pieces in the cutting layout.
import type { MyFabric } from '../engine/fabrics';
import { PRINTS, PRINT_IDS, PrintKind, STRIPES_REPEAT, printImage, printOf } from '../engine/prints';
import { TestingTag } from './TestingTag';

const base = import.meta.env.BASE_URL;

/** The fabric with this print chosen: checks keep their own switch, so the seams are marked to match. */
function withPrint(f: MyFabric, kind: PrintKind | undefined): MyFabric {
  return {
    ...f,
    print: kind,
    checks: kind === 'checks' ? f.checks ?? {} : undefined,
    motif: kind === 'motif' ? f.motif ?? {} : undefined,
  };
}

export function PrintPicker({ fabric, onFabric }: { fabric: MyFabric; onFabric: (f: MyFabric) => void }) {
  const kind = printOf(fabric);
  const info = kind && PRINTS[kind];
  const repeat = kind === 'checks' ? fabric.checks?.repeat : fabric.motif?.repeat;
  const stripes = kind === 'checks' && !!fabric.checks?.stripes;
  const setRepeat = (r: number | undefined) =>
    onFabric(kind === 'checks' ? { ...fabric, checks: { ...fabric.checks, repeat: r } } : { ...fabric, motif: { repeat: r } });
  const gingham = kind === 'checks' && !stripes && !!fabric.checks?.gingham;
  const setLook = (look: 'checks' | 'gingham' | 'stripes') =>
    onFabric({ ...fabric, checks: { ...fabric.checks, stripes: look === 'stripes' || undefined, gingham: look === 'gingham' || undefined } });
  return (
    <div className="printpick">
      <p className="printpick-q">What's the print? <TestingTag tool="prints" /></p>
      <div className="printtiles" role="radiogroup" aria-label="What's printed on your fabric">
        {PRINT_IDS.map((id) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={kind === id}
            className={kind === id ? 'printtile on' : 'printtile'}
            // Tapping the chosen print again clears it.
            onClick={() => onFabric(withPrint(fabric, kind === id ? undefined : id))}
          >
            <img src={printImage(id, base)} alt="" loading="lazy" />
            <span className="card-name">{PRINTS[id].label}</span>
          </button>
        ))}
      </div>
      {kind === 'checks' && (
        <div className="fabtabs" role="radiogroup" aria-label="Checks or stripes">
          <button type="button" role="radio" aria-checked={!stripes && !gingham} className={!stripes && !gingham ? 'on' : ''} onClick={() => setLook('checks')}>
            Checks
          </button>
          <button type="button" role="radio" aria-checked={gingham} className={gingham ? 'on' : ''} onClick={() => setLook('gingham')}>
            Gingham
          </button>
          <button type="button" role="radio" aria-checked={stripes} className={stripes ? 'on' : ''} onClick={() => setLook('stripes')}>
            Stripes
          </button>
        </div>
      )}
      {info && <p className="muted small printpick-hint">{info.hint[0].toUpperCase() + info.hint.slice(1)}.</p>}
      {info?.repeat && (
        <div className="field plain">
          <label htmlFor="fabrepeat">Repeat, cm</label>
          <input
            id="fabrepeat"
            type="number"
            inputMode="decimal"
            min={0}
            value={repeat ?? ''}
            placeholder={String(stripes ? STRIPES_REPEAT : info.defaultRepeat)}
            onChange={(e) => setRepeat(e.target.value ? Number(e.target.value) : undefined)}
          />
        </div>
      )}
    </div>
  );
}
