import { useId, type ReactNode } from 'react';
import { DropMenu } from '../ui/DropMenu';
import { FABRIC_WIDTHS, type FabricWidth, Lay, layAmount, layWords } from '../engine/layplan';
import { LayPlanView } from '../ui/LayPlanView';
import { CLOTHS, seamFinish } from '../engine/couture';
import { inCm } from '../units';
import { FIBRES, Fibre, MyFabric, FabricStyle, adviceFor, checkFabric, clothFor, pickTag, printRepeat } from '../engine/fabrics';
import { colourWords } from '../engine/houseColours';
import { SPECIALS, Special, needsNap } from '../engine/specialFabrics';
import { printNap, printOf } from '../engine/prints';
import { InterestCard } from '../ui/InterestCard';
import { Mode, shows, type ProTool } from '../mode';
import { TintFilter, clothTint, flatId } from '../ui/FabricFill';
import { buyAmount, buyLink, shopFabric, shopPrice, type ShopFabric } from '../engine/shopFabrics';
import { LabelCard } from '../ui/LabelCard';
import { DemoButton } from '../ui/DemoButton';
import { isKnit, isLowerBody } from '../measurements';
import type { Garment } from '../measurements';
import type { Finish } from '../savedWork';
import type { Fitting } from '../engine/fitting';
import { ExtrasSignup } from '../ui/ExtrasSignup';
import type { Printable } from './ExportScreen';

// Cut it, the first page of the Sew chapter (Cat, Nov 28: "Doesn't the cut step make more sense for the sew chapter?").
// Print is the paper pattern; Sew is the fabric, its layout, what you'll need, a toile, then the steps. Everything here
// was Print's Cut it and moved as it was.

export interface CutProps {
  made?: Printable;
  title: string;
  garment: Garment;
  finish: Finish;
  onFinish: (f: Finish) => void;
  style: FabricStyle;
  onEditFabric?: () => void;
  onKeep?: () => void;
  tester?: boolean;
  imported?: boolean;
  mode?: Mode;
  fitting?: Fitting;
  fittingNotes?: string[];
  onFitting?: () => void;
  onTrueScale?: () => void;
  label?: { name: string; code?: string };
  /** Next: Sew it; none for a pattern read from a file, which has no Sew chapter of its own. */
  onNext?: () => void;
  /** Shown above the heading, such as the way back to the chapter before. */
  head?: ReactNode;
}

