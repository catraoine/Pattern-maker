import { DropMenu } from '../ui/DropMenu';
import { useWide } from '../ui/StyleLayout';
import { useEffect, useMemo, useState } from 'react';
import { SendToDevice } from '../ui/SendToDevice';
import { OVERLAP, PAGE_MARGIN, Paper, Sheet, layout, pageCount, pageName, pageSize, tileGrid, toSvg, usedTiles } from '../engine/export';
import { checkPattern } from '../engine/qc';
import type { Piece } from '../engine/piece';
import type { SewingGuide } from '../engine/instructions';
import type { SpecRow } from '../engine/techpack';
import { PatternPreview } from '../ui/Preview';
import type { Finish } from '../savedWork';
import type { Garment, Unit } from '../measurements';
import type { Alteration, Fitting } from '../engine/fitting';
import { FABRIC_WIDTHS, type FabricWidth, Lay, layAmount, layWords } from '../engine/layplan';
import { LayPlanView } from '../ui/LayPlanView';
import type { Flat } from '../engine/flat';
import { TechFlatView } from '../ui/TechFlatView';
import { StepDiagram } from '../ui/StepDiagram';
import { CLOTHS, seamFinish } from '../engine/couture';
import { FIBRES, Fibre, MyFabric, FabricStyle, adviceFor, checkFabric, clothFor, pickTag, printRepeat } from '../engine/fabrics';
import { SPECIALS, Special, needsNap } from '../engine/specialFabrics';
import { printNap, printOf } from '../engine/prints';
import { SizeRun } from '../ui/SizeRun';
import { Envelope } from '../ui/Envelope';
import { InterestCard } from '../ui/InterestCard';
import type { MeasurementValues } from '../measurements';
import { Mode, ProTool, shows } from '../mode';
import { ModeLink } from '../ui/ModeLink';
import { countStep } from '../report/report';
import { flatId } from '../ui/FabricFill';
import { buyAmount, buyLink, shopFabric, shopPrice, type ShopFabric } from '../engine/shopFabrics';
import { canShareFiles, download } from '../ui/download';
import { LabelCard } from '../ui/LabelCard';
import { TestingTag } from '../ui/TestingTag';
import { DemoButton } from '../ui/DemoButton';
import { isKnit, isLowerBody } from '../measurements';

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
  /** Drafted to the example body because measuring was skipped: printing asks first (Cat, 2026-10-21). */
  example?: boolean;
  /** Measure me, from that question: drops the example and opens measuring. */
  onMeasureMe?: () => void;
  /** The sewist's unit; the PDF's text is written in inches when it is `in`. */
  unit?: Unit;
  /** The paper picked last time, kept with the rest of the work; without one, inches start on US Letter. */
  paper?: Paper;
  onPaper?: (p: Paper) => void;
  /** The link that carries this device's measurements and patterns to a computer; see moveLink.ts. */
  sendLink?: () => Promise<string>;
  profile: string;
  title: string;
  fit: string;
  garment: Garment;
  finish: Finish;
  onFinish: (f: Finish) => void;
  made?: Printable;
  error?: string;
  /** Back to the style screen's Fabric tab, where the fabric is chosen. */
  onEditFabric?: () => void;
  /** Keeps the pattern in your patterns, for the label card's code; the button itself is on Review. */
  onKeep?: () => void;
  /** After printing: "How did it fit?" opens the fit notes for this pattern (saving it first if need be). */
  onFitNotes?: () => void;
  /** The fit already reported for this pattern, in a line, if there is one. */
  fitNote?: string;
  /** Corrections from toile fittings, and their notes, already in the pattern. */
  fitting?: Fitting;
  fittingNotes: string[];
  /** The toile corrections as alterations a pattern cutter makes on their own block. */
  alterations?: Alteration[];
  onFitting: () => void;
  /** The style the fabric is checked against. */
  style: FabricStyle;
  /** Each piece on screen at its real size. */
  onTrueScale?: () => void;
  /** For grading: the measurements, and the pattern's pieces drafted to any set of them. */
  values?: MeasurementValues;
  draftAt?: (m: MeasurementValues) => Piece[];
  /** A pattern read from another program's file: no style, fabric check or toile of its own. */
  imported?: { source?: string; fileName: string };
  /** The signature label: whose name it carries and the saved pattern's code. */
  label?: { name: string; code?: string };
  /** Simple or all tools; all when not given. */
  mode?: Mode;
  onMode?: (m: Mode) => void;
  /** A numbered drop's copy and an Archive cut's credit, printed in the title block. */
  edition?: string;
  credit?: string;
}

