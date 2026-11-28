import { DropMenu } from '../ui/DropMenu';
import { TesterReport } from '../ui/TesterReport';
import { useTablet, useWide } from '../ui/StyleLayout';
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { CopyShopWay } from '../ui/CopyShopWay';
import { SendToDevice } from '../ui/SendToDevice';
import { OVERLAP, PAGE_MARGIN, Paper, Sheet, layout, pageCount, pageName, pageSize, tileGrid, toSvg, usedTiles } from '../engine/export';
import { checkPattern } from '../engine/qc';
import type { Piece } from '../engine/piece';
import type { SewingGuide } from '../engine/instructions';
import type { SpecRow } from '../engine/techpack';
import { PatternPreview } from '../ui/Preview';
import type { Finish } from '../savedWork';
import type { Garment, Unit } from '../measurements';
import type { Alteration } from '../engine/fitting';
import { Lay, type LayFabric, fabricsOf } from '../engine/layplan';
import type { Flat } from '../engine/flat';
import { TechFlatView } from '../ui/TechFlatView';
import { needsNap } from '../engine/specialFabrics';
import { printNap, printOf } from '../engine/prints';
import { SizeRun } from '../ui/SizeRun';
import { Envelope } from '../ui/Envelope';
import { InterestCard } from '../ui/InterestCard';
import type { MeasurementValues } from '../measurements';
import { Mode, ProTool, shows } from '../mode';
import { MoreTools, ToolRow, ToolTick } from '../ui/MoreTools';
import { countStep } from '../report/report';
import { patternCode } from '../patternCode';
import { GarmentFabric } from '../ui/FabricFill';
import { amazonLink, amazonTagged, kit } from '../engine/projectorKit';
import { canShareFiles, download } from '../ui/download';
import { TestingTag } from '../ui/TestingTag';
import { DemoButton } from '../ui/DemoButton';
import { reloadPending } from './load';
import { fieldsFor } from '../measurements';
import { isWaistRow } from '../engine/spec';
import { cloud } from '../cloud/api';
import { testerHeaders } from '../ui/TesterCode';
import { inInches } from '../units';
import { onPhone } from '../ui/device';

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
  /** Next: Cut and sew, at the foot of Print: on to the Sew tab, which opens on cutting. */
  onNextSew?: () => void;
  /** Measure me, from that question: drops the example and opens measuring. */
  onMeasureMe?: () => void;
  /** Back to the measurements, from a pattern that can't be drafted to them. */
  onEditMeasurements?: () => void;
  /** The sewist's unit; the PDF's text is written in inches when it is `in`. */
  unit?: Unit;
  /** The paper picked last time, kept with the rest of the work; without one, inches start on US Letter. */
  paper?: Paper;
  onPaper?: (p: Paper) => void;
  /** The link that carries this device's measurements and patterns to a computer; see moveLink.ts. */
  sendLink?: () => Promise<string>;
  profile: string;
  title: string;
  /** The collection look's name while the pattern is still that look, for the print's title card. */
  lookName?: string;
  fit: string;
  garment: Garment;
  finish: Finish;
  onFinish: (f: Finish) => void;
  made?: Printable;
  error?: string;
  /** Keeps the pattern in your patterns, for the label card's code; the button itself is on Review. */
  onKeep?: () => void;
  /** Saved patterns is full, so printing can't keep this one: Print says so instead of keeping quiet. */
  full?: boolean;
  /** After printing: "How did it fit?" opens the fit notes for this pattern (saving it first if need be). */
  onFitNotes?: () => void;
  /** A fit tester's device: after printing, the tester form instead of the app's own fit notes. */
  tester?: boolean;
  /** Who "Email me the files" may send to: the signed-in person's own email, or, for a fit tester, any address they
   *  type (with their code). Neither: the email way isn't offered (weekly review, Nov 16). */
  emailTo?: { signedIn?: string; testerCode?: string };
  /** The fit already reported for this pattern, in a line, if there is one. */
  fitNote?: string;
  /** The toile corrections as alterations a pattern cutter makes on their own block. */
  alterations?: Alteration[];
  /** For grading: the measurements, and the pattern's pieces drafted to any set of them. */
  values?: MeasurementValues;
  draftAt?: (m: MeasurementValues) => Piece[];
  /** A pattern read from another program's file: no style, fabric check or toile of its own. */
  imported?: { source?: string; fileName: string };
  /** Simple or all tools; all when not given. */
  mode?: Mode;
  onMode?: (m: Mode) => void;
  /** A numbered drop's copy and an Archive cut's credit, printed in the title block. */
  edition?: string;
  credit?: string;
}

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

