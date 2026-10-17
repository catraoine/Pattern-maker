import { useEffect, useMemo, useState } from 'react';
import { OVERLAP, PAGE_MARGIN, Paper, Sheet, layout, pageCount, pageName, pageSize, tileGrid, toSvg, usedTiles } from '../engine/export';
import { checkPattern } from '../engine/qc';
import type { Piece } from '../engine/piece';
import type { SewingGuide } from '../engine/instructions';
import type { SpecRow } from '../engine/techpack';
import { PatternPreview } from '../ui/Preview';
import type { Finish } from '../App';
import { SaveControl } from '../ui/SaveControl';
import type { Garment } from '../measurements';
import type { Fitting } from '../engine/fitting';
import { FABRIC_WIDTHS, Lay, layWords } from '../engine/layplan';
import { LayPlanView } from '../ui/LayPlanView';
import type { Flat } from '../engine/flat';
import { TechFlatView } from '../ui/TechFlatView';
import { StepDiagram } from '../ui/StepDiagram';
import { CLOTHS, seamFinish } from '../engine/couture';
import { DRAPES, FIBRES, FIBRE_IDS, MyFabric, WEIGHTS, FabricStyle, checkFabric, clothFor, easeWords } from '../engine/fabrics';
import { FabricGuide } from '../ui/FabricGuide';
import { SizeRun } from '../ui/SizeRun';
import type { MeasurementValues } from '../measurements';

/** What to print: the drafted pieces of either garment, with its notes and sewing steps. */
export interface Printable {
  pieces: Piece[];
  notes: string[];
  guide: SewingGuide;
  /** Body, ease and finished measurements, for the tech pack. */
  spec: SpecRow[];
  /** Cutting layouts at the chosen fabric width, one for each fabric. */
  lays: Lay[];
  /** The garment drawn flat, front and back. */
  flat?: Flat;
}

interface Props {
  profile: string;
  title: string;
  fit: string;
  garment: Garment;
  finish: Finish;
  onFinish: (f: Finish) => void;
  made?: Printable;
  error?: string;
  onBack: () => void;
  saveState: 'can' | 'saved' | 'full';
  onSave: () => void;
  onAccount: () => void;
  /** Corrections from toile fittings, and their notes, already in the pattern. */
  fitting?: Fitting;
  fittingNotes: string[];
  onFitting: () => void;
  /** The style the fabric is checked against. */
  style: FabricStyle;
  /** Each piece on screen at its real size. */
  onTrueScale?: () => void;
  /** For grading: the measurements, and the pattern's pieces drafted to any set of them. */
  values?: MeasurementValues;
  draftAt?: (m: MeasurementValues) => Piece[];
}

type Output = Paper | 'projector' | 'projectorDark';

// The dark projector file is the same page with white lines on black, offered as an option of the projector.
const PAPERS: { id: Paper | 'projector'; label: string }[] = [
  { id: 'a4', label: 'A4' },
  { id: 'letter', label: 'US Letter' },
  { id: 'a0', label: 'A0 copy shop' },
  { id: 'projector', label: 'Projector' },
];

const isProjector = (o: Output): o is 'projector' | 'projectorDark' => o === 'projector' || o === 'projectorDark';

/** The date as printed on the pattern, such as 14 Oct 2026. */
const printedDate = () => new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

// Phones can hand a file to the share sheet (email, Files, AirDrop, a printer app); most desktops can't.
const canShareFiles = (() => {
  try {
    return (
      typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File([''], 'x.pdf', { type: 'application/pdf' })] })
    );
  } catch {
    return false;
  }
})();