/** A touch screen with no mouse: a phone or tablet, where sending the work to a computer helps. */
const onPhone = () => typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches && !window.matchMedia('(any-pointer: fine)').matches;

const NONE: Alteration[] = [];

/** US Letter for inches, or a browser set to Canada or the US; A4 everywhere else. */
export function defaultPaper(unit: Unit, language = typeof navigator === 'undefined' ? '' : navigator.language): Paper {
  return unit === 'in' || /^en-(US|CA)\b/i.test(language) ? 'letter' : 'a4';
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



export function ExportScreen({ example, onMeasureMe, unit = 'cm', paper: savedPaper, onPaper, sendLink, profile, title, fit, garment, finish, onFinish, made, error, onEditFabric, onKeep, onFitNotes, fitNote, fitting, fittingNotes, alterations = NONE, onFitting, onTrueScale, values, draftAt, style, imported, mode = 'all', onMode, edition, credit, label }: Props) {
  const can = (t: ProTool) => shows(mode, t);
  /** Knits fit by their stretch: tested in a spare knit, not a calico toile. */
  const knit = isKnit(garment);
  // The paper starts on what was picked before, else on US Letter for a sewist measuring in inches or on a
  // North American browser (the tester walk, 2026-10-27: an inch tester printed A4 tiles on Letter paper). The pick
  // is kept with the saved work, so it holds across visits and garments.
  const [picked, setPicked] = useState<Output>(savedPaper ?? defaultPaper(unit));
  const setPaper = (p: Output) => {
    setPicked(p);
    if (!isProjector(p)) onPaper?.(p);
  };
  // The copy-shop sheet shows in every view (Cat, 2026-10-22): one big sheet saves testers and beginners the
  // taping. Only the projector files wait behind all the tools.
  const paper: Output = can('bigPrint') || !isProjector(picked) ? picked : 'a4';
  const [pdf, setPdf] = useState<{ paper: Output; bytes: Uint8Array; total: number } | null>(null);
  const [shareNote, setShareNote] = useState('');
  const special = finish.fabric?.special;
  const print = printOf(finish.fabric);
  const napFixed = needsNap(special) || printNap(print);
  const nap = finish.nap || napFixed;
  const guide = made?.guide;
  const date = useMemo(printedDate, []);
  const sheet = useMemo(
    () =>
      made ? layout(made.pieces, `Maison Tracé: ${title}`, made.notes, { pattern: title, madeFor: profile, date, edition, credit }, { atelier: finish.atelier }) : undefined,
    [made, title, profile, date, finish.atelier, edition, credit],
  );
  // The seam check walks the garment's own pieces and its pockets; its lining and facings follow them.
  const checks = useMemo(() => {
    if (!made) return [];
    const waist = made.spec.find((r) => r.label === 'Waist')?.finished;
    return checkPattern(
      made.pieces.filter((pc) => !pc.kind || pc.kind === 'collar' || pc.kind === 'pocket'),
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
        ? { rows: made.spec.filter((r) => typeof r.finished === 'number'), checks, madeFor: profile, date, edition, credit, drafting: finish.atelier ? drafting : undefined, byHand, lays, flat: made.flat, fabric: made.guide.fabric }
        : undefined,
    [made, checks, profile, date, edition, credit, drafting, finish.atelier, lays, byHand],
  );

  // Build the PDF ahead of time, so share and print run straight from the tap (phones require that).
  useEffect(() => {
    if (!sheet || !guide) return;
    let live = true;
    setPdf(null);
    let countPages = async (_: Uint8Array) => 0;
    import('../engine/pdf')
      .then(({ toTiledPdf, toProjectorPdf, pdfPageCount }) => {
        countPages = pdfPageCount;
        return isProjector(paper) ? toProjectorPdf(sheet, { dark: paper === 'projectorDark', title }) : toTiledPdf(sheet, paper, { title, guide, summary, unit });
      })
      .then(async (bytes) => live && setPdf({ paper, bytes, total: await countPages(bytes) }));
    return () => {
      live = false;
    };
  }, [sheet, paper, title, guide, summary, unit]);

  // These hooks sit above the early return below so every render calls them in the same order.
  // Once the pattern has left the app (downloaded, shared or opened to print), the fit question comes up.
  const [printed, setPrinted] = useState(false);
  // How to sew it folds closed on a phone, where the page was one long scroll, and opens on a computer (the
  // aesthetic review, 2026-10-21). Set once on arrival; after that the fold is the reader's.
  // On the example body, the first print asks once whether to measure first or print the example anyway.
  const [asking, setAsking] = useState<(() => void) | undefined>();
  const [exampleOk, setExampleOk] = useState(false);
  // On a computer the pages sit in their own column beside the controls, so they stay open there.
  const wide = useWide();
  const [seePages, setSeePages] = useState(false);
  if (!made || !sheet || !guide) {
    return (
      <section className="card">
        <p className="msg error">{error ?? 'Add your measurements first.'}</p>
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

  const showPages = wide || seePages;
  const checked = (go: () => void) => () => (example && !exampleOk ? setAsking(() => go) : go());
  const share = async () => {
    if (!ready) return;
    try {
      await navigator.share({ files: [new File([ready], fileName, { type: 'application/pdf' })], title: `Maison Tracé: ${title}` });
      countStep('printed', garment);
      setPrinted(true);
      setShareNote('');
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setShareNote("Sharing didn't work on this device. Download the PDF instead.");
    }
  };

  const openToPrint = () => {
    if (!ready) return;
    countStep('printed', garment);
    setPrinted(true);
    const url = URL.createObjectURL(new Blob([ready], { type: 'application/pdf' }));
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const download_ = () => {
    if (!ready) return;
    countStep('printed', garment);
    setPrinted(true);
    download(ready, 'application/pdf', fileName);
  };
  const paperChoice = projector ? 'projector' : paper;

  return (
    <>
      <div className="split">
        <section className="card grow print-top" aria-labelledby="ptitle">
          <div className="print-head">
            <h1 id="ptitle">{title[0].toUpperCase() + title.slice(1)}</h1>
            <p className="muted">
              {imported
                ? `${imported.fileName} · ${made.pieces.length} ${made.pieces.length === 1 ? 'piece' : 'pieces'}${imported.source ? ` from ${imported.source}` : ''}`
                : `For ${profile === 'Me' ? 'you' : profile} · ${fit[0].toUpperCase() + fit.slice(1)} fit`}
            </p>
          </div>
          <div className="print-cover">
            <Envelope name={title[0].toUpperCase() + title.slice(1)} flat={made.flat} mark={edition} foot={imported ? undefined : `Drafted to ${profile === 'Me' ? 'you' : profile}`} />
            <p className="eyebrow">Pieces</p>
            <ul className="pieces">
              {made.pieces.map((pc, i) => (
                <li key={i}>
                  {pc.name}: {pc.cut.replace(' (1 pair)', '').toLowerCase()}
                </li>
              ))}
            </ul>
          </div>
          <div className="print-controls">
            <fieldset className="group">
              <legend>Print on</legend>
              <DropMenu
                name="Paper"
                value={PAPERS.find((p) => p.id === paperChoice)?.label}
                items={PAPERS.filter((p) => can('bigPrint') || p.id !== 'projector').map((p) => ({ id: p.id, text: p.label, on: paperChoice === p.id }))}
                onPick={(id) => setPaper(id === 'projector' ? (paper === 'projectorDark' ? 'projectorDark' : 'projector') : (id as Paper))}
              />
              {projector && (
                <label className="check">
                  <input type="checkbox" checked={paper === 'projectorDark'} onChange={(e) => setPaper(e.target.checked ? 'projectorDark' : 'projector')} />
                  <span>White lines on black, easier to see on dark fabric</span>
                </label>
              )}
            </fieldset>
            <div className="stack">
              <button type="button" className="primary" onClick={checked(download_)} disabled={!ready}>
                {ready ? `Download PDF (${pages} ${pages === 1 ? 'page' : 'pages'})` : 'Making your PDF…'}
              </button>
              {canShareFiles && (
                <button type="button" className="secondary" onClick={checked(share)} disabled={!ready}>
                  Send to email or a printer
                </button>
              )}
              <button type="button" className="secondary" onClick={checked(openToPrint)} disabled={!ready}>
                Open PDF to print
              </button>
              {asking && (
                <div className="example-ask" role="alertdialog" aria-labelledby="example-ask-title">
                  <p id="example-ask-title" className="small">
                    This is drafted to an example body, not yours, so it won't fit you.
                  </p>
                  {onMeasureMe && (
                    <button type="button" className="primary" onClick={onMeasureMe}>
                      Measure me
                    </button>
                  )}
                  <button
                    type="button"
                    className="later"
                    onClick={() => {
                      setExampleOk(true);
                      setAsking(undefined);
                      asking();
                    }}
                  >
                    Print the example anyway
                  </button>
                </div>
              )}
              {shareNote && <p className="msg small">{shareNote}</p>}
            </div>
            {onFitNotes && !imported && (printed || fitNote) && (
              <div className="stack fit-ask" role="status">
                {fitNote ? (
                  <p className="small">Fit reported: {fitNote}</p>
                ) : (
                  <p className="small">Sewn it? Say how it fitted, in three taps. Each note makes the next pattern better, for you and for everyone.</p>
                )}
                <button type="button" className="link" onClick={onFitNotes}>
                  {fitNote ? 'Fit notes' : 'How did it fit?'}
                </button>
              </div>
            )}
            {sendLink && onPhone() && (
              <div className="stack send-device">
                <p className="small">Printer on your computer? Send your measurements and patterns there, then print from it.</p>
                <SendToDevice link={sendLink} className="link" />
              </div>
            )}
            <p>
              {projector
                ? 'One page at true size, in fine lines for projecting onto fabric. Line your projector up with the 10 cm test square.'
                : paper === 'a0'
                  ? 'Ask the copy shop to print at 100% (actual size). Measure the 10 cm test square before you cut.'
                  : 'Print at 100% (actual size). Measure the 10 cm test square on page A1 before you cut.'}
            </p>
            {/* The file is longer than the tiles: a copy shop prints and charges for every page (the tester walk, 2026-10-27). */}
            {!projector && paper !== 'a0' && ready && pdf && pdf.total > pages && (
              <p className="small muted">
                The file has {pdf.total} pages: a cover, the {pages} pattern pages (A1 is page 2), then the cutting layout and sewing steps. At a copy shop, ask for pages 2 to {pages + 1}.
              </p>
            )}
            {!projector && paper !== 'a0' && (
              <details className="small fold-link">
                <summary>How the pages fit together</summary>
                <p className="muted small">
                  Trim each page along its dashed line on the left and top, then lay it over the page before so the half diamonds make whole ones.
                  Tape them down. On a phone, send the PDF to your email and print from a computer, or print straight from the
                  share menu.
                </p>
              </details>
            )}
          </div>
          <div className="print-sheet">
            {/* On a phone the pages fold behind one line (Cat applied P3, 2026-10-24), so Print is a shorter scroll. */}
            {!wide && (
              <button type="button" className="later go see-pages" aria-expanded={seePages} onClick={() => setSeePages(!seePages)}>
                {seePages ? 'Hide the pages' : projector ? 'See the page' : `See the ${pages} ${pages === 1 ? 'page' : 'pages'}`} <span aria-hidden="true">{seePages ? '‹' : '›'}</span>
              </button>
            )}
            {showPages && (
              <div className="preview tiles" style={{ ['--cols' as string]: grid.cols }}>
                <PatternPreview sheet={sheet} label={projector ? 'Pattern on one page for a projector' : `Pattern laid over ${pages} numbered print pages`} />
                {!projector && <TileOverlay sheet={sheet} paper={paper} />}
                <DemoButton demo="print" />
              </div>
            )}
            {!imported && <p className="muted small">
              {passed === checks.length
                ? 'Checked: every seam meets its partner and every curve runs smoothly from piece to piece.'
                : `${checks.length - passed} of ${checks.length} seam checks found something to look at. The details are on the last page of the PDF.`}
            </p>}
          </div>
          <div className="print-more">
            {can('byHand') && !imported && (
              <label className="check">
                <input type="checkbox" checked={!!finish.byHand} onChange={(e) => onFinish({ ...finish, byHand: e.target.checked })} />
                <span>
                  Draft it by hand <span className="muted small">add pages to draw the pattern yourself on pattern paper, point by point</span>
                </span>
              </label>
            )}
            <p className="muted small">Printed it? Your cutting layout and sewing steps are just below, and on the last pages of the PDF.</p>
            <ModeLink quiet mode={mode} onMode={onMode} what="big paper and projector, a toile fitting, a dressmaker's pack and more" />
          </div>
        </section>
      </div>

      {made?.flat && can('techFlat') && (
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

      {!imported && (
        <YourFabric
          fabric={finish.fabric ?? {}}
          style={style}
          metres={lays.find((l) => l.fabric !== 'lining' && l.fabric !== 'interlining' && !l.hide)?.metres}
          onChange={onEditFabric}
        />
      )}

      <section className="card" aria-labelledby="laytitle">
        <div className="row between wrap">
          <div>
            <p className="eyebrow">Cutting layout</p>
            <h2 id="laytitle">
              {lays
                .map((l, i) => {
                  const amount = `${layAmount(l)}${l.fabric === 'lining' ? ' of lining' : l.fabric === 'interlining' ? ' of coutil' : ''}`;
                  return i === 0 ? amount[0].toUpperCase() + amount.slice(1) : amount;
                })
                .join(' + ') || 'Too wide to lay out'}
            </h2>
            {lays.some((l) => l.hide) && <p className="muted small">Leather is sold by the hide, in square feet. This includes a third extra for the hide's shape and flaws.</p>}
          </div>
          <div className="row wrap">
            <DropMenu
              name="Fabric width"
              label="Fabric"
              value={`${finish.fabricWidth} cm wide`}
              items={FABRIC_WIDTHS.map((w) => ({ id: String(w), text: `${w} cm wide`, on: finish.fabricWidth === w }))}
              onPick={(id) => onFinish({ ...finish, fabricWidth: Number(id) as FabricWidth })}
            />
            <label className="check">
              <input type="checkbox" checked={nap} disabled={napFixed} onChange={(e) => onFinish({ ...finish, nap: e.target.checked })} />
              <span>
                Nap or one-way print{' '}
                <span className="muted small">{napFixed ? `always on for ${needsNap(special) ? SPECIALS[special!].label.toLowerCase() : print === 'motif' ? 'placed motifs' : 'a one-way print'}` : 'every piece the same way up'}</span>
              </span>
            </label>
          </div>
        </div>
        {lays.length ? (
          lays.map((lay) => (
            <div key={lay.fabric} className="lay">
              {lays.length > 1 && <p className="eyebrow">{lay.fabric === 'lining' ? 'Lining' : lay.fabric === 'interlining' ? 'Coutil' : 'Fabric'}</p>}
              <div className="lay-box">
                <LayPlanView
                  lay={lay}
                  cloth={lay.fabric === 'self' ? (flatId(finish.fabric) ?? 'default') : lay.fabric === 'lining' ? 'silk' : 'cotton'}
                  print={lay.fabric === 'self' && print ? { kind: print, repeat: printRepeat(finish.fabric), stripes: finish.fabric?.checks?.stripes, gingham: finish.fabric?.checks?.gingham } : undefined}
                />
                {lay.fabric === 'self' && <DemoButton demo="fabric" />}
              </div>
              {lay.fabric === 'self' && print === 'motif' && <p className="muted small">The front is centred on a motif. Move the pattern so no motif sits on the bust points or the seat.</p>}
              <p className="muted small">{layWords(lay)}</p>
            </div>
          ))
        ) : (
          <p className="muted">These pieces are wider than {finish.fabricWidth} cm fabric. Try a wider fabric.</p>
        )}
      </section>

      {/* The toile shows in the simple view too (measuring accuracy, 2026-10-21): a calico try-on fixes what a tape at
          home can't, so a first-time sewist is offered it before cutting good fabric. */}
      {!imported && (
        <section className="card" aria-labelledby="toiletitle">
          <p className="eyebrow">Before your fabric{fittingNotes.length && fitting ? ` · version ${fitting.round + 1}` : ''}</p>
          <h2 id="toiletitle">{knit ? 'Try it in a spare knit first' : fittingNotes.length ? 'Corrected after your toile' : 'Fit it in a toile first'}</h2>
          {knit ? (
            <p className="muted">
              {garment === 'lingerie'
                ? 'A knit fits by its stretch, so make one first in a cheap knit with the same stretch as yours. Then tell us how it fitted under “How did it fit?” on the style screen, and the pattern is redrawn.'
                : 'A knit fits by its stretch, so test it in a cheap knit with the same stretch as yours, not calico. If it is too snug or too loose, change the stretch or the fit on the style screen.'}
            </p>
          ) : fittingNotes.length ? (
            <ul className="fitlist">
              {fittingNotes.map((n) => (
                <li key={n}>{n[0].toUpperCase() + n.slice(1)}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">
              Make it up in calico first and try it on. Tell us what you see, such as {isLowerBody(garment) ? 'pulling across the hips or folds below the back waist' : 'pulling at the bust or a gaping neckline'}, and the
              pattern is corrected the way a pattern cutter would, with a second line for one side if your shoulders or hips differ.
            </p>
          )}
          <div className="row wrap">
            {!knit && (
              <button type="button" className="secondary" onClick={onFitting}>
                {fittingNotes.length ? 'Fit another toile' : 'I’ve tried on a toile'}
              </button>
            )}
            {onTrueScale && made && can('toile') && (
              <button type="button" className="secondary" onClick={onTrueScale}>
                See a piece at true size
              </button>
            )}
          </div>
        </section>
      )}

      {can('makerPack') && (
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
          values={imported ? undefined : values}
          imported={!!imported}
          alterations={imported ? NONE : alterations}
        />
      )}

      {values && draftAt && can('sizeRun') && (
        <SizeRun garment={garment} values={values} draftAt={draftAt} title={title} fileBase={fileBase} width={finish.fabricWidth} nap={nap} download={download} />
      )}
      {values && draftAt && can('sizeRun') && <InterestCard offer="sizerun" pattern={title} />}

      {/* Folded shut on phone and computer alike (Cat applied P1, 2026-10-24), so Print is a shorter scroll. */}
      <details className="card sew">
        <summary className="sew-summary">
          <p className="eyebrow">After printing</p>
          <h2 id="sewtitle">How to sew it</h2>
        </summary>
        <div className="row between wrap">
          {garment !== 'trousers' && !knit && can('couture') && !imported && (
          <div className="seg" role="group" aria-label="How to sew it">
            {(['quick', 'couture'] as const).map((r) => (
              <button key={r} type="button" className={finish.route === r ? 'on' : ''} aria-pressed={finish.route === r} onClick={() => onFinish({ ...finish, route: r })}>
                {r === 'quick' ? 'Quick' : 'Couture'}
              </button>
            ))}
          </div>
          )}
        </div>
        {finish.route === 'couture' && garment !== 'trousers' && !knit && !imported && (
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
          <InterestCard offer="tools" pattern={title} inset />
        </div>
      </details>

      {/* Everything to buy or sign up for, folded at the very end so nothing comes between printing and sewing. */}
      {!imported && (
        <details className="card extras">
          <summary>
            <span className="extras-title">Extras for this pattern</span>
            <span className="muted small">Printed and posted roll · fabric and notions kit · {label ? 'your label and woven labels' : 'woven labels'}{hasFabric(finish.fabric) ? '' : ' · deadstock cloth'}</span>
          </summary>
          <div className="split">
            <InterestCard offer="printed" pattern={title} />
            <InterestCard offer="kit" pattern={title} />
          </div>
          {label && <LabelCard name={label.name} code={label.code} pattern={title} onKeep={onKeep} />}
          {!hasFabric(finish.fabric) && <Deadstock style={style} lays={lays} title={title} />}
        </details>
      )}
    </>
  );
}

const today = () => new Date().toISOString().slice(0, 10);

/** The note that goes with the files when they are sent to a dressmaker. */
export function makerNote(title: string, profile: string, imported = false): string {
  return [
    `Hello, could you make this ${title} for me?`,
    imported
      ? `The tech pack has the piece list and construction steps. The pattern is attached as a PDF to print at 100% and as a DXF for pattern software.`
      : `The pattern was drafted to my own measurements in Maison Tracé. The tech pack has my measurements, the ease, the piece list, fabric and construction steps. The pattern is attached as a PDF to print at 100% and as a DXF for pattern software.`,
    `Could you let me know your price and when you could fit it in? Thank you, ${profile}`,
  ].join('\n\n');
}


const fabricPhoto = (id?: Fibre | Special) => `${import.meta.env.BASE_URL}fabrics/${id ?? 'default'}.jpg`;

/** A close-up of the chosen cloth, with its name and how it handles. */
function FabricStage({ fabric }: { fabric: MyFabric }) {
  const id = fabric.special ?? fabric.fibre;
  const label = fabric.special ? SPECIALS[fabric.special].label : fabric.fibre ? FIBRES[fabric.fibre].label : undefined;
  const handle = [fabric.weight && `${fabric.weight} weight`, fabric.drape && `${fabric.drape} drape`].filter(Boolean).join(', ');
  return (
    <figure className="fabstage">
      <img src={fabricPhoto(id)} alt={label ? `${label} close up` : ''} />
      <figcaption>
        <span className="fabname">{label ?? 'No fabric chosen'}</span>
        <span className="muted small">{label ? (handle ? handle[0].toUpperCase() + handle.slice(1) : 'Set the weight and drape on the Fabric tab.') : 'Choose one on the Fabric tab.'}</span>
      </figcaption>
    </figure>
  );
}

/** Buy the shop fabric: opens the shop's own site with the amount from the cutting layout. */
function BuyShopFabric({ shop, colour, metres }: { shop: ShopFabric; colour?: string; metres: number }) {
  const { qty, unit } = buyAmount(shop, metres);
  const link = buyLink(shop, colour, metres);
  const words = unit === 'yd' ? (qty === 1 ? 'yard' : 'yards') : 'm';
  const amount = unit === 'yd' ? `${qty} ${words}` : `${qty} m`;
  const cost = Math.ceil(qty * shopPrice(shop, colour));
  if (!link) return <p className="muted small">You need {amount}, about ${cost}.</p>;
  return (
    <>
      <a className="buylink" href={link.href} target="_blank" rel="noopener noreferrer">
        Buy {unit === 'yd' ? `${qty} yd` : `${qty} m`} at {shop.shop}
      </a>
      <p className="muted small">
        {link.inCart ? `${amount} goes straight into the cart` : `Add ${amount} on ${shop.shop}'s page`}, about ${cost} {shop.currency}. We may earn a
        commission when you buy.
      </p>
    </>
  );
}

/** The fabric, as chosen on the style screen's Fabric tab (one place to choose it, Cat 2026-10-18): what it
 * is, whether it suits the style, where to buy it, and the way back to change it. */
function YourFabric({ fabric, style, metres, onChange }: { fabric: MyFabric; style: Props['style']; metres?: number; onChange?: () => void }) {
  const shop = shopFabric(fabric.shop);
  const notes = checkFabric(style, fabric);
  const name = fabricName(fabric);
  // No fabric yet: one line and the way to choose it, not a photo of folded cloth (Cat applied P2, 2026-10-24).
  if (!name)
    return (
      <section className="card yourfabric none" aria-labelledby="fabtitle">
        <p className="eyebrow" id="fabtitle">
          Your fabric
        </p>
        <div className="fabline">
          <p className="muted small">Not chosen yet. It sets the cutting layout and goes on the PDF.</p>
          {onChange && (
            <button type="button" className="later go" onClick={onChange}>
              Choose fabric <span aria-hidden="true">›</span>
            </button>
          )}
        </div>
      </section>
    );
  return (
    <section className="card yourfabric" aria-labelledby="fabtitle">
      <p className="eyebrow">Your fabric</p>
      <h2 id="fabtitle" className="fabhead">
        {name ? `${name}${metres !== undefined ? ` · ${metres} m` : ''}` : 'Not chosen yet'}
      </h2>
      <FabricStage fabric={fabric} />
      {shop && (
        <div className="shopbuy">
          <p className="small">
            <b>{shop.name}</b>
            {fabric.colour ? `, ${fabric.colour}` : ''}{' '}
            <span className="muted">
              from {shop.shop}, ${shopPrice(shop, fabric.colour)}/{shop.yards ? 'yd' : 'm'}
            </span>
          </p>
          {metres !== undefined && <BuyShopFabric shop={shop} colour={fabric.colour} metres={metres} />}
        </div>
      )}
      {notes.map((n) => (
        <p key={n.text} className={`small fabnote ${n.level}`}>
          {n.level === 'ok' ? <b>Good match </b> : n.level === 'warn' ? <b>Heads up </b> : null}
          {n.level === 'ok' ? n.text.replace(/^Good match /, '') : n.text}
        </p>
      ))}
      <p className="muted small">
        {name ? 'Chosen on the Fabric tab. It sets the cutting layout below and goes on the PDF.' : 'Choose it on the Fabric tab to see the style in it. It goes on the PDF.'}
      </p>
      {onChange && (
        <button type="button" className="later go" onClick={onChange}>
          {name ? 'Change fabric' : 'Choose fabric'} <span aria-hidden="true">›</span>
        </button>
      )}
    </section>
  );
}

/** The fabric's name in a few words: its own name, else the cloth, with the colour. */
function fabricName(f: MyFabric): string | undefined {
  const cloth = f.name || (f.special ? SPECIALS[f.special].label : f.fibre ? FIBRES[f.fibre].label : undefined);
  return cloth && (f.colour && !f.name ? `${cloth}, ${f.colour}` : cloth);
}

const hasFabric = (f: MyFabric | undefined) => !!(f && (f.name || f.fibre || f.special));

/** Deadstock matched to the style, measured to the cutting layout: a sign-up until the first drop opens. */
function Deadstock({ style, lays, title }: { style: FabricStyle; lays: Lay[]; title: string }) {
  const cloth = adviceFor(style).picks[0];
  const lay = lays.find((l) => l.fabric === 'self');
  return (
    <InterestCard offer="deadstock" pattern={title} choice={{ label: 'Cut it for me too', hint: 'it arrives as your pattern pieces, ready to sew' }}>
      <dl className="offerprices deadstock small">
        {cloth && (
          <div>
            <dt>Suits this style</dt>
            <dd>
              {cloth.name} <span className="muted">· {pickTag(cloth).toLowerCase()}</span>
            </dd>
          </div>
        )}
        {lay && (
          <div>
            <dt>Your cutting layout</dt>
            <dd>
              {layAmount(lay)}
              {lay.hide ? '' : <span className="muted"> at {lay.width} cm wide</span>}
            </dd>
          </div>
        )}
      </dl>
    </InterestCard>
  );
}

async function saveMeasurements(values: MeasurementValues, profile: string, fileBase: string, kind: 'vit' | 'csv') {
  const { toVit, toMeasurementsCsv } = await import('../measureExport');
  if (kind === 'vit') download(toVit(values, profile), 'application/xml', `${fileBase}-measurements.vit`);
  else download(toMeasurementsCsv(values), 'text/csv', `${fileBase}-measurements.csv`);
}

/** The dress form built from these measurements, as an OBJ in millimetres for CLO 3D and Browzwear. */
async function saveBody(values: MeasurementValues, profile: string, fileBase: string) {
  const { toObj } = await import('../engine/body3d');
  download(toObj(values, profile), 'model/obj', `${fileBase}-body.obj`);
}

async function saveAlterations(alterations: Alteration[], fileBase: string) {
  const { toAlterationsCsv } = await import('../measureExport');
  download(toAlterationsCsv(alterations), 'text/csv', `${fileBase}-alterations.csv`);
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
  values,
  imported,
  alterations,
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
  /** The person's measurements, for pattern software of the maker's own. */
  values?: MeasurementValues;
  /** Read from another program's file rather than drafted here. */
  imported?: boolean;
  alterations: Alteration[];
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
      const bytes = await toTechPack({ title, profile, fit: fitName, date: today(), pieces: made.pieces, measurements: made.spec, notes: made.notes, guide: made.guide, alterations });
      if (live) {
        setDxfText(text);
        setPack(bytes);
      }
    });
    return () => {
      live = false;
    };
  }, [made, title, profile, fitName, alterations]);

  const ready = pack && dxfText;

  const send = async () => {
    if (!ready) return;
    const pdfFile = (bytes: Uint8Array, name: string) => new File([bytes], name, { type: 'application/pdf' });
    const withPattern = [pdfFile(pack, packName), ...(pattern ? [pdfFile(pattern.bytes, pattern.name)] : [])];
    const all = [...withPattern, new File([dxfText], dxfName, { type: 'application/dxf' })];
    const text = makerNote(title, profile, imported);
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
          {imported
            ? 'The dressmaker gets the tech pack (the piece list and sewing steps), the pattern to print and a DXF for pattern software.'
            : 'The dressmaker gets the tech pack (your measurements, the ease, the piece list, fabric and sewing steps), the pattern to print and a DXF for pattern software.'}
        </p>
        <button type="button" className="primary" onClick={send} disabled={!ready}>
          {ready ? 'Send to a dressmaker' : 'Making the files…'}
        </button>
        <p className="muted small">Opens your share menu with the files and a short note for the maker.</p>
        {note && <p className="msg small">{note}</p>}
        <FindAMaker title={title} />
        <InterestCard offer="cutforme" pattern={title} inset>
          <ol className="cutsteps small">
            <li>Post your fabric to the studio.</li>
            <li>They cut every piece from your pattern.</li>
            <li>The pieces come back marked and labelled.</li>
          </ol>
        </InterestCard>
      </section>

      <details className="card more">
        <summary>
          <span className="eyebrow">Having it made, or drafting by hand <TestingTag /></span>
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
        {values && (
          <>
            <p className="muted">
              Your measurements, for drafting in other software: a file Seamly2D and Valentina open, and a table in cm and inches to enter into CLO 3D
              or Browzwear.{alterations.length > 0 && ' The alterations from your toile, for a pattern cutter to make on their own block, are in the tech pack and as a table.'}
            </p>
            <div className="row wrap">
              <button type="button" className="secondary" onClick={() => saveMeasurements(values, profile, fileBase, 'vit')}>
                Measurements (Seamly2D)
              </button>
              <button type="button" className="secondary" onClick={() => saveMeasurements(values, profile, fileBase, 'csv')}>
                Measurements (CSV)
              </button>
              {alterations.length > 0 && (
                <button type="button" className="secondary" onClick={() => saveAlterations(alterations, fileBase)}>
                  Alterations (CSV)
                </button>
              )}
            </div>
            <p className="muted">
              Your body in 3D: a dress form made from your measurements, the same form as in the app. CLO 3D and Browzwear open it as an avatar,
              so you can try the pattern on before you cut.
            </p>
            <div className="row wrap">
              <button type="button" className="secondary" onClick={() => saveBody(values, profile, fileBase)}>
                3D body (OBJ)
              </button>
            </div>
          </>
        )}
        {!imported && <label className="check">
          <input type="checkbox" checked={atelier} onChange={(e) => onAtelier(e.target.checked)} />
          <span>
            Show how it was drafted <span className="muted small">numbered points on the pattern, with a note on how each was found</span>
          </span>
        </label>}
        {atelier && !imported && (
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
            <label htmlFor="maker-email" className="small">Email</label>
            <input id="maker-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
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