// Projector mode loads only when it is opened.
const ProjectorMode = lazy(() => import('../ui/ProjectorMode').then((m) => ({ default: m.ProjectorMode })));

/** The date as printed on the pattern, such as 14 Oct 2026. */
// A piece cut from the fabric and again from the lining (or coutil) is one pattern piece, so the list named it once and
// read as if the lining needed nothing (DU walk, Nov 21): it says where it is cut again.
const AGAIN: Record<Exclude<LayFabric, 'self'>, string> = { lining: 'lining', interlining: 'coutil' };
const againIn = (pc: Piece) => {
  const from = fabricsOf(pc);
  const also = from.filter((f) => f !== 'self').map((f) => AGAIN[f]);
  // A piece cut only from the lining is named as a lining piece already.
  return from.includes('self') && also.length ? `, and again in ${also.join(' and ')}` : '';
};

/** A piece with how many to cut, as "Skirt front: cut 1 on fold, and again in lining". */
const pieceCut = (pc: Piece) => `${pc.name}: ${pc.cut.replace(' (1 pair)', '').toLowerCase()}${againIn(pc)}`;

const printedDate = () => new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });



const FRACTION_WORDS: Record<string, string> = { '⅛': '1-8', '¼': '1-4', '⅜': '3-8', '½': '1-2', '⅝': '5-8', '¾': '3-4', '⅞': '7-8' };

