import { useEffect, useMemo, useState } from 'react';
import { ARCHIVE, ArchiveCut, accession, canMake } from '../archive';
import { COLLECTION, HouseLook, SEASON, lookFlat, lookValues } from '../collection';
import { NEXT_DROP, clock, dropLook, dropNo, dropState, editionLabel } from '../drops';
import type { MeasurementValues } from '../measurements';
import { describePattern } from './describe';
import { Envelope } from '../ui/Envelope';
import { InterestCard } from '../ui/InterestCard';
import { TechFlatView } from '../ui/TechFlatView';
import { GarmentFabric } from '../ui/FabricFill';
import { lookFabric } from '../collection';
import { TestingTag } from '../ui/TestingTag';

interface Props {
  values: MeasurementValues;
  onMake: (look: HouseLook) => void;
  onBack: () => void;
}

type Shelf = 'house' | 'archive';

const lookNo = (n: number) => `Look ${String(n).padStart(2, '0')}`;

/** The time now, ticking each second while a drop clock is on screen. */
function useNow(ticking: boolean): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!ticking) return;
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, [ticking]);
  return now;
}

function Flat({ look, values }: { look: HouseLook; values: MeasurementValues }) {
  const flat = useMemo(() => lookFlat(look, lookValues(look, values).values), [look, values]);
  return flat ? <GarmentFabric fabric={lookFabric(look.fabric)}><TechFlatView flat={flat} title={describePattern(look.choices).toLowerCase()} /></GarmentFabric> : <p className="muted small">This look can&rsquo;t be drafted to these measurements.</p>;
}

/**
 * The next numbered drop, first in the collection under a gold strip. Before a piece and a date are set
 * it is a sign-up for the drop alert; once live, it is made like any look and each copy is numbered.
 */