function download(data: BlobPart, type: string, name: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function ExportScreen({ profile, title, fit, garment, finish, onFinish, made, error, onBack, saveState, onSave, onAccount, fitting, fittingNotes, onFitting, onTrueScale, values, draftAt, style }: Props) {
  const [paper, setPaper] = useState<Output>('a4');
  const [pdf, setPdf] = useState<{ paper: Output; bytes: Uint8Array } | null>(null);
  const [shareNote, setShareNote] = useState('');
  const guide = made?.guide;
  const date = useMemo(printedDate, []);
  const sheet = useMemo(
    () =>
      made ? layout(made.pieces, `Maison Tracé: ${title}`, made.notes, { pattern: title, madeFor: profile, date }, { atelier: finish.atelier }) : undefined,
    [made, title, profile, date, finish.atelier],
  );
  // The seam check walks the garment's own pieces; its lining and facings follow them.
  const checks = useMemo(() => {
    if (!made) return [];
    const waist = made.spec.find((r) => r.label === 'Waist')?.finished;
    return checkPattern(
      made.pieces.filter((pc) => !pc.kind || pc.kind === 'collar'),
      { finishedWaist: typeof waist === 'number' ? waist : undefined },
    );
  }, [made]);
  const drafting = useMemo(() => (made ? made.pieces.filter((pc) => pc.draft).map((pc) => ({ piece: pc.name, points: pc.draft!.points })) : []), [made]);
  // The draft-it-by-hand guide: every garment piece that carries its draft (not the facings and lining).
  const byHand = useMemo(
    () =>
      made && finish.byHand
        ? made.pieces
            .filter((pc) => pc.draft && pc.kind !== 'lining' && pc.kind !== 'facing')
            .map((pc) => ({ piece: pc.name, frame: pc.draft!.frame, outline: pc.outline.points(12), lines: pc.lines.map((l) => l.points(8)), points: pc.draft!.points }))
        : undefined,
    [made, finish.byHand],
  );
  const lays = useMemo(() => made?.lays ?? [], [made]);
  const summary = useMemo(
    () =>
      made
        ? { rows: made.spec.filter((r) => typeof r.finished === 'number'), checks, madeFor: profile, date, drafting: finish.atelier ? drafting : undefined, byHand, lays, flat: made.flat, fabric: made.guide.fabric }
        : undefined,
    [made, checks, profile, date, drafting, finish.atelier, lays, byHand],
  );

  // Build the PDF ahead of time, so share and print run straight from the tap (phones require that).
  useEffect(() => {
    if (!sheet || !guide) return;
    let live = true;
    setPdf(null);
    import('../engine/pdf')
      .then(({ toTiledPdf, toProjectorPdf }) =>
        isProjector(paper) ? toProjectorPdf(sheet, { dark: paper === 'projectorDark', title }) : toTiledPdf(sheet, paper, { title, guide, summary }),
      )
      .then((bytes) => live && setPdf({ paper, bytes }));
    return () => {
      live = false;
    };
  }, [sheet, paper, title, guide, summary]);

  if (!made || !sheet || !guide) {
    return (
      <section className="card">
        <p className="msg error">{error ?? 'Add your measurements first.'}</p>
        <button type="button" className="link" onClick={onBack}>
          Back
        </button>
      </section>
    );
  }

  const projector = isProjector(paper);
  const grid = projector ? { rows: 1, cols: 1 } : tileGrid(sheet, paper);
  const pages = projector ? 1 : pageCount(sheet, paper);
  const passed = checks.filter((c) => c.ok).length;
  const fileBase = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  const fileName = `${fileBase}-${paper === 'projectorDark' ? 'projector-black' : paper}.pdf`;
  const ready = pdf?.paper === paper ? pdf.bytes : null;

  const share = async () => {
    if (!ready) return;
    try {
      await navigator.share({ files: [new File([ready], fileName, { type: 'application/pdf' })], title: `Maison Tracé: ${title}` });
      setShareNote('');
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setShareNote("Sharing didn't work on this device. Download the PDF instead.");
    }
  };

  const openToPrint = () => {
    if (!ready) return;
    const url = URL.createObjectURL(new Blob([ready], { type: 'application/pdf' }));
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const download_ = () => ready && download(ready, 'application/pdf', fileName);
  const paperChoice = projector ? 'projector' : paper;

  return (
    <>
      <div className="split">
        <section className="card grow" aria-labelledby="ptitle">
          <div>
            <h1 id="ptitle">{title[0].toUpperCase() + title.slice(1)}</h1>
            <p className="muted">
              For {profile === 'Me' ? 'you' : profile} · {fit[0].toUpperCase() + fit.slice(1)} fit
            </p>
          </div>
          <fieldset className="group">
            <legend>Print on</legend>
            <div className="chips" role="group" aria-label="Paper">
              {PAPERS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={paperChoice === p.id ? 'chip on' : 'chip'}
                  aria-pressed={paperChoice === p.id}
                  onClick={() => setPaper(p.id === 'projector' ? (paper === 'projectorDark' ? 'projectorDark' : 'projector') : p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {projector && (
              <label className="check">
                <input type="checkbox" checked={paper === 'projectorDark'} onChange={(e) => setPaper(e.target.checked ? 'projectorDark' : 'projector')} />
                <span>White lines on black, easier to see on dark fabric</span>
              </label>
            )}
          </fieldset>
          <div className="stack">
            <button type="button" className="primary" onClick={download_} disabled={!ready}>
              {ready ? `Download PDF (${pages} ${pages === 1 ? 'page' : 'pages'})` : 'Making your PDF…'}
            </button>
            {canShareFiles && (
              <button type="button" className="secondary" onClick={share} disabled={!ready}>
                Send to email or a printer
              </button>
            )}
            <button type="button" className="secondary" onClick={openToPrint} disabled={!ready}>
              Open PDF to print
            </button>
            {shareNote && <p className="msg small">{shareNote}</p>}
          </div>
          <p>
            {projector
              ? 'One page at true size, in fine lines for projecting onto fabric. Line your projector up with the 10 cm test square.'
              : paper === 'a0'
                ? 'Ask the copy shop to print at 100% (actual size). Measure the 10 cm test square before you cut.'
                : 'Print at 100% (actual size). Measure the 10 cm test square on page 1 before you cut.'}
          </p>
          {!projector && paper !== 'a0' && (
            <details className="small">
              <summary>How the pages fit together</summary>
              <p className="muted small">
                Trim each page along its dashed line on the left and top, then lay it over the page before so the half diamonds make whole ones.
                Tape them down and cut out your size line. On a phone, send the PDF to your email and print from a computer, or print straight from the
                share menu.
              </p>
            </details>
          )}
          <div className="preview tiles" style={{ ['--cols' as string]: grid.cols }}>
            <PatternPreview sheet={sheet} label={projector ? 'Pattern on one page for a projector' : `Pattern laid over ${pages} numbered print pages`} />
            {!projector && <TileOverlay sheet={sheet} paper={paper} />}
          </div>
          <p className="muted small">
            {passed === checks.length
              ? 'Checked: every seam meets its partner and every curve runs smoothly from piece to piece.'
              : `${checks.length - passed} of ${checks.length} seam checks found something to look at. The details are on the last page of the PDF.`}
          </p>
          <label className="check">
            <input type="checkbox" checked={!!finish.byHand} onChange={(e) => onFinish({ ...finish, byHand: e.target.checked })} />
            <span>
              Draft it by hand <span className="muted small">add pages to draw the pattern yourself on pattern paper, point by point</span>
            </span>
          </label>
          <SaveControl state={saveState} onSave={onSave} onAccount={onAccount} />
          <p className="muted small">Printed it? The sewing steps are just below, and on the last pages of the PDF.</p>
          <button type="button" className="link" onClick={onBack}>
            Back to style
          </button>
        </section>
      </div>

      {made?.flat && (
        <section className="card" aria-labelledby="flattitle">
          <p className="eyebrow">Technical flat</p>
          <h2 id="flattitle">{title}</h2>
          <TechFlatView flat={made.flat} title={title} />
          <p className="muted small">
            Drawn to scale from your pattern{garment === 'tee' ? '' : ', with the darts sewn'}. It goes on the first page of the PDF, for a dressmaker or anyone
            checking the design.
          </p>
        </section>
      )}

      <YourFabric fabric={finish.fabric ?? {}} onFabric={(fabric) => onFinish({ ...finish, fabric, cloth: clothFor(fabric, finish.cloth) })} style={style} />

      <section className="card" aria-labelledby="laytitle">
        <div className="row between wrap">
          <div>
            <p className="eyebrow">Cutting layout</p>
            <h2 id="laytitle">{lays.map((l) => `${l.metres.toFixed(1)} m${l.fabric === 'lining' ? ' of lining' : ''}`).join(' + ') || 'Too wide to lay out'}</h2>
          </div>
          <div className="row wrap">
            <div className="seg" role="group" aria-label="Fabric width">
              {FABRIC_WIDTHS.map((w) => (
                <button key={w} type="button" className={finish.fabricWidth === w ? 'on' : ''} aria-pressed={finish.fabricWidth === w} onClick={() => onFinish({ ...finish, fabricWidth: w })}>
                  {w} cm
                </button>
              ))}
            </div>
            <label className="check">
              <input type="checkbox" checked={finish.nap} onChange={(e) => onFinish({ ...finish, nap: e.target.checked })} />
              <span>
                Nap or one-way print <span className="muted small">every piece the same way up</span>
              </span>
            </label>
          </div>
        </div>
        {lays.length ? (
          lays.map((lay) => (
            <div key={lay.fabric} className="lay">
              {lays.length > 1 && <p className="eyebrow">{lay.fabric === 'lining' ? 'Lining' : 'Fabric'}</p>}
              <LayPlanView lay={lay} />
              <p className="muted small">{layWords(lay)}</p>
            </div>
          ))
        ) : (
          <p className="muted">These pieces are wider than {finish.fabricWidth} cm fabric. Try a wider fabric.</p>
        )}
      </section>

      <section className="card" aria-labelledby="toiletitle">
        <p className="eyebrow">Before your fabric{fittingNotes.length && fitting ? ` · version ${fitting.round + 1}` : ''}</p>
        <h2 id="toiletitle">{garment === 'tee' ? 'Try it in a spare knit first' : fittingNotes.length ? 'Corrected after your toile' : 'Fit it in a toile first'}</h2>
        {garment === 'tee' ? (
          <p className="muted">
            A knit fits by its stretch, so test it in a cheap knit with the same stretch as yours, not calico. If it is too snug or too
            loose, change the stretch or the fit on the style screen.
          </p>
        ) : fittingNotes.length ? (
          <ul className="fitlist">
            {fittingNotes.map((n) => (
              <li key={n}>{n[0].toUpperCase() + n.slice(1)}</li>
            ))}
          </ul>
        ) : (
          <p className="muted">
            Make it up in calico first and try it on. Tell us what you see, such as {garment === 'skirt' || garment === 'trousers' ? 'pulling across the hips or folds below the back waist' : 'pulling at the bust or a gaping neckline'}, and the
            pattern is corrected the way a pattern cutter would, with a second line for one side if your shoulders or hips differ.
          </p>
        )}
        <div className="row wrap">
          {garment !== 'tee' && (
            <button type="button" className="secondary" onClick={onFitting}>
              {fittingNotes.length ? 'Fit another toile' : 'I’ve tried on a toile'}
            </button>
          )}
          {onTrueScale && made && (
            <button type="button" className="secondary" onClick={onTrueScale}>
              See a piece at true size
            </button>
          )}
        </div>
      </section>

      <MakerPack
        profile={profile}
        title={title}
        fit={fit}
        made={made}
        fileBase={fileBase}
        onSvg={() => download(toSvg(sheet), 'image/svg+xml', `${fileBase}.svg`)}
        atelier={finish.atelier}
        onAtelier={(on) => onFinish({ ...finish, atelier: on })}
        drafting={drafting}
        pattern={ready ? { bytes: ready, name: fileName } : undefined}
      />

      {values && draftAt && (
        <SizeRun garment={garment} values={values} draftAt={draftAt} title={title} fileBase={fileBase} width={finish.fabricWidth} nap={finish.nap} download={download} />
      )}

      <section className="card sew" aria-labelledby="sewtitle">
        <div className="row between wrap">
          <div>
            <p className="eyebrow">After printing</p>
            <h2 id="sewtitle">How to sew it</h2>
          </div>
          {garment !== 'trousers' && garment !== 'tee' && (
          <div className="seg" role="group" aria-label="How to sew it">
            {(['quick', 'couture'] as const).map((r) => (
              <button key={r} type="button" className={finish.route === r ? 'on' : ''} aria-pressed={finish.route === r} onClick={() => onFinish({ ...finish, route: r })}>
                {r === 'quick' ? 'Quick' : 'Couture'}
              </button>
            ))}
          </div>
          )}
        </div>
        {finish.route === 'couture' && garment !== 'trousers' && garment !== 'tee' && (
          <div className="cloth">
            <p className="muted small">
              Thread-traced lines, basting and a fitting before machining, a hand-picked zip and hand-finished edges. The seam finish and
              pressing follow your cloth.
            </p>
            {finish.fabric?.fibre ? null : (
              <div className="seg" role="group" aria-label="Your cloth">
                {CLOTHS.map((c) => (
                  <button key={c.id} type="button" className={finish.cloth === c.id ? 'on' : ''} aria-pressed={finish.cloth === c.id} onClick={() => onFinish({ ...finish, cloth: c.id })} title={c.detail}>
                    {c.label}
                  </button>
                ))}
              </div>
            )}
            <p className="muted small">
              Seams: {{ french: 'French seams', hongkong: 'Hong Kong bound', pinked: 'pinked', overcast: 'overcast by hand' }[seamFinish(clothFor(finish.fabric, finish.cloth), garment === 'skirt' ? finish.skirtLined : finish.bodiceEdges === 'lined')]}
              {finish.fabric?.fibre ? `, chosen for your ${FIBRES[finish.fabric.fibre].label.toLowerCase()}` : ''}.
            </p>
          </div>
        )}
        <div className="sewgrid">
          <div className="notions">
            {guide.fabric?.length ? (
              <>
                <p className="eyebrow">Your fabric</p>
                <ul>
                  {guide.fabric.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </>
            ) : null}
            <p className="eyebrow">You'll need</p>
            <ul>
              {guide.notions.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
            <p className="muted small">These steps are also on the last pages of the PDF.</p>
          </div>
          <ol className="sewsteps">
            {guide.steps.map((st) => (
              <li key={st.title}>
                <strong>{st.title}</strong>
                <p>{st.text}</p>
                {st.diagram && <StepDiagram id={st.diagram} />}
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}

const today = () => new Date().toISOString().slice(0, 10);

/** The note that goes with the files when they are sent to a dressmaker. */
export function makerNote(title: string, profile: string): string {
  return [
    `Hello, could you make this ${title} for me?`,
    `The pattern was drafted to my own measurements in Maison Tracé. The tech pack has my measurements, the ease, the piece list, fabric and construction steps. The pattern is attached as a PDF to print at 100% and as a DXF for pattern software.`,
    `Could you let me know your price and when you could fit it in? Thank you, ${profile}`,
  ].join('\n\n');
}

/** One row of chips for a fabric trait; tapping the chosen one again clears it. */
function Chips<T extends string>({ label, options, value, onPick }: { label: string; options: { id: T; label: string }[]; value?: T; onPick: (v: T | undefined) => void }) {
  return (
    <fieldset className="group">
      <legend>{label}</legend>
      <div className="chips">
        {options.map((o) => (
          <button key={o.id} type="button" className={value === o.id ? 'chip on' : 'chip'} aria-pressed={value === o.id} onClick={() => onPick(value === o.id ? undefined : o.id)}>
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** The fabric the maker has bought: checked against the style, and carried into the ease, the PDF and the tech pack. */
function YourFabric({ fabric, onFabric, style }: { fabric: MyFabric; onFabric: (f: MyFabric) => void; style: Props['style'] }) {
  const set = (patch: Partial<MyFabric>) => onFabric({ ...fabric, ...patch });
  const notes = checkFabric(style, fabric);
  return (
    <section className="card yourfabric" aria-labelledby="fabtitle">
      <div className="row between wrap">
        <div>
          <p className="eyebrow">Your fabric</p>
          <h2 id="fabtitle">What are you making it in?</h2>
        </div>
        <FabricGuide />
      </div>
      <p className="muted small">Optional. It goes on the PDF and the tech pack, sets the couture seam finish and pressing, and adjusts the ease for heavy cloth.</p>
      <div className="fields">
        <div className="field plain">
          <label htmlFor="fabname">Name</label>
          <input id="fabname" type="text" autoComplete="off" value={fabric.name ?? ''} placeholder="For example, olive washed linen" onChange={(e) => set({ name: e.target.value })} />
        </div>
        <div className="field plain">
          <label htmlFor="fabcolour">Colour</label>
          <input id="fabcolour" type="text" autoComplete="off" value={fabric.colour ?? ''} placeholder="For example, olive" onChange={(e) => set({ colour: e.target.value })} />
        </div>
      </div>
      <Chips label="Fibre" options={FIBRE_IDS.map((id) => ({ id, label: FIBRES[id].label }))} value={fabric.fibre} onPick={(fibre) => set({ fibre })} />
      <Chips label="Weight" options={WEIGHTS} value={fabric.weight} onPick={(weight) => set({ weight })} />
      <Chips label="Drape" options={DRAPES} value={fabric.drape} onPick={(drape) => set({ drape })} />
      {notes.map((n) => (
        <p key={n.text} className={`small fabnote ${n.level}`}>
          {n.level === 'ok' ? <b>Good match </b> : n.level === 'warn' ? <b>Heads up </b> : null}
          {n.level === 'ok' ? n.text.replace(/^Good match /, '') : n.text}
        </p>
      ))}
      {fabric.weight === 'heavy' && style.garment !== 'tee' && (
        <label className="check">
          <input type="checkbox" checked={fabric.matchEase !== false} onChange={(e) => set({ matchEase: e.target.checked })} />
          <span>
            Adjust ease to my fabric{' '}
            <span className="muted small">{easeWords(fabric, style.garment)}, for the cloth's thickness</span>
          </span>
        </label>
      )}
    </section>
  );
}

/** Files for someone else to make the garment: a tech pack and the pattern as DXF for pattern software. */
function MakerPack({
  profile,
  title,
  fit,
  made,
  fileBase,
  pattern,
  onSvg,
  atelier,
  onAtelier,
  drafting,
}: {
  profile: string;
  title: string;
  fit: string;
  made: Printable;
  fileBase: string;
  onSvg: () => void;
  atelier: boolean;
  onAtelier: (on: boolean) => void;
  drafting: { piece: string; points: { n: string; note: string }[] }[];
  /** The printable pattern PDF, once it is made. */
  pattern?: { bytes: Uint8Array; name: string };
}) {
  const [pack, setPack] = useState<Uint8Array | null>(null);
  const [dxfText, setDxfText] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const fitName = fit[0].toUpperCase() + fit.slice(1);
  const packName = `${fileBase}-tech-pack.pdf`;
  const dxfName = `${fileBase}.dxf`;

  // Make both files ahead of time, so sharing runs straight from the tap (phones require that).
  useEffect(() => {
    let live = true;
    setPack(null);
    setDxfText(null);
    Promise.all([import('../engine/techpack'), import('../engine/dxf')]).then(async ([{ toTechPack }, { toDxf }]) => {
      const text = toDxf(made.pieces, { style: title, size: profile, date: today() });
      const bytes = await toTechPack({ title, profile, fit: fitName, date: today(), pieces: made.pieces, measurements: made.spec, notes: made.notes, guide: made.guide });
      if (live) {
        setDxfText(text);
        setPack(bytes);
      }
    });
    return () => {
      live = false;
    };
  }, [made, title, profile, fitName]);

  const ready = pack && dxfText;

  const send = async () => {
    if (!ready) return;
    const pdfFile = (bytes: Uint8Array, name: string) => new File([bytes], name, { type: 'application/pdf' });
    const withPattern = [pdfFile(pack, packName), ...(pattern ? [pdfFile(pattern.bytes, pattern.name)] : [])];
    const all = [...withPattern, new File([dxfText], dxfName, { type: 'application/dxf' })];
    const text = makerNote(title, profile);
    // Some share targets won't take a DXF; send the PDFs alone then.
    const files = [all, withPattern].find((fs) => {
      try {
        return navigator.canShare?.({ files: fs });
      } catch {
        return false;
      }
    });
    if (files) {
      try {
        await navigator.share({ files, title: `Please make my ${title}`, text });
        setNote(files === all ? '' : 'Sent the tech pack and pattern PDF. Download the DXF below if the maker uses pattern software.');
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setNote("Sending didn't work on this device. Download the files below and attach them to an email.");
      }
      return;
    }
    // Most computers can't share files: download them and start an email with the note.
    download(pack, 'application/pdf', packName);
    download(dxfText, 'application/dxf', dxfName);
    window.location.href = `mailto:?subject=${encodeURIComponent(`Please make my ${title}`)}&body=${encodeURIComponent(text)}`;
    setNote('Both files are in your downloads. Attach them to the email that just opened.');
  };

  return (
    <>
      <section className="card" aria-labelledby="makertitle">
        <p className="eyebrow">Having it made</p>
        <h2 id="makertitle">Send it to a dressmaker</h2>
        <p className="muted">
          The dressmaker gets the tech pack (your measurements, the ease, the piece list, fabric and sewing steps), the pattern to print and a DXF for
          pattern software.
        </p>
        <button type="button" className="primary" onClick={send} disabled={!ready}>
          {ready ? 'Send to a dressmaker' : 'Making the files…'}
        </button>
        <p className="muted small">Opens your share menu with the files and a short note for the maker.</p>
        {note && <p className="msg small">{note}</p>}
        <FindAMaker title={title} />
      </section>

      <details className="card more">
        <summary>
          <span className="eyebrow">Having it made, or drafting by hand</span>
          <h2>More files</h2>
        </summary>
        <p className="muted">
          For a dressmaker or factory, send both files. The tech pack has the measurements, ease, piece list, fabric and sewing steps. The DXF opens
          in pattern software such as Gerber, Lectra, Optitex and CLO 3D.
        </p>
        <div className="row wrap">
          <button type="button" className="secondary" onClick={() => pack && download(pack, 'application/pdf', packName)} disabled={!pack}>
            Tech pack (PDF)
          </button>
          <button type="button" className="secondary" onClick={() => dxfText && download(dxfText, 'application/dxf', dxfName)} disabled={!dxfText}>
            Pattern (DXF)
          </button>
          <button type="button" className="secondary" onClick={onSvg}>
            Pattern (SVG)
          </button>
        </div>
        <label className="check">
          <input type="checkbox" checked={atelier} onChange={(e) => onAtelier(e.target.checked)} />
          <span>
            Show how it was drafted <span className="muted small">numbered points on the pattern, with a note on how each was found</span>
          </span>
        </label>
        {atelier && (
          <div className="atelier">
            {drafting.map((d) => (
              <div key={d.piece}>
                <h3>{d.piece}</h3>
                <ol className="draftpoints">
                  {d.points.map((pt) => (
                    <li key={pt.n}>
                      <span className="num">{pt.n}</span>
                      {pt.note}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        )}
      </details>
    </>
  );
}

type Sent = 'idle' | 'sending' | 'sent' | 'failed';

/** Sign-up for the dressmaker pilot: the email goes to Netlify Forms (the "find-a-maker" form in index.html). */
function FindAMaker({ title }: { title: string }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<Sent>('idle');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('sending');
    try {
      const body = new URLSearchParams({ 'form-name': 'find-a-maker', email, pattern: title, 'bot-field': '' });
      const res = await fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
      setState(res.ok ? 'sent' : 'failed');
    } catch {
      setState('failed');
    }
  };

  return (
    <div className="makerform">
      <hr />
      <p className="eyebrow">No dressmaker yet?</p>
      {state === 'sent' ? (
        <p className="msg">Thank you. We'll email you to introduce a dressmaker in Vancouver.</p>
      ) : (
        <>
          <p className="muted">We're trying this with a few dressmakers in Vancouver. Leave your email and we'll introduce you to one.</p>
          <form className="row" onSubmit={submit}>
            <input type="email" required autoComplete="email" placeholder="Your email" aria-label="Your email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button type="submit" className="secondary" disabled={state === 'sending'}>
              {state === 'sending' ? 'Sending…' : 'Find me a maker'}
            </button>
          </form>
          {state === 'failed' && <p className="msg small">That didn't go through. Please try again in a moment.</p>}
        </>
      )}
    </div>
  );
}

/** Dashed page boundaries drawn over the preview, matching how the PDF is tiled. Blank pages aren't printed. */
function TileOverlay({ sheet, paper }: { sheet: Sheet; paper: Paper }) {
  const [pw, ph] = pageSize(sheet, paper);
  const tw = pw - 2 * PAGE_MARGIN;
  const th = ph - 2 * PAGE_MARGIN;
  const stepX = tw - OVERLAP;
  const stepY = th - OVERLAP;
  const cells = usedTiles(sheet, paper).flatMap((row, r) =>
    row.map((on, c) =>
      on ? (
        <g key={`${r}-${c}`}>
          <rect x={c * stepX} y={r * stepY} width={tw} height={th} fill="none" style={{ stroke: 'var(--muted)' }} strokeWidth={0.12} strokeDasharray="0.8 0.6" />
          <text x={c * stepX + 0.8} y={r * stepY + 2} fontSize={1.4} style={{ fill: 'var(--muted)', fontFamily: 'var(--mono)' }}>
            {pageName(r, c)}
          </text>
        </g>
      ) : null,
    ),
  );
  return (
    <svg viewBox={`0 0 ${sheet.width} ${sheet.height}`} className="preview-svg overlay" aria-hidden="true">
      {cells}
    </svg>
  );
}