export function ExportScreen({ example, onNextSew, onMeasureMe, onEditMeasurements, unit = 'cm', paper: savedPaper, onPaper, sendLink, profile, title, lookName, fit, garment, finish, onFinish, made, error, onKeep, onFitNotes, tester, emailTo, fitNote, alterations = NONE, values, draftAt, imported, mode = 'all', onMode, edition, credit, full }: Props) {
  const can = (t: ProTool) => shows(mode, t);
  // The paper starts on what was picked before, else on US Letter for a sewist measuring in inches or on a
  // North American browser (the tester walk, 2026-10-27: an inch tester printed A4 tiles on Letter paper). The pick
  // is kept with the saved work, so it holds across visits and garments.
  const [picked, setPicked] = useState<Output>(savedPaper ?? defaultPaper(unit));
  const setPaper = (p: Output) => {
    setPicked(p);
    if (!isProjector(p)) onPaper?.(p);
  };
  // The copy-shop sheet (Cat, 2026-10-22) and the projector file (Cat, 2026-10-28) show in every view: many
  // sewists, beginners too, project instead of taping pages.
  const paper: Output = picked;
  // The pattern to print and, apart from it, the instructions booklet (Cat, Nov 15: what they download is what they
  // print, so the cover, layouts and steps are a file of their own). A projector's booklet is on A4 or Letter paper.
  const [pdf, setPdf] = useState<{ paper: Output; bytes: Uint8Array; booklet: { bytes: Uint8Array; pages: number } | null } | null>(null);
  // A PDF that couldn't be made says so, instead of "Making your PDF…" for ever (Anna, Nov 10).
  const [pdfFailed, setPdfFailed] = useState(false);
  const [shareNote, setShareNote] = useState('');
  const [projecting, setProjecting] = useState(false);
  const special = finish.fabric?.special;
  const print = printOf(finish.fabric);
  const napFixed = needsNap(special) || printNap(print);
  const nap = finish.nap || napFixed;
  const guide = made?.guide;
  const date = useMemo(printedDate, []);
  // Pieces left out of the print, by their place in the list, so one lost sleeve reprints on a page or two
  // instead of the whole pattern (the PDF-printing pain in the Reddit research, 2026-10-28). A new draft starts whole.
  const [leftOut, setLeftOut] = useState<number[]>([]);
  useEffect(() => setLeftOut([]), [made]);
  const toPrint = useMemo(() => made?.pieces.filter((_, i) => !leftOut.includes(i)), [made, leftOut]);
  // The whole draft's code, so a reprint of one piece carries the same one.
  // Only the high bust this garment drafts from: a skirt's code changed once a dress asked for the high bust, so its
  // printed page 1 no longer matched the app (DU tester walk, Nov 21).
  const code = useMemo(() => {
    if (!made) return undefined;
    const own = fieldsFor(garment).some((f) => f.id === 'high_bust') ? values ?? {} : { ...values, high_bust: undefined };
    return patternCode(made.pieces, own, __APP_VERSION__);
  }, [made, values, garment]);
  const sheet = useMemo(
    () =>
      made && toPrint ? layout(toPrint, `Maison Tracé: ${title}`, made.notes, { pattern: title, name: lookName, madeFor: profile, date, edition, credit, code }, { atelier: finish.atelier, paper: paper === 'a0' ? 'a0' : undefined }) : undefined,
    [made, toPrint, title, lookName, profile, date, finish.atelier, edition, credit, code, paper],
  );
  // The seam check walks the garment's own pieces and its pockets; its lining and facings follow them.
  const checks = useMemo(() => {
    if (!made) return [];
    // A dress with its waist seam moved off the waist: the seam is checked against its own girth, not the waist's.
    const waist = (made.spec.find((r) => /^Waist seam, /.test(r.label)) ?? made.spec.find((r) => isWaistRow(r.label)))?.finished;
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
        ? { rows: made.spec.filter((r) => typeof r.finished === 'number'), checks, madeFor: profile, date, edition, credit, code, drafting: finish.atelier ? drafting : undefined, byHand, lays, flat: made.flat, fabric: made.guide.fabric }
        : undefined,
    [made, checks, profile, date, edition, credit, code, drafting, finish.atelier, lays, byHand],
  );

  // Build the PDF ahead of time, so share and print run straight from the tap (phones require that).
  useEffect(() => {
    if (!sheet || !guide) return;
    let live = true;
    setPdf(null);
    setPdfFailed(false);
    import('../engine/pdf')
      .then(async ({ toTiledPdf, toProjectorPdf, pdfPageCount }) => {
        const [bytes, book] = await Promise.all([
          isProjector(paper) ? toProjectorPdf(sheet, { dark: paper === 'projectorDark', title: lookName ?? (unit === 'in' ? inInches(title) : title) }) : toTiledPdf(sheet, paper, { title, name: lookName, unit, part: 'pattern' }),
          // On home paper: for a projector or the copy shop's A0, the sewist's own size, Letter for inches (an inch tester's
          // A0 booklet came on A4, EM walk, Nov 28).
          toTiledPdf(sheet, isProjector(paper) ? (unit === 'in' ? 'letter' : 'a4') : paper === 'a0' ? defaultPaper(unit) : paper, { title, name: lookName, guide, summary, unit, part: 'booklet' }),
        ]);
        const pages = await pdfPageCount(book);
        // A booklet with nothing in it isn't offered.
        return { paper, bytes, booklet: pages ? { bytes: book, pages } : null };
      })
      .then((made) => live && setPdf(made))
      .catch(() => live && !reloadPending() && setPdfFailed(true));
    return () => {
      live = false;
    };
  }, [sheet, paper, title, lookName, guide, summary, unit]);

  // These hooks sit above the early return below so every render calls them in the same order.
  // Once the pattern has left the app (downloaded, shared or opened to print), the fit question comes up.
  const [printed, setPrinted] = useState(false);
  // The paper the pattern last left the app on: Download steps back for Next only while that's the paper picked, so a
  // switch to the copy shop's A0 after printing at home brings the filled Download back (code review, Nov 28).
  const [gotOn, setGotOn] = useState<Output>();
  const [kept, setKept] = useState(false);
  // How to sew it folds closed on a phone, where the page was one long scroll, and opens on a computer (the
  // aesthetic review, 2026-10-21). Set once on arrival; after that the fold is the reader's.
  // On the example body, the first print asks once whether to measure first or print the example anyway.
  const [asking, setAsking] = useState<(() => void) | undefined>();
  const [exampleOk, setExampleOk] = useState(false);
  // On a computer the pages sit in their own column beside the controls, so they stay open there.
  const wide = useWide();
  // On an iPad the pages have the room to show from the start, under the cover and the print buttons (the iPad check, 2026-10-30).
  const tablet = useTablet();
  const [seePages, setSeePages] = useState(false);
  if (!made || !sheet || !guide) {
    return (
      <section className="card">
        <p className="msg error">{error ?? 'Add your measurements first.'}</p>
        {/* The tab had no way back to Measure (pretend tester DV walk, Nov 21). */}
        {onEditMeasurements && (
          <button type="button" className="primary" onClick={onEditMeasurements}>
            Check my measurements
          </button>
        )}
      </section>
    );
  }

  const projector = isProjector(paper);
  const grid = projector ? { rows: 1, cols: 1 } : tileGrid(sheet, paper);
  const pages = projector ? 1 : pageCount(sheet, paper);
  const passed = checks.filter((c) => c.ok).length;
  // Named in the sewist's unit: an inch pattern downloaded as "56-cm-…" (pretend tester, Nov 17). Fractions are spelt
  // out, "20⅛ in" as "20-1-8-in".
  // A collection look is named for itself ("black-pleated-skirt-letter.pdf"), as testers know it (pretend tester, Nov 18).
  const named = lookName ?? title;
  // In cm a name's length goes to the whole cm, as file names always had it: "63.5 cm" made "63-5-cm", which reads as a range.
  const fileBase = (unit === 'in' ? inInches(named).replace(/[⅛¼⅜½⅝¾⅞]/g, (f) => ` ${FRACTION_WORDS[f]} `) : named.replace(/(\d+\.\d+)(?= cm)/g, (n) => `${Math.round(Number(n))}`)).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  // An inch file says so: the cm and inch files had one name, so the second came down as "(1)" (pretend tester, Nov 18).
  const inchPart = unit === 'in' ? '-inches' : '';
  const fileName = `${fileBase}-${paper === 'projectorDark' ? 'projector-black' : paper}${inchPart}.pdf`;
  const ready = pdf?.paper === paper ? pdf.bytes : null;
  const booklet = pdf?.paper === paper ? pdf.booklet : null;
  // Named for its paper too: the Letter and A4 booklets shared one name, so the second overwrote the first or came down
  // as "(1)" (pretend tester, Nov 18).
  // The paper it's laid out on, which for A0 and a projector is A4 or Letter (see the booklet's toTiledPdf above).
  const bookletName = `${fileBase}-${isProjector(paper) ? (unit === 'in' ? 'letter' : 'a4') : paper === 'a0' ? defaultPaper(unit) : paper}${inchPart}-instructions.pdf`;
  // Both files together, for sharing and emailing.
  const files = () => [new File([ready!], fileName, { type: 'application/pdf' }), ...(booklet ? [new File([booklet.bytes], bookletName, { type: 'application/pdf' })] : [])];

  const showPages = wide || tablet || seePages;
  const got = gotOn === paper;
  const checked = (go: () => void) => () => (example && !exampleOk ? setAsking(() => go) : go());
  // The pattern has left the app: the fit question comes up, and the pattern is kept in Saved patterns where there's
  // room, so it's there after closing the app (journey review, Nov 10: printing didn't save it).
  const left = () => {
    countStep('printed', garment);
    setPrinted(true);
    setGotOn(paper);
    if (onKeep && !example && !imported) {
      onKeep();
      setKept(true);
    }
  };
  const share = async () => {
    if (!ready) return;
    try {
      await navigator.share({ files: files(), title: `Maison Tracé: ${title}` });
      left();
      setShareNote('');
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setShareNote("Sharing didn't work on this device. Download the PDF instead.");
    }
  };

  // Email me the files is for the signed in and fit testers, on their own patterns.
  const emailable = !imported && !!(emailTo?.signedIn || emailTo?.testerCode);
  // Whether this is a phone (a touch screen) decides which of the Other ways it gets.
  const phone = onPhone();

  const openToPrint = () => {
    if (!ready) return;
    left();
    const url = URL.createObjectURL(new Blob([ready], { type: 'application/pdf' }));
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const download_ = () => {
    if (!ready) return;
    left();
    download(ready, 'application/pdf', fileName);
  };
  const downloadBooklet = () => {
    if (!booklet) return;
    left();
    download(booklet.bytes, 'application/pdf', bookletName);
  };
  const paperChoice = projector ? 'projector' : paper;

  // Files for a dressmaker, under the Dressmaker's pack row of More for this pattern.
  const makerPack = (
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
  );
  return (
    <>
      <div className="split">
        <section className="card grow print-top" aria-labelledby="ptitle">
          <div className="print-head">
            {/* Where you've landed, said calmly (Cat, Nov 3), first of the three parts since the declutter (Cat's E,
                Nov 21), with no "Part 1" over it (Cat, Nov 28) and no line under it: the card and the buttons say what
                the page is for. The garment's name and who it's for are on the card below (Cat, Nov 7). An imported
                pattern still says which file it came from. */}
            <h1 id="ptitle">Print it</h1>
            {imported && (
              <p className="muted">
                {`${imported.fileName}, ${made.pieces.length} ${made.pieces.length === 1 ? 'piece' : 'pieces'}${imported.source ? ` from ${imported.source}` : ''}`}
              </p>
            )}
          </div>
          {/* The card's garment in the cloth picked in Style, as on Your look: it was drawn white beside "Wool, Blush"
              (desktop review, Nov 21). */}
          <GarmentFabric fabric={finish.fabric}>
          <div className="print-cover">
            <Envelope house={false} name={lookName ?? title[0].toUpperCase() + title.slice(1)} flat={made.flat} mark={edition} foot={imported || example ? undefined : `Drafted to ${profile === 'Me' ? 'you' : profile}`} />
            {/* Each piece's cut count sits on its row in Print only some pieces, so one list says it all (Cat, Nov 28:
                "We don't need the second pieces list"). A one-piece pattern has no such list, so it keeps this line. */}
            {made.pieces.length === 1 && (
              <>
                <p className="eyebrow">Pieces</p>
                <ul className="pieces">
                  <li>{pieceCut(made.pieces[0])}</li>
                </ul>
              </>
            )}
          </div>
          </GarmentFabric>
          <div className="print-controls">
            <fieldset className="group">
              <legend>Print on</legend>
              <DropMenu
                name="Paper"
                value={PAPERS.find((p) => p.id === paperChoice)?.label}
                items={PAPERS.map((p) => ({ id: p.id, text: p.label, on: paperChoice === p.id }))}
                onPick={(id) => setPaper(id === 'projector' ? (paper === 'projectorDark' ? 'projectorDark' : 'projector') : (id as Paper))}
              />
              {projector && (
                <label className="check">
                  <input type="checkbox" checked={paper === 'projectorDark'} onChange={(e) => setPaper(e.target.checked ? 'projectorDark' : 'projector')} />
                  <span>White lines on black, easier to see on dark fabric</span>
                </label>
              )}
              {made.pieces.length > 1 && (
                <details className="small fold-link print-some" open={leftOut.length > 0 || undefined}>
                  <summary>{leftOut.length ? `Printing ${made.pieces.length - leftOut.length} of ${made.pieces.length} pieces` : 'Print only some pieces'}</summary>
                  {made.pieces.map((pc, i) => (
                    <label className="check" key={i}>
                      <input
                        type="checkbox"
                        checked={!leftOut.includes(i)}
                        // At least one piece stays in, so there is always something to print.
                        disabled={!leftOut.includes(i) && leftOut.length === made.pieces.length - 1}
                        onChange={(e) => setLeftOut(e.target.checked ? leftOut.filter((j) => j !== i) : [...leftOut, i])}
                      />
                      <span>{pieceCut(pc)}</span>
                    </label>
                  ))}
                </details>
              )}
            </fieldset>
            {/* On its own, so on a phone it can ride in a bar at the foot of the screen, as Print my pattern does on Your
                look: on a 360 phone it sat under the fold, out of the thumb's reach (comfort review, Nov 25). */}
            {/* Once the pattern has left the app, Next: Cut and sew takes the fill and Download steps back to an outline, out
                of the phone's bar, so the way on is the button that stands out (EM walk, Nov 28: Next was a faint outline). */}
            <div className={got ? 'print-go done' : 'print-go'}>
              <button type="button" className={got ? 'secondary' : 'primary'} onClick={checked(download_)} disabled={!ready}>
                {ready
                  ? // On A0 the count is of the big sheets, not every page in the file (Cat, Nov 14), so it says so.
                    `Download pattern (${pages} ${paper === 'a0' ? (pages === 1 ? 'A0 sheet' : 'A0 sheets') : pages === 1 ? 'page' : 'pages'})`
                  : pdfFailed
                    ? 'PDF not made'
                    : 'Making your PDF…'}
              </button>
            </div>
            <div className="stack">
              {booklet && (
                <button type="button" className="secondary" onClick={checked(downloadBooklet)}>
                  {`Download instructions (${booklet.pages} ${booklet.pages === 1 ? 'page' : 'pages'})`}
                </button>
              )}
              {/* The one rule that spoils a print, said where you download, not further down under How to print (EM walk,
                  Nov 28). */}
              <p className="print-rule">
                <b>Print at 100%</b> (actual size), never “fit to page”.
              </p>
              {/* Said here too, not only in the small page preview: nothing on Print said there was a code, or that the
                  tester form asks for it (pretend tester, Nov 18). */}
              {tester && !imported && code && (
                <p className="small muted">
                  Your pattern code is <span data-keep-cm>{code}</span>. It&rsquo;s at the top of the first page of your pattern, and the tester form asks for it.
                </p>
              )}
              {pdfFailed && (
                <p className="msg error" role="alert">
                  The PDF couldn't be made. Reload the page to try again: you'll stay on Print.
                </p>
              )}
              {/* Download is the one filled button and every other way sits in a plain list under it, so the main way
                  stands out at a glance (Cat picked A1 Quiet list, Nov 14: all five were the same gold capitals). */}
              <p className="eyebrow other-ways-label" id="other-ways">
                Other ways
              </p>
              {/* One row for each different job (Cat, Nov 28: "some seem to overlap"; she picked Trim as proposed). On a
                  phone that can share, the share menu prints too, so opening the PDF to print is for everything else;
                  on a computer the share menu did what Email me does, so it's only offered where Email me isn't. */}
              <div className="other-ways" role="group" aria-labelledby="other-ways">
                {(!phone || !canShareFiles) && (
                  <button type="button" className="way" onClick={checked(openToPrint)} disabled={!ready}>
                    Print it now
                  </button>
                )}
                {emailable && emailTo && <EmailPdf who={emailTo} ready={ready} fileName={fileName} booklet={booklet?.bytes ?? null} bookletName={bookletName} title={title} onSent={left} checked={checked} />}
                {canShareFiles && (phone || !emailable) && (
                  <button type="button" className="way" onClick={checked(share)} disabled={!ready}>
                    Share the files
                  </button>
                )}
                <CopyShopWay a0={paper === 'a0'} onA0={() => setPaper('a0')} onHome={() => setPaper(defaultPaper(unit))} unit={unit} />
                {/* It moves the measurements and styling, not the files, so it's named for why you'd use it. */}
                {sendLink && phone && <SendToDevice link={sendLink} className="way" />}
              </div>
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
              {kept && (
                <p className="small muted" role="status">
                  Saved in Your account, under Saved patterns.
                </p>
              )}
              {/* Printed with Saved patterns full: it isn't kept, and the person should know (Nov 19 bug hunt: the
                  fourth print went nowhere without a word). */}
              {printed && !kept && full && !example && !imported && (
                <p className="small muted" role="status">
                  Not kept in Saved patterns, which is full. Delete one in Your account to keep this one.
                </p>
              )}
            </div>
            {tester && !imported && (printed || fitNote) && <TesterReport />}
            {onFitNotes && !tester && !imported && (printed || fitNote) && (
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
            {projector || paper === 'a0' ? (
              <p>
                {projector
                  ? 'One page at true size, for a projector app such as Pattern Projector. Line your projector up with the 10 cm test square.'
                  : // What to ask the copy shop for is in Print at a copy shop, open above whenever the paper is A0.
                    'Measure the 10 cm test square before you cut.'}
              </p>
            ) : (
              // Each step opens in bold, like How styling works (copy review, Nov 14), so the one that matters is found at a glance.
              <div className="stack print-steps">
                {/* Named like Other ways and Pieces (Cat, Nov 28: they needed a title). "How to print", not "Print
                    instructions", which would read as printing the instructions booklet just above. */}
                <p className="eyebrow">How to print</p>
                <p>
                  <b>Check the size.</b> The test square on page A2 (row A, column 2, as its footer says) must measure exactly 10 cm before you cut.
                </p>
                {pages < grid.rows * grid.cols && (
                  <p>
                    <b>Blank pages are left out.</b> Leave a gap where a page number is missing when you tape.
                  </p>
                )}
              </div>
            )}
            {projector && made && (
              <div className="stack projector-offer">
                <h3>
                  Projector mode <TestingTag tool="projector" />
                </h3>
                <p className="muted small">
                  Plug your projector into this computer or tablet. Line it up with your cutting mat once, then show one piece at a time at true
                  size, in thick lines on black. Move and turn each piece on the cloth.
                </p>
                <button type="button" className="secondary" onClick={() => setProjecting(true)}>
                  Open projector mode
                </button>
                {/* Its own clip (Cat, 2026-10-29): the line-up is the part that needs showing. */}
                <DemoButton demo="projector" />
                <details className="small fold-link projector-kit">
                  <summary>What you'll need</summary>
                  <ul>
                    {kit(unit).map((item) => (
                      <li key={item.name}>
                        <span>
                          <span>
                            <strong>{item.name}</strong>
                            {item.optional && <span className="muted"> (optional)</span>}
                          </span>
                          <span className="muted small">{item.why}</span>
                        </span>
                        <a href={amazonLink(item)} target="_blank" rel="noopener noreferrer">
                          See on Amazon ↗
                        </a>
                      </li>
                    ))}
                  </ul>
                  {amazonTagged() && <p className="muted small">As an Amazon Associate, Maison Tracé earns from qualifying purchases.</p>}
                </details>
              </div>
            )}
            {projecting && made && (
              <Suspense fallback={null}>
                <ProjectorMode pieces={made.pieces} unit={unit} onClose={() => setProjecting(false)} />
              </Suspense>
            )}
            {/* No "ask for pages 2 to N" line here: the PDF they download is what they print, cover, layout and steps
                included (Cat, Nov 15). The cover carries the pattern code testers need for their report. */}
            {/* One fold about the pages (declutter, Cat's E, Nov 21): on a phone "See the pages" opens with it, where it
                was a second link of its own under it. */}
            {!projector && paper !== 'a0' && (
              <details className="small fold-link pages-fold" open={!wide && !tablet ? seePages : undefined} onToggle={(e) => !wide && !tablet && setSeePages((e.currentTarget as HTMLDetailsElement).open)}>
                <summary>{!wide && !tablet ? 'The pages and how they fit together' : 'How the pages fit together'}</summary>
                <p className="muted small">
                  Cut each page along the solid line marked CUT on its left and top edges, then lay it over the page before so the half diamonds make whole ones: each diamond says whether its page goes OVER or UNDER the page named.
                  Tape them down. On a phone, send the PDF to your email and print from a computer, or print straight from the
                  share menu.
                </p>
              </details>
            )}
          </div>
          <div className="print-sheet">
            {/* On a phone the pages fold behind one line (Cat applied P3, 2026-10-24), so Print is a shorter scroll. */}
            {!wide && !tablet && (projector || paper === 'a0') && (
              <button type="button" className="later go see-pages" aria-expanded={seePages} onClick={() => setSeePages(!seePages)}>
                {seePages ? 'Hide the pages' : projector || pages === 1 ? 'See the page' : 'See the pages'} <span aria-hidden="true">{seePages ? '‹' : '›'}</span>
              </button>
            )}
            {showPages && (
              <div className="preview tiles" style={{ ['--cols' as string]: grid.cols }}>
                <PatternPreview sheet={sheet} label={projector ? 'Pattern on one page for a projector' : `Pattern laid over ${pages} numbered print pages`} />
                {!projector && <TileOverlay sheet={sheet} paper={paper} />}
                <DemoButton demo="print" />
              </div>
            )}
            {/* Said only when a check found something: a line that everything passed was reassurance (copy review, Nov 14). */}
            {!imported && passed < checks.length && (
              <p className="muted small">
                {checks.length - passed} of {checks.length} seam checks found something to look at. The details are under Seam check in the instructions booklet.
              </p>
            )}
          </div>
          <div className="print-more">
            {/* Every extra tool in one fold at the foot of Print (Cat picked A, Nov 28). Most sewists never need them, so
                they stay in reach without a page of their own, and Next: Cut and sew stays the last thing on Print. */}
            {(onMode || mode === 'all') && (
              <MoreTools onOpen={() => mode !== 'all' && onMode?.('all')}>
                {can('byHand') && !imported && (
                  <ToolTick name="Draft it by hand" what="Pages to draw it yourself on pattern paper, point by point" checked={!!finish.byHand} onChange={(on) => onFinish({ ...finish, byHand: on })} />
                )}
                {can('makerPack') && (
                  <ToolRow name="Dressmaker's pack" what={made?.flat && can('techFlat') ? 'Technical flat, tech pack, DXF and SVG files' : 'Tech pack, DXF and SVG files'}>
                    {/* The technical flat leads the pack (Cat, Nov 28: one row, not two): it is for a dressmaker, and goes
                        on the instructions' cover too. */}
                    {made?.flat && can('techFlat') && (
                      <section className="card" aria-labelledby="flattitle">
                        <p className="eyebrow">Technical flat</p>
                        <h2 id="flattitle">{title}</h2>
                        <TechFlatView flat={made.flat} title={title} />
                        <p className="muted small">
                          Drawn to scale from your pattern{garment === 'tee' ? '' : ', with the darts sewn'}. It goes on the cover of the instructions, for a dressmaker
                          or anyone checking the design.
                        </p>
                      </section>
                    )}
                    {makerPack}
                  </ToolRow>
                )}
                {values && draftAt && can('sizeRun') && (
                  <ToolRow name="Size run" what="Grade this pattern up and down">
                    <SizeRun garment={garment} values={values} draftAt={draftAt} title={title} fileBase={fileBase} width={finish.fabricWidth} nap={nap} download={download} />
                    <InterestCard offer="sizerun" pattern={title} />
                  </ToolRow>
                )}
              </MoreTools>
            )}
          </div>
        </section>
      </div>

      {/* On to the Sew chapter, which opens on cutting (Cat, Nov 28). An outline, since Download pattern is this page's
          one fill (clarity review B1, Nov 22). */}
      {onNextSew && (
        <button type="button" className={`${got ? 'primary' : 'secondary'} chapter-next`} onClick={onNextSew}>
          Next: Cut and sew <span aria-hidden="true">›</span>
        </button>
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
        {/* An outline: Download pattern is the screen's one filled button (clarity review B1, Nov 22). */}
        <button type="button" className="secondary" onClick={send} disabled={!ready}>
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
          <span className="eyebrow">Having it made, or drafting by hand <TestingTag tool="pro_files" /></span>
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

/** The PDF as base64, a piece at a time so a long pattern doesn't overflow the call. */
function toBase64(bytes: Uint8Array) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/**
 * "Email me the files" (journey review, Nov 10; was "Email me the PDF" until the instructions became their own file, Nov 15): on every phone, tablet and computer. On a
 * computer it stands in for the share menu, which some computer browsers don't have. The address is used only to send this email.
 */
function EmailPdf({ who, ready, fileName, booklet, bookletName, title, onSent, checked }: { who: { signedIn?: string; testerCode?: string }; ready: Uint8Array | null; fileName: string; booklet: Uint8Array | null; bookletName: string; title: string; onSent: () => void; checked: (go: () => void) => () => void }) {
  const [open, setOpen] = useState(false);
  const [typed, setTo] = useState('');
  // Signed in, it goes to the account's own email, which the server checks again; a tester types any address.
  const to = who.signedIn ?? typed;
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'limit' | 'off' | 'big' | 'refused' | 'failed'>('idle');
  const [sentTo, setSentTo] = useState('');
  // The latest onSent when the send comes back, not the one from when it started, so nothing changed meanwhile is lost.
  const sentNow = useRef(onSent);
  sentNow.current = onSent;
  if (!open)
    return (
      <button type="button" className="way" onClick={() => setOpen(true)} disabled={!ready}>
        Email me the files
      </button>
    );
  const send = async () => {
    if (!ready) return;
    setState('sending');
    try {
      const token = who.signedIn ? await (await cloud()).token() : null;
      const res = await fetch('/.netlify/functions/email-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : testerHeaders(who.testerCode)) },
        body: JSON.stringify({ to: to.trim(), title: title.slice(0, 200), fileName, pdf: toBase64(ready), ...(booklet ? { bookletName, booklet: toBase64(booklet) } : {}) }),
      });
      if (res.ok) {
        setSentTo(to.trim());
        setState('sent');
        sentNow.current();
      } else setState(res.status === 429 ? 'limit' : res.status === 503 ? 'off' : res.status === 403 ? 'refused' : res.status === 413 ? 'big' : 'failed');
    } catch {
      setState('failed');
    }
  };
  return (
    <form
      className="stack email-pdf"
      onSubmit={(e) => {
        e.preventDefault();
        checked(() => void send())();
      }}
    >
      {who.signedIn ? (
        <p className="small">To {who.signedIn}, the email you signed in with.</p>
      ) : (
        <label className="field">
          <span>Your email</span>
          <input type="email" required value={typed} onChange={(e) => setTo(e.target.value)} autoComplete="email" inputMode="email" />
        </label>
      )}
      {/* An outline, like every button but Download pattern on this screen (clarity review B1, Nov 22). */}
      <button type="submit" className="secondary" disabled={!ready || state === 'sending' || !to.trim()}>
        {state === 'sending' ? 'Sending…' : 'Send'}
      </button>
      {state === 'sent' ? (
        <p className="msg small" role="status">
          Sent to {sentTo}. It should arrive in a minute, from hello@maisontrace.co. Not there? Check spam.
        </p>
      ) : state === 'limit' ? (
        <p className="msg small" role="status">
          That's as many emails as we can send today. Download the PDF instead, or try again tomorrow.
        </p>
      ) : state === 'off' || state === 'big' ? (
        <p className="msg small" role="status">
          {state === 'off' ? "Emailing isn't working just now." : 'This PDF is too big to email.'} Download the PDF instead.
        </p>
      ) : state === 'refused' ? (
        <p className="msg small" role="status">
          {who.signedIn ? 'Your sign-in has run out. Sign in again from Account, then send it.' : 'Your fit tester code didn\'t go through. Check it under Account, or download the PDF instead.'}
        </p>
      ) : state === 'failed' ? (
        <p className="msg small" role="status">
          It didn't send. Check the address, or download the PDF instead.
        </p>
      ) : (
        <p className="small muted">We use it only to send the pattern and its instructions.</p>
      )}
    </form>
  );
}