function DropSlot({ values, onMake }: Pick<Props, 'values' | 'onMake'>) {
  const drop = NEXT_DROP;
  const look = dropLook(drop);
  const announced = dropState(drop, new Date()).kind === 'announced';
  const state = dropState(drop, useNow(!announced));
  const strip =
    state.kind === 'live' ? `${clock(state.left)} left` : state.kind === 'opens' ? `Opens in ${clock(state.in)}` : state.kind === 'closed' ? 'Closed' : 'Date soon';
  return (
    <section className="drop-slot" aria-labelledby="drop-title">
      <p className="drop-strip">
        <span>
          {dropNo(drop)}
          {state.kind === 'live' ? ' · Live' : ''}
        </span>
        <span>{strip}</span>
      </p>
      {look && state.kind !== 'announced' ? (
        <div className="house-look">
          <p className="eyebrow">
            {drop.editions} numbered copies{drop.designer ? ` · ${drop.designer}${drop.city ? `, ${drop.city}` : ''}` : ''}
          </p>
          <div className="house-flat">
            <Flat look={look} values={values} />
          </div>
          <h2 id="drop-title">{look.name}</h2>
          <p className="muted">{look.line}</p>
          {state.kind === 'live' && (
            <button type="button" className="secondary" onClick={() => onMake(look)}>
              Make this look
            </button>
          )}
        </div>
      ) : (
        <>
          <h2 id="drop-title" className="visually-hidden">
            {dropNo(drop)}
          </h2>
          <InterestCard offer="drops" inset />
        </>
      )}
      <div className="edition-sample" aria-label="How the edition number is printed">
        <p className="eyebrow">On every pattern piece</p>
        <dl className="title-block">
          <div>
            <dt>Piece</dt>
            <dd>Front · cut 1 on fold</dd>
          </div>
          <div className="ed">
            <dt>Edition</dt>
            <dd>{editionLabel(drop, 127)}</dd>
          </div>
          <div>
            <dt>Drafted for</dt>
            <dd>You</dd>
          </div>
          <div>
            <dt>Drop</dt>
            <dd>{String(drop.number).padStart(2, '0')}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

/** An Archive cut as a catalogue record: number, year, where it's from and who it's credited to. */
function Record({ cut, values, onMake }: { cut: ArchiveCut; values: MeasurementValues; onMake: Props['onMake'] }) {
  const open = canMake(cut);
  const flat = useMemo(() => lookFlat(cut, lookValues(cut, values).values), [cut, values]);
  return (
    <li className="archive-record">
      <Envelope name={cut.name} flat={flat} foot={String(cut.year)} />
      <div className="record-body">
        <p className="accession">{accession(cut)}</p>
        <h2>{cut.name}</h2>
        <dl>
          <div>
            <dt>Year</dt>
            <dd>{cut.year}</dd>
          </div>
          <div>
            <dt>From</dt>
            <dd>{cut.origin}</dd>
          </div>
          <div>
            <dt>Source</dt>
            <dd>{cut.source ?? 'To be announced'}</dd>
          </div>
        </dl>
        <p className="muted small">{cut.line}</p>
        {open ? (
          <>
            <p className="credit">{cut.credit}</p>
            <button type="button" className="secondary" onClick={() => onMake(cut)}>
              Make this cut
            </button>
          </>
        ) : (
          <p className="muted small">Preview. Opens when its source is licensed.</p>
        )}
      </div>
    </li>
  );
}

/** The Maison collection, laid out like a lookbook: each house look drawn flat to the sewist's measurements. */
export function CollectionScreen({ values, onMake, onBack }: Props) {
  const [shelf, setShelf] = useState<Shelf>('house');
  const looks = useMemo(
    () =>
      COLLECTION.map((look) => {
        const at = lookValues(look, values);
        return { look, own: at.own, flat: lookFlat(look, at.values) };
      }),
    [values],
  );
  const sample = (shelf === 'house' ? COLLECTION : ARCHIVE).some((l) => !lookValues(l, values).own);

  return (
    <div className="collection">
      <header className="collection-head">
        <p className="eyebrow">Maison Tracé <TestingTag tool="collection" /></p>
        <h1 id="ctitle">The collection</h1>
        {shelf === 'house' && <p className="season-name">{SEASON.code} · {SEASON.name}</p>}
        <p className="muted">
          {shelf === 'house'
            ? 'This season\u2019s house looks, in its colours, each drafted to your measurements. Make one, then change any detail you like.'
            : 'Last season\u2019s house looks, and cuts from fashion history credited to the museum, dealer or pattern cutter they come from, all drafted to you.'}
        </p>
        {sample && <p className="muted small">Looks you haven&rsquo;t measured for yet are drawn to sample measurements.</p>}
        <div className="seg shelves" role="group" aria-label="Collection">
          {(['house', 'archive'] as const).map((s) => (
            <button key={s} type="button" aria-pressed={shelf === s} className={shelf === s ? 'on' : undefined} onClick={() => setShelf(s)}>
              {s === 'house' ? 'House' : 'Archive'}
            </button>
          ))}
        </div>
        <button type="button" className="link" onClick={onBack}>
          Back to styling
        </button>
      </header>
      {shelf === 'house' ? (
        <>
          <DropSlot values={values} onMake={onMake} />
          <ol className="lookbook" aria-labelledby="ctitle">
            {looks.map(({ look, flat }) => (
              <li key={look.id} className="house-look">
                <p className="eyebrow">{lookNo(look.number)}</p>
                <div className="house-flat">{flat ? <GarmentFabric fabric={lookFabric(look.fabric)}><TechFlatView flat={flat} title={describePattern(look.choices).toLowerCase()} /></GarmentFabric> : <p className="muted small">This look can&rsquo;t be drafted to these measurements.</p>}</div>
                <h2>{look.name}</h2>
                <p className="muted">{look.line}</p>
                <p className="muted small">Cut in {look.fabric[0].toLowerCase() + look.fabric.slice(1)}.</p>
                <button type="button" className="secondary" onClick={() => onMake(look)}>
                  Make this look
                </button>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <>
          <ol className="archive" aria-label="The Archive">
            {ARCHIVE.map((cut) => (
              <Record key={cut.id} cut={cut} values={values} onMake={onMake} />
            ))}
          </ol>
          {ARCHIVE.some((c) => !canMake(c)) && <InterestCard offer="archive" />}
        </>
      )}
    </div>
  );
}