export function CutPart({ made, title, garment, finish, onFinish, style, onEditFabric, onKeep, tester, imported, mode = 'all', fitting, fittingNotes = [], onFitting, onTrueScale, label, onNext, head }: CutProps) {
  const can = (t: ProTool) => shows(mode, t);
  const knit = isKnit(garment);
  const guide = made?.guide;
  const lays = made?.lays ?? [];
  const special = finish.fabric?.special;
  const print = printOf(finish.fabric);
  const napFixed = needsNap(special) || printNap(print);
  const nap = finish.nap || napFixed;
  return (
    <>
      {head}
      <div className="chapter-head">
        {/* A page of its own on Sew; under Print's own heading for a pattern read from a file, so one level down there. */}
        {imported ? <h2 id="cuttitle">Cut it</h2> : <h1 id="cuttitle">Cut it</h1>}
      </div>

      {!imported && (
        <YourFabric
          fabric={finish.fabric ?? {}}
          style={style}
          metres={lays.find((l) => l.fabric !== 'lining' && l.fabric !== 'interlining' && !l.hide)?.metres}
          onChange={onEditFabric}
          calico={tester ? guide?.fabric?.find((l) => l.startsWith('Sewing in muslin')) : undefined}
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
                {/* Its purpose in plain words: "nap" alone meant nothing to Cat (Nov 21). */}
                Pile or one-way print{' '}
                <span className="muted small">
                  {napFixed
                    ? `Always on for ${needsNap(special) ? SPECIALS[special!].label.toLowerCase() : print === 'motif' ? 'placed motifs' : 'a one-way print'}: every piece is laid the same way up.`
                    : 'Tick it if your fabric has a pile, like velvet or corduroy, or a print that points one way. Every piece is then laid the same way up, so it takes a little more fabric.'}
                </span>
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
                  size={lays.length > 1}
                  cloth={lay.fabric === 'self' ? (flatId(finish.fabric) ?? 'default') : lay.fabric === 'lining' ? 'silk' : 'cotton'}
                  tint={lay.fabric === 'self' ? clothTint(finish.fabric, 'tile') : undefined}
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

      {/* What to have ready before cutting: the fabric notes, the notions and, with all the tools, Quick or Couture,
          which changes both. It was folded under Every step as a list, now on Sew (Cat, Nov 28). */}
      {guide && (
        <section className="card need-card" aria-labelledby="needtitle">
          <h2 id="needtitle">What you'll need</h2>
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
          <div className="notions">
            {guide.fabric?.length ? (
              <>
                <p className="eyebrow">Your fabric</p>
                <ul>
                  {/* In the sewist's words, as the steps are: "about 150 C" had no degree sign here (EM walk, Nov 28). */}
                  {guide.fabric.map((n) => (
                    <li key={n}>{inCm(n)}</li>
                  ))}
                </ul>
              </>
            ) : null}
            {/* Under the fabric lines, a label of their own, so the zip and thread don't read as more fabric. */}
            {guide.fabric?.length ? <p className="eyebrow">Notions</p> : null}
            <ul>
              {guide.notions.map((n) => (
                <li key={n}>{inCm(n)}</li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* The toile shows in the simple view too (measuring accuracy, 2026-10-21): a calico try-on fixes what a tape at
          home can't, so a first-time sewist is offered it before cutting good fabric. */}
      {/* Not for a fit tester, who sews the pattern as drafted and reports on the tester form: redrawn first, the pattern
          and its code no longer match what was tested (pretend tester DV walk, Nov 21; Cat: hide it for testers). */}
      {!imported && !tester && (
        <section className="card" aria-labelledby="toiletitle">
          {/* Under Sew it, "Before you cut your fabric" went (declutter, Nov 21); a corrected version still says which. */}
          {fittingNotes.length > 0 && fitting && <p className="eyebrow">Version {fitting.round + 1}</p>}
          <h2 id="toiletitle">{knit ? 'Try it in a spare knit first' : fittingNotes.length ? 'Corrected after your toile' : 'Sew a toile first'}</h2>
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
              Sew it in cheap fabric first (a toile, or muslin) and try it on. Tick what you see, such as {isLowerBody(garment) ? 'pulling across the hips or folds below the back waist' : 'pulling at the bust or a gaping neckline'}, and your
              pattern is redrawn to fix it.
            </p>
          )}
          <div className="row wrap">
            {!knit && (
              <button type="button" className="secondary" onClick={onFitting}>
                {fittingNotes.length ? 'Fit another toile' : 'I’ve tried on my toile'}
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

      {onNext && (
        <button type="button" className="primary chapter-next" onClick={onNext}>
          Next: Sew it <span aria-hidden="true">›</span>
        </button>
      )}
      {/* Everything to buy or sign up for, folded at the very end so nothing comes between printing and sewing. */}
      {!imported && (
        <details className="card extras">
          <summary>
            <span className="extras-title">Extras for this pattern</span>
            <span className="muted small">Printed and posted roll, fabric and notions kit, {label ? 'your label and woven labels' : 'woven labels'}{hasFabric(finish.fabric) ? '' : ', deadstock cloth'}</span>
          </summary>
          <ExtrasSignup offers={['printed', 'kit', ...(label ? (['labels'] as const) : []), ...(hasFabric(finish.fabric) ? [] : (['deadstock'] as const))]} pattern={title}>
            {/* One holder, so on a computer the extras sit side by side as cards (clarity review C5, Nov 22). */}
            <div className="extras-cards">
              <div className="split">
                <InterestCard offer="printed" pattern={title} />
                <InterestCard offer="kit" pattern={title} />
              </div>
              {label && <LabelCard name={label.name} code={label.code} pattern={title} onKeep={onKeep} />}
              {!hasFabric(finish.fabric) && <Deadstock style={style} lays={lays} title={title} />}
            </div>
          </ExtrasSignup>
        </details>
      )}
    </>
  );
}

const fabricPhoto = (id?: Fibre | Special) => `${import.meta.env.BASE_URL}fabrics/${id ?? 'default'}.jpg`;

/** A close-up of the chosen cloth, with its name and how it handles. */
function FabricStage({ fabric }: { fabric: MyFabric }) {
  const id = fabric.special ?? fabric.fibre;
  const label = fabric.special ? SPECIALS[fabric.special].label : fabric.fibre ? FIBRES[fabric.fibre].label : undefined;
  const handle = [fabric.weight && `${fabric.weight} weight`, fabric.drape && `${fabric.drape} drape`].filter(Boolean).join(', ');
  // In the colour picked, so the close-up is the cloth named over it.
  const tint = clothTint(fabric, 'close-up');
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <figure className="fabstage">
      {tint && (
      <svg className="fabric-defs" aria-hidden="true" focusable="false">
        <defs>
          <TintFilter id={`stage${uid}`} table={tint} />
        </defs>
      </svg>
      )}
      <img src={fabricPhoto(id)} alt={label ? `${label} close up` : ''} style={tint ? { filter: `url(#stage${uid})` } : undefined} />
      <figcaption>
      <span className="fabname">{label ?? 'No fabric chosen'}</span>
      <span className="muted small">{label ? (handle ? handle[0].toUpperCase() + handle.slice(1) : 'Set the weight and drape under Fabric in Style.') : 'Choose one under Fabric in Style.'}</span>
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
  // A shop whose listed price isn't a yard's (shopCatalogue.ts) has no cost here: its page shows it.
  const cost = shopPrice(shop, colour) ? `about $${Math.ceil(qty * shopPrice(shop, colour))} ${shop.currency}` : 'price on its page';
  if (!link) return <p className="muted small">You need {amount}, {cost}.</p>;
  return (
    <>
      <a className="buylink" href={link.href} target="_blank" rel="noopener noreferrer">
      Buy {unit === 'yd' ? `${qty} yd` : `${qty} m`} at {shop.shop}
      </a>
      <p className="muted small">
      {link.inCart ? `${amount} goes straight into the cart` : `Add ${amount} on ${shop.shop}'s page`}, {cost}. We may earn a commission when you buy.
      </p>
    </>
  );
}

/** The fabric, as chosen on the style screen's Fabric tab (one place to choose it, Cat 2026-10-18): what it
 * is, whether it suits the style, where to buy it, and the way back to change it. */
function YourFabric({ fabric, style, metres, onChange, calico }: { fabric: MyFabric; style: FabricStyle; metres?: number; onChange?: () => void; calico?: string }) {
  // Testers sew in calico, and the screen headlined only the look's own cloth, with its care ("Do not wash it"): the
  // calico advice was in the booklet alone (pretend tester DV walk, Nov 21; Cat: add it for testers).
  const forTest = calico && (
    <p className="small fabnote tester-calico">
      <b>For your fit test </b>
      {calico}
    </p>
  );
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
        {forTest}
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
        {name ? `${name}${metres !== undefined ? `, ${metres} m` : ''}` : 'Not chosen yet'}
      </h2>
      {forTest}
      <FabricStage fabric={fabric} />
      {shop && (
        <div className="shopbuy">
          <p className="small">
            <b>{shop.name}</b>
            {fabric.colour ? `, ${colourWords(fabric.colour) ?? fabric.colour}` : ''}{' '}
            <span className="muted">
              from {shop.shop}
              {shopPrice(shop, fabric.colour) ? `, $${shopPrice(shop, fabric.colour)}/${shop.yards ? 'yd' : 'm'}` : ''}
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
        {name ? 'Chosen under Fabric in Style. It sets the cutting layout below and goes on the PDF.' : 'Choose it under Fabric in Style to see the style in it. It goes on the PDF.'}
      </p>
      {onChange && (
        <button type="button" className="later go" onClick={onChange}>
          {name ? 'Change fabric' : 'Choose fabric'} <span aria-hidden="true">›</span>
        </button>
      )}
    </section>
  );
}

/** The fabric's name in a few words: its own name, else the cloth, with the colour in words. A house colour is stored
 *  as its swatch's code, and "Sheer, #9CC3E6" showed on the Print screen (pretend tester DM walk, Nov 19). */
function fabricName(f: MyFabric): string | undefined {
  const cloth = f.name || (f.special ? SPECIALS[f.special].label : f.fibre ? FIBRES[f.fibre].label : undefined);
  const colour = colourWords(f.colour) ?? f.colour;
  return cloth && (colour && !f.name ? `${cloth}, ${colour}` : cloth);
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
              {cloth.name}, <span className="muted">{pickTag(cloth).toLowerCase()}</span>
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
